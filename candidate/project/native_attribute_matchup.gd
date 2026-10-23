extends Label
## Original force/tech/speed triangle and its source-provided live multiplier.
signal detail_requested
var nodes: Array[Label]=[]
var art:=Control.new()
func _ready() -> void:
	art.mouse_filter=Control.MOUSE_FILTER_IGNORE
	art.show_behind_parent=true
	add_child(art);art.draw.connect(_draw_plate)
	mouse_filter=Control.MOUSE_FILTER_STOP
	horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	add_theme_color_override("font_color",Color("2b1505"))
	add_theme_font_size_override("font_size",11)
	for entry in [["力","ff5d58"],["速","52b7ff"],["技","54db81"]]:
		var label:=Label.new()
		label.text=entry[0];label.mouse_filter=Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size",11)
		label.add_theme_color_override("font_color",Color.WHITE)
		label.set_meta("color",Color(entry[1]));add_child(label);nodes.append(label)
	resized.connect(_layout);_layout()
func _layout() -> void:
	if nodes.size()!=3:return
	var points: Array[Vector2]=[Vector2(7,size.y-25),Vector2(size.x-27,size.y-25),Vector2(size.x*.5-10,3)]
	for i in range(3):nodes[i].position=points[i];nodes[i].size=Vector2(20,20)
	art.size=size;art.queue_redraw()
func _draw_plate() -> void:
	var plate:=StyleBoxFlat.new()
	plate.bg_color=Color("102b46");plate.border_color=Color("ffe8bc80")
	plate.set_border_width_all(1);plate.set_corner_radius_all(12)
	art.draw_style_box(plate,Rect2(Vector2.ZERO,size))
	for pair in [[0,2],[2,1],[1,0]]:
		var from: Vector2=nodes[pair[0]].position+Vector2(10,10)
		var to: Vector2=nodes[pair[1]].position+Vector2(10,10)
		var direction: Vector2=(to-from).normalized()
		var tip:=to-direction*12
		art.draw_line(from+direction*12,tip,Color("ffe8bc"),1.0,true)
		art.draw_line(tip,tip-direction.rotated(.5)*4,Color("ffe8bc"),1.0,true)
		art.draw_line(tip,tip-direction.rotated(-.5)*4,Color("ffe8bc"),1.0,true)
	for node in nodes:art.draw_circle(node.position+Vector2(10,10),10,node.get_meta("color"))
	var label_plate:=StyleBoxFlat.new();label_plate.bg_color=Color("ffe291")
	label_plate.set_corner_radius_all(6)
	art.draw_style_box(label_plate,Rect2(Vector2(size.x*.5-19,size.y*.5-7),Vector2(38,14)))
func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and event.pressed:
		detail_requested.emit();accept_event()
