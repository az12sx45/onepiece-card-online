extends Control
## Original intercept-only squad. Three persistent sprites, never idle guards.
const Motion=preload("res://native_judge_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var view: Control
var cache: Node
var sprites: Array[Control]=[]
var slots: Array=[]
var hit_times: Array[int]=[]
var began:=0
var cursor:=0
var frozen_ms:=-1

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;z_index=6
	for i in range(3):
		var sprite:=Filtered.new();add_child(sprite);sprite.hide();sprites.append(sprite)
	hide();set_process(false)

func warm() -> bool: return cache.request(str(Motion.data.asset))!=null

func deploy(count: int) -> void:
	stop()
	count=clampi(count,0,3)
	if count==0:return
	assert(warm(),"Original clone guard image must be ready")
	slots=Motion.data.formations[count-1];hit_times.assign([-1,-1,-1]);cursor=0;began=Time.get_ticks_msec()
	for i in range(count):sprites[i].show();sprites[i].filter_signature="";sprites[i].passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
	show();set_process(true);_tick()

func intercept() -> Dictionary:
	if cursor>=slots.size():return {}
	var index:=cursor;cursor+=1;hit_times[index]=frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-began
	_tick()
	var sprite: Control=sprites[index]
	var transform: Transform2D=sprite.get_transform()
	var bounds:=Rect2(transform*Vector2.ZERO,Vector2.ZERO)
	for point in [Vector2(sprite.size.x,0),sprite.size,Vector2(0,sprite.size.y)]:bounds=bounds.expand(transform*point)
	return {"impact":position+bounds.position+bounds.size*.5,"number":position+bounds.position+bounds.size*Vector2(.5,.38),"index":index}

func _process(_delta: float) -> void: _tick()
func _tick() -> void:
	if not visible:return
	position=view.portraits.enemy.position;size=view.portraits.enemy.size
	var compact:=view.size.y<=600
	var extent:=size*Vector2(.76 if compact else .78,.86 if compact else .88)
	var elapsed:=frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-began
	var any_visible:=false
	for i in range(slots.size()):
		var slot: Dictionary=slots[i];var sprite: Control=sprites[i]
		var breaking:=hit_times[i]>=0
		var milliseconds:=elapsed-hit_times[i] if breaking else elapsed-i*45
		if breaking and milliseconds>=720:
			sprite.hide();sprite.stop();continue
		any_visible=true;sprite.show()
		var key: String=("judgeCloneGuardBreak:" if breaking else "judgeCloneSquadDeploy:")+str(slot.scale)
		var sample:=Motion.sample(key,maxf(0,float(milliseconds))/1000.0,extent)
		sprite.configure(cache.request(str(Motion.data.asset)),extent)
		sprite.passes[0].effect.set_shader_parameter("image_alignment",Vector2(.5,1))
		sprite.z_index=8 if breaking else int(slot.z)
		sprite.apply_motion(sample,Vector2(size.x*float(slot.x)/100.0,size.y*(.96 if compact else .97)-extent.y),Vector2(.5,.92))
		sprite.apply_filters(sample.filters)
	if not any_visible:hide();set_process(false)

func stop() -> void:
	hide();set_process(false);slots=[];cursor=0
	for sprite in sprites:sprite.hide();sprite.stop()
