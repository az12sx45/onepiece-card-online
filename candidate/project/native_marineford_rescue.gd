extends Control
## Persistent presentation of the original controller's rescue nodes. Source
## classes own phase changes; source CSS keyframes own all animation timing.
const Motion=preload("res://native_marineford_motion.gd")
const Paint=preload("res://native_marineford_rescue.gdshader")
var guard_nodes: Array[TextureRect]=[]
var aura: Control
var rings: Array[ColorRect]=[]
var bolts: Array[ColorRect]=[]
var shock: Control
var cracks: ColorRect
var model: Dictionary={}
var epochs: Dictionary={}
var identities: Dictionary={}
var guard_box:=Rect2()
var slot_box:=Rect2()
var page_size:=Vector2.ZERO
var waiting:=false
var frames:=0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=12
	for i in range(2):
		var n:=TextureRect.new();n.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;n.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;n.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(n);guard_nodes.append(n)
	shock=Control.new();shock.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(shock)
	for i in range(2):
		var n:=_paint(shock,1);n.set_meta("ring",i);n.material.set_shader_parameter("stroke",3.0);n.material.set_shader_parameter("ink",Color(232.0/255,249.0/255,1,.9) if i==0 else Color(94.0/255,177.0/255,229.0/255,.66))
	cracks=_paint(shock,3)
	aura=Control.new();aura.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(aura);_paint(aura,0)
	for i in range(2):
		var n:=_paint(aura,1);n.material.set_shader_parameter("stroke",4.0);n.material.set_shader_parameter("ink",Color(219.0/255,245.0/255,1,.86) if i==0 else Color(86.0/255,169.0/255,219.0/255,.58));rings.append(n)
	for i in range(6):bolts.append(_paint(aura,2))
	reset()
func _paint(parent: Control,kind: int) -> ColorRect:
	var n:=ColorRect.new();n.mouse_filter=Control.MOUSE_FILTER_IGNORE;n.color=Color.WHITE
	var m:=ShaderMaterial.new();m.shader=Paint;m.set_shader_parameter("kind",kind);n.material=m;parent.add_child(n);return n
func _box(n: Control,extent: Vector2) -> void:
	n.size=extent
	if n is ColorRect:n.material.set_shader_parameter("extent",extent)
func apply(data: Dictionary,textures: Dictionary,viewport: Vector2,guards: Rect2,slot: Rect2) -> void:
	model=data;guard_box=guards;slot_box=slot;page_size=viewport;size=viewport
	var now:=Time.get_ticks_msec()
	for key in ["guardUid","shockUid","auraUid"]:
		var identity:=str(data.get(key,""))
		if identities.get(key,"")!=identity:identities[key]=identity;epochs[key]=now
	var next_waiting:=str(data.get("guardSplit","")).split(" ").has("waiting")
	if waiting and not next_waiting:epochs.guardUid=now
	waiting=next_waiting
	for i in range(2):
		guard_nodes[i].texture=textures.get(str(data.get("guardHalves",[])[i])) if data.get("guardHalves",[]).size()>i else null
	if bool(data.get("pageShock",false)) and not epochs.has("pageShock"):epochs.pageShock=now
	if not bool(data.get("pageShock",false)):epochs.erase("pageShock")
	show();_process(0)
func _animate(n: Control,name: String,elapsed: float,extent: Vector2,base: Vector2,origin: Vector2,angle:=0.0) -> void:
	_box(n,extent)
	var sample:=Motion.sample(name,maxf(0,elapsed),extent,angle);var t: Transform2D=sample.transform
	n.position=base+origin+t.origin-t.basis_xform(origin);n.rotation=t.get_rotation();n.scale=t.get_scale();n.modulate.a=sample.opacity if elapsed>=0 else 0
func _time(key: String) -> float:return float(Time.get_ticks_msec()-int(epochs.get(key,Time.get_ticks_msec())))/1000
func _process(_delta: float) -> void:
	if model.is_empty():return
	frames+=1;var moving:=false
	for i in range(2):
		var n:=guard_nodes[i];n.visible=not str(model.get("guardUid","")).is_empty()
		if n.visible:
			var t:=0.0 if waiting else _time("guardUid")
			_animate(n,"conquerorGuardFallLeft" if i==0 else "conquerorGuardFallRight",t,guard_box.size,guard_box.position,guard_box.size*Vector2(.28 if i==0 else .72,.88));moving=moving or (not waiting and t<2.15)
	shock.visible=not str(model.get("shockUid","")).is_empty()
	if shock.visible:
		var t:=_time("shockUid");var extent:=Vector2(slot_box.size.x*4.7,330)
		_animate(shock,"conquerorShockBurst",t,extent,Vector2(slot_box.get_center().x,slot_box.position.y+52),extent*.5);moving=moving or t<2.05
		for i in range(2):
			var n: ColorRect=shock.get_child(i);_box(n,extent*Vector2(.68 if i==0 else .96,.42 if i==0 else .68)+Vector2.ONE*6);n.position=(extent-n.size)*.5
		var crack_size:=extent*Vector2(.86,.7)
		_animate(cracks,"conquerorLightningFlash",t-.08,crack_size,extent*Vector2(.07,.15),crack_size*.5)
	aura.visible=not str(model.get("auraUid","")).is_empty()
	if aura.visible:
		var t:=_time("auraUid");var extent:=page_size*Vector2(1.2,1.24)
		_animate(aura,"conquerorPageAura",t,extent,page_size*Vector2(-.1,-.12),extent*.5);_box(aura.get_child(0),extent);moving=moving or t<2.55
		for i in range(2):
			var ring_size:=page_size*Vector2(1.18 if i==0 else 1.45,.7 if i==0 else .86)+Vector2.ONE*8
			_animate(rings[i],"conquerorPageRing",t-i*.12,ring_size,extent*.5,ring_size*.5)
		for i in range(6):
			var bolt_size:=Vector2(minf(page_size.x*.74,980),5)
			_animate(bolts[i],"conquerorBolt",t-[.04,.11,.18,.25,.32,.39][i],bolt_size,extent*.5,Vector2(0,2.5),deg_to_rad([18.0,156.0,78.0,122.0,-28.0,-72.0][i]))
	var parent:=get_parent() as Control
	if epochs.has("pageShock"):
		var t:=_time("pageShock");_animate(parent,"conquerorPageShake",t,page_size,Vector2.ZERO,page_size*.5);moving=moving or t<2.7
	else:parent.position=Vector2.ZERO;parent.rotation=0;parent.scale=Vector2.ONE
	set_process(moving)
func reset() -> void:
	model.clear();epochs.clear();identities.clear();waiting=false;set_process(false);hide()
	var parent:=get_parent() as Control
	if parent:parent.position=Vector2.ZERO;parent.rotation=0;parent.scale=Vector2.ONE
