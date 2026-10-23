extends Control
## Original purification timeline; game state owns the victory and damage.
const Motion=preload("res://native_oars_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
const ART="images/board/battle/postgame_mechanics/oars/oars_salt_purification.webp"
var view: Control
var cache: Node
var timeline: Node
var epoch:=0
var starts:=0
var layouts:=0
var begun:=0
var frozen_ms:=-1
var installed:=false
var packet: Dictionary={}
var actions_index:=0
var trace: Array=[]
var scene_layer: Control
var backdrop: ColorRect
var projectile: Control
var shadow: Control
var shadow_source: SubViewport
var shadow_paint: ColorRect
var flash: Control
var flash_paint: ColorRect
var cutin: ColorRect
var status: ColorRect
var title: Label
var subtitle: Label
func _ready() -> void:
	z_index=315;mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;hide();set_process(false)
func _paint(shader: Shader,kind: int,parent: Node) -> ColorRect:
	var node:=ColorRect.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.material=ShaderMaterial.new();node.material.shader=shader;node.material.set_shader_parameter("kind",kind);parent.add_child(node);return node
func _ensure() -> void:
	if scene_layer!=null:return
	status=_paint(preload("res://native_kyubi_art.gdshader"),3,self)
	subtitle=Label.new();subtitle.mouse_filter=Control.MOUSE_FILTER_IGNORE;subtitle.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;subtitle.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;subtitle.add_theme_font_override("font",Fonts.weighted(400));subtitle.add_theme_color_override("font_color",Color("ffe8bc"));status.add_child(subtitle)
	cutin=_paint(preload("res://native_kyubi_art.gdshader"),2,self)
	title=Label.new();title.mouse_filter=Control.MOUSE_FILTER_IGNORE;title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;title.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;title.add_theme_font_override("font",Fonts.weighted(950));title.add_theme_color_override("font_color",Color("301406"));cutin.add_child(title)
	scene_layer=Control.new();scene_layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(scene_layer)
	backdrop=_paint(preload("res://native_oars_art.gdshader"),0,scene_layer)
	shadow_source=SubViewport.new();shadow_source.disable_3d=true;shadow_source.transparent_bg=true;shadow_source.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(shadow_source)
	shadow_paint=_paint(preload("res://native_oars_art.gdshader"),1,shadow_source)
	shadow=Filtered.new();scene_layer.add_child(shadow);shadow.passes[0].effect.set_shader_parameter("source_fill",true);shadow.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	projectile=Filtered.new();scene_layer.add_child(projectile)
	flash=Control.new();flash.mouse_filter=Control.MOUSE_FILTER_IGNORE;scene_layer.add_child(flash);flash_paint=_paint(preload("res://native_oars_art.gdshader"),2,flash)
	view.resized.connect(_resize)
func _resize() -> void:
	if installed:_layout();_render(_elapsed())
func _layout() -> void:
	size=view.size;layouts+=1;scene_layer.size=size;backdrop.size=size;backdrop.material.set_shader_parameter("extent",size)
	var vmin:=minf(size.x,size.y)
	projectile.configure(cache.request(ART),Vector2.ONE*minf(size.x*.72,860))
	projectile.apply_filters([{"kind":"drop-shadow","x":0,"y":0,"blur":18,"color":[238.0/255,249.0/255,1,.9]},{"kind":"drop-shadow","x":0,"y":0,"blur":44,"color":[117.0/255,48.0/255,207.0/255,.8]}])
	var extent:=Vector2(vmin*.32,vmin*.45)
	shadow_source.size=Vector2i(extent.ceil());shadow_paint.size=Vector2(shadow_source.size);shadow_paint.material.set_shader_parameter("extent",extent);shadow_source.render_target_update_mode=SubViewport.UPDATE_ONCE
	shadow.configure(shadow_source.get_texture(),extent);shadow.bind_live_source(shadow_source);shadow.apply_filters([{"kind":"blur","value":10}])
	flash.size=Vector2.ONE*vmin*.15;flash_paint.position=Vector2.ONE*-180;flash_paint.size=flash.size+Vector2.ONE*360;flash_paint.material.set_shader_parameter("extent",flash.size);flash_paint.material.set_shader_parameter("padding",180.0)
	var font_size:=maxi(16,int(clampf(size.y/720.0,.58,1)*25.2))
	title.add_theme_font_size_override("font_size",font_size);cutin.size=Vector2(minf(760,size.x*.88),font_size*1.3+32);title.size=cutin.size;cutin.material.set_shader_parameter("extent",cutin.size)
	subtitle.add_theme_font_size_override("font_size",maxi(11,int(16*clampf(size.y/720.0,.7,1))));status.size=Vector2(minf(720,size.x*.9),42);status.position=Vector2((size.x-status.size.x)*.5,18);subtitle.size=status.size;status.material.set_shader_parameter("extent",status.size)
func play_event(event: Dictionary,original: Dictionary) -> String:
	_ensure();cancel();epoch+=1;var token:=epoch
	if not original.has("actions"):return "Original Oars presentation packet required"
	var deadline:=Time.get_ticks_msec()+15000
	while cache.request(ART)==null:
		if cache.failed.has(ART) or Time.get_ticks_msec()>deadline:return "Original Oars purification art unavailable"
		await get_tree().process_frame
		if token!=epoch:return ""
	packet=original;trace.clear();actions_index=0;starts+=1;installed=true;begun=Time.get_ticks_msec();subtitle.text=str(packet.status)
	for action in packet.actions:
		if action.kind=="cutin":title.text=str(action.text)
	_layout();_tick();show();set_process(true)
	while token==epoch and _elapsed()<float(packet.endAt):await get_tree().process_frame
	if token!=epoch:return ""
	_tick();cancel();return ""
func _elapsed() -> float:return float(frozen_ms) if frozen_ms>=0 else float(Time.get_ticks_msec()-begun)
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	var ms:=_elapsed()
	while actions_index<packet.actions.size() and float(packet.actions[actions_index].at)<=ms:
		var action: Dictionary=packet.actions[actions_index];actions_index+=1;trace.append(action)
		match str(action.kind):
			"pose":timeline._pose(str(action.side),"hitEnemySide",float(action.duration))
			"shake":timeline.shake.play()
			"damage":timeline.numbers.spawn(float(action.amount),str(action.side),{"critical":action.critical});timeline.applied_hits+=1
			"state":timeline.pose_epochs.enemy=int(timeline.pose_epochs.get("enemy",0))+1;view.set_pose(str(action.side),str(action.pose))
	_render(ms)
func _move(node: Control,state: Dictionary,anchor: Vector2) -> void:
	var m: Transform2D=state.transform;var origin:=node.size*.5;node.position=anchor+origin+m.origin-m.basis_xform(origin);node.rotation=m.get_rotation();node.scale=m.get_scale();node.modulate.a=state.opacity
func _render(ms: float) -> void:
	var seconds:=ms/1000.0;scene_layer.modulate.a=Motion.sample("layer",seconds,size,size).opacity
	projectile.apply_motion(Motion.sample("projectile",seconds,projectile.box,size),size*Vector2(.18,.53))
	shadow.apply_motion(Motion.sample("shadow",seconds,shadow.box,size),size*Vector2(.76,.43))
	_move(flash,Motion.sample("flash",seconds,flash.size,size),size*Vector2(.76,.43))
	_move(cutin,Motion.sample("cutin",seconds,cutin.size,size),size*Vector2(.5,.18))
	status.visible=ms<float(packet.statusUntil)
func cancel() -> void:
	epoch+=1;installed=false;frozen_ms=-1;hide();set_process(false)
	if projectile!=null:projectile.stop();shadow.stop();shadow_source.render_target_update_mode=SubViewport.UPDATE_DISABLED
func debug_json() -> String:
	return JSON.stringify({"installed":installed,"starts":starts,"layouts":layouts,"trace":trace,"visible":visible,"asset":ART,"title":title.text if title!=null else "","status":subtitle.text if subtitle!=null else ""})

