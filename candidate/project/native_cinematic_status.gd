extends Control
## Original status-message text above cinematic layers; compact on short phones.
const Fonts=preload("res://native_fonts.gd")
var label: Label
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=40
	var background:=Panel.new();background.mouse_filter=Control.MOUSE_FILTER_IGNORE;background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var style:=StyleBoxFlat.new();style.bg_color=Color(0,0,0,.58);style.border_color=Color(1,.91,.74,.3);style.set_border_width_all(1);style.set_corner_radius_all(18);background.add_theme_stylebox_override("panel",style);add_child(background)
	label=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_override("font",Fonts.weighted(900));label.add_theme_color_override("font_color",Color("fff0bd"));label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;add_child(label);hide()
func layout(viewport: Vector2) -> void:
	var short:=viewport.y<=520;size=Vector2(minf(720,viewport.x*.9),20 if short else 32);position=Vector2((viewport.x-size.x)*.5,1 if short else 18);label.position=Vector2(8,0);label.size=size-Vector2(16,0);label.add_theme_font_size_override("font_size",9 if short else 13)
func update_state(text: String,shown: bool) -> void:
	if label.text!=text:label.text=text
	visible=shown
