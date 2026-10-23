extends Node
## Original stageImpactShake keyframes, restarted on each connected hit.
signal started
const Motion=preload("res://native_rokuogan_motion.gd")
var view: Control
var began:=0
var active:=false
var origin:=Vector2.ZERO
func _ready() -> void:set_process(false)
func play() -> void:
	if not active:origin=view.position
	active=true;began=Time.get_ticks_msec();set_process(true);started.emit();_process(0)
func _process(_delta: float) -> void:
	var elapsed:=float(Time.get_ticks_msec()-began)/1000.0
	if elapsed>=float(Motion.data.catalog.stageImpactShake.duration):
		stop();return
	view.position=origin+Motion.sample("stageImpactShake",elapsed,view.size).transform.origin
func stop() -> void:
	if active and is_instance_valid(view):view.position=origin
	active=false;set_process(false)
func _exit_tree() -> void:stop()
