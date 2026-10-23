extends Control
## The source JS sets the path, pose and phase; this persistent layer draws it.
const Motion=preload("res://native_sea_train_motion.gd")
const Ease=preload("res://native_evolution_motion.gd")
const FilterImage=preload("res://native_css_ordered_image.gd")
var cache: Node
var map_view: Control
var model: Dictionary={}
var points:=PackedVector2Array()
var distances:=PackedFloat32Array()
var textures: Array[Texture2D]=[]
var token:=Control.new()
var facing:=Control.new()
var sprite: Control
var started:=0
var moving:=-1
var train_moving:=-1
var arrived:=-1
var ship_id:=""
var ship_hidden:=false
var cull_elapsed:=0.0
var active:=false
var pose: Dictionary={"x":0,"y":0,"angle":0,"flip":1}
var camera: Dictionary={}
var camera_from:=Vector3.ZERO
var camera_tick:=0
var camera_ease:=false
var draw_calls:=0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=28;hide();set_process(false)
	token.mouse_filter=Control.MOUSE_FILTER_IGNORE;facing.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(token);token.add_child(facing);sprite=FilterImage.new();facing.add_child(sprite)
func prepare_json(value: String) -> void:
	model=JSON.parse_string(value);started=Time.get_ticks_msec();moving=-1;train_moving=-1;arrived=-1;ship_id="";ship_hidden=false;active=true;textures.clear();points.clear();distances.clear()
	size=map_view.world.size;draw_calls=0
	var a:=Vector2(model.start.x,model.start.y);var b:=Vector2(model.control.x,model.control.y);var c:=Vector2(model.end.x,model.end.y);var length:=0.0
	for i in range(257):
		var t:=float(i)/256;var point: Vector2=(1-t)*(1-t)*a+2*(1-t)*t*b+t*t*c
		if i>0:length+=point.distance_to(points[-1])
		points.append(point);distances.append(length)
	show();set_process(true);_load_frames();queue_redraw()
func _load_frames() -> void:
	if textures.size()==4:return
	var complete: Array[Texture2D]=[]
	for path in model.frames:
		if cache.pending.size()>=2 and not cache.records.has(path) and not cache.live_textures.has(path):return
		var image: Texture2D=cache.request(path)
		if image==null:return
		complete.append(image)
	textures=complete
func pose_json(value: String) -> void:
	pose=JSON.parse_string(value);token.position=Vector2(pose.x,pose.y);token.rotation=deg_to_rad(pose.angle);facing.position=Vector2(0,-14);facing.scale=Vector2(pose.flip,1)
func set_phase(value: String) -> void:
	var now:=Time.get_ticks_msec()
	if value=="moving":moving=now
	elif value=="train-moving":train_moving=now
	elif value=="arrived":arrived=now
	else:push_error("Unknown original train phase")
func ship_state(id: String,value: String) -> void:
	ship_id=id
	if value=="sea-train-hidden-source":ship_hidden=true
func camera_json(value: String) -> void:
	camera=JSON.parse_string(value);camera_from=Vector3(map_view.offset.x,map_view.offset.y,map_view.zoom);camera_tick=Time.get_ticks_msec();camera_ease=camera.transition!="none"
	if not camera_ease:_camera(1)
func _camera(weight: float) -> void:
	map_view.offset=Vector2(lerpf(camera_from.x,camera.x,weight),lerpf(camera_from.y,camera.y,weight));map_view.zoom=lerpf(camera_from.z,camera.scale,weight);map_view.initialized_camera=true;map_view.world.position=map_view.offset;map_view.world.scale=Vector2.ONE*map_view.zoom
func _process(delta: float) -> void:
	if not active:return
	var now:=Time.get_ticks_msec();_load_frames()
	if camera_ease:
		var raw:=clampf((now-camera_tick)/220.0,0,1);_camera(Ease._ease(raw,[.25,.1,.25,1]));if raw>=1:camera_ease=false
	cull_elapsed+=delta
	if cull_elapsed>=.1:cull_elapsed=0;map_view._camera_changed()
	var key: String="ship:"+ship_id
	if map_view.entries.has(key):
		var ship: Control=map_view.entries[key].button;ship.visible=not ship_hidden
		if not ship_hidden:ship.modulate.a=Motion.sample("item","seaTrainShipTransform",(now-started)/1000.0,ship.size).opacity
	sprite.visible=train_moving>=0 and textures.size()==4
	if sprite.visible:
		var side: float=model.tokenSize;var frame_index:=int((now-started)/90)%4;sprite.configure(textures[frame_index],Vector2.ONE*side)
		var motion: Dictionary=Motion.sample("item","seaTrainArrivePop" if arrived>=0 else "seaTrainMaterialize",(now-(arrived if arrived>=0 else train_moving))/1000.0,Vector2.ONE*side)
		sprite.apply_filters(motion.filters);sprite.modulate.a=motion.opacity;sprite.position=Vector2.ONE*-side/2;sprite.pivot_offset=Vector2.ONE*side/2;sprite.rotation=deg_to_rad(model.correction)
	queue_redraw()
func _path(progress: float,offset_y:=0.0) -> PackedVector2Array:
	var result:=PackedVector2Array();var target: float=distances[-1]*progress
	for i in range(points.size()):
		if distances[i]<=target:result.append(points[i]+Vector2(0,offset_y))
		else:
			if i>0:result.append(points[i-1].lerp(points[i],(target-distances[i-1])/(distances[i]-distances[i-1]))+Vector2(0,offset_y))
			break
	return result
func _stroke(progress: float,offset_y: float,color: Color,width: float,dash:=0.0,gap:=0.0,shift:=0.0) -> void:
	var path:=_path(progress,offset_y)
	if path.size()<2:return
	if dash<=0:draw_polyline(path,color,width,true);return
	var distance:=0.0
	for i in range(1,path.size()):
		var length:=path[i].distance_to(path[i-1]);var cursor:=0.0
		while cursor<length:
			var phase:=fposmod(distance+cursor+shift,dash+gap);var step:=minf(length-cursor,(dash-phase) if phase<dash else dash+gap-phase)
			if phase<dash and step>0:draw_line(path[i-1].lerp(path[i],cursor/length),path[i-1].lerp(path[i],(cursor+step)/length),color,width,true)
			cursor+=maxf(.001,step)
		distance+=length
func _draw() -> void:
	if not active or moving<0:return
	draw_calls+=1
	var seconds: float=(Time.get_ticks_msec()-moving)/1000.0;var reveal:=Ease._ease(clampf(seconds/1.05,0,1),[.18,.78,.2,1]);var opacity:=Ease._ease(clampf(seconds/.46,0,1),[.25,.1,.25,1])
	_stroke(reveal,0,Color(.686,.933,1,.064*opacity),13);_stroke(reveal,0,Color(0,0,0,.42*opacity),18);_stroke(reveal,0,Color(.235,.157,.094,.3*opacity),18,4,42)
	_stroke(reveal,0,Color(.318,.216,.129,opacity),10);_stroke(reveal,0,Color(.435,.298,.176,opacity),13);_stroke(reveal,0,Color(.616,.424,.239,.8*opacity),12,5,14)
	for offset_y in [-5.0,5.0]:_stroke(reveal,offset_y,Color(.784,.773,.706,opacity),2.5)
	for offset_y in [-6.0,4.0]:_stroke(reveal,offset_y,Color(1,.961,.843,.84*.72*opacity),.85)
	var bolt: float=Motion.sample("item","seaTrainRailBoltGlint",fmod((Time.get_ticks_msec()-started)/1000.0,2.4),Vector2.ONE).opacity
	for offset_y in [-5.0,5.0]:_stroke(reveal,offset_y,Color(1,.812,.459,.82*bolt),1.4,.1,24)
	_stroke(reveal,-14,Color(1,1,1,.42*.26*opacity),.95,20,38,-fmod((Time.get_ticks_msec()-started)/1600.0,1)*72)
func finish() -> void:
	active=false;hide();set_process(false);sprite.stop();camera_ease=false
	var key: String="ship:"+ship_id
	if map_view.entries.has(key):map_view.entries[key].button.modulate=Color.WHITE;map_view.entries[key].button.show()
	map_view._camera_changed()
func test_motion_json() -> String:return JSON.stringify({"active":active,"model":model,"pose":pose,"moving":moving,"trainMoving":train_moving,"arrived":arrived,"framesLoaded":textures.size(),"drawCalls":draw_calls,"pathPoints":points.size(),"pathLength":distances[-1] if not distances.is_empty() else 0})
