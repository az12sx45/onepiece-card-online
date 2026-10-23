extends Control
const Icon=preload("res://native_item_icon.gd")
var view:=SubViewport.new()
var icon:=Icon.new()
var label:=Label.new()
var display:=TextureRect.new()
var reflection:=TextureRect.new()
var model: Dictionary={}
var textures: Dictionary={}
var materials: Array=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;view.disable_3d=true;view.transparent_bg=true;view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(view);view.add_child(icon);view.add_child(label)
	label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(900));label.add_theme_font_size_override("font_size",11);label.add_theme_color_override("font_color",Color("fff0be"))
	for image in [display,reflection]:
		image.mouse_filter=Control.MOUSE_FILTER_IGNORE;image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.texture=view.get_texture();var effect:=ShaderMaterial.new();effect.shader=preload("res://native_compass_card.gdshader");image.material=effect;materials.append(effect);add_child(image)
	materials[1].set_shader_parameter("reflection",true);resized.connect(_layout)
func present(data: Dictionary,loaded: Dictionary) -> void:
	if data==model and loaded==textures:return
	model=data;textures=loaded;icon.present(data.icon,loaded);label.text=data.name;modulate.a=data.opacity;z_index=int(data.order)
	for effect in materials:
		effect.set_shader_parameter("angle",deg_to_rad(float(data.angle)));effect.set_shader_parameter("card_scale",data.scale);effect.set_shader_parameter("brightness",.18 if data.locked else 1.08 if data.selected else .68);effect.set_shader_parameter("gray",1.0 if data.locked else 0.0)
	_layout()
func _layout() -> void:
	if size.x<1 or size.y<1:return
	view.size=Vector2i(size.ceil());icon.size=Vector2(size.x,size.x);label.position=Vector2(0,size.x);label.size=Vector2(size.x,20);display.size=size;reflection.size=size;reflection.position=Vector2(0,size.y+7)
	for effect in materials:effect.set_shader_parameter("box_size",size)
	view.render_target_update_mode=SubViewport.UPDATE_ONCE
