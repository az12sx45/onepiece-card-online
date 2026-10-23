extends Control
## Original map data, persistent hit targets, viewport-limited image requests.
## This component does not replace the original island/service controllers.
signal command_requested(type: String, payload: Dictionary)
const Routes = preload("res://native_map_routes.gd")
var cache: Node
var model: Dictionary = {}
var world := Control.new()
var background := TextureRect.new()
var surroundings := TextureRect.new()
const SURROUNDINGS_ASSET="images/board/backgrounds/board_bg_start.webp"
var routes := Routes.new()
var entries: Dictionary = {}
var marker_nodes: Dictionary={}
var zoom := 0.45
var min_zoom:=0.1
var max_zoom:=3.0
var offset := Vector2.ZERO
var initialized_camera := false
var active_pointer := -1
var pointer_start := Vector2.ZERO
var moved := false
var pending_command: Dictionary = {}
var touches: Dictionary = {}
var pinch_distance := 0.0
var pinch_center := Vector2.ZERO
var model_writes := 0
var texture_writes := 0
var signature := ""
var sailing: Dictionary = {}
var movement_active := false
var sailing_cull_elapsed := 0.0
var source_camera_tween: Tween
var postgame_effect: Node
var effect_hidden_ships: Dictionary={}
func set_ship_effect_hidden(id: String,value: bool) -> void:
	if value:effect_hidden_ships[id]=true
	else:effect_hidden_ships.erase(id)
	var key: String="ship:"+id
	if entries.has(key):
		var source_hidden:=false
		for ship in model.get("ships",[]):if str(ship.id)==id:source_hidden=ship.hidden;break
		entries[key].button.visible=not value and not source_hidden
		_camera_changed()
func set_world_reveal(active: bool) -> void:postgame_effect.set_active(active)
func camera_geometry_json(key: String) -> String:
	if not entries.has(key):return "null"
	var entry: Dictionary=entries[key]
	if not str(entry.path).is_empty() and entry.picture.texture==null:
		var texture: Texture2D=cache.request(entry.path)
		if texture==null:return "null"
		_assign_picture(entry,texture)
	var button:=Rect2(entry.button.position,entry.button.size)
	var art:=Rect2(entry.button.position+entry.picture.position,entry.picture.size)
	return JSON.stringify({"button":[button.position.x,button.position.y,button.size.x,button.size.y],"art":[art.position.x,art.position.y,art.size.x,art.size.y],"hasArt":not str(entry.path).is_empty()})
func camera_view_json() -> String:
	var factor:=preload("res://native_screen_metrics.gd").css_factor(get_viewport())
	return JSON.stringify({"factor":factor,"width":size.x*factor,"height":size.y*factor,"scale":zoom*factor,"x":offset.x*factor,"y":offset.y*factor,"minScale":min_zoom*factor,"maxScale":max_zoom*factor})
func set_camera_limits(minimum: float,maximum: float) -> void:min_zoom=minimum;max_zoom=maximum
func test_markers_json() -> String:
	var result: Array=[]
	for node in marker_nodes.values():
		var anchor: Vector2=node.position+node.size*Vector2(.5,1.05)
		result.append({"title":node.tooltip_text,"label":node.label.text,"left":anchor.x,"top":anchor.y,"color":"#"+node.color.to_html(false)})
	return JSON.stringify(result)
func test_inspect_point_json(type: String,id: String) -> String:
	var key: String=("island:" if type=="inspect-island" else "tile:")+id
	if not entries.has(key):return "null"
	var entry: Dictionary=entries[key];var rect:=Rect2(entry.button.position,entry.button.size)
	for ry in [.1,.3,.5,.7,.9]:
		for rx in [.1,.3,.5,.7,.9]:
			var local:=rect.position+rect.size*Vector2(rx,ry);var point:=local*zoom+offset;var found:=_pick(point)
			if found.get("type","")==type and found.get("payload",{}).values().has(id) and Rect2(Vector2.ZERO,size).has_point(point):return JSON.stringify([point.x,point.y])
	return "null"

func apply_source_camera_json(value: String) -> void:
	var target: Dictionary=JSON.parse_string(value)
	if source_camera_tween:source_camera_tween.kill()
	var from_offset:=offset;var from_zoom:=zoom;var to_offset:=Vector2(target.x,target.y);var to_zoom: float=target.scale;initialized_camera=true
	if target.immediate:offset=to_offset;zoom=to_zoom;_camera_changed();return
	source_camera_tween=create_tween()
	source_camera_tween.tween_method(func(progress: float):
		var eased:=preload("res://native_evolution_motion.gd")._ease(progress,[.25,.1,.25,1]);offset=from_offset.lerp(to_offset,eased);zoom=lerpf(from_zoom,to_zoom,eased);_camera_changed()
	,0.0,1.0,.22)

func _ready() -> void:
	add_child(preload("res://native_map_tile_clock.gd").new())
	clip_contents = true
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	mouse_filter = Control.MOUSE_FILTER_STOP
	surroundings.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	surroundings.mouse_filter=Control.MOUSE_FILTER_IGNORE
	surroundings.material=ShaderMaterial.new()
	surroundings.material.shader=preload("res://native_map_surroundings.gdshader")
	add_child(surroundings)
	add_child(world)
	world.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_SCALE
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world.add_child(background)
	routes.z_index = 1
	world.add_child(routes)
	postgame_effect=preload("res://native_postgame_map_effect.gd").new();postgame_effect.map=self;add_child(postgame_effect)
	cache.asset_ready.connect(_asset_ready)
	resized.connect(_camera_changed)
	set_process(false)

func sailing_position_json(id: String) -> String:
	if not sailing.has(id):return "null"
	var point:=_sailing_position(sailing[id])
	return JSON.stringify({"x":point.x,"y":point.y})

func _sailing_position(motion: Dictionary) -> Vector2:
	var progress:=clampf((Time.get_ticks_msec()-float(motion.startedAt))/float(motion.duration),0,1)
	return Vector2(motion.from.x,motion.from.y).lerp(Vector2(motion.to.x,motion.to.y),progress)

func start_sailing_json(value: String) -> void:
	var motion: Dictionary=JSON.parse_string(value)
	sailing[str(motion.playerId)]=motion
	set_process(true)

func stop_sailing(id: String) -> void:
	if sailing.has(id):
		var key: String="ship:"+id
		if entries.has(key):entries[key].button.position=Vector2(sailing[id].to.x,sailing[id].to.y)-entries[key].button.size/2.0
		sailing.erase(id)
	if sailing.is_empty():set_process(false)

func reset_sailing() -> void:
	sailing.clear();set_process(false)

func _process(delta: float) -> void:
	var camera_moved:=false
	for id in sailing.keys():
		var motion: Dictionary=sailing[id]
		var key: String="ship:"+id
		if not entries.has(key):continue
		var point:=_sailing_position(motion)
		entries[key].button.position=point-entries[key].button.size/2.0
		if motion.follow:
			offset=size/2.0-(point-Vector2(motion.offset.x,motion.offset.y))*zoom
			camera_moved=true
		if Time.get_ticks_msec()-float(motion.startedAt)>=float(motion.duration):sailing.erase(id)
	if camera_moved:
		_clamp_camera();world.position=offset
	# Ship/camera transforms update every frame; offscreen image selection runs at
	# most ten times per second and never rebuilds the static map controls.
	sailing_cull_elapsed+=delta
	if sailing_cull_elapsed>=0.1:
		sailing_cull_elapsed=0;_camera_changed()
	if sailing.is_empty():_camera_changed();set_process(false)

func apply_model(value: Dictionary) -> void:
	var next := JSON.stringify(value)
	if next == signature: return
	signature = next
	model = value
	model_writes += 1
	if surroundings.texture==null:surroundings.texture=cache.request(SURROUNDINGS_ASSET)
	world.size = Vector2(value.width,value.height)
	background.size = world.size
	# Use existing lossless full-resolution composition only for its exact layout.
	# The original source artwork remains available for every custom layout.
	var fixed: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://map-static-layout.json"))
	var use_fixed: bool = value.width == fixed.width and value.height == fixed.height and JSON.stringify(value.decorations) == JSON.stringify(fixed.decorations)
	var background_path: String = "mobile/art-ui/"+str(fixed.asset) if use_fixed else "images/board/backgrounds/board_bg_map_main.webp"
	background.set_meta("wanted_asset",background_path)
	var texture: Texture2D = cache.request(background_path)
	if texture != null and background.texture != texture: background.texture=texture;texture_writes+=1
	routes.apply(value.edges)
	var marker_keep: Dictionary={}
	for marker in value.markers:
		var key: String=str(marker.id);marker_keep[key]=true
		if not marker_nodes.has(key):var node=preload("res://native_map_marker.gd").new();world.add_child(node);marker_nodes[key]=node
		marker_nodes[key].present(marker)
	for key in marker_nodes.keys():
		if not marker_keep.has(key):marker_nodes[key].queue_free();marker_nodes.erase(key)
	var keep: Dictionary = {}
	if not use_fixed:
		for index in range(value.decorations.size()):
			var decoration: Dictionary=value.decorations[index]
			var key := "decoration:"+str(index)
			keep[key]=true
			_update_picture(key,decoration,Vector2.ONE*float(decoration.size),Vector2.ZERO,0,{})
	for tile in value.tiles:
		var key := "tile:"+str(tile.id)
		keep[key]=true
		var entry := _entry(key)
		var button: Button=entry.button
		button.flat=false
		button.position=Vector2(tile.x,tile.y)-Vector2(24,24)
		button.size=Vector2(48,48)
		button.tooltip_text="偵查型被動：黑色遭遇格" if tile.scout else ""
		preload("res://native_map_tile.gd").apply(entry,tile)
		entry.command={"type":"choose-route","payload":{"routeId":tile.routeChoiceId}} if not str(tile.routeChoiceId).is_empty() else {"type":"inspect-sea","payload":{"tileId":tile.id}}
	for island in value.islands:
		var key := "island:"+str(island.id)
		keep[key]=true
		var image_width := 140.0 if island.kind == "unknown" else 148.0
		# Android's shared !important minimum is 48; the 120px visual plus
		# 2px top padding and two borders determine the actual 124px height.
		var height := 124.0
		if island.kind in ["start","reverse-mountain"]:height=122.0
		elif island.kind == "yonko":height=124.0
		var picture: Dictionary=island.duplicate()
		picture.source=island.images[0].source if not island.images.is_empty() else ""
		picture.image_width=image_width
		picture.image_top=-60.0 if island.kind == "unknown" else -height/2.0+(7.0 if height == 122.0 else 9.0)
		_update_picture(key,picture,Vector2(158,height),Vector2.ZERO,3,{"type":"inspect-island","payload":{"islandId":island.id}})
	for ship in value.ships:
		keep["ship:"+str(ship.id)]=true
		_present_ship(ship)
	for key in entries.keys():
		if keep.has(key):continue
		entries[key].button.queue_free()
		entries.erase(key)
	if not initialized_camera:
		initialized_camera=true
		var focus := Vector2(value.width,value.height)/2.0
		for ship in value.ships:
			if ship.current:focus=Vector2(ship.x,ship.y);break
		offset=size/2.0-focus*zoom
	_camera_changed()

func _entry(key: String) -> Dictionary:
	if entries.has(key):return entries[key]
	var button := Button.new()
	button.flat=true
	button.mouse_filter=Control.MOUSE_FILTER_IGNORE
	world.add_child(button)
	var picture := TextureRect.new()
	picture.mouse_filter=Control.MOUSE_FILTER_IGNORE
	picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	button.add_child(picture)
	var entry := {"button":button,"picture":picture,"path":"","current_path":"","command":{},"image_width":0.0,"image_top":0.0}
	entries[key]=entry
	return entry

func _update_picture(key: String, data: Dictionary, bounds: Vector2, image_offset: Vector2, layer: int, command: Dictionary) -> void:
	var entry := _entry(key)
	entry.button.position=Vector2(data.x,data.y)-bounds/2.0
	entry.button.size=bounds
	entry.button.z_index=layer
	entry.button.tooltip_text=str(data.get("name",""))
	entry.path=str(data.get("source",""))
	entry.command=command
	entry.image_width=float(data.get("image_width",bounds.x))
	entry.image_top=float(data.get("image_top",-bounds.y/2.0))
	entry.rotation=float(str(data.get("rotation","0")).trim_suffix("deg"))
	entry.flip=float(data.get("flip",1))
	entry.picture.position=image_offset
	entry.picture.rotation=deg_to_rad(entry.rotation*entry.flip)
	entry.picture.scale=Vector2(entry.flip,1)
	entry.picture.set_meta("wanted_asset",entry.path)
	if entry.picture.texture!=null:_layout_picture(entry)

func center_on_point(x: float,y: float) -> void:
	# Keep the user's mobile zoom instead of resetting it to desktop scale .88.
	offset=size/2.0-Vector2(x,y)*zoom;initialized_camera=true;_camera_changed()

func _clamp_camera() -> void:
	var extent := world.size*zoom
	for axis in [0,1]:offset[axis]=(size[axis]-extent[axis])/2.0 if extent[axis]<=size[axis] else clampf(offset[axis],size[axis]-extent[axis],0)

func _camera_changed() -> void:
	surroundings.size=size
	surroundings.material.set_shader_parameter("extent",size)
	if model.is_empty():return
	_clamp_camera()
	world.scale=Vector2.ONE*zoom
	world.position=offset
	var visible_world := Rect2(-offset/zoom,size/zoom).grow(180)
	for entry in entries.values():
		if str(entry.path).is_empty():continue
		var shown: bool=entry.button.visible and visible_world.intersects(Rect2(entry.button.position,entry.button.size).grow(80))
		entry.in_view=shown;entry.picture.visible=shown and not entry.get("postgame_effect",false)
		if not shown:
			entry.picture.texture=null
			entry.current_path=""
			continue
		if entry.picture.texture == null or entry.current_path != entry.path:
			var texture: Texture2D=cache.request(entry.path)
			if texture != null:_assign_picture(entry,texture)

func _assign_picture(entry: Dictionary, texture: Texture2D) -> void:
	if entry.picture.texture != texture:
		entry.picture.texture=texture
		entry.current_path=entry.path
		texture_writes+=1
	_layout_picture(entry)

func _layout_picture(entry: Dictionary) -> void:
	if entry.get("tile_scout",false):
		var rect: Dictionary=entry.tile_icon_rect
		entry.picture.size=Vector2(rect.width,rect.height);entry.picture.position=Vector2(rect.x,rect.y);return
	var texture: Texture2D=entry.picture.texture
	var height: float=entry.image_width*texture.get_height()/float(texture.get_width())
	entry.picture.size=Vector2(entry.image_width,height)
	entry.picture.position=entry.button.size/2.0+Vector2(-entry.image_width/2.0,maxf(-height/2.0,entry.image_top))
	entry.picture.pivot_offset=entry.picture.size/2.0
	entry.picture.rotation=deg_to_rad(entry.rotation*float(entry.get("flip",1)))
	entry.picture.scale=Vector2(entry.get("flip",1),1)

func _asset_ready(path: String, texture: Texture2D) -> void:
	if path==SURROUNDINGS_ASSET:surroundings.texture=texture
	if path == background.get_meta("wanted_asset",""):
		if background.texture != texture:background.texture=texture;texture_writes+=1
	for entry in entries.values():
		if entry.path == path and entry.picture.visible:_assign_picture(entry,texture)

func zoom_at(factor: float, anchor: Vector2) -> void:
	var before := (anchor-offset)/zoom
	zoom=clampf(zoom*factor,min_zoom,max_zoom)
	offset=anchor-before*zoom
	_camera_changed()

func fit_all() -> void:
	if model.is_empty():return
	zoom=minf(size.x/world.size.x,size.y/world.size.y)*0.96
	offset=(size-world.size*zoom)/2.0
	_camera_changed()

func _pick(point: Vector2) -> Dictionary:
	var local := (point-offset)/zoom
	var picked: Dictionary={}
	var layer := -1
	for entry in entries.values():
		if entry.command.is_empty() or not entry.button.visible:continue
		if entry.button.z_index>=layer and Rect2(entry.button.position,entry.button.size).has_point(local):
			picked=entry.command
			layer=entry.button.z_index
	return picked

func _gui_input(event: InputEvent) -> void:
	if source_camera_tween and (event is InputEventScreenTouch or event is InputEventMouseButton):source_camera_tween.kill()
	if event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
		zoom_at(1.1 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0/1.1,event.position);accept_event()
	elif event is InputEventScreenTouch:
		if event.pressed:
			touches[event.index]=event.position
			if touches.size()==1:
				active_pointer=event.index;pointer_start=event.position;moved=false;pending_command=_pick(event.position)
			elif touches.size()==2:
				var points: Array=touches.values()
				pinch_distance=points[0].distance_to(points[1])
				pinch_center=(points[0]+points[1])/2.0
				moved=true;pending_command={}
		else:
			var was_single := touches.size()==1
			touches.erase(event.index)
			if was_single and event.index==active_pointer and not moved and not pending_command.is_empty():command_requested.emit(pending_command.type,pending_command.payload)
			pending_command={};pinch_distance=0
			active_pointer=-1 if touches.is_empty() else int(touches.keys()[0])
			if active_pointer!=-1:pointer_start=touches[active_pointer];moved=true
		accept_event()
	elif event is InputEventScreenDrag and touches.has(event.index):
		touches[event.index]=event.position
		if touches.size()>=2:
			var points: Array=touches.values()
			var distance: float=points[0].distance_to(points[1])
			var center: Vector2=(points[0]+points[1])/2.0
			if pinch_distance>1 and distance>1:
				var anchor := (pinch_center-offset)/zoom
				zoom=clampf(zoom*distance/pinch_distance,min_zoom,max_zoom)
				offset=center-anchor*zoom
				_camera_changed()
			pinch_distance=distance;pinch_center=center;moved=true;pending_command={}
		elif event.index==active_pointer:
			moved=moved or event.position.distance_to(pointer_start)>8
			offset+=event.relative;_camera_changed()
		accept_event()


func _present_ship(ship: Dictionary) -> void:
	var key := "ship:"+str(ship.id)
	var command: Dictionary={}
	if ship.canAct or ship.canControlCpu: command={"type":"ship-actions","payload":{"playerId":ship.id}}
	elif ship.canLearn:command={"type":"move-learn","payload":{"playerId":ship.id}}
	var picture: Dictionary=ship.duplicate()
	picture.image_width=58.0
	picture.image_top=-29.0
	_update_picture(key,picture,Vector2(70,70),Vector2.ZERO,5,command)
	entries[key].button.visible=not ship.hidden and not effect_hidden_ships.has(str(ship.id))

# Match the original incremental ship update. A missing token requests the
# original full-map fallback; existing islands/routes are not reconstructed.
func apply_ships_json(value: String) -> bool:
	if model.is_empty():return false
	var ships: Array=JSON.parse_string(value)
	for ship in ships:
		if not entries.has("ship:"+str(ship.id)):return false
	# JS preserves insertion order; Godot's JSON.stringify sorts dictionary keys.
	# Compare decoded values so unchanged ships do not invalidate the whole map.
	if model.get("ships",[])==ships:return true
	model.ships=ships
	signature="" # A later full update must compare against the new ship state.
	for ship in ships:_present_ship(ship)
	_camera_changed()
	return true
