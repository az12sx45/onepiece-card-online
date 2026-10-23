extends Control
## Original map shake and diagonal battle curtain. Nodes and textures persist;
## source timing changes presentation only, never the battle state or RNG.
const Motion=preload("res://native_battle_entry_motion.gd")
const Ease=preload("res://native_evolution_motion.gd")
var battle: Control
var active:=false
var skip:=false
var closing:=false
var started:=0
var delay:=0
var close_started:=0
var targets: Array=[]
var originals: Array=[]
var history: Array[String]=[]
var last_phase:=""
var ready_at:=1950

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;z_index=250;hide();set_process(false)

func begin(packet: Dictionary) -> void:
	reset();ready_at=int(Motion.data.timing.READY_DELAY);last_phase="";skip=bool(packet.get("skip",true));delay=maxi(0,int(packet.get("delay",0)));started=Time.get_ticks_msec();active=true
	var application:=battle.get_parent()
	for key in ["map_view","helm","game_tools"]:
		var node=application.get(key)
		if node is Control:targets.append(node);originals.append([node.position,node.rotation,node.scale])
	size=application.size;show();set_process(true);_process(0)

func elapsed_ms() -> int:return Time.get_ticks_msec()-started-delay
func can_open() -> bool:return not active or skip or elapsed_ms()>=int(Motion.data.timing.OPEN_DELAY)
func presentation_ready() -> bool:return not closing and (not active or skip or elapsed_ms()>=ready_at)
func reopen() -> void:
	if closing:reset()
	elif active:ready_at=mini(ready_at,elapsed_ms())
func _restore_map() -> void:
	for i in range(targets.size()):
		if is_instance_valid(targets[i]):targets[i].position=originals[i][0];targets[i].rotation=originals[i][1];targets[i].scale=originals[i][2]

func reset() -> void:
	_restore_map();targets.clear();originals.clear();active=false;closing=false;hide();set_process(false)
	if is_instance_valid(battle) and is_instance_valid(battle.view):battle.view.modulate.a=1; battle.view.scale=Vector2.ONE;battle.view.position=Vector2.ZERO

func begin_close() -> void:
	_restore_map();active=false;closing=true;close_started=Time.get_ticks_msec();show();set_process(true)

func _process(_delta: float) -> void:
	if not is_instance_valid(battle):reset();return
	size=battle.size
	if closing:
		var t:=float(Time.get_ticks_msec()-close_started)/1000
		battle.view.modulate.a=1-Ease._ease(clampf(t/.28,0,1),[.25,.1,.25,1])
		var scale_value:=lerpf(1,.985,Ease._ease(clampf(t/.42,0,1),[.25,.1,.25,1]));battle.view.scale=Vector2.ONE*scale_value;battle.view.position=size*(1-scale_value)*.5
		queue_redraw();return
	if not active:return
	var ms:=elapsed_ms();var seconds:=float(ms)/1000
	var phase:="waiting" if ms<0 else "shake" if not can_open() else "curtain" if not presentation_ready() else "ready"
	if phase!=last_phase:history.append(phase);last_phase=phase
	if not skip and ms>=0 and ms<int(Motion.data.timing.OPEN_DELAY):
		var transform: Transform2D=Motion.sample("battleMapShakeTwice",seconds,size).transform
		for i in range(targets.size()):
			var node: Control=targets[i];var origin:=node.size*.5
			node.position=originals[i][0]+origin+transform.origin-transform.basis_xform(origin);node.rotation=originals[i][1]+transform.get_rotation()
	else:_restore_map()
	var fade:=maxf(0,float(ms-ready_at)/1000)
	var alpha:=1.0 if skip else Ease._ease(clampf(fade/.28,0,1),[.25,.1,.25,1])
	var scale_value:=1.0 if skip else lerpf(1.018,1,Ease._ease(clampf(fade/.42,0,1),[.25,.1,.25,1]))
	battle.view.modulate.a=alpha;battle.view.scale=Vector2.ONE*scale_value;battle.view.position=size*(1-scale_value)*.5
	queue_redraw()
	if battle.visible and (skip or ms>=int(Motion.data.timing.CLEAR_DELAY)):
		active=false;_restore_map();hide();set_process(false)

func _draw() -> void:
	if closing:return
	if not active or not can_open():return
	if not battle.visible:draw_rect(Rect2(Vector2.ZERO,size),Color("041526"))
	if skip:return
	var seconds:=float(elapsed_ms()-int(Motion.data.timing.OPEN_DELAY))/1000
	var alpha: float=Motion.sample("battlePageBlackFlash",seconds,size).opacity
	var extent:=size*1.16
	for i in range(2):
		var points:=PackedVector2Array([Vector2.ZERO,Vector2(extent.x,0),Vector2(0,extent.y)] if i==0 else [extent,Vector2(extent.x,0),Vector2(0,extent.y)])
		var transform: Transform2D=Motion.sample("battlePageCloseTopLeft" if i==0 else "battlePageCloseBottomRight",seconds,extent).transform
		for j in range(points.size()):points[j]=transform*points[j]-size*.08
		draw_colored_polygon(points,Color(0,0,0,alpha))

func _exit_tree() -> void:_restore_map()
