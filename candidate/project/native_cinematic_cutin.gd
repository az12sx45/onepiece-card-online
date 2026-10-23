extends ColorRect
const Motion=preload("res://native_saga_motion.gd")
const Fonts=preload("res://native_fonts.gd")
var label: Label
var anchor:=Vector2.ZERO
var at:=-1.0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;material=ShaderMaterial.new();material.shader=preload("res://native_kyubi_art.gdshader");material.set_shader_parameter("kind",2)
	label=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_override("font",Fonts.weighted(950));label.add_theme_color_override("font_color",Color("301406"));label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;add_child(label)
func layout(viewport: Vector2) -> void:
	size=Vector2(minf(760,viewport.x*.88),42 if viewport.y<=520 else 68);anchor=viewport*Vector2(.5,.18);label.size=size;label.add_theme_font_size_override("font_size",16 if viewport.y<=520 else 28);material.set_shader_parameter("extent",size)
func update_state(text: String,started: float) -> void:
	if label.text!=text:label.text=text
	at=started
func render_state(ms: float) -> void:
	var state:=Motion.sample("cutin",(ms-at)/1000.0,size,size);var m: Transform2D=state.transform;var origin:=size*.5
	position=anchor+origin+m.origin-m.basis_xform(origin);rotation=m.get_rotation();scale=m.get_scale();modulate.a=state.opacity if at>=0 else 0.0
