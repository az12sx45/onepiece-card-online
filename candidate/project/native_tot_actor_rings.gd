extends Control
## Original outer/inner/wrapper gradients and borders, independent of image motion.
var world:="player"
var materials: Array[ShaderMaterial]=[]
var boxes: Array[ColorRect]=[]
var styles: Array=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	styles=JSON.parse_string(FileAccess.get_file_as_string("res://tot-portrait-geometry.json")).styles[world]
	for style in styles:
		var box:=ColorRect.new();box.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(box);boxes.append(box)
		var material:=ShaderMaterial.new();material.shader=preload("res://native_tot_actor.gdshader");material.set_shader_parameter("style_mode",true);box.material=material;materials.append(material)
		material.set_shader_parameter("gradient_angle",style.angle);material.set_shader_parameter("gradient_middle",style.stops[1].at)
		for i in range(3):material.set_shader_parameter(["gradient_a","gradient_b","gradient_c"][i],_color(style.stops[i].color))
		material.set_shader_parameter("border_color",_color(style.borderColor))
func _color(value: Array) -> Color:return Color(value[0],value[1],value[2],value[3])
func layout_boxes(extent: Vector2,geometry: Dictionary,source_scale: float) -> void:
	size=extent
	var insets:=[0.0,geometry.innerInset,geometry.wrapperInset]
	for i in range(3):
		var inset: float=insets[i];var rect:=Rect2(Vector2.ONE*inset,(extent-Vector2.ONE*inset*2).max(Vector2.ONE))
		boxes[i].position=rect.position;boxes[i].size=rect.size
		materials[i].set_shader_parameter("style_rect",Vector4(rect.position.x,rect.position.y,rect.size.x,rect.size.y));materials[i].set_shader_parameter("style_radius",float(styles[i].radius)*source_scale);materials[i].set_shader_parameter("border_width",float(styles[i].borderWidth)*source_scale)
