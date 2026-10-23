extends HBoxContainer
signal detail_requested(value: Dictionary,anchor: Rect2)
var battle_view: Control
var signature:=""
var builds:=0
var rows: Array=[]
var buttons: Array[Button]=[]
var images: Array[TextureRect]=[]
func _ready() -> void:
	add_theme_constant_override("separation",3)
	battle_view.cache.asset_failed.connect(_failed)
func _failed(path: String,_error: int) -> void:
	for index in range(images.size()):
		if str(images[index].get_meta("wanted_asset",""))==path and str(rows[index].get("fallback",""))!=path:battle_view._image(images[index],str(rows[index].fallback))
func apply_source(value: Array) -> void:
	var next:=JSON.stringify(value)
	if next==signature:return
	signature=next;rows=value;builds+=1
	for child in get_children():remove_child(child);child.queue_free()
	buttons.clear();images.clear()
	for entry in rows:
		var button:=Button.new();button.custom_minimum_size=Vector2(18,18);button.flat=true;button.focus_mode=Control.FOCUS_NONE;button.tooltip_text=str(entry.label);add_child(button);buttons.append(button)
		var icon:=TextureRect.new();images.append(icon);icon.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;icon.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;icon.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(icon);icon.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);battle_view._image(icon,str(entry.iconUrl))
		var badge:=Label.new();badge.text=str(entry.get("badge",""));badge.mouse_filter=Control.MOUSE_FILTER_IGNORE;badge.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;badge.vertical_alignment=VERTICAL_ALIGNMENT_BOTTOM;badge.add_theme_font_size_override("font_size",9);badge.add_theme_constant_override("outline_size",2);badge.add_theme_color_override("font_outline_color",Color("051020"));badge.add_theme_color_override("font_color",Color("ff9999") if "is-debuff" in str(entry.get("badgeClass","")) else Color("91ffd0") if "is-buff" in str(entry.get("badgeClass","")) else Color("fff4d0"));button.add_child(badge);badge.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		button.pressed.connect(func():detail_requested.emit(entry.detail,button.get_global_rect()))
func assets_ready() -> bool:
	for icon in images:
		if icon.texture==null:return false
	return true
func test_press(index: int) -> void:
	assert(index>=0 and index<buttons.size());var point:=buttons[index].get_global_rect().get_center();var motion:=InputEventMouseMotion.new();motion.position=point;motion.global_position=point;get_viewport().push_input(motion,true)
	for down in [true,false]:
		var event:=InputEventMouseButton.new();event.position=point;event.global_position=point;event.button_index=MOUSE_BUTTON_LEFT;event.pressed=down;get_viewport().push_input(event,true)
