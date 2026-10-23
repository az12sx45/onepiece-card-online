extends PanelContainer
## Original status-popover content, kept inside the landscape viewport.
var stack:=VBoxContainer.new()
var scroll:=ScrollContainer.new()
var labels: Array[Label]=[]
var detail: Dictionary={}
func _ready() -> void:
	z_index=350;mouse_filter=Control.MOUSE_FILTER_STOP
	var style:=StyleBoxFlat.new();style.bg_color=Color(3.0/255,12.0/255,24.0/255,.94);style.border_color=Color(1,.91,.74,.5);style.set_border_width_all(1);style.set_corner_radius_all(10);style.content_margin_left=12;style.content_margin_right=12;style.content_margin_top=10;style.content_margin_bottom=10;add_theme_stylebox_override("panel",style)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;scroll.vertical_scroll_mode=ScrollContainer.SCROLL_MODE_AUTO;add_child(scroll);stack.size_flags_horizontal=Control.SIZE_EXPAND_FILL;stack.add_theme_constant_override("separation",6);scroll.add_child(stack)
	for index in range(4):
		var label:=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.add_theme_font_size_override("font_size",14 if index==0 else 12);label.add_theme_color_override("font_color",Color("ffe391") if index==0 else Color("ffe8bcd6") if index==1 else Color("ffffffdb"));stack.add_child(label);labels.append(label)
	hide()
func show_for(value: Dictionary,anchor: Rect2,viewport_size: Vector2) -> void:
	detail=value;var turns:=int(value.get("turns",0));var duration:=str(value.get("durationText","")).strip_edges()
	labels[0].text=str(value.get("label","效果"));labels[1].text=duration if not duration.is_empty() else "剩餘 %d 回合" %turns if turns>0 else "即時效果 / 本次效果"
	labels[2].text="套用結果："+str(value.get("result",value.get("label","效果")));labels[3].text=str(value.get("description","沒有額外說明。"))
	var width:=minf(260,viewport_size.x-24);var content_height:=20.0+18.0
	stack.custom_minimum_size.x=0;stack.size.x=width-24
	for label in labels:
		label.size.x=width-24
		content_height+=label.get_theme_font("font").get_multiline_string_size(label.text,HORIZONTAL_ALIGNMENT_LEFT,width-24,label.get_theme_font_size("font_size")).y
	custom_minimum_size=Vector2(width,0);size=Vector2(width,minf(ceilf(content_height)+2,viewport_size.y-24));scroll.scroll_vertical=0
	position=Vector2(clampf(anchor.position.x,12,viewport_size.x-width-12),clampf(anchor.end.y+8,12,viewport_size.y-size.y-12));show()
	for label in labels:label.queue_redraw()
func _input(event: InputEvent) -> void:
	if not visible:return
	if event is InputEventMouseButton and event.pressed and not get_global_rect().has_point(event.position):hide()
	elif event is InputEventScreenTouch and event.pressed and not get_global_rect().has_point(event.position):hide()
