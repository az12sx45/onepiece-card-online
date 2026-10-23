extends Control
## BoardShared.showToast: original lifetime, stacking, color and dimensions.
var entries: Array[Dictionary]=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	resized.connect(_layout)
func show_message(text: String) -> void:
	var panel:=PanelContainer.new();panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var style:=StyleBoxFlat.new();style.bg_color=Color(244/255.0,252/255.0,1,.84);style.border_color=Color(1,1,1,.78);style.set_border_width_all(1);style.set_corner_radius_all(16);style.content_margin_left=14;style.content_margin_right=14;style.content_margin_top=12;style.content_margin_bottom=12;style.shadow_color=Color(33/255.0,102/255.0,132/255.0,.18);style.shadow_size=32;style.shadow_offset=Vector2(0,18);panel.add_theme_stylebox_override("panel",style)
	var label:=Label.new();label.text=text;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_override("font",preload("res://native_fonts.gd").base());label.add_theme_font_size_override("font_size",16);label.add_theme_color_override("font_color",Color("27546b"));panel.add_child(label);add_child(panel)
	entries.append({"panel":panel,"label":label,"expires":Time.get_ticks_msec()+2800});_layout()
	call_deferred("_layout")
func _layout() -> void:
	var width:=minf(size.x*.92,420);var bottom:=size.y-18
	for index in range(entries.size()-1,-1,-1):
		var panel: PanelContainer=entries[index].panel
		panel.size.x=width;panel.size.y=panel.get_combined_minimum_size().y
		bottom-=panel.size.y;panel.position=Vector2((size.x-width)/2,bottom);bottom-=10
func _process(_delta: float) -> void:
	var changed:=false
	for index in range(entries.size()-1,-1,-1):
		if Time.get_ticks_msec()>=entries[index].expires:
			entries[index].panel.queue_free();entries.remove_at(index);changed=true
	if changed:_layout()
func clear() -> void:
	for entry in entries:entry.panel.queue_free()
	entries.clear()
func test_count() -> int:return entries.size()
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for entry in entries:
		if not bounds.encloses(entry.panel.get_rect()):return false
		if not entry.panel.get_global_rect().encloses(entry.label.get_global_rect()):return false
	return true
