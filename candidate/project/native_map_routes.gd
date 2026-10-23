extends Node2D
## Static geometry is redrawn only when original route data changes.
var signature := ""
var edges: Array = []
var reveal_time:=-1.0
func set_reveal(seconds: float) -> void:
	if reveal_time==seconds:return
	reveal_time=seconds;queue_redraw()

func apply(edges_value: Array) -> void:
	var next := JSON.stringify(edges_value)
	if next == signature: return
	signature = next
	edges = edges_value
	queue_redraw()

func _draw() -> void:
	for edge in edges:
		var a := Vector2(edge.a.x,edge.a.y)
		var b := Vector2(edge.b.x,edge.b.y)
		var opacity:=1.0;var brightness:=1.0
		if reveal_time>=0 and edge.postgameRoute:
			var progress:=clampf((reveal_time-float(edge.postgameOrder)*.09)/1.25,0,1);var eased:=preload("res://native_evolution_motion.gd")._ease(progress,[.22,.75,.22,1]);b=a.lerp(b,eased);opacity=eased;brightness=lerpf(2.2,1,eased)
		draw_line(a,b,Color(0.56*brightness,0.84*brightness,0.96*brightness,0.35*opacity),10,true)
		draw_line(a,b,Color(0.88*brightness,0.97*brightness,brightness,0.82*opacity),3,true)
