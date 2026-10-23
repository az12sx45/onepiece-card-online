extends Node
const Motion=preload("res://native_tot_actor_motion.gd")
const ActorShader=preload("res://native_tot_actor.gdshader")
const Geometry=preload("res://native_tot_portrait_geometry.gd")
var stage: Control
var actor: Dictionary
var world: String
var frame_material:=ShaderMaterial.new()
var image_material:=ShaderMaterial.new()
var classes: Array=[]
var began: Dictionary={}
var idle_began:=0
var last_parent:=""
var last_image:=""
var geometry_key: Array=[]
var uniforms: Dictionary={}
var uniform_writes:=0
func _uniform(material: ShaderMaterial,key: String,value: Variant) -> void:
	var id:=material.get_instance_id()
	if not uniforms.has(id):uniforms[id]={}
	if uniforms[id].has(key):
		var previous: Variant=uniforms[id][key]
		if previous==value:return
		# Control layout may round an unchanged 252px extent to 252.0001px.
		# Do not resend identical pixel geometry for floating point noise.
		if typeof(previous)==typeof(value):
			if value is float and is_equal_approx(previous,value):return
			if (value is Vector2 or value is Basis or value is Color) and previous.is_equal_approx(value):return
	uniforms[id][key]=value;material.set_shader_parameter(key,value);uniform_writes+=1
func _ready() -> void:
	frame_material.shader=ActorShader;image_material.shader=ActorShader
	image_material.set_shader_parameter("portrait_layer",true)
	actor.portrait.material=image_material
	idle_began=_now()
func _now() -> int:
	return stage.cinematic._now() if stage.cinematic!=null else Time.get_ticks_msec()
func apply_classes(next: Array) -> void:
	for flag in next:
		if flag not in classes:began[flag]=_now()
	for flag in classes:
		if flag not in next:began.erase(flag)
	if ("portrait-hit" in classes or "portrait-attack" in classes) and not ("portrait-hit" in next or "portrait-attack" in next):idle_began=_now()
	classes=next.duplicate()
func restart(name: String) -> void:
	began[name]=_now()
func age(name: String) -> float:return maxf(0,float(_now()-int(began.get(name,_now())))/1000.0)
func parent_name() -> String:
	if "portrait-hit" not in classes:return ""
	if world=="boss":return "bossHit" if age("portrait-hit")<.7 else ""
	return "allyHit" if "enemy-impact" in stage.packet.get("classes",[]) else ""
func _process(_delta: float) -> void:
	if stage.visible and actor.card.visible:update_motion()
func update_geometry() -> void:
	var natural: Vector2=actor.portrait.texture.get_size() if actor.portrait.texture!=null else Vector2.ONE
	var key: Array=[actor.card.size,stage.size,natural]
	if geometry_key.size()==3 and geometry_key[0].is_equal_approx(key[0]) and geometry_key[1].is_equal_approx(key[1]) and geometry_key[2].is_equal_approx(key[2]):return
	geometry_key=key
	var source_scale:=minf(1.0,minf(stage.size.x/1024.0,stage.size.y/576.0))
	var geometry:=Geometry.rects(actor.card.size,stage.size,source_scale,natural)
	actor.portrait.position=geometry.image.position;actor.portrait.size=geometry.image.size
	actor.ringLayer.layout_boxes(actor.card.size,geometry,source_scale)
	for field in ["clip","image"]:
		var rect: Rect2=geometry[field];image_material.set_shader_parameter(field+"_rect",Vector4(rect.position.x,rect.position.y,rect.size.x,rect.size.y))
	image_material.set_shader_parameter("portrait_radius",geometry.radius)
func update_motion() -> void:
	update_geometry()
	var extent: Vector2=actor.card.size
	var parent:=parent_name();last_parent=parent
	var parent_sample: Dictionary={} if parent.is_empty() else Motion.sample(parent,age("portrait-hit"),extent)
	var image:="portraitIdle";var seconds:=fmod(maxf(0,float(_now()-idle_began)/1000.0),3.2)
	if "portrait-hit" in classes:
		image="portraitHit";seconds=age("portrait-hit")
	elif world=="boss" and "portrait-attack" in classes:
		image="enemyPortraitAttack";seconds=age("portrait-attack")
	last_image=image
	var image_extent: Vector2=actor.portrait.size
	var image_sample:=Motion.sample(image,seconds,image_extent)
	# translate animation is independent of the underlying portrait transform.
	# The attack animation replaces that transform; hit/idle do not.
	if image!="enemyPortraitAttack":
		var base: Dictionary=Motion.data.portraitBase["boss" if world=="boss" else "player"]
		image_sample.matrix[12]+=image_extent.x*float(base.x);image_sample.matrix[13]+=image_extent.y*float(base.y)
	var brightness:=1.0;var saturation:=1.0
	for filter in parent_sample.get("filters",[]):
		if filter.kind=="brightness":brightness*=float(filter.value)
		elif filter.kind=="saturate":saturation*=float(filter.value)
	var transform: Transform2D=actor.card.get_global_transform()
	for material in [frame_material,image_material]+actor.ringLayer.materials:
		_uniform(material,"card_to_world",Motion.from_transform(transform))
		_uniform(material,"world_to_card",Motion.from_transform(transform.affine_inverse()))
		_uniform(material,"card_size",extent)
		_uniform(material,"parent_motion",Basis.IDENTITY if parent.is_empty() else Motion.homography(parent_sample.matrix))
		_uniform(material,"parent_translate",parent_sample.get("translate",Vector2.ZERO))
		_uniform(material,"brightness",brightness);_uniform(material,"saturation",saturation)
	_uniform(image_material,"image_motion",Motion.homography(image_sample.matrix))
	_uniform(image_material,"image_translate",image_sample.translate)
