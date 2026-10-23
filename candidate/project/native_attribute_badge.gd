extends Label
## Permanent HUD element. A deliberate attribute pulse never rebuilds the HUD.
var plate:=ColorRect.new()
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	plate.mouse_filter=Control.MOUSE_FILTER_IGNORE;plate.show_behind_parent=true;plate.material=ShaderMaterial.new();plate.material.shader=preload("res://native_attribute_badge.gdshader");add_child(plate)
	var effect:=Shader.new();effect.code="shader_type canvas_item;uniform float brightness=1.0;uniform float saturation=1.0;void fragment(){float l=dot(COLOR.rgb,vec3(.2126,.7152,.0722));COLOR.rgb=mix(vec3(l),COLOR.rgb,saturation)*brightness;}"
	material=ShaderMaterial.new();material.shader=effect;resized.connect(_layout);_layout()
func _layout() -> void:
	plate.size=size;plate.material.set_shader_parameter("extent",size);pivot_offset=size*.5
func set_attribute(value: String) -> void:
	if text==value:return
	text=value;tooltip_text=value;plate.material.set_shader_parameter("attribute_kind",{"力":1,"速":2,"技":3}.get(value,0))
func pulse(value: Dictionary) -> void:
	var m: Transform2D=value.transform;scale=m.get_scale();var brightness:=1.0;var saturation:=1.0
	for op in value.filters:
		if op.kind=="brightness":brightness=op.value
		elif op.kind=="saturate":saturation=op.value
	material.set_shader_parameter("brightness",brightness);material.set_shader_parameter("saturation",saturation);plate.material.set_shader_parameter("brightness",brightness);plate.material.set_shader_parameter("saturation",saturation)
func clear_pulse() -> void:pulse({"transform":Transform2D.IDENTITY,"filters":[]})
