extends Control
## Preserve authored CSS filter order, including colors before shadows and
## multiple chained shadows. GPU passes persist across animation updates.
const Raw=preload("res://native_css_image_source.gdshader")
const AlphaBlur=preload("res://native_css_soft_shadow.gdshader")
const RgbaBlur=preload("res://native_css_rgba_blur.gdshader")
const Shadow=preload("res://native_css_image_shadow.gdshader")
const ColorFilter=preload("res://native_css_image_color.gdshader")
const PADDING:=180.0
var passes: Array[Dictionary]=[]
var display: TextureRect
var source_image: Texture2D
var extent:=Vector2i.ONE
var box:=Vector2.ONE
var filter_signature:=""
var configurations:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	display=TextureRect.new();display.mouse_filter=Control.MOUSE_FILTER_IGNORE;display.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	var shader:=Shader.new();shader.code="shader_type canvas_item;render_mode unshaded,blend_premul_alpha;varying vec4 tint;void vertex(){tint=COLOR;}void fragment(){vec4 c=texture(TEXTURE,UV);COLOR=vec4(c.rgb*tint.rgb*tint.a,c.a*tint.a);}"
	var effect:=ShaderMaterial.new();effect.shader=shader;display.material=effect;add_child(display)
	_pass(0,Raw)

func _pass(index: int,shader: Shader,target_size:=Vector2i.ZERO) -> Dictionary:
	assert(index<24,"Unbounded CSS filter pass chain")
	while passes.size()<=index:
		var viewport:=SubViewport.new();viewport.disable_3d=true;viewport.transparent_bg=true;viewport.size=extent;viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(viewport)
		var quad:=ColorRect.new();quad.size=Vector2(extent);var material:=ShaderMaterial.new();quad.material=material;viewport.add_child(quad)
		passes.append({"view":viewport,"quad":quad,"effect":material})
	var item: Dictionary=passes[index]
	var dimensions: Vector2i=extent if target_size==Vector2i.ZERO else target_size
	if item.view.size!=dimensions:item.view.size=dimensions;item.quad.size=Vector2(dimensions)
	if item.effect.shader!=shader:item.effect.shader=shader
	return item

func configure(image: Texture2D,box_size: Vector2) -> void:
	if source_image==image and box==box_size:return
	source_image=image;box=box_size;size=box_size;extent=Vector2i((box+Vector2.ONE*PADDING*2).ceil());configurations+=1
	for item in passes:item.view.size=extent;item.quad.size=Vector2(extent)
	display.position=Vector2.ONE*-PADDING;display.size=Vector2(extent)
	var raw: ShaderMaterial=passes[0].effect;raw.set_shader_parameter("source_image",image);raw.set_shader_parameter("surface_size",Vector2(extent));raw.set_shader_parameter("box_size",box);raw.set_shader_parameter("image_size",image.get_size());raw.set_shader_parameter("padding",PADDING)
	passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;filter_signature=""

func apply_filters(filters: Array) -> void:
	var signature:=JSON.stringify(filters);if signature==filter_signature:return
	filter_signature=signature
	var groups: Array=[];var colors: Array=[];var kinds: Array=["brightness","contrast","invert","grayscale","sepia","saturate"]
	for op in filters:
		if op.kind in kinds:colors.append(Vector2(kinds.find(op.kind)+1,float(op.value)))
		else:
			if not colors.is_empty():groups.append({"kind":"color","values":colors});colors=[]
			assert(op.kind in ["drop-shadow","blur"],"Unsupported ordered CSS filter "+str(op.kind));groups.append(op)
	if not colors.is_empty():groups.append({"kind":"color","values":colors})
	var previous: Texture2D=passes[0].view.get_texture();var index:=1
	for group in groups:
		if group.kind=="color":
			var item:=_pass(index,ColorFilter);var operations:=PackedVector2Array(group.values);var count:=operations.size();assert(count<=8)
			while operations.size()<8:operations.append(Vector2.ZERO)
			item.effect.set_shader_parameter("source_texture",previous);item.effect.set_shader_parameter("count",count);item.effect.set_shader_parameter("operations",operations);item.view.render_target_update_mode=SubViewport.UPDATE_ONCE;previous=item.view.get_texture();index+=1
		else:
			var source:=previous
			# Full-resolution color/portrait output; only soft shadow convolution
			# uses quarter resolution and dense taps to avoid strided blur bands.
			var blur_size:=Vector2i((Vector2(extent)/4.0).ceil()) if group.kind=="drop-shadow" else extent
			for direction in [Vector2.RIGHT,Vector2.DOWN]:
				var item:=_pass(index,AlphaBlur if group.kind=="drop-shadow" else RgbaBlur,blur_size);item.effect.set_shader_parameter("source_texture",previous);item.effect.set_shader_parameter("pixel_size",Vector2.ONE/Vector2(blur_size));item.effect.set_shader_parameter("direction",direction);item.effect.set_shader_parameter("sigma",float(group.blur)/4.0 if group.kind=="drop-shadow" else float(group.value));item.view.render_target_update_mode=SubViewport.UPDATE_ONCE;previous=item.view.get_texture();index+=1
			if group.kind=="drop-shadow":
				var item:=_pass(index,Shadow);item.effect.set_shader_parameter("source_texture",source);item.effect.set_shader_parameter("shadow_texture",previous);item.effect.set_shader_parameter("shadow_color",Color(group.color[0],group.color[1],group.color[2],group.color[3]));item.effect.set_shader_parameter("offset_uv",Vector2(group.x,group.y)/Vector2(extent));item.view.render_target_update_mode=SubViewport.UPDATE_ONCE;previous=item.view.get_texture();index+=1
	for i in range(index,passes.size()):passes[i].view.render_target_update_mode=SubViewport.UPDATE_DISABLED
	display.texture=previous
	# A ViewportTexture is a live producer, not a static image. Declare the
	# render dependency chain so UPDATE_ONCE consumers see this frame's pixels.
	# Sibling viewports otherwise sample the previous (initially empty) frame.
	for i in range(index):
		RenderingServer.viewport_set_parent_viewport(passes[i].view.get_viewport_rid(),passes[i+1].view.get_viewport_rid() if i+1<index else get_viewport().get_viewport_rid())

func bind_live_source(source: SubViewport) -> void:
	RenderingServer.viewport_set_parent_viewport(source.get_viewport_rid(),passes[0].view.get_viewport_rid())
	passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;filter_signature=""

func apply_motion(value: Dictionary,anchor: Vector2,origin_ratio:=Vector2(.5,.5)) -> void:
	var movement: Transform2D=value.transform;var origin:=box*origin_ratio
	position=anchor+origin+movement.origin-movement.basis_xform(origin);rotation=movement.get_rotation();scale=movement.get_scale();modulate.a=float(value.opacity)

func stop() -> void:
	for item in passes:item.view.render_target_update_mode=SubViewport.UPDATE_DISABLED
