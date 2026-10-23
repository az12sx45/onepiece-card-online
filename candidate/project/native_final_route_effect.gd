extends Control
const Motion=preload("res://native_final_ritual_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Paint=preload("res://native_final_route_effect.gdshader")
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var glyphs: Array=[]
var rays: Array=[]
var core: Control
var aura: Control
var shade: ColorRect
var started:=0.0
var ending:=-1.0
var epoch:=0
var busy:=false
var frozen_time:=-1.0
func _shade(mode: int,parent: Node,box:=Vector2.ZERO) -> ColorRect:
	var item:=ColorRect.new();item.mouse_filter=Control.MOUSE_FILTER_IGNORE;var effect:=ShaderMaterial.new();effect.shader=Paint;effect.set_shader_parameter("mode",mode);item.material=effect;parent.add_child(item)
	if box!=Vector2.ZERO:item.position=Vector2(-100,-100);item.size=box+Vector2(200,200);effect.set_shader_parameter("box",box)
	return item
func _effect(mode: int,box: Vector2) -> Control:
	var node:=Control.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.size=box;add_child(node);node.set_meta("quad",_shade(mode,node,box));return node
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;shade=_shade(0,self)
	for i in range(2):rays.append(_effect(1,Vector2(100,5)))
	for i in range(4):var glyph=Filtered.new();add_child(glyph);glyphs.append(glyph)
	aura=_effect(3,Vector2(230,230));core=_effect(2,Vector2(34,34));hide();set_process(false)
func _number(style: Dictionary,key: String) -> float:return float(str(style.get(key,"0")).trim_suffix("px").trim_suffix("ms").trim_suffix("rad"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:return
	if not visible and not busy:started=Time.get_ticks_msec()/1000.0;ending=-1
	if str(next.classes).contains("is-ending") and ending<0:ending=Time.get_ticks_msec()/1000.0
	model=next
	if busy:return
	if visible:_tick();return
	epoch+=1;busy=true;_prepare(epoch)
func _prepare(token: int) -> void:
	var paths: Array=[]
	for child in model.children:
		if str(child.classes).contains("final-reveal-poneglyph"):
			var source: String=child.style["--glyph-image"];source=source.trim_prefix("url(\"").trim_suffix("\")");paths.append(source)
	assert(paths.size()==4,"Original final reveal requires four images")
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original final route image missing: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Final route assets timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	for i in range(4):glyphs[i].configure(textures[paths[i]],Vector2(108,108))
	size=Vector2(model.extent.width,model.extent.height);shade.size=size;shade.material.set_shader_parameter("extent",size);shade.material.set_shader_parameter("core",Vector2(_number(model.style,"--core-x"),_number(model.style,"--core-y")));busy=false;show();set_process(true);_tick()
func _transform(node: Control,value: Dictionary,anchor: Vector2,origin: Vector2) -> void:
	var move: Transform2D=value.transform;node.position=anchor+origin+move.origin-move.basis_xform(origin);node.rotation=move.get_rotation();node.scale=move.get_scale();node.modulate.a=value.opacity
func _tick() -> void:
	if busy or model.is_empty():return
	var now:=started+frozen_time if frozen_time>=0 else Time.get_ticks_msec()/1000.0;var elapsed:=now-started;var gi:=0;var ri:=0
	for child in model.children:
		var classes: String=child.classes;var style: Dictionary=child.style
		if classes.contains("final-reveal-poneglyph"):
			var node: Control=glyphs[gi];gi+=1;var t:=elapsed-_number(style,"--glyph-delay")/1000.0;node.visible=t>=0
			if t<0:continue
			var motion:=Motion.sample("finalPoneglyphImageRise",t,node.box);node.apply_motion(motion,Vector2(_number(style,"--glyph-x"),_number(style,"--glyph-y")));node.apply_filters(Motion.sample("finalPoneglyphImageBreathe",fmod(t-1.5,3.6),node.box).filters if t>=1.5 else motion.filters)
		elif classes=="final-reveal-ray":
			var node: Control=rays[ri];ri+=1;var t:=elapsed-_number(style,"--ray-delay")/1000.0;node.visible=t>=0
			if t<0:continue
			node.size=Vector2(_number(style,"--ray-len"),5);var quad: ColorRect=node.get_meta("quad");quad.size=node.size+Vector2(200,200);quad.material.set_shader_parameter("box",node.size);var angle:=_number(style,"--ray-angle");var motion:=Motion.sample("finalRevealRayGrow_0",t,node.size);motion.transform=Transform2D(0,Vector2(0,-2.5))*Transform2D(angle,Vector2.ZERO)*Transform2D(0,motion.transform.get_scale(),0,Vector2.ZERO);_transform(node,motion,Vector2(_number(style,"--ray-x"),_number(style,"--ray-y")),Vector2(0,2.5))
	var center:=Vector2(_number(model.style,"--core-x"),_number(model.style,"--core-y"));core.visible=elapsed>=6.9;aura.visible=elapsed>=7.9
	if core.visible:_transform(core,Motion.sample("finalRevealCoreIgnite",elapsed-6.9,core.size),center,core.size*.5)
	if aura.visible:_transform(aura,Motion.sample("finalRevealAuraBloom",elapsed-7.9,aura.size),center,aura.size*.5)
	shade.material.set_shader_parameter("grid_opacity",Motion.sample("finalRevealGridPulse",fmod(elapsed-1.2,5.2),size).opacity if elapsed>=1.2 else .42);modulate.a=Motion.sample("finalRevealLayerFade",maxf(0,now-ending),size).opacity if ending>=0 else 1.0
func _process(_delta: float) -> void:_tick()
func close_surface() -> void:
	epoch+=1;busy=false;hide();set_process(false)
	for glyph in glyphs:glyph.stop()
func test_ready() -> bool:return visible and not busy
