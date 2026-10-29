extends Control
const KEYS=['coinScore','atkScore','defScore','hitScore','intelScore','survivalScore']
const LABELS=['金幣','攻擊','防禦','命中','偵查','生存']
var scores: Dictionary={}
var mine:=0
var other:=0
func _draw() -> void:
	var center:=size*.5;var radius:=minf(size.x,size.y)*.30;var caps: Array=[];var font:=preload('res://native_fonts.gd').base()
	for key in KEYS:
		var cap:=10.0
		for row in scores.values():cap=maxf(cap,float(row.get(key,0))+10)
		caps.append(cap)
	for ring in range(1,6):
		var points:=PackedVector2Array()
		for i in range(7):points.append(center+Vector2.from_angle(-PI/2+(i%6)*TAU/6)*radius*ring/5.0)
		draw_polyline(points,Color(1,1,1,.2),1,true)
	for i in range(6):
		var direction:=Vector2.from_angle(-PI/2+i*TAU/6);draw_line(center,center+direction*radius,Color(1,1,1,.25),1,true)
		var label: String=LABELS[i]+' '+str(int(scores.get(str(other),{}).get(KEYS[i],0)));var width:=font.get_string_size(label,HORIZONTAL_ALIGNMENT_LEFT,-1,14).x
		draw_string(font,center+direction*(radius+20)-Vector2(width*.5,-5),label,HORIZONTAL_ALIGNMENT_LEFT,-1,14,Color('ffe3a0'))
	for id in [mine,other]:
		var points:=PackedVector2Array()
		for i in range(6):points.append(center+Vector2.from_angle(-PI/2+i*TAU/6)*radius*clampf(float(scores.get(str(id),{}).get(KEYS[i],0))/caps[i],0,1))
		var color:=Color('4e9cff') if id==mine else Color('ff6384');draw_colored_polygon(points,Color(color,.22));points.append(points[0]);draw_polyline(points,color,2,true)
