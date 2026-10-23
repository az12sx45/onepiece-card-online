extends Control
## Persistent original demon layers. All image decoding goes through the same
## bounded cache; unchanged battle snapshots do not rerender any GPU pass.
const Filtered=preload("res://native_css_ordered_image.gd")
var cache: Node
var portrait: TextureRect
var catalog: Dictionary
var layers: Dictionary={}
var active:=false
var art_ready:=false
var model: Dictionary={}
var pose:="normal"
var source_view: SubViewport
var source_rect: TextureRect
var filtered: Control
var last_texture: Texture2D
var last_size:=Vector2.ZERO
var last_filter:=""
var redraws:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	catalog=JSON.parse_string(FileAccess.get_file_as_string("res://demon-art-catalog.json")).catalog
	# These high-resolution transparent ornaments shrink to 100-260 px on a
	# phone. Decode their mip chain on the cache worker, once, to avoid aliasing.
	if not "images/board/battle/black_turn/" in cache.mipmap_prefixes:cache.mipmap_prefixes.append("images/board/battle/black_turn/")
	cache.asset_ready.connect(_asset_ready)
	portrait.resized.connect(_layout)
	hide()

func _ensure_nodes() -> void:
	if filtered!=null:return
	var ordered: Array=catalog.layers.duplicate()
	ordered.sort_custom(func(a,b):return float(a.z)<float(b.z))
	for layer in ordered:
		if layer.display=="none" or float(layer.opacity)==0:continue
		# Preserve the source card stacking context using sibling draw order.
		# Negative global z would incorrectly place wings behind the battlefield.
		var art:=Filtered.new();add_child(art);art.hide();layers[layer.key]=art
		art.passes[0].effect.set_shader_parameter("source_fill",true)
		var image: Texture2D=cache.request(layer.image)
		if image!=null:art.set_meta("image",image)
	source_view=SubViewport.new();source_view.disable_3d=true;source_view.transparent_bg=true;source_view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(source_view)
	source_rect=TextureRect.new();source_rect.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;source_rect.stretch_mode=TextureRect.STRETCH_SCALE;source_rect.material=portrait.material.duplicate();source_view.add_child(source_rect)
	filtered=Filtered.new();add_child(filtered)
	filtered.passes[0].effect.set_shader_parameter("source_fill",true)
	filtered.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	var effect:=ShaderMaterial.new();effect.shader=preload("res://native_demon_portrait.gdshader");filtered.display.material=effect

func sync(value: Dictionary,current_pose: String) -> void:
	model=value
	# Source setPortraitState applies portrait-hit to hit/weak/dizzy. The native
	# attack timeline uses side-specific image keys for the same hit state.
	pose="hit" if current_pose in ["hit","hitEnemySide","hitPlayerSide","weak","dizzy"] else current_pose if current_pose in ["attack","switch-in"] else "normal"
	active=value.get("active",false)
	if not active:
		stop();return
	_ensure_nodes();show();_layout()

func _asset_ready(path: String,image: Texture2D) -> void:
	for layer in catalog.layers:
		if layer.image==path and layers.has(layer.key):layers[layer.key].set_meta("image",image)
	if active:_layout()

func _layout() -> void:
	if not active or filtered==null:return
	size=portrait.size;art_ready=true
	for layer in catalog.layers:
		if not layers.has(layer.key):continue
		var art: Control=layers[layer.key];var image: Texture2D=art.get_meta("image") if art.has_meta("image") else null
		if image==null:art_ready=false;continue
		var extent: Vector2=size*Vector2(layer.w,layer.h)
		art.configure(image,extent);art.apply_filters(layer.filters);art.position=size*Vector2(layer.x,layer.y)-extent*.5;art.modulate.a=layer.opacity
	# Publish the complete ornament set together, never five partial flashes.
	for art in layers.values():art.visible=art_ready
	if portrait.texture==null:return
	var style: Dictionary=catalog.portraits[("imu" if model.get("imu",false) else "demon")+"-"+pose]
	var signature:=JSON.stringify(style)
	if portrait.texture!=last_texture or size!=last_size:
		last_texture=portrait.texture;last_size=size
		source_view.size=Vector2i(size.ceil());source_rect.size=size;source_rect.texture=portrait.texture
		source_rect.material.set_shader_parameter("card_size",size)
		source_view.render_target_update_mode=SubViewport.UPDATE_ONCE
		filtered.configure(source_view.get_texture(),size)
		filtered.bind_live_source(source_view)
		# A ViewportTexture retains identity when its source pixels change.
		filtered.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
		filtered.filter_signature="";redraws+=1
	if signature!=last_filter or filtered.filter_signature.is_empty():
		last_filter=signature;filtered.apply_filters(style.filters);redraws+=1
	filtered.display.material.set_shader_parameter("card_size",size)
	filtered.display.material.set_shader_parameter("vignette",style.overlay)
	filtered.display.material.set_shader_parameter("overlay_opacity",style.overlayOpacity)
	portrait.self_modulate.a=0.0

func texture_changed() -> void:
	if active:_layout()

func stop() -> void:
	active=false;art_ready=false;hide();portrait.self_modulate.a=1.0
	if filtered!=null:
		filtered.stop();source_view.render_target_update_mode=SubViewport.UPDATE_DISABLED
		for art in layers.values():art.stop()

func debug_state() -> Dictionary:
	var result: Dictionary={"active":active,"ready":art_ready,"model":model,"pose":pose,"redraws":redraws,"layers":[],"ids":[]}
	for key in layers:
		var art: Control=layers[key]
		result.ids.append(art.get_instance_id())
		result.layers.append({"key":key,"visible":art.visible,"rect":[art.position.x,art.position.y,art.size.x,art.size.y],"opacity":art.modulate.a,"configurations":art.configurations})
	return result
