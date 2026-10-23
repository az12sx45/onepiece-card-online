extends Node
## Original cinematic timeline; authoritative HP/rules remain in JS game state.
signal music_hold_requested(held: bool)
const Motion=preload('res://native_rokuogan_motion.gd')
var timeline: Node
var view: Control
var layer: Control
var trace: Array=[]
var began:=0
var shake_began:=-1
var base_position:=Vector2.ZERO
var held:=false
func _ready() -> void:
	layer=preload('res://native_rokuogan_effect.gd').new();layer.cache=timeline.cache;layer.size=view.size;layer.z_index=318;view.add_child(layer)
	view.resized.connect(func():layer.size=view.size)
	set_process(false)
func _mark(kind: String,value=null) -> void:trace.append({'kind':kind,'value':value,'ms':Time.get_ticks_msec()-began})
func _until(ms: float) -> void:
	var remaining:=ms-(Time.get_ticks_msec()-began)
	if remaining>0:await get_tree().create_timer(remaining/1000.0).timeout
func _shake() -> void:
	shake_began=Time.get_ticks_msec();set_process(true);_mark('shake')
func _process(_delta: float) -> void:
	var time:=float(Time.get_ticks_msec()-shake_began)/1000
	if shake_began<0 or time>=float(Motion.data.catalog.stageImpactShake.duration):view.position=base_position;set_process(false);return
	view.position=base_position+Motion.sample('stageImpactShake',time,view.size).transform.origin
func play(event: Dictionary,hp: Dictionary,status: Dictionary) -> String:
	var audio: Node=timeline.audio
	var sounds: Dictionary={}
	for key in ['voiceSfx','hitVoiceSfx','hitSfx']:
		if not str(event.get(key,'')).is_empty():sounds[key]=event[key]
	var error: String=await timeline._warm(event,{},sounds)
	if not error.is_empty():return error
	var deadline:=Time.get_ticks_msec()+15000
	while not layer.warm():
		if Time.get_ticks_msec()>deadline:return 'Original Lucci cinematic assets unavailable'
		await get_tree().process_frame
	var target: String=str(event.get('targetSide',''))
	if target not in ['player','enemy']:target='player' if event.get('side','')=='enemy' else 'enemy'
	var hits: Array=event.hitDamages if event.get('hitDamages') is Array and not event.hitDamages.is_empty() else [event.get('damage',0)]
	var total:=0
	for hit in hits:total+=maxi(0,roundi(float(hit)))
	var connected: bool=not event.get('miss',false) and total>0
	var final_map: Dictionary=event.finalHp if event.get('finalHp') is Dictionary else {}
	var start_map: Dictionary=event.startHp if event.get('startHp') is Dictionary else {}
	var final_hp: float=hp.get('finalPlayerHp' if target=='player' else 'finalEnemyHp',final_map.get(target,view.hud[target].hp.value))
	var current_hp: float=hp.get('playerHp' if target=='player' else 'enemyHp',start_map.get(target,minf(view.hud[target].hp.max_value,final_hp+total)))
	view.set_display_hp(target,current_hp)
	began=Time.get_ticks_msec();base_position=view.position;trace.clear()
	audio.silence_effects(true);held=true;music_hold_requested.emit(true);_mark('music-hold')
	layer.start();_mark('show');audio.play_effect(str(event.get('voiceSfx','')),.96,true);_mark('voice-call',event.get('voiceSfx',''))
	timeline._pose('enemy','attack',1800);_mark('enemy-attack')
	await _until(2850);_shake()
	await _until(float(Motion.data.timing.LUCCI_ROKUOGAN_CINEMATIC_MS));layer.stop();_mark('hide');timeline.pose_epochs[target]=int(timeline.pose_epochs.get(target,0))+1;view.set_pose(target,'')
	await _until(float(Motion.data.timing.LUCCI_ROKUOGAN_IMPACT_AT_MS))
	if connected:
		audio.play_effect(str(event.get('hitVoiceSfx','')),.9,true);_mark('voice-hit',event.get('hitVoiceSfx',''))
		timeline._pose(target,'hitPlayerSide' if target=='player' else 'hitEnemySide',float(Motion.data.timing.LUCCI_ROKUOGAN_HIT_POSE_MS))
		for index in range(hits.size()):
			var damage:=maxi(0,roundi(float(hits[index])));current_hp=maxf(final_hp,maxf(0,current_hp-damage));view.set_display_hp(target,current_hp)
			var critical: bool=timeline.critical_hit(event,index)
			timeline.numbers.spawn(damage,target,{'critical':critical,'hitIndex':index});timeline.applied_hits+=1;_mark('damage',{'amount':damage,'critical':critical,'target':target,'index':index})
		audio.play_effect(str(event.get('hitSfx','')),.16,true);_shake()
	else:timeline.numbers.spawn(0,target,{'miss':true});_mark('miss',target)
	if connected and event.get('effectFx') is Dictionary and not event.effectFx.is_empty() and not status.is_empty():
		await _until(float(Motion.data.timing.LUCCI_ROKUOGAN_IMPACT_AT_MS)+900)
		timeline._status_visual(event,status,true,'');_mark('status',status.target)
	await _until(float(Motion.data.timing.LUCCI_ROKUOGAN_IMPACT_AT_MS)+float(Motion.data.timing.LUCCI_ROKUOGAN_HIT_POSE_MS)-100)
	view.release_display_hp(target);_mark('hp-finished')
	await _until(maxf(float(Motion.data.timing.LUCCI_ROKUOGAN_TOTAL_MS),float(event.get('duration',Motion.data.timing.LUCCI_ROKUOGAN_TOTAL_MS))))
	for key in ['voiceSfx','hitVoiceSfx']:audio.stop_path(str(event.get(key,'')))
	cleanup();_mark('cleanup');return ''
func cleanup() -> void:
	if is_instance_valid(layer):layer.stop()
	if is_instance_valid(timeline.audio):timeline.audio.silence_effects(false)
	if held:held=false;music_hold_requested.emit(false)
	if is_instance_valid(view):view.position=base_position
	set_process(false)
func _exit_tree() -> void:
	if held:music_hold_requested.emit(false)
