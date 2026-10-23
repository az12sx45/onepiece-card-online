extends Node2D
class HintArrow extends Node2D:
	func _draw() -> void:
		# Original 20x20 SVG: M4 17 A13 13 0 0 1 17 4;
		# M2 12 l2 5 5-2; M12 2 l5 2-2 5, displayed at 22px.
		var ink:=Color("fff1be")
		draw_arc(Vector2(7,7)*1.1,14.3,PI,PI*1.5,32,ink,2.2,true)
		draw_polyline(PackedVector2Array([Vector2(-8,2)*1.1,Vector2(-6,7)*1.1,Vector2(-1,5)*1.1]),ink,2.2,true)
		draw_polyline(PackedVector2Array([Vector2(2,-8)*1.1,Vector2(7,-6)*1.1,Vector2(5,-1)*1.1]),ink,2.2,true)
var elapsed := 0.0
var arrow:=HintArrow.new()
func _ready() -> void:add_child(arrow)
func _draw() -> void:
	draw_circle(Vector2.ZERO,15,Color.BLACK)
	draw_arc(Vector2.ZERO,14.5,0,TAU,48,Color("d3aa55"),1,true)

func _process(delta: float) -> void:
	if not is_visible_in_tree():return
	elapsed+=delta
	var triangle:=1.0-absf(2.0*fmod(elapsed/1.35,1.0)-1.0)
	var phase: float=preload("res://native_evolution_motion.gd")._ease(triangle,[.42,0,.58,1])
	arrow.rotation=deg_to_rad(lerpf(-14,14,phase))
	arrow.position=Vector2(lerpf(-3,3,phase),lerpf(2,-2,phase))
	arrow.scale=Vector2.ONE*lerpf(0.94,1.08,phase)
	arrow.modulate.a=lerpf(0.72,1,phase)
