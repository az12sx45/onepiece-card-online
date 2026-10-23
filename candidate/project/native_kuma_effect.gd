extends Control
const Motion=preload("res://native_kuma_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var cache: Node
var model: Dictionary={}
var pose: Dictionary={}
var textures: Dictionary={}
var token:=Control.new()
var bubble: Control
var ship: Control
var burst: Control
var landed: Control
var trails: Array=[]
var curve_points:=PackedVector2Array()
var curve_lengths:=PackedFloat32Array()
var moving:=-1.0
var arrived:=-1.0
var epoch:=0
var busy:=false
var frozen_time:=-1.0
var started:=0.0
var last_trail_fraction:=-1.0
var last_trail_scale:=-1.0
var trail_updates:=0
func _image(parent: Node) -> Control:
	var image=Filtered.new();parent.add_child(image);return image
func _shadow(x: float,y: float,blur: float,color: Color) -> Dictionary:return {"kind":"drop-shadow","x":x,"y":y,"blur":blur,"color":[color.r,color.g,color.b,color.a]}
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	# Layered soft strokes approximate the original SVG glow; original path and
	# normalized arc-length reveal remain authoritative and are checked separately.
	for item in [[44,Color(.54,.8,1,.035)],[32,Color(.54,.8,1,.07)],[20,Color(.54,.8,1,.14)],[12,Color(.45,.76,1,.15)],[6,Color(.9,1,.57,.18)],[2.8,Color(.93,.99,1,.9)]]:
		var line:=Line2D.new();line.width=item[0];line.default_color=item[1];line.antialiased=true;line.begin_cap_mode=Line2D.LINE_CAP_ROUND;line.end_cap_mode=Line2D.LINE_CAP_ROUND;add_child(line);trails.append(line)
	burst=_image(self);add_child(token);token.mouse_filter=Control.MOUSE_FILTER_IGNORE;bubble=_image(token);ship=_image(token);landed=_image(self);hide();set_process(false)
	cache.request("images/board/final_island/kuma_paw_transfer/paw_flight_bubble.webp");cache.request("images/board/final_island/kuma_paw_transfer/paw_landing_impact.webp")
func open_json(value: String) -> void:
	epoch+=1;busy=true;model=JSON.parse_string(value);pose={};started=Time.get_ticks_msec()/1000.0;moving=-1;arrived=-1;last_trail_fraction=-1;last_trail_scale=-1;trail_updates=0;_prepare(epoch)
func _prepare(sequence: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	while sequence==epoch:
		var ready:=true
		for path in [model.ship,model.bubble,model.burst]:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original Kuma bitmap missing: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Kuma image timeout");return
		await get_tree().process_frame
	if sequence!=epoch:return
	var viewport:=get_viewport_rect().size
	var phone: bool=viewport.x<=980 or viewport.y<=620;token.size=Vector2(236,154) if phone else Vector2(286,186);burst.configure(textures[model.burst],Vector2(280,246) if phone else Vector2(340,300));bubble.configure(textures[model.bubble],token.size);ship.configure(textures[model.ship],token.size*Vector2(.30,.42));landed.configure(textures[model.ship],Vector2(78,78) if phone else Vector2(96,96))
	burst.apply_filters([_shadow(0,12,15,Color(0,0,0,.58))]);bubble.apply_filters([_shadow(0,11,14,Color(0,0,0,.34)),_shadow(0,0,15,Color(.49,.79,1,.8)),_shadow(0,0,8,Color(.90,1,.56,.55))]);ship.apply_filters([{"kind":"brightness","value":1.12},_shadow(0,4,4,Color(0,0,0,.7)),_shadow(0,0,5,Color(1,.96,.88,.78))]);landed.apply_filters([{"kind":"brightness","value":1.12},_shadow(0,6,6,Color(0,0,0,.78)),_shadow(0,0,7,Color(1,.97,.86,.92))])
	curve_points.clear();curve_lengths.clear();var p: Array=model.points;var a:=Vector2(p[0],p[1]);var c:=Vector2(p[2],p[3]);var b:=Vector2(p[4],p[5]);var distance:=0.0
	for i in range(257):
		var t:=float(i)/256;var point: Vector2=(1-t)*(1-t)*a+2*(1-t)*t*c+t*t*b
		if i>0:distance+=point.distance_to(curve_points[-1])
		curve_points.append(point);curve_lengths.append(distance)
	busy=false;show();set_process(true);_tick()
func pose_json(value: String) -> void:pose=JSON.parse_string(value)
func phase_changed(classes: String) -> void:
	var now:=Time.get_ticks_msec()/1000.0;model.classes=classes
	if classes.contains("moving") and moving<0:moving=now
	if classes.contains("arrived") and arrived<0:arrived=now
	# Render the latest source pose/phase together in _process. Several source
	# updates in one frame must not upload the same six trail meshes repeatedly.
func _place(image: Control,center: Vector2,motion: Dictionary) -> void:
	image.pivot_offset=image.box*.5;image.position=center-image.box*.5;image.scale=Vector2.ONE*float(motion.scale);image.rotation=deg_to_rad(float(motion.rotate));image.modulate.a=motion.opacity
func _tick() -> void:
	if busy or model.is_empty() or pose.is_empty():return
	var now:=started+frozen_time if frozen_time>=0 else Time.get_ticks_msec()/1000.0;var center:=Vector2(float(str(pose.get("left","0")).trim_suffix("px")),float(str(pose.get("top","0")).trim_suffix("px")));var angle:=-deg_to_rad(float(str(pose.get("upright","0")).trim_suffix("deg")));var travel:=maxf(0,now-moving);var landing_time:=maxf(0,now-arrived)
	token.visible=moving>=0
	if token.visible:
		var motion:=Motion.sample("kumaPawMapVanish" if arrived>=0 else "kumaPawMapMaterialize",landing_time if arrived>=0 else travel);token.pivot_offset=token.size*.5;token.position=center-token.size*.5;token.rotation=angle;token.scale=Vector2.ONE*float(motion.scale);token.modulate.a=motion.opacity
		bubble.position=Vector2(token.size.x,0);bubble.scale=Vector2(-1,1);ship.position=token.size*Vector2(.68,.55)-ship.box*.5;ship.pivot_offset=ship.box*.5;ship.rotation=-angle;ship.visible=arrived<0
	var end:=Vector2(model.points[4],model.points[5]);burst.visible=arrived>=0;landed.visible=arrived>=0
	if arrived>=0:_place(burst,end,Motion.sample("kumaPawMapLandingBurst",landing_time));_place(landed,end,Motion.sample("kumaPawMapLandingShip",landing_time))
	var fraction: float=1.0-Motion.sample("kumaPawMapTrail",travel).strokeDashoffset if moving>=0 else 0.0
	if fraction!=last_trail_fraction and not curve_points.is_empty():
		var points:=PackedVector2Array();var length: float=curve_lengths[-1]*fraction
		for i in range(curve_points.size()):
			if curve_lengths[i]<=length:points.append(curve_points[i])
			else:
				if i>0:points.append(curve_points[i-1].lerp(curve_points[i],(length-curve_lengths[i-1])/maxf(.00001,curve_lengths[i]-curve_lengths[i-1])))
				break
		for line in trails:line.points=points
		last_trail_fraction=fraction;trail_updates+=1
	var map_scale:=maxf(.01,get_global_transform().get_scale().x)
	if map_scale!=last_trail_scale:
		for i in range(trails.size()):trails[i].width=float([44,32,20,12,6,2.8][i])/map_scale
		last_trail_scale=map_scale
func _process(_delta: float) -> void:_tick()
func close_surface() -> void:
	epoch+=1;busy=false;model={};pose={};hide();set_process(false)
	for image in [bubble,ship,burst,landed]:image.stop()
func test_ready() -> bool:return visible and not busy
func test_state_json() -> String:return JSON.stringify({"model":model,"pose":pose,"moving":moving>=0,"arrived":arrived>=0,"visible":visible})
func test_static_trail_reuse() -> bool:
	# Freeze only this presentation clock; original game state is untouched.
	var previous:=frozen_time
	frozen_time=Time.get_ticks_msec()/1000.0-started
	_tick()
	var updates:=trail_updates
	var points: PackedVector2Array=trails[0].points
	for i in range(20):_tick()
	frozen_time=previous
	return trail_updates==updates and trails[0].points==points
