extends TextureRect
## Source-authored layers rendered with persistent GPU passes. Static previews
## render only when dirty; the original Nika pulse updates its dependent passes.
const SourceShader=preload("res://native_cosmetic_source.gdshader")
const BlurShader=preload("res://native_cosmetic_blur.gdshader")
const CompositeShader=preload("res://native_cosmetic_composite.gdshader")
const BaseShader=preload("res://native_cosmetic_base.gdshader")
const Ease=preload("res://native_tavern_host_motion.gd")
var base: Dictionary={}
var pool: Array[Dictionary]=[]
var model: Dictionary={}
var images: Dictionary={}
var layers: Array=[]
var extent:=Vector2i(1,1)
var signature:=""
var clock_start:=0
var pulse_index:=-1
var frozen_time:=-1.0
var active:=false
var configured_count:=0
var layer_shader: Shader
func _ready() -> void:
	expand_mode=TextureRect.EXPAND_IGNORE_SIZE;mouse_filter=Control.MOUSE_FILTER_IGNORE;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	layer_shader=Shader.new();layer_shader.code=SourceShader.code.replace("source_image: filter_linear,","source_image: filter_linear_mipmap,")
	var shader:=Shader.new();shader.code="shader_type canvas_item;render_mode unshaded,blend_premul_alpha;void fragment(){COLOR=texture(TEXTURE,UV);}"
	var display:=ShaderMaterial.new();display.shader=shader;material=display;base=_pass(BaseShader);texture=base.view.get_texture();resized.connect(_resize);_resize()
func _pass(shader: Shader) -> Dictionary:
	var view:=SubViewport.new();view.disable_3d=true;view.transparent_bg=true;view.size=extent;view.render_target_update_mode=SubViewport.UPDATE_DISABLED;view.canvas_item_default_texture_filter=Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR;add_child(view)
	var quad:=ColorRect.new();quad.size=Vector2(extent);quad.color=Color.WHITE;var effect:=ShaderMaterial.new();effect.shader=shader;quad.material=effect;view.add_child(quad)
	return {"view":view,"quad":quad,"effect":effect}
func _new_layer() -> Dictionary:return {"raw":_pass(SourceShader),"horizontal":_pass(BlurShader),"vertical":_pass(BlurShader),"composite":_pass(CompositeShader)}
func _resize() -> void:
	var next:=Vector2i(maxi(1,roundi(size.x)),maxi(1,roundi(size.y)));if next==extent:return
	extent=next
	if not base.is_empty():base.view.size=extent;base.quad.size=Vector2(extent)
	for layer in pool:
		for pass_data in layer.values():pass_data.view.size=extent;pass_data.quad.size=Vector2(extent)
	signature=""
	if not model.is_empty():configure(model,images)
func configure(value: Dictionary,textures: Dictionary) -> void:
	var next_signature:=JSON.stringify([value.image,value.selected,value.layers,extent.x,extent.y]);if not active:clock_start=Time.get_ticks_msec()
	active=true
	if next_signature==signature:return
	signature=next_signature;model=value;images=textures;clock_start=Time.get_ticks_msec();pulse_index=-1;configured_count+=1
	layers=model.layers.duplicate(true)
	layers.append({"image":model.image,"index":999,"z":4,"portrait":true,"strength":1.0,"opacity":1.0,"pulse":false,"blend":"normal","rotate":0.0,"flipX":1.0,"flipY":1.0})
	layers.sort_custom(func(a,b):return float(a.z)<float(b.z) or (float(a.z)==float(b.z) and int(a.index)<int(b.index)))
	while pool.size()<layers.size():pool.append(_new_layer())
	var card_size:=Vector2(float(extent.x)*0.5,minf(float(extent.x)*0.5,float(extent.y)*0.88));var origin: Vector2=(Vector2(extent)-card_size)/2.0
	# The source keeps its 1 px border even when transparent. Percentage-sized
	# absolute children use the padding box, and Blink layouts quantize to 1/64 px.
	var inner_size:=card_size-Vector2(2,2);var inner_origin:=origin+Vector2.ONE
	base.effect.set_shader_parameter("surface_size",Vector2(extent));base.effect.set_shader_parameter("card_rect",Vector4(origin.x,origin.y,card_size.x,card_size.y));base.effect.set_shader_parameter("has_frame",not str(model.selected).is_empty());_dirty(base)
	var previous: Texture2D=base.view.get_texture()
	for i in range(pool.size()):
		var item: Dictionary=pool[i]
		if i>=layers.size():
			for pass_data in item.values():pass_data.view.render_target_update_mode=SubViewport.UPDATE_DISABLED
			item.raw.effect.set_shader_parameter("source_image",null);continue
		var layer: Dictionary=layers[i];var is_portrait: bool=layer.get("portrait",false);var img: Texture2D=images[layer.image];var inset: Vector2=(inner_size*.035*64.0).floor()/64.0
		var element: Vector2=inner_size-inset*2 if is_portrait else (inner_size*Vector2(layer.w,layer.h)/100.0*64.0).floor()/64.0
		var position_value: Vector2=origin+card_size*.5 if is_portrait else inner_origin+Vector2(Vector2i(inner_size*Vector2(layer.x,layer.y)/100.0*64.0))/64.0
		var raw: ShaderMaterial=item.raw.effect;raw.shader=SourceShader if is_portrait else layer_shader;raw.set_shader_parameter("source_image",img);raw.set_shader_parameter("surface_size",Vector2(extent));raw.set_shader_parameter("image_size",img.get_size());raw.set_shader_parameter("element_size",element);raw.set_shader_parameter("center",position_value);raw.set_shader_parameter("angle",deg_to_rad(layer.rotate));raw.set_shader_parameter("flip",Vector2(layer.flipX,layer.flipY));raw.set_shader_parameter("portrait",is_portrait)
		raw.set_shader_parameter("brightness",1.04 if is_portrait else layer.strength);raw.set_shader_parameter("saturation",1.06 if is_portrait else layer.strength);raw.set_shader_parameter("contrast",1.06 if is_portrait else layer.strength)
		for pair in [["horizontal",Vector2(1,0),item.raw.view.get_texture()],["vertical",Vector2(0,1),item.horizontal.view.get_texture()]]:
			var effect: ShaderMaterial=item[pair[0]].effect;effect.set_shader_parameter("source_texture",pair[2]);effect.set_shader_parameter("pixel_size",Vector2.ONE/Vector2(extent));effect.set_shader_parameter("direction",pair[1]);effect.set_shader_parameter("sigma",10.0*float(layer.strength))
		var composite: ShaderMaterial=item.composite.effect;composite.set_shader_parameter("source_texture",item.raw.view.get_texture());composite.set_shader_parameter("shadow_texture",item.vertical.view.get_texture());composite.set_shader_parameter("backdrop_texture",previous);composite.set_shader_parameter("opacity",layer.opacity);composite.set_shader_parameter("shadow_color",Color(1,214.0/255,112.0/255,0 if is_portrait else 0.3));composite.set_shader_parameter("blend_mode",1 if layer.blend=="screen" else 2 if layer.blend=="multiply" else 0)
		previous=item.composite.view.get_texture()
		for pass_data in item.values():_dirty(pass_data)
		if layer.pulse:pulse_index=i
	texture=previous
	if pulse_index>=0:_pulse(0.0 if frozen_time<0 else frozen_time)
func _dirty(pass_data: Dictionary) -> void:pass_data.view.render_target_update_mode=SubViewport.UPDATE_ONCE
func _process(_delta: float) -> void:
	if active and is_visible_in_tree() and pulse_index>=0 and frozen_time<0:_pulse(float(Time.get_ticks_msec()-clock_start)/1000.0)
func _pulse(time: float) -> void:
	var loop:=fposmod(time,5.6);var factor:=Ease._ease((loop if loop<=2.8 else 5.6-loop)/2.8);var item: Dictionary=pool[pulse_index]
	item.raw.effect.set_shader_parameter("brightness",lerpf(.94,1.08,factor));item.raw.effect.set_shader_parameter("saturation",1.0);item.raw.effect.set_shader_parameter("contrast",1.0)
	for name in ["horizontal","vertical"]:item[name].effect.set_shader_parameter("sigma",lerpf(12,24,factor))
	item.composite.effect.set_shader_parameter("opacity",lerpf(.58,.84,factor));item.composite.effect.set_shader_parameter("shadow_color",Color(1,1,1,lerpf(.34,.54,factor)))
	for pass_data in item.values():_dirty(pass_data)
	for i in range(pulse_index+1,layers.size()):_dirty(pool[i].composite)
func stop() -> void:
	active=false
	if not base.is_empty():base.view.render_target_update_mode=SubViewport.UPDATE_DISABLED
	for layer in pool:
		for pass_data in layer.values():pass_data.view.render_target_update_mode=SubViewport.UPDATE_DISABLED
func test_freeze(time: float) -> void:frozen_time=time;if pulse_index>=0:_pulse(time)
func test_identity_json() -> String:
	var ids: Array=[configured_count,base.view.get_instance_id(),texture.get_rid().get_id()]
	for layer in pool:for pass_data in layer.values():ids.append(pass_data.view.get_instance_id())
	return JSON.stringify(ids)
func test_geometry_json() -> String:
	var card_size:=Vector2(float(extent.x)*0.5,minf(float(extent.x)*0.5,float(extent.y)*0.88));var origin: Vector2=(Vector2(extent)-card_size)/2.0;var result: Array=[];var portrait_rect: Array=[]
	for i in range(layers.size()):
		var raw: ShaderMaterial=pool[i].raw.effect;var element: Vector2=raw.get_shader_parameter("element_size");var center: Vector2=raw.get_shader_parameter("center")
		if layers[i].get("portrait",false):portrait_rect=[center.x-element.x/2,center.y-element.y/2,element.x,element.y];continue
		var angle: float=raw.get_shader_parameter("angle");var flip: Vector2=raw.get_shader_parameter("flip");var composite: ShaderMaterial=pool[i].composite.effect
		result.append({"image":layers[i].image,"width":element.x,"height":element.y,"left":center.x-origin.x-1,"top":center.y-origin.y-1,"opacity":composite.get_shader_parameter("opacity"),"z":layers[i].z,"matrix":[cos(angle)*flip.x,sin(angle)*flip.x,-sin(angle)*flip.y,cos(angle)*flip.y,-element.x/2,-element.y/2],"brightness":raw.get_shader_parameter("brightness"),"sigma":pool[i].horizontal.effect.get_shader_parameter("sigma"),"shadowAlpha":composite.get_shader_parameter("shadow_color").a})
	return JSON.stringify({"card":[origin.x,origin.y,card_size.x,card_size.y],"portrait":portrait_rect,"layers":result})
