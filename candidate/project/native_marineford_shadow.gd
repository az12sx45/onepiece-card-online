extends Control
## Original slot-img alpha shadow. Blur is rendered once per image/size;
## following the portrait transform does not reblur or rebuild nodes.
var filter=preload("res://native_css_ordered_image.gd").new()
var display:=TextureRect.new()
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(filter);filter.display.hide()
	display.mouse_filter=Control.MOUSE_FILTER_IGNORE;display.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	var paint:=Shader.new();paint.code="shader_type canvas_item; render_mode unshaded; varying vec4 tint; void vertex(){tint=COLOR;} void fragment(){COLOR=vec4(0.0,0.0,0.0,texture(TEXTURE,UV).a*.55)*tint;}"
	var material:=ShaderMaterial.new();material.shader=paint;display.material=material;add_child(display)
func configure(image: Texture2D,extent: Vector2) -> void:
	filter.configure(image,extent);filter.apply_filters([{"kind":"drop-shadow","x":0.0,"y":12.0,"blur":16.0,"color":[0,0,0,.55]}])
	display.texture=filter.passes[2].view.get_texture();display.position=Vector2(-filter.PADDING,-filter.PADDING+12);display.size=Vector2(filter.extent)
func follow(portrait: TextureRect) -> void:
	visible=portrait.visible;position=portrait.position;scale=portrait.scale;rotation=portrait.rotation;modulate.a=portrait.modulate.a
