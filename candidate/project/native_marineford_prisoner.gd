extends Control
## Original portrait and source-selected split phases. Original controller owns
## the execution result; this node only animates its authored class changes.
const Motion=preload("res://native_marineford_motion.gd")
var main: TextureRect
var halves: Array[TextureRect]=[]
var image: Texture2D
var signature:=""
var classes:=""
var split_classes:=""
var sentenced_at:=-1
var split_at:=-1
var rescued_at:=-1
var glow:=ColorRect.new()
var rescued_glow:=ColorRect.new()
var shadow: Control
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	shadow=preload("res://native_marineford_shadow.gd").new();add_child(shadow)
	main=_picture(-1)
	for side in range(2):halves.append(_picture(side))
	glow.mouse_filter=Control.MOUSE_FILTER_IGNORE;glow.color=Color("ffefb8");add_child(glow);glow.hide()
	rescued_glow.mouse_filter=Control.MOUSE_FILTER_IGNORE;rescued_glow.color=Color.WHITE
	var paint:=ShaderMaterial.new();paint.shader=preload("res://native_marineford_rescue.gdshader");paint.set_shader_parameter("kind",4);rescued_glow.material=paint;add_child(rescued_glow);rescued_glow.hide()
	resized.connect(_layout);set_process(false)
func _picture(side: int) -> TextureRect:
	var node:=TextureRect.new();node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_SCALE;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var material:=ShaderMaterial.new();material.shader=preload("res://native_marineford_portrait.gdshader");material.set_shader_parameter("half_side",side);node.material=material;add_child(node);return node
func apply(texture: Texture2D,data: Dictionary) -> void:
	var uid:=str(data.get("portraitUid",""))
	if uid!=signature:signature=uid;sentenced_at=-1;split_at=-1;rescued_at=-1
	image=texture;classes=str(data.portraitClasses);split_classes=str(data.get("splitClasses",""))
	var now:=Time.get_ticks_msec()
	if classes.split(" ").has("is-sentenced") and sentenced_at<0:sentenced_at=now
	if classes.split(" ").has("is-rescued") and rescued_at<0:rescued_at=now
	if split_classes.split(" ").has("is-splitting") and split_at<0:split_at=now
	_layout();_process(0)
func _layout() -> void:
	if image==null:return
	var extent:=image.get_size()*minf(size.x/image.get_width(),size.y/image.get_height())
	shadow.configure(image,extent)
	for node in [main]+halves:
		node.texture=image;node.size=extent;node.position=Vector2((size.x-extent.x)/2,size.y-extent.y);node.material.set_shader_parameter("displayed_size",extent)
	glow.position=Vector2(size.x/2-2,-size.y*.08);glow.size=Vector2(4,size.y*1.16)
func _filters(node: TextureRect,effects: Array) -> void:
	var values:=PackedVector2Array();var blur:=0.0
	for op in effects:
		if op.kind=="blur":blur=float(op.value)
		else:values.append(Vector2({"brightness":1,"contrast":2,"grayscale":4,"saturate":6}.get(op.kind,0),float(op.value)))
	var count:=values.size()
	while values.size()<8:values.append(Vector2.ZERO)
	node.material.set_shader_parameter("operations",values);node.material.set_shader_parameter("count",count);node.material.set_shader_parameter("blur_pixels",blur)
func _motion(node: Control,sample: Dictionary,origin: Vector2,base: Vector2) -> void:
	var transform: Transform2D=sample.transform
	node.position=base+origin+transform.origin-transform.basis_xform(origin);node.rotation=transform.get_rotation();node.scale=transform.get_scale();node.modulate.a=sample.opacity
func _process(_delta: float) -> void:
	if image==null:return
	var now:=Time.get_ticks_msec();var moving:=false
	main.visible=not classes.split(" ").has("is-hidden-after-split")
	main.material.set_shader_parameter("rescued",rescued_at>=0)
	var base:=Vector2((size.x-main.size.x)/2,size.y-main.size.y)
	main.position=base;main.rotation=0;main.scale=Vector2.ONE;main.modulate.a=1
	if main.visible:
		var name:="executionCondemn" if sentenced_at>=0 else "rescuedCardPop" if rescued_at>=0 else ""
		var begun:=sentenced_at if sentenced_at>=0 else rescued_at
		if not name.is_empty():
			var elapsed:=float(now-begun)/1000;var sample:=Motion.sample(name,elapsed,size)
			_motion(main,sample,size*.5-base,base);_filters(main,sample.filters);moving=elapsed<float(Motion.catalog[name].duration)
		else:_filters(main,[])
	for side in range(2):
		var node:=halves[side];node.visible=not split_classes.is_empty()
		if not node.visible:continue
		var elapsed:=maxf(0,float(now-split_at)/1000) if split_at>=0 else 0.0
		var name: String=["executionSplitLeft","executionSplitRight"][side];var sample:=Motion.sample(name,elapsed,size)
		_motion(node,sample,size*Vector2(.49 if side==0 else .51,.52)-base,base)
		_filters(node,[{"kind":"grayscale","value":1.0},{"kind":"saturate","value":.08},{"kind":"brightness","value":.58},{"kind":"contrast","value":1.12}]+sample.filters)
		moving=moving or elapsed<1.05
	var flash_time:=float(now-split_at)/1000 if split_at>=0 else float(now-sentenced_at)/1000-.18
	glow.visible=(split_at>=0 or sentenced_at>=0) and flash_time>=0 and flash_time<=.34
	if glow.visible:
		var sample:=Motion.sample("executionSplitLine" if split_at>=0 else "executionCutFlash",flash_time,glow.size)
		_motion(glow,sample,glow.size*.5,Vector2(size.x/2-2,-size.y*.08));moving=true
	var rescued_time:=float(now-rescued_at)/1000 if rescued_at>=0 else -1.0
	rescued_glow.visible=rescued_time>=0 and rescued_time<=.82
	if rescued_glow.visible:
		rescued_glow.size=size*1.6;rescued_glow.material.set_shader_parameter("extent",rescued_glow.size)
		_motion(rescued_glow,Motion.sample("rescuedGlow",rescued_time,rescued_glow.size),rescued_glow.size*.5,size*-.3);moving=true
	shadow.follow(main)
	set_process(moving)
func reset() -> void:
	signature="";sentenced_at=-1;split_at=-1;rescued_at=-1;set_process(false);hide()
