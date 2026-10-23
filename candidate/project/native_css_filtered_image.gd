extends Control
## Persistent native filter passes for the original evolution image layers.
## Source pixels update on asset/size change, filters only when their values change.
const Raw=preload("res://native_css_image_source.gdshader")
const Blur=preload("res://native_cosmetic_blur.gdshader")
const Shadow=preload("res://native_css_image_shadow.gdshader")
const ColorFilter=preload("res://native_css_image_color.gdshader")
const PADDING:=180.0
var passes: Array[Dictionary]=[]
var display: TextureRect
var source_image: Texture2D
var extent:=Vector2i.ONE
var box:=Vector2.ONE
var filter_signature:=""
var active:=true

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	for shader in [Raw,Blur,Blur,Shadow,Blur,Blur,Shadow,ColorFilter]:passes.append(_pass(shader))
	display=TextureRect.new();display.mouse_filter=Control.MOUSE_FILTER_IGNORE;display.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	var shader:=Shader.new();shader.code="shader_type canvas_item;render_mode unshaded,blend_premul_alpha;varying vec4 tint;void vertex(){tint=COLOR;}void fragment(){vec4 c=texture(TEXTURE,UV);COLOR=vec4(c.rgb*tint.rgb*tint.a,c.a*tint.a);}"
	var effect:=ShaderMaterial.new();effect.shader=shader;display.material=effect;add_child(display)
	display.texture=passes[7].view.get_texture()

func _pass(shader: Shader) -> Dictionary:
	var view:=SubViewport.new();view.disable_3d=true;view.transparent_bg=true;view.size=extent;view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(view)
	var quad:=ColorRect.new();quad.size=Vector2(extent);var effect:=ShaderMaterial.new();effect.shader=shader;quad.material=effect;view.add_child(quad)
	return {"view":view,"quad":quad,"effect":effect}

func configure(image: Texture2D,box_size: Vector2) -> void:
	active=true
	if source_image==image and box==box_size:return
	source_image=image;box=box_size;size=box_size;extent=Vector2i((box+Vector2.ONE*PADDING*2).ceil())
	for item in passes:item.view.size=extent;item.quad.size=Vector2(extent)
	display.position=Vector2.ONE*-PADDING;display.size=Vector2(extent)
	var raw: ShaderMaterial=passes[0].effect;raw.set_shader_parameter("source_image",image);raw.set_shader_parameter("surface_size",Vector2(extent));raw.set_shader_parameter("box_size",box);raw.set_shader_parameter("image_size",image.get_size());raw.set_shader_parameter("padding",PADDING)
	passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;filter_signature=""

func apply_filters(filters: Array) -> void:
	var signature:=JSON.stringify(filters);if signature==filter_signature:return
	filter_signature=signature
	var shadows: Array=[];var colors:=PackedVector2Array();var color_started:=false
	for op in filters:
		if op.kind=="drop-shadow":assert(not color_started,"Unsupported shadow after color filter");shadows.append(op)
		else:
			color_started=true
			var kinds: Array=["brightness","contrast","invert","grayscale","sepia","saturate"]
			assert(op.kind in kinds,"Unbound CSS filter "+str(op.kind));colors.append(Vector2(kinds.find(op.kind)+1,float(op.value)))
	assert(shadows.size()<=2 and colors.size()<=8,"Native CSS filter capacity exceeded")
	var previous: Texture2D=passes[0].view.get_texture()
	for i in range(2):
		var offset:=1+i*3
		if i>=shadows.size():
			for n in range(offset,offset+3):passes[n].view.render_target_update_mode=SubViewport.UPDATE_DISABLED
			continue
		var shadow: Dictionary=shadows[i]
		for n in range(2):
			var effect: ShaderMaterial=passes[offset+n].effect;effect.set_shader_parameter("source_texture",previous if n==0 else passes[offset].view.get_texture());effect.set_shader_parameter("pixel_size",Vector2.ONE/Vector2(extent));effect.set_shader_parameter("direction",Vector2.RIGHT if n==0 else Vector2.DOWN);effect.set_shader_parameter("sigma",float(shadow.blur))
		var composite: ShaderMaterial=passes[offset+2].effect;composite.set_shader_parameter("source_texture",previous);composite.set_shader_parameter("shadow_texture",passes[offset+1].view.get_texture());composite.set_shader_parameter("shadow_color",Color(shadow.color[0],shadow.color[1],shadow.color[2],shadow.color[3]));composite.set_shader_parameter("offset_uv",Vector2(shadow.x,shadow.y)/Vector2(extent))
		for n in range(offset,offset+3):passes[n].view.render_target_update_mode=SubViewport.UPDATE_ONCE
		previous=passes[offset+2].view.get_texture()
	var count:=colors.size();while colors.size()<8:colors.append(Vector2.ZERO)
	passes[7].effect.set_shader_parameter("source_texture",previous);passes[7].effect.set_shader_parameter("count",count);passes[7].effect.set_shader_parameter("operations",colors);passes[7].view.render_target_update_mode=SubViewport.UPDATE_ONCE
	var chain: Array=[0]
	for i in range(1,1+shadows.size()*3):chain.append(i)
	chain.append(7)
	for i in range(chain.size()):RenderingServer.viewport_set_parent_viewport(passes[chain[i]].view.get_viewport_rid(),passes[chain[i+1]].view.get_viewport_rid() if i+1<chain.size() else get_viewport().get_viewport_rid())

func bind_live_source(source: SubViewport) -> void:
	RenderingServer.viewport_set_parent_viewport(source.get_viewport_rid(),passes[0].view.get_viewport_rid())
	passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;filter_signature=""

func apply_motion(value: Dictionary,anchor: Vector2) -> void:
	var movement: Transform2D=value.transform;var origin:=box*.5
	position=anchor+origin+movement.origin-movement.basis_xform(origin);rotation=movement.get_rotation();scale=movement.get_scale();modulate.a=float(value.opacity)

func stop() -> void:
	active=false
	for item in passes:item.view.render_target_update_mode=SubViewport.UPDATE_DISABLED
