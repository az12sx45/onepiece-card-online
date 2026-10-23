extends Control
## Persistent original cultivation layers; authored CSS timelines drive transforms.
const Motion=preload("res://native_research_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var tracks: Dictionary={}
var textures: Dictionary={}
var light:=Color.WHITE
var core:=Color.WHITE
var rgb:=Color.WHITE
var tick:=-1
var completed:=false
func _ready() -> void:mouse_filter=Control.MOUSE_FILTER_IGNORE;set_process(false)
func configure(page: Dictionary,images: Dictionary) -> void:
	custom_minimum_size=Vector2(190,190);size=custom_minimum_size
	for part in str(page.colors).split(";"):
		var pair:=part.split(":",true,1)
		if pair.size()!=2:continue
		if pair[0]=="--cultivation-light":light=Color(pair[1])
		elif pair[0]=="--cultivation-core":core=Color(pair[1])
		elif pair[0]=="--cultivation-rgb":var c:=pair[1].split(" ");rgb=Color(float(c[0])/255,float(c[1])/255,float(c[2])/255)
	var chamber:=TextureRect.new();chamber.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;chamber.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;chamber.texture=images[page.chamber];chamber.size=size;chamber.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(chamber)
	completed=page.result!=null
	if not page.factorImage.image.is_empty():_portrait("research-factor-dissolve",images.get(page.factorImage.image),Vector2(.4,.34),Vector2(.2,.37),false)
	if not page.bubble.image.is_empty():_portrait("research-bubble-reveal",images.get(page.bubble.image),Vector2(.39,.32),Vector2(.22,.4),true)
	var energy:=_energy("research-energy-build",self,Vector2(.39,.33)*size,Vector2(.22,.4)*size,false,false)
	_energy("research-bubble-shell",energy,Vector2(-.34,1.06)*energy.size-Vector2(0,energy.size.x*1.68),Vector2.ONE*energy.size.x*1.68,true,false)
	_energy("research-bubble-pop",self,Vector2(.43,.38)*size,Vector2.ONE*.14*size.x,true,true)
	for name in tracks:
		tracks[name].node.modulate.a=1 if name=="research-factor-dissolve" or (completed and name=="research-bubble-reveal") else 0
	if completed and textures.has("research-bubble-reveal"):_clip("research-bubble-reveal",[72,50,50])
func _portrait(name: String,texture: Texture2D,anchor: Vector2,extent: Vector2,bubble: bool) -> void:
	if texture==null:return
	var box:=extent*size;var view:=SubViewport.new();view.disable_3d=true;view.transparent_bg=true;view.size=Vector2i((box*2).ceil());view.render_target_update_mode=SubViewport.UPDATE_ONCE;add_child(view)
	var quad:=ColorRect.new();quad.size=Vector2(view.size);var effect:=ShaderMaterial.new();effect.shader=preload("res://native_research_portrait.gdshader");quad.material=effect;effect.set_shader_parameter("portrait",texture);effect.set_shader_parameter("image_size",texture.get_size());effect.set_shader_parameter("box_size",Vector2(view.size));effect.set_shader_parameter("bubble",bubble);view.add_child(quad)
	var layer:=Filtered.new();add_child(layer);layer.configure(view.get_texture(),box);layer.passes[0].effect.set_shader_parameter("source_premultiplied",true);layer.apply_filters([{"kind":"drop-shadow","x":0,"y":0,"blur":7 if bubble else 8,"color":[light.r,light.g,light.b,1]}]);layer.position=anchor*size
	layer.bind_live_source(view);layer.apply_filters([{"kind":"drop-shadow","x":0,"y":0,"blur":7 if bubble else 8,"color":[light.r,light.g,light.b,1]}])
	tracks[name]={"node":layer,"anchor":anchor*size,"extent":box};textures[name]={"view":view,"effect":effect}
func _energy(name: String,parent: Node,anchor: Vector2,extent: Vector2,ring: bool,pop: bool) -> Control:
	var layer:=Control.new();layer.size=extent;layer.position=anchor;layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(layer)
	var quad:=ColorRect.new();quad.position=Vector2.ONE*-32;quad.size=extent+Vector2.ONE*64;quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;var effect:=ShaderMaterial.new();effect.shader=preload("res://native_research_energy.gdshader");quad.material=effect;layer.add_child(quad)
	for pair in [["box_size",extent],["light_color",light],["core_color",core],["rgb_color",rgb],["ring",ring],["pop",pop]]:effect.set_shader_parameter(pair[0],pair[1])
	tracks[name]={"node":layer,"anchor":anchor,"extent":extent};return layer
func _clip(name: String,value: Array) -> void:
	textures[name].effect.set_shader_parameter("circle",Vector3(value[0],value[1],value[2]));textures[name].view.render_target_update_mode=SubViewport.UPDATE_ONCE;tracks[name].node.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;tracks[name].node.filter_signature=""
func start() -> void:tick=Time.get_ticks_msec();set_process(true);sample(0)
func _process(_delta: float) -> void:
	var elapsed: float=(Time.get_ticks_msec()-tick)/1000.0;sample(elapsed)
	if elapsed>=4.3:set_process(false)
func sample(elapsed: float) -> void:
	for name in tracks:
		var entry: Dictionary=tracks[name];var state:=Motion.sample("research",name,elapsed,entry.extent);var m: Transform2D=state.transform;var pivot: Vector2=entry.extent*Vector2(state.origin[0],state.origin[1])*.01
		entry.node.position=entry.anchor+pivot+m.origin-m.basis_xform(pivot);entry.node.scale=m.get_scale();entry.node.modulate.a=state.opacity
		if textures.has(name):
			if name=="research-bubble-reveal":_clip(name,state.clip)
			var filters: Array=state.filters.duplicate(true)
			if name=="research-bubble-reveal":filters=[{"kind":"drop-shadow","x":0,"y":0,"blur":7,"color":[light.r,light.g,light.b,1]}]
			for filter in filters:
				if filter.kind=="drop-shadow":filter.color=[light.r,light.g,light.b,filter.color[3]]
			entry.node.apply_filters(filters)
