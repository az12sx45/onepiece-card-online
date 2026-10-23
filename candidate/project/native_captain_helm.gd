extends Control
signal command_requested(action: String, player_id: String)
const Motion=preload("res://native_helm_motion.gd")
const Hint=preload("res://native_helm_hint.gd")
const ART="mobile/art-ui/command-helm-v010.png"
const RADIUS=294.0
const GROWTH=1.3125
const ICONS={"roll":[75.7847,-0.21152,0.81586],"items":[74.86567,0.41791,1.19403],"crew":[69.3656,-0.1936,0.49784],"spar":[69.3656,-0.1936,0.49784],"learn":[72.3027,-0.05766,1.38378],"mission":[75.9281,-0.93851,0.81741],"fleet":[71.02301,-0.28319,0.14159],"ship":[68.36116,-0.02726,0.10903]}
var cache: Node
var model: Dictionary={}
var motion=Motion.new()
var art:=Sprite2D.new()
var icon:=TextureRect.new()
var label:=Label.new()
var hint:=Hint.new()
var pointer := -1
var start_point:=Vector2.ZERO
var moved := 0.0
var stopped_inertia := false
var start_index := -1
var index := -1
var icon_path := ""
var art_pivot:=Vector2.ZERO
var signature := ""
var icon_textures: Dictionary = {}
var pixel_unit:=1.0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	cache.asset_ready.connect(_asset_ready)
	art.centered=false
	art.offset=-Vector2(626.655,601.144)
	art.scale=Vector2.ONE*(588.0/1254.0)
	add_child(art)
	icon.mouse_filter=Control.MOUSE_FILTER_IGNORE
	icon.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	add_child(icon)
	var weighted:=preload("res://native_fonts.gd").weighted(800.0)
	label.add_theme_font_override("font",weighted)
	label.add_theme_font_size_override("font_size",24)
	label.add_theme_color_override("font_color",Color("f3d18a"))
	label.add_theme_color_override("font_outline_color",Color.BLACK)
	label.add_theme_constant_override("outline_size",3)
	label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment=VERTICAL_ALIGNMENT_BOTTOM
	label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(label)
	add_child(hint)
	resized.connect(_layout)
	art.texture=cache.request(ART)
	_layout()

func apply_model(value: Dictionary) -> void:
	var next:=JSON.stringify(value)
	if next==signature:return
	if model.get("playerId","") != value.get("playerId",""):
		motion.angle=0;motion.inertia=false;pointer=-1;index=-1
	model=value;signature=next
	var needed: Array=[]
	for entry in value.get("entries",[]):
		needed.append(str(entry.icon))
		var texture: Texture2D=cache.request(str(entry.icon))
		if texture != null:icon_textures[str(entry.icon)]=texture
	for path in icon_textures.keys():
		if not needed.has(path):icon_textures.erase(path)
	visible=not value.get("entries",[]).is_empty()
	_update_selection(true)

func _draw() -> void:
	draw_circle(size+Vector2.ONE*.5*pixel_unit,177.1875*pixel_unit,Color.BLACK)

func _layout() -> void:
	pixel_unit=1.0/preload("res://native_screen_metrics.gd").css_factor(get_viewport())
	art_pivot=size+Vector2.ONE*.5*pixel_unit
	art.position=art_pivot
	art.scale=Vector2.ONE*(588.0/1254.0)*pixel_unit
	hint.scale=Vector2.ONE*pixel_unit
	label.add_theme_font_size_override("font_size",roundi(24*pixel_unit))
	label.add_theme_constant_override("outline_size",maxi(1,roundi(.7*pixel_unit)))
	var width:=maxf(1,minf(300,size.x/pixel_unit-550))*pixel_unit
	label.position=Vector2((size.x-width)/2.0-24*pixel_unit,size.y-84*pixel_unit)
	label.size=Vector2(width,64*pixel_unit)
	_update_selection(true)
	queue_redraw()

func _update_selection(force: bool=false) -> void:
	if model.get("entries",[]).is_empty():return
	var selected: int=motion.selected(model.entries.size())
	if not force and selected==index:return
	index=selected
	var entry: Dictionary=model.entries[index]
	label.text=str(entry.label)
	icon.modulate.a=1.0 if entry.enabled else 0.42
	var proportions: Array=ICONS.get(str(entry.action),[72.0,0.0,0.0])
	icon.size=Vector2.ONE*float(proportions[0])*GROWTH*pixel_unit
	icon.position=_icon_bounds().get_center()-icon.size/2.0+Vector2(proportions[1],proportions[2])*GROWTH*pixel_unit
	icon_path=str(entry.icon)
	var texture: Texture2D=icon_textures.get(icon_path)
	if texture == null:texture=cache.request(icon_path)
	if texture != null:icon.texture=texture
	else:icon.texture=null

func _icon_bounds() -> Rect2:return Rect2(size-Vector2.ONE*125.5*pixel_unit,Vector2.ONE*126*pixel_unit)

func _asset_ready(path: String, texture: Texture2D) -> void:
	if path==ART:art.texture=texture
	for entry in model.get("entries",[]):
		if entry.icon==path:icon_textures[path]=texture;break
	if path==icon_path:icon.texture=texture

func _process(_delta: float) -> void:
	if not is_visible_in_tree():return
	motion.advance(Time.get_ticks_msec())
	art.rotation=deg_to_rad(motion.angle)
	_update_selection()
	hint.visible=pointer==-1 and not motion.inertia
	if hint.visible:
		var gap: float=motion.angle+22.5+45*floor((180-motion.angle)/45+0.5)
		if gap<190:gap+=45
		elif gap>240:gap-=45
		hint.position=art_pivot+Vector2.from_angle(deg_to_rad(gap))*(224*RADIUS/256.0)*pixel_unit

func _has_point(point: Vector2) -> bool:
	return point.x>=size.x-RADIUS*pixel_unit and point.y>=size.y-RADIUS*pixel_unit and point.distance_to(art_pivot)<=RADIUS*pixel_unit

func pointer_down(id: int, point: Vector2, now: float) -> void:
	if pointer!=-1 or not _has_point(point):return
	pointer=id;start_point=point;moved=0
	start_index=index if _icon_bounds().has_point(point) else -1
	stopped_inertia=motion.begin(point-art_pivot,now)

func pointer_move(id: int, point: Vector2, now: float) -> void:
	if pointer!=id:return
	moved=maxf(moved,point.distance_to(start_point))
	motion.sample(point-art_pivot,now)
	art.rotation=deg_to_rad(motion.angle)
	_update_selection()

func pointer_up(id: int, point: Vector2, now: float) -> void:
	if pointer!=id:return
	pointer_move(id,point,now)
	pointer=-1
	if motion.previewed:motion.release(now);return
	motion.inertia=false
	if stopped_inertia or moved>10*pixel_unit or start_index!=index or index<0 or not _icon_bounds().has_point(point):return
	var entry: Dictionary=model.entries[index]
	if entry.enabled:command_requested.emit(str(entry.action),str(model.playerId))

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:pointer_down(event.index,event.position,Time.get_ticks_msec())
		else:pointer_up(event.index,event.position,Time.get_ticks_msec())
		accept_event()
	elif event is InputEventScreenDrag:
		pointer_move(event.index,event.position,Time.get_ticks_msec());accept_event()
