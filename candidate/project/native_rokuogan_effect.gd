extends Control
## Persistent image/filter nodes for the original Lucci six-king-gun cinematic.
const Motion=preload('res://native_rokuogan_motion.gd')
const Filtered=preload('res://native_css_ordered_image.gd')
var cache: Node
var cast: Control
var direct_cast:=TextureRect.new()
var impact: Control
var background:=ColorRect.new()
var shock:=ColorRect.new()
var flash:=ColorRect.new()
var began:=0
var frozen_time:=-1.0
var configured_size:=Vector2.ZERO

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background)
	cast=Filtered.new();add_child(cast)
	direct_cast.mouse_filter=Control.MOUSE_FILTER_IGNORE;direct_cast.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;direct_cast.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;direct_cast.texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var cast_material:=ShaderMaterial.new();cast_material.shader=preload('res://native_rokuogan_cast.gdshader');direct_cast.material=cast_material;add_child(direct_cast)
	shock.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var effect:=ShaderMaterial.new();effect.shader=preload('res://native_rokuogan_shock.gdshader');shock.material=effect;add_child(shock)
	impact=Filtered.new();add_child(impact)
	flash.mouse_filter=Control.MOUSE_FILTER_IGNORE;flash.color=Color.WHITE;add_child(flash)
	hide();set_process(false)
func warm() -> bool:
	var ready:=true
	for path in Motion.data.assets.values():
		if cache.request(str(path))==null:ready=false
	return ready
func start() -> void:
	assert(warm(),'Original Lucci textures must be ready')
	began=Time.get_ticks_msec();configured_size=Vector2.ZERO;show();set_process(true);_tick()
func _layout() -> void:
	if configured_size==size:return
	configured_size=size
	var layout:=Motion.layout(size)
	background.size=size
	cast.configure(cache.request(Motion.data.assets.cast),layout.cast.size)
	direct_cast.texture=cache.request(Motion.data.assets.cast);direct_cast.size=layout.cast.size
	impact.configure(cache.request(Motion.data.assets.impact),layout.impact.size)
	impact.apply_filters([{'kind':'drop-shadow','x':0.0,'y':0.0,'blur':20.0,'color':[1.0,1.0,1.0,.92]},{'kind':'drop-shadow','x':0.0,'y':0.0,'blur':44.0,'color':[225.0/255,39.0/255,55.0/255,.82]}])
	shock.size=layout.shock.size;shock.material.set_shader_parameter('extent',shock.size)
	flash.position=layout.shock.position;flash.size=layout.shock.size
func _tick() -> void:
	if not visible:return
	_layout()
	var time:=frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-began)/1000
	var layout:=Motion.layout(size)
	var layer:=Motion.sample('lucciRokuoganLayer',time,size);modulate.a=layer.opacity;background.color=layer.background
	var cast_motion:=Motion.sample('lucciRokuoganCast',time,layout.cast.size)
	var needs_blur: bool=cast_motion.filters.any(func(op):return op.kind=='blur' and float(op.value)>.001)
	if needs_blur and not cast.visible:cast.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;cast.filter_signature=''
	cast.visible=needs_blur;direct_cast.visible=not needs_blur
	if needs_blur:cast.apply_motion(cast_motion,layout.cast.position);cast.apply_filters(cast_motion.filters)
	else:
		cast.stop()
		var movement: Transform2D=cast_motion.transform;var center: Vector2=layout.cast.size*.5
		direct_cast.position=layout.cast.position+center+movement.origin-movement.basis_xform(center);direct_cast.scale=movement.get_scale();direct_cast.modulate.a=cast_motion.opacity
		var operations:=PackedVector2Array()
		for op in cast_motion.filters:
			if op.kind!='blur':operations.append(Vector2(['brightness','contrast','saturate'].find(op.kind)+1,op.value))
		direct_cast.material.set_shader_parameter('count',operations.size())
		while operations.size()<8:operations.append(Vector2.ZERO)
		direct_cast.material.set_shader_parameter('operations',operations)
	impact.apply_motion(Motion.sample('lucciRokuoganImpact',time,layout.impact.size),layout.impact.position)
	var shock_motion:=Motion.sample('lucciRokuoganShock',time,layout.shock.size)
	var transform: Transform2D=shock_motion.transform;var origin: Vector2=layout.shock.size*.5
	shock.position=layout.shock.position+origin+transform.origin-transform.basis_xform(origin);shock.scale=transform.get_scale();shock.modulate.a=shock_motion.opacity
	flash.modulate.a=Motion.sample('lucciRokuoganFlash',time,layout.shock.size).opacity
func _process(_delta: float) -> void:_tick()
func stop() -> void:
	hide();set_process(false);cast.stop();impact.stop()
