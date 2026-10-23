extends Control
## Persistent Tot Musica presentation nodes. Original JS chooses all phases,
## faces, text, damage and poses; authored CSS keyframes choose their motion.
const Motion=preload("res://native_tot_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var stage: Control
var nodes: Dictionary={}
var flags: Array=[]
var started: Dictionary={}
var dice: Dictionary={}
var collisions: Dictionary={}
var waves: Dictionary={}
var moves: Dictionary={}
var core: ColorRect
var core_text: Label
var burst: ColorRect
var result: Label
var fx: Node2D
var numbers: Control
var shake: Node
var frozen_ms:=-1
var effect_trace: Array=[]
var effects_started:=0
var packet_count:=0
var warm_paths: Array[String]=[]
var warm_textures: Dictionary={}
const WAVE_PATHS={"merged":"tot_musica_sync_wave_up_v2.webp","red":"tot_musica_unsynced_red_up.webp","blue":"tot_musica_unsynced_blue_up.webp","downReal":"tot_musica_boss_wave_down.webp","downSong":"tot_musica_boss_wave_down.webp"}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=25;set_process(false)
	for world in ["Real","Song","Boss"]:
		var root:=Control.new();root.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(root)
		var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(image);stage.battle_view._image(image,"images/board/battle_dice_ui/battle_dice_blank.webp")
		var face:=_label(image,34);face.add_theme_color_override("font_color",Color("080604"));face.add_theme_color_override("font_outline_color",Color("f0cf86"));face.add_theme_constant_override("outline_size",1)
		var parity:=_label(root,17);var total:=_label(root,11);total.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		dice[world]={"root":root,"image":image,"face":face,"parity":parity,"total":total,"state":"","began":0}
		if world!="Boss":moves[world]=_label(self,11)
	for side in ["Left","Right"]:
		var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(image);stage.battle_view._image(image,"images/board/battle_dice_ui/battle_dice_blank.webp");var label:=_label(image,32);label.add_theme_color_override("font_color",Color("080604"));collisions[side]={"image":image,"label":label}
	core=_glow(0);core_text=_label(core,17);core_text.add_theme_color_override("font_color",Color("2c1000"));burst=_glow(1)
	for key in WAVE_PATHS:
		var sprite:=Filtered.new();add_child(sprite);waves[key]=sprite
	result=_label(self,15);result.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;result.add_theme_color_override("font_color",Color("fff1bd"));var panel:=StyleBoxFlat.new();panel.bg_color=Color("291a30f5");panel.border_color=Color("ffe087bd");panel.set_border_width_all(2);panel.set_corner_radius_all(24);panel.content_margin_left=15;panel.content_margin_right=15;panel.content_margin_top=6;panel.content_margin_bottom=6;result.add_theme_stylebox_override("normal",panel)
	fx=preload("res://native_move_fx.gd").new();fx.cache=stage.battle_view.cache;fx.z_index=80;add_child(fx)
	numbers=preload("res://native_battle_numbers.gd").new();numbers.view=stage.battle_view;numbers.z_index=90;add_child(numbers)
	shake=preload("res://native_battle_shake.gd").new();shake.view=stage;add_child(shake)
	hide()
func _label(parent: Node,font_size: int) -> Label:
	var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("fff0b5"));label.add_theme_color_override("font_outline_color",Color("07080b"));label.add_theme_constant_override("outline_size",2);parent.add_child(label);return label
func _glow(kind: int) -> ColorRect:
	var node:=ColorRect.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.material=ShaderMaterial.new();node.material.shader=preload("res://native_tot_glow.gdshader");node.material.set_shader_parameter("kind",kind);add_child(node);return node
func _now() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()
func _has(flag: String) -> bool:return flag in flags
func _age(flag: String) -> float:return maxf(0,float(_now()-int(started.get(flag,_now())))/1000.0)
func _text(key: String) -> String:return str(nodes.get(key,{}).get("text",""))
func _write(label: Label,text: String) -> void:
	if label.text!=text:label.text=text
func apply(packet: Dictionary) -> void:
	packet_count+=1;nodes=packet.get("cinematic",{}).get("nodes",{})
	var next: Array=packet.get("classes",[])
	for flag in next:
		if flag not in flags:started[flag]=_now()
	for flag in flags:
		if flag not in next:started.erase(flag)
	flags=next
	var active: bool=packet.get("cinematic",{}).get("animationActive",false)
	visible=active;set_process(active)
	if not active:
		warm_textures.clear()
		for sprite in waves.values():sprite.hide();sprite.stop()
		return
	for world in dice:
		var item: Dictionary=dice[world];var state: String=JSON.stringify(nodes.get("totMusica"+world+"Die",{}).get("parentClasses",[]))
		if item.state!=state:item.state=state;item.began=_now()
	_tick()
func _process(_delta: float) -> void:_tick()
func ready_assets() -> bool:
	var ready:=true
	for file in WAVE_PATHS.values():
		if stage.battle_view.cache.request("images/board/battle/tot_musica_dual/"+file)==null:ready=false
	for item in dice.values():
		if item.image.texture==null:ready=false
	for file in warm_paths:
		if warm_textures.has(file):continue
		var texture: Texture2D=stage.battle_view.cache.request(file)
		if texture==null:ready=false
		else:warm_textures[file]=texture
	return ready
func warm_json(json: String) -> void:
	var packet: Dictionary=JSON.parse_string(json);warm_paths.assign(packet.images);warm_textures.clear();fx.warm(packet.profiles)
	for source in packet.get("sounds",[]):stage.get_parent().timeline.audio.warm(str(source))
	for profile in packet.profiles:
		if not str(profile.get("sheet","")).is_empty():warm_paths.append(str(profile.sheet))
	ready_assets()
func _animated(node: Control,name: String,age: float,anchor: Vector2,origin:=Vector2(.5,.5)) -> Dictionary:
	var sample:=Motion.sample(name,age,node.size,size);Motion.apply(node,sample,anchor,origin);return sample
func _reset(node: Control,anchor: Vector2) -> void:node.position=anchor;node.rotation=0;node.scale=Vector2.ONE;node.modulate.a=1
func _actor_motion(world: String) -> void:
	var actor: Dictionary=stage.actors[world];var card: Control=actor.card;var panel: Control=actor.panel;_reset(card,actor.baseCard);_reset(panel,actor.basePanel)
	var ally:=world!="boss";var cast:="enemy-status-cast" if _has("enemy-status-cast") else "enemy-striking"
	if ally:
		if _has("launch-upward"):_animated(card,"totMusicaUiFall",_age("launch-upward"),actor.baseCard);_animated(panel,"totMusicaUiFall",_age("launch-upward"),actor.basePanel)
		elif _has(cast):_animated(card,"totMusicaTargetsCameraApproach",_age(cast),actor.baseCard);_animated(panel,"totMusicaPlayerUiReturn",_age(cast),actor.basePanel)
		elif _has("camera-held-high"):card.modulate.a=0;panel.modulate.a=0
		elif _has("enemy-camera-rising"):_animated(card,"totMusicaPlayersLeaveForBoss",_age("enemy-camera-rising"),actor.baseCard);_animated(panel,"totMusicaPlayerUiLeaveForBoss",_age("enemy-camera-rising"),actor.basePanel)
		elif _has("actors-converge"):_animated(card,"totMusicaPlayerAttackUpLeft" if world=="real" else "totMusicaPlayerAttackUpRight",_age("actors-converge"),actor.baseCard)
	else:
		if _has("boss-knockout-fall"):_animated(card,"totMusicaBossKnockoutFall",_age("boss-knockout-fall"),actor.baseCard);_animated(panel,"totMusicaBossKnockoutHudOut",_age("boss-knockout-fall"),actor.basePanel+Vector2(panel.size.x*.5,0))
		elif _has("boss-knockout-stagger"):_animated(card,"totMusicaBossKnockoutStagger",_age("boss-knockout-stagger"),actor.baseCard)
		elif _has(cast):_animated(card,"totMusicaStatusCastPulse" if cast=="enemy-status-cast" else "totMusicaBossCastCameraDown",_age(cast),actor.baseCard);_animated(panel,"totMusicaBossUiLeaveUp",_age(cast),actor.basePanel)
		elif _has("boss-revealed"):
			_animated(card,"totMusicaBossHighReveal",_age("boss-revealed"),actor.baseCard)
			if not _has("wave-impact"):_animated(panel,"totMusicaBossHudAfterDescent",_age("boss-revealed"),actor.basePanel)
	# The original hit selector replaces the card transform, while its HUD
	# continues the stage animation. Never apply both transforms to the card.
	if not actor.renderer.parent_name().is_empty():_reset(card,actor.baseCard)
	actor.renderer.update_motion()
func _tick() -> void:
	size=stage.size
	var compact:=size.x<=1100 or size.y<=620;var source_scale:=minf(1,minf(size.x/1024,size.y/576))
	for world in stage.actors:_actor_motion(world)
	stage.divider.modulate.a=1
	if _has("launch-upward"):stage.divider.modulate.a=Motion.sample("totMusicaUiFall",_age("launch-upward"),stage.divider.size,size).opacity
	elif _has("enemy-striking") or _has("enemy-status-cast"):stage.divider.modulate.a=Motion.sample("totMusicaPlayerUiReturn",_age("enemy-striking" if _has("enemy-striking") else "enemy-status-cast"),stage.divider.size,size).opacity
	elif _has("camera-held-high"):stage.divider.modulate.a=0
	elif _has("enemy-camera-rising"):stage.divider.modulate.a=Motion.sample("totMusicaPlayerUiLeaveForBoss",_age("enemy-camera-rising"),stage.divider.size,size).opacity
	var camera:=""
	if _has("enemy-striking"):camera="totMusicaCameraDescend"
	elif _has("enemy-status-cast"):camera="totMusicaCameraDescend"
	elif _has("launch-upward"):camera="totMusicaCameraRise"
	elif _has("enemy-camera-rising"):camera="totMusicaCameraClimbToBoss"
	var camera_flag:="enemy-striking" if _has("enemy-striking") else "enemy-status-cast" if _has("enemy-status-cast") else "launch-upward" if _has("launch-upward") else "enemy-camera-rising"
	if not camera.is_empty():
		var sample:=Motion.sample(camera,_age(camera_flag),size*Vector2(1.16,3),size);stage.background.material.set_shader_parameter("camera",sample.transform.origin.y/(size.y*2))
	else:stage.background.material.set_shader_parameter("camera",1.0 if _has("camera-held-high") or _has("enemy-camera-high") else 0.0)
	for world in dice:
		var item: Dictionary=dice[world];var boss: bool=world=="Boss";var dying:=_has("dice-colliding") or _has("collision-fused") or _has("collision-failed")
		item.root.visible=_has("enemy-rolling") if boss else _has("player-resolving") and not dying
		var extent: float=(72 if compact else clampf(size.x*.062,74,108))*source_scale;var width: float=minf(size.x*(.20 if boss and compact else .18 if boss else .165),180 if boss and compact else 270 if boss else 260)*source_scale
		item.root.size=Vector2(maxf(extent,width),extent+48*source_scale)
		var anchor: Vector2=Vector2(size.x*(.17 if compact else .18),size.y*(.45 if compact else .42))-item.root.size*.5 if boss else Vector2(size.x*(.305 if compact else .315),size.y*.28)
		if world=="Song":anchor.x=size.x-anchor.x-item.root.size.x
		_reset(item.root,anchor);item.image.size=Vector2.ONE*extent;var image_anchor:=Vector2((item.root.size.x-extent)*.5,0)
		_reset(item.image,image_anchor);item.face.position=Vector2.ZERO;item.face.size=item.image.size;item.face.add_theme_font_size_override("font_size",maxi(16,roundi(34*source_scale)))
		var parent: Array=nodes.get("totMusica"+world+"Die",{}).get("parentClasses",[]);var age:=float(_now()-int(item.began))/1000.0
		if "is-rolling" in parent:_animated(item.image,"diceRollShake",fmod(age,.095),image_anchor)
		elif "is-settled" in parent:_animated(item.image,"diceResultPop",age,image_anchor)
		_write(item.face,_text("totMusica"+world+"Die"));_write(item.parity,_text("totMusicaBossDiceLabel" if boss else "totMusica"+world+"Parity"));_write(item.total,_text("totMusicaBossDiceTotal" if boss else "totMusica"+world+"Total"))
		item.parity.position=Vector2(0,extent);item.parity.size=Vector2(item.root.size.x,21);item.total.position=Vector2(0,extent+21);item.total.size=Vector2(item.root.size.x,34);item.parity.add_theme_font_size_override("font_size",maxi(11,roundi(24*source_scale)))
		if boss and _has("enemy-striking"):_animated(item.root,"totMusicaBossUiLeaveUp",_age("enemy-striking"),anchor)
	for side in collisions:
		var item: Dictionary=collisions[side];item.image.visible=_has("dice-colliding") and not _has("collision-failed") and not _has("collision-fused");item.image.size=Vector2.ONE*clampf(size.x*.082,92,146)*source_scale;item.label.size=item.image.size;_write(item.label,_text("totMusicaCollision"+side+"Face"))
		if item.image.visible:
			var motion: String="totMusicaDieCollide"+side;var sample:=Motion.sample(motion,_age("dice-colliding"),item.image.size,size);var x: float=sample.left if side=="Left" else size.x-sample.right-item.image.size.x;Motion.apply(item.image,sample,Vector2(x,size.y*.42))
	core.visible=_has("collision-fused");core.size=Vector2.ONE*clampf(size.x*.12,130,220)*source_scale;core_text.size=core.size;_write(core_text,_text("totMusicaSyncCoreValue"))
	if core.visible:
		_animated(core,"totMusicaCoreFuse",_age("collision-fused"),size*Vector2(.5,.42))
		if _has("launch-upward"):core.modulate.a*=Motion.sample("totMusicaUiFall",_age("launch-upward"),core.size,size).opacity
	for key in waves:
		var sprite: Control=waves[key];var down: bool=key.begins_with("down");var split:=_has("split-upward");var active: bool=_has("enemy-striking") if down else _has("launch-upward") and ((key=="merged")!=split)
		sprite.visible=active
		if not active:sprite.stop();continue
		var extent:=Vector2(minf(size.x*(.26 if down else .44 if key=="merged" else .14),440 if down else 650 if key=="merged" else 230)*source_scale,size.y*(.68 if down else .98 if key=="merged" else .88))
		sprite.configure(stage.battle_view.cache.request("images/board/battle/tot_musica_dual/"+str(WAVE_PATHS[key])),extent)
		var phase:="enemy-striking" if down else "wave-impact" if _has("wave-impact") else "launch-upward"
		var motion:="totMusicaDownWaveReal" if key=="downReal" else "totMusicaDownWaveSong" if key=="downSong" else "totMusicaWaveArtImpact" if phase=="wave-impact" and key=="merged" else "totMusicaStraightImpact" if phase=="wave-impact" else "totMusicaMergedStrikeRise" if key=="merged" else "totMusicaStraightRedRise" if key=="red" else "totMusicaStraightBlueRise"
		var sample:=Motion.sample(motion,_age(phase),extent,size);var anchor:=Vector2(float(sample.get("left",size.x*(.34 if key=="red" else .66 if key=="blue" else .5))),float(sample.get("top",size.y-extent.y-float(sample.get("bottom",0)))))
		sprite.apply_motion(sample,anchor,Vector2(.5,0 if down else 1));sprite.apply_filters(sample.filters)
	burst.visible=_has("wave-impact");burst.size=Vector2.ONE*minf(size.x,size.y)*.18
	if burst.visible:_animated(burst,"totMusicaImpactBurst",_age("wave-impact"),size*.5)
	result.visible=_has("judged");result.size=Vector2(minf(860*source_scale,size.x*.78),42);_write(result,_text("totMusicaDualResult"));_reset(result,Vector2((size.x-result.size.x)*.5,size.y*.945-result.size.y))
	if _has("launch-upward"):_animated(result,"totMusicaUiFall",minf(_age("launch-upward"),_age("judged")),result.position)
	for world in moves:
		var label: Label=moves[world];label.size=Vector2(size.x*.31,20);label.position=Vector2(size.x*.04 if world=="Real" else size.x*.65,size.y*.125);_write(label,_text("totMusica"+world+"Move"));label.visible=stage.actors.real.card.modulate.a>.5
	fx.stage_size=size
func _anchor(name: String,ratio:=Vector2(.5,.5)) -> Vector2:
	var world:="real" if "Real" in name else "song" if "Song" in name else "boss";var card: Control=stage.actors[world].card
	return card.position+card.size*ratio
func effect_json(json: String) -> void:
	var effect: Dictionary=JSON.parse_string(json);effect_trace.append({"type":effect.type,"ms":_now()});effects_started+=1
	if effect_trace.size()>256:effect_trace.pop_front()
	match str(effect.type):
		"clear-numbers":
			for label in numbers.pool:label.hide()
			numbers.active.clear();numbers.set_process(false)
		"shake":shake.play()
		"cast-sound","hit-sound":stage.get_parent().timeline.audio.play_effect(str(effect.get("source","")),.12 if effect.type=="cast-sound" else .16)
		"warm":fx.warm([effect.get("profile",{})])
		"move":
			var options: Dictionary=effect.get("options",{});var anchor:=_anchor(str(options.get("anchorElement","totMusicaBossFrame")));fx.play(effect.get("profile",{}),effect.event,anchor,anchor,options)
		"number":
			var value: Dictionary=effect.value;value.anchor=_anchor(str(value.get("anchorElement","totMusicaBossFrame")),Vector2(.5,.38));numbers.spawn(float(value.get("amount",0)),str(value.get("targetSide","enemy")),value)
		"animation":
			var world:="real" if "Real" in str(effect.anchor) else "song" if "Song" in str(effect.anchor) else "boss"
			stage.actors[world].renderer.restart(str(effect.name));_actor_motion(world)
		"refresh-panel":pass
		_:assert(false,"Unhandled original Tot effect "+str(effect.type))
