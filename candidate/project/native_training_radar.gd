extends Button
## Draw the points and labels emitted by the original SVG-producing function.
## No gameplay stat normalization or radar ratios are recalculated here.
var chart: Dictionary={}
var font: Font=preload("res://native_fonts.gd").weighted(850)
func _ready() -> void:
	flat=true
	for state in ["normal","hover","pressed","focus"]:add_theme_stylebox_override(state,StyleBoxEmpty.new())
	resized.connect(queue_redraw)
func apply_model(value: Dictionary) -> void:chart=value;tooltip_text=str(chart.label);queue_redraw()
func _draw() -> void:
	if chart.is_empty():return
	var factor:=minf(size.x/180.0,size.y/90.0);var origin: Vector2=(size-Vector2(180,90)*factor)/2.0
	for polygon in chart.polygons:
		if polygon.value:continue
		var points:=PackedVector2Array()
		for point in polygon.points:points.append(origin+Vector2(point[0],point[1])*factor)
		draw_colored_polygon(points,Color(41.0/255,196.0/255,197.0/255,0.38) if polygon.value else Color(5.0/255,28.0/255,34.0/255,0.32))
		points.append(points[0]);draw_polyline(points,Color("f0c56e") if polygon.value else Color(219.0/255,178.0/255,88.0/255,0.48),1.6 if polygon.value else 0.8,true)
	for line in chart.lines:draw_line(origin+Vector2(line[0],line[1])*factor,origin+Vector2(line[2],line[3])*factor,Color(219.0/255,178.0/255,88.0/255,0.3),0.8,true)
	for polygon in chart.polygons:
		if not polygon.value:continue
		var points:=PackedVector2Array()
		for point in polygon.points:points.append(origin+Vector2(point[0],point[1])*factor)
		draw_colored_polygon(points,Color(41.0/255,196.0/255,197.0/255,0.38));points.append(points[0]);draw_polyline(points,Color("f0c56e"),1.6,true)
	for circle in chart.circles:
		var center:=origin+Vector2(circle[0],circle[1])*factor;draw_circle(center,float(circle[2])*factor,Color("f7df91"));draw_arc(center,float(circle[2])*factor,0,TAU,24,Color("553618"),0.8*factor,true)
	for label in chart.labels:
		var font_size:=maxi(7,roundi((6 if label.mode else 8)*factor));var text: String=label.text;var width:=font.get_string_size(text,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x
		var point:=origin+Vector2(label.x,label.y)*factor;point.x-=width if label.anchor=="end" else width/2 if label.anchor=="middle" else 0
		draw_string_outline(font,point,text,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size,maxi(1,roundi(2*factor)),Color(0,0,0,0.88))
		if label.mode:draw_string(font,point,text,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size,Color("ffe7a3"))
		else:
			var name: String=label.name;draw_string(font,point,name,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size,Color("f7e7bd"));point.x+=font.get_string_size(name,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x
			draw_string(font,point," "+str(label.value),HORIZONTAL_ALIGNMENT_LEFT,-1,font_size,Color("77e1df"))
