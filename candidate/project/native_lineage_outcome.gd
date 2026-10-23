extends Control
## Source-timed procedural CSS shapes. The result remains owned by source JS.
const Motion=preload("res://native_lineage_motion.gd")
var packet: Dictionary={}
var enemy:=Rect2()
var showcase:=Rect2()
var elapsed:=0.0

func _ready() -> void:mouse_filter=Control.MOUSE_FILTER_IGNORE
func paint(value: Dictionary,enemy_box: Rect2,launcher_box: Rect2,time: float) -> void:
	packet=value;enemy=enemy_box;showcase=launcher_box;elapsed=time;queue_redraw()

func _glow_line(start: Vector2,finish: Vector2,width: float,color: Color) -> void:
	for step in range(4,0,-1):draw_line(start,finish,Color(color,color.a*.045),width+step*5,true)
	draw_line(start,finish,color,width,true)
	draw_line(start,finish,Color(1,1,.85,color.a*.85),maxf(1,width*.25),true)

func _beam(start: Vector2,finish: Vector2,track: bool) -> void:
	var age: float=elapsed-2.2-(0.0 if track else .26)
	if age<0:return
	var width:=clampf(size.x*.022,18,32)*(.52 if track else .34)
	var length: float=start.distance_to(finish)
	var sample:=Motion.sample("lineage-beam-fire",age*(1.35/.52 if track else 1.0),Vector2(length,width))
	var color:=Color(str(packet.theme.get("--lineage-beam-mid","#57eee1")))
	var scale: Vector2=sample.transform.get_scale();color.a*=sample.opacity
	if "is-outcome-failure" in packet.classes:
		var failure:=Motion.sample("lineage-beam-collapse",elapsed-5.8,Vector2(length,width));scale=failure.transform.get_scale();color=Color("ff746b");color.a=failure.opacity
	_glow_line(start,start+(finish-start)*scale.x,width*scale.y,color)
	if not track and "is-outcome-success" in packet.classes:
		var edge:=clampf(size.x*.02,16,29);var result:=Motion.sample("lineage-sample-return",elapsed-5.8,Vector2(length,edge))
		var point: Vector2=start+(finish-start).normalized()*result.left;var radius: float=edge*.5*result.transform.get_scale().x
		for index in range(3,0,-1):draw_circle(point,radius+index*3,Color(color,.12*result.opacity))
		draw_circle(point,radius,Color(color,result.opacity));draw_circle(point,radius*.45,Color(1,1,1,result.opacity))

func _draw() -> void:
	if packet.is_empty() or packet.get("mode","")!="outcome":return
	var track: Dictionary=packet.outcome.track;var beam: Dictionary=packet.outcome.beam
	if track.is_empty() or beam.is_empty():return
	var start:=showcase.position+Vector2(str(track.left).to_float(),str(track.top).to_float())
	var muzzle:=start+Vector2(str(track.width).to_float(),0)
	var target:=enemy.position+enemy.size*Vector2(.5,.46)
	_beam(start,muzzle,true);_beam(muzzle,target,false)
	if elapsed<2.56:return
	var name:="lineage-impact-in";var age:=elapsed-2.56
	if "is-outcome-failure" in packet.classes:name="lineage-impact-failure";age=elapsed-5.8
	elif "is-outcome-success" in packet.classes:name="lineage-impact-success";age=fmod(elapsed-5.8,1.35)
	elif "is-outcome-testing" in packet.classes:name="lineage-containment-test";age=elapsed-3.1
	var edge:=clampf(size.x*.13,105,185);var sample:=Motion.sample(name,age,Vector2.ONE*edge)
	# CSS transforms are applied around center after the authored -50% placement.
	var move: Transform2D=sample.transform
	var matrix:=Transform2D(0,target+Vector2.ONE*edge*.5)*move*Transform2D(0,-Vector2.ONE*edge*.5)
	draw_set_transform_matrix(matrix)
	var color:=Color("ff776d") if "is-outcome-failure" in packet.classes else Color(str(packet.theme.get("--lineage-beam-mid","#57eee1")))
	color.a*=sample.opacity
	for index in range(4,0,-1):draw_arc(Vector2.ONE*edge*.5,edge*.5,0,TAU,96,Color(color,color.a*.065),4+index*4,true)
	draw_arc(Vector2.ONE*edge*.5,edge*.5,0,TAU,96,color,clampf(size.x*.0032,3,5),true)
	draw_arc(Vector2.ONE*edge*.5,edge*.37,0,TAU,96,Color(1,.97,.79,color.a),2,true)
	draw_arc(Vector2.ONE*edge*.5,edge*.24,0,TAU,96,Color(color,color.a*.8),2,true)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	if "is-outcome-testing" in packet.classes:
		var pip:=clampf(size.x*.011,10,16);var center:=enemy.position+enemy.size*Vector2(.5,.66)
		for index in range(3):
			var delay: float=[.26,1.12,1.98][index];var motion:=Motion.sample("lineage-pip-lock",maxf(0,elapsed-3.1-delay),Vector2.ONE*pip)
			var locked: bool=elapsed-3.1>=delay
			draw_set_transform_matrix(Transform2D(0,center+Vector2((index-1)*(pip+8),0))*motion.transform)
			draw_rect(Rect2(-Vector2.ONE*pip*.5,Vector2.ONE*pip),Color("64f5e9") if locked else Color("02121e"));draw_rect(Rect2(-Vector2.ONE*pip*.5,Vector2.ONE*pip),color,false,2)
	draw_set_transform_matrix(Transform2D.IDENTITY)
