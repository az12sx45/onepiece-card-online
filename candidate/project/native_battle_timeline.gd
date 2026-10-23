extends Node
## Source playImpactFx timing translated to native sprite/timer operations.
## Each boss event must have an actual native presenter before it is enabled.
## An unknown event is an error, never a silent acknowledgement.
signal finished(id: String, error: String)
signal status_icons_ready(side: String, id: String)
const MoveFx = preload("res://native_move_fx.gd")
const Dice = preload("res://native_battle_dice.gd")
const NoticeQueue = preload("res://native_notice_queue.gd")
const Numbers = preload("res://native_battle_numbers.gd")
const Audio = preload("res://native_battle_audio.gd")
const StatusParticles = preload("res://native_status_particles.gd")
const TurnBanner = preload("res://native_turn_banner.gd")
const NikaHeartbeat=preload("res://native_nika_heartbeat.gd")
var view: Control
var cache: Node
var fx: Node2D
var seen: Dictionary = {}
var history: Array[String] = []
var pose_epochs: Dictionary = {}
var active_jobs := 0
var applied_hits := 0
var dice: Control
var notices: Control
var numbers: Control
var audio: Node
var status_layers: Dictionary = {}
var turn_banner: Control
var replacement_gate := ""
var knockout_done: Dictionary = {}
var knockout_tweens: Dictionary = {}
var result_gate := ""
var result_notice_epoch := -1
var nika_heartbeat: Control
var rokuogan: Node
var judge_clones: Control
var shake: Node
var katakuri: Control
var king: Control
var sanji: Control
var kyubi: Control
var phase_dialogue: Control
var black_turn: Node
var lucci_six: Control
var oars: Control
var saga: Control
var bullet: Control

func _ready() -> void:
	fx = MoveFx.new()
	fx.cache = cache
	view.add_child(fx)
	audio=Audio.new()
	audio.asset_root=cache.asset_root
	add_child(audio)
	numbers=Numbers.new()
	numbers.view=view
	view.add_child(numbers)
	for side in ["player","enemy"]:
		var clip:=Control.new()
		clip.mouse_filter=Control.MOUSE_FILTER_IGNORE
		clip.clip_contents=true
		view.add_child(clip)
		var particles:=StatusParticles.new()
		clip.add_child(particles)
		status_layers[side]={"clip":clip,"particles":particles}
	dice = Dice.new()
	dice.cache = cache
	view.add_child(dice)
	notices = NoticeQueue.new()
	notices.cache = cache
	view.add_child(notices)
	var overlay:=CanvasLayer.new()
	overlay.layer=1000
	add_child(overlay)
	turn_banner=TurnBanner.new()
	turn_banner.view=view
	overlay.add_child(turn_banner)
	nika_heartbeat=NikaHeartbeat.new();nika_heartbeat.view=view;view.add_child(nika_heartbeat)
	rokuogan=preload('res://native_rokuogan_sequence.gd').new();rokuogan.timeline=self;rokuogan.view=view;add_child(rokuogan)
	judge_clones=preload("res://native_judge_clones.gd").new();judge_clones.view=view;judge_clones.cache=cache;view.add_child(judge_clones)
	shake=preload("res://native_battle_shake.gd").new();shake.view=view;add_child(shake)
	katakuri=preload("res://native_katakuri_cinematic.gd").new();katakuri.size=view.size;katakuri.asset_root=cache.asset_root;view.add_child(katakuri)
	view.resized.connect(func():katakuri.size=view.size)
	king=preload("res://native_king_flame.gd").new();king.view=view;king.audio=audio;view.add_child(king)
	sanji=preload("res://native_sanji_cinematic.gd").new();sanji.cache=cache;sanji.size=view.size;view.add_child(sanji)
	view.resized.connect(func():sanji.size=view.size)
	sanji.shake_requested.connect(shake.play)
	kyubi=preload("res://native_kyubi_mask.gd").new();kyubi.cache=cache;kyubi.view=view;view.add_child(kyubi);kyubi.shake_requested.connect(shake.play)
	phase_dialogue=preload("res://native_phase_dialogue.gd").new();phase_dialogue.view=view;view.add_child(phase_dialogue)
	phase_dialogue.skipped.connect(func():pose_epochs.enemy=int(pose_epochs.get("enemy",0))+1;view.set_pose("enemy",""))
	black_turn=preload("res://native_black_turn_cinematic.gd").new();black_turn.view=view;black_turn.cache=cache;add_child(black_turn)
	lucci_six=preload("res://native_lucci_six.gd").new();lucci_six.view=view;lucci_six.cache=cache;view.add_child(lucci_six);lucci_six.shake_requested.connect(shake.play)
	oars=preload("res://native_oars_purification.gd").new();oars.view=view;oars.cache=cache;oars.timeline=self;view.add_child(oars)
	saga=preload("res://native_saga_fusion.gd").new();saga.view=view;saga.cache=cache;saga.timeline=self;view.add_child(saga)
	bullet=preload("res://native_bullet_fusion.gd").new();bullet.view=view;bullet.cache=cache;bullet.timeline=self;view.add_child(bullet)

func present(id: String, event: Dictionary, profile: Dictionary, packet: Dictionary = {}, display_hp: Dictionary = {}, sounds: Dictionary = {}, status: Dictionary = {}, kyubi_packet: Dictionary = {}, black_turn_packet: Dictionary = {}, lucci_six_packet: Dictionary = {}, oars_packet: Dictionary = {}, saga_packet: Dictionary = {}, bullet_packet: Dictionary = {}) -> void:
	if seen.has(id):
		if seen[id] != "pending": finished.emit(id,str(seen[id]))
		return
	seen[id] = "pending"
	history.append(id)
	while history.size() > 512:
		var old: String = history.pop_front()
		if seen.get(old) != "pending": seen.erase(old)
	active_jobs += 1
	var error := ""
	var type: String = event.get("type","")
	var side: String = event.get("side","player")
	if type == "attack": error = await _attack(event,profile,display_hp,sounds,status)
	elif type in ["status","heal","passive-opening"]:
		if status.is_empty(): error="Original status presentation packet is required"
		else: error=await _effect(event,profile,sounds,status)
	elif type == "prepare":
		_pose(side,"morale" if event.get("moveType") in ["heal","buff","shield"] else "angry",1800)
		await dice.message(str(event.get("moveName","準備行動")),"",float(event.get("duration",520)))
	elif type == "dice":
		if packet.is_empty(): error = "Original dice presentation packet is required"
		else:
			_pose(side,"morale" if packet.theme in ["heal","skill"] else "angry",maxf(2600,float(event.get("duration",1650))+1250))
			await dice.play(packet)
	elif type == "bonus":
		if packet.is_empty(): error = "Original bonus presentation packet is required"
		else: await dice.message(str(packet.settledTitle),str(packet.summary),float(event.get("duration",900)))
	elif type == "switch":
		var switch_duration:=maxf(900,float(event.get("duration",1800)))
		_pose(side,"switch-in",switch_duration)
		var portrait: TextureRect = view.portraits[side]
		portrait.modulate.a = 0.35
		var tween := create_tween()
		tween.tween_property(portrait,"modulate:a",1.0,0.28)
		await dice.message(str(event.get("title","換上 "+str(event.get("toName","夥伴"))+"！")),str(event.get("subtitle","")),switch_duration)
	elif type == "legacy-heal":
		_pose(side,"morale",900)
		numbers.spawn(float(event.get("amount",0)),side,{"heal":true})
		await dice.message("回復","+"+str(event.get("amount",0))+" HP",float(event.get("duration",760)))
	elif type in ["legacy-buff","legacy-debuff"]:
		_pose(side,"morale" if type == "legacy-buff" else "dizzy",900)
		await dice.message(str(event.get("label","")),"",float(event.get("duration",760)))
	elif type == "legacy-switch":
		# Source emits the dedicated switch visual as well. Only the source's
		# short parent-window wait remains here; do not play the switch twice.
		await _wait(float(event.get("duration",280)))
	elif type == "legacy-escape":
		await dice.message("逃跑成功！" if event.get("success",false) else "逃跑失敗！","",float(event.get("duration",680)))
	elif type == "round-end":
		await dice.message({"round-pause":"本輪結束","win":"勝利！","lose":"戰敗..."}.get(event.get("result",""),"戰鬥結果"),"",float(event.get("duration",520)))
	elif type == "battle-intro":
		await dice.message(str(event.get("playerName",""))+" VS "+str(event.get("enemyName","")),"",float(event.get("duration",520)))
	elif type == "mission-complete-toast": await notices.play(event)
	elif type == "turn-banner": await turn_banner.play(event)
	elif type == "knockout": await _knockout(side,str(event.get("targetName",event.get("name",""))))
	elif type == "postgame-aramaki-down":
		# Source showKnockoutPose keeps the body visible; this is not the final KO.
		pose_epochs.enemy=int(pose_epochs.get("enemy",0))+1
		view.set_pose("enemy","dizzy")
		await dice.message(str(event.get("targetName","綠牛／荒牧"))+" 倒下！","",float(event.get("duration",1100)))
	elif type == "postgame-aramaki-revive":
		pose_epochs.enemy=int(pose_epochs.get("enemy",0))+1
		knockout_done.erase("enemy")
		view.portraits.enemy.modulate.a=1.0
		view.set_pose("enemy","")
		var healing: Dictionary=event.duplicate(true);healing.type="heal"
		if status.is_empty():error="Original Aramaki healing presentation packet is required"
		else:error=await _effect(healing,profile,sounds,status)
	elif type == "nika-heartbeat":
		pose_epochs.player=int(pose_epochs.get("player",0))+1
		nika_heartbeat.pulse();await _wait(float(event.get("duration",920)))
	elif type == "postgame-katakuri-future-sight":error=await katakuri.play_event(event)
	elif type == "sanji-raid-suit-transform":error=await sanji.play_event(event)
	elif type == "kyubi-mask":error=await kyubi.play_event(event,kyubi_packet)
	elif type == "black-turn-cast":error=await black_turn.play_event(event,black_turn_packet)
	elif type == "postgame-lucci-six-power":error=await lucci_six.play_event(event,lucci_six_packet)
	elif type == "postgame-oars-purify":error=await oars.play_event(event,oars_packet)
	elif type == "postgame-saga-fusion":error=await saga.play_event(event,saga_packet)
	elif type == "postgame-bullet-fusion":error=await bullet.play_event(event,bullet_packet)
	elif type == "phase2-dialogue":
		_pose("enemy","angry",maxf(1800,float(event.get("duration",3000))))
		error=await phase_dialogue.play_event(event)
	else: error = "Native presentation not implemented: "+type
	active_jobs -= 1
	seen[id] = error
	finished.emit(id,error)

func reset_actor_presentation() -> void:
	suspend_result()
	replacement_gate=""
	for tween in knockout_tweens.values():
		if is_instance_valid(tween):tween.kill()
	knockout_tweens.clear()
	knockout_done.clear()
	for side in ["player","enemy"]:
		pose_epochs[side]=int(pose_epochs.get(side,0))+1
		view.portraits[side].stop_attack_motion()
		view.portraits[side].stop_hit_motion()

func sync_replacement(model: Dictionary) -> void:
	var battle: Dictionary=model.get("battle",{})
	if not battle.get("needsReplacement",false) or battle.get("luffyGearFifthAwakeningPending",false) or battle.get("keepPlayerPortraitOnKnockout",false):
		replacement_gate=""
		return
	var key: String=str(view.actor_keys.get("player",""))+":"+str(battle.get("replacementReason",""))
	if replacement_gate == key: return
	replacement_gate=key
	_replacement_after_animation(key)

func sync_result(model: Dictionary) -> void:
	var battle: Dictionary=model.get("battle",{})
	if battle.get("luffyGearFifthAwakeningPending",false) or battle.get("keepPlayerPortraitOnKnockout",false) or battle.get("needsReplacement",false) or not (battle.get("result") or battle.get("canFinish",false)) or not model.has("_nativeResult"):
		result_gate=""
		return
	# Dedicated interactive rewards/extraction/switching must own their screen.
	if battle.get("result") == "judicial-switch" or (battle.get("lineageExtraction") is Dictionary and not battle.lineageExtraction.get("allResolved",false)):
		suspend_result()
		return
	var key: String=str(model._nativeResult.signature)
	if result_gate == key: return
	result_gate=key
	_result_after_animation(key)

func suspend_result() -> void:
	# An interactive page can replace a pending result while its delay is still
	# running. Invalidate only that result, never a queued gameplay animation.
	result_gate=""
	if result_notice_epoch==dice.epoch:
		dice.epoch+=1
		dice.hide()
	result_notice_epoch=-1

func _result_after_animation(key: String) -> void:
	await get_tree().process_frame
	if result_gate != key: return
	while active_jobs > 0:
		await get_tree().process_frame
		if result_gate != key: return
	for side in ["player","enemy"]:
		if result_gate != key: return
		var actor: Dictionary=view.model.activeCard if side == "player" else view.model.enemy
		if actor.currentHp <= 0: await _knockout(side,str(actor.name),key)
	if result_gate == key: view.show_result()

func _replacement_after_animation(key: String) -> void:
	# The JS bridge enqueues the current visual after applying its state. Give
	# it that frame before deciding whether the attack has actually finished.
	await get_tree().process_frame
	while active_jobs > 0:
		await get_tree().process_frame
		if replacement_gate != key: return
	if replacement_gate != key: return
	if view.model.activeCard.currentHp <= 0:
		await _knockout("player",str(view.model.activeCard.name))
	if replacement_gate == key: view.show_replacement()

func _knockout(side: String, label: String, result_key: String="") -> void:
	var key: String=view.actor_keys.get(side,"")
	if knockout_done.get(side,"") == key: return
	knockout_done[side]=key
	pose_epochs[side]=int(pose_epochs.get(side,0))+1
	view.set_pose(side,"hitPlayerSide" if side == "player" else "hitEnemySide")
	if side == "player" and (view.model.battle.get("keepPlayerPortraitOnKnockout",false) or view.model.battle.get("luffyGearFifthAwakeningPending",false)):
		dice.message(label+" 瀕死！","",760)
		return
	await _wait(1250)
	if not result_key.is_empty() and result_gate!=result_key:
		if knockout_done.get(side,"")==key:knockout_done.erase(side)
		return
	if view.actor_keys.get(side,"") != key: return
	var tween:=create_tween()
	knockout_tweens[side]=tween
	tween.tween_property(view.portraits[side],"modulate:a",0.0,1.05)
	while tween.is_running():
		await get_tree().process_frame
		if view.actor_keys.get(side,"") != key:
			tween.kill()
			if knockout_tweens.get(side)==tween:knockout_tweens.erase(side)
			return
		if not result_key.is_empty() and result_gate!=result_key:
			tween.kill()
			if knockout_tweens.get(side)==tween:knockout_tweens.erase(side)
			if view.actor_keys.get(side,"")==key:view.portraits[side].modulate.a=1.0
			if knockout_done.get(side,"")==key:knockout_done.erase(side)
			return
	if knockout_tweens.get(side)==tween:knockout_tweens.erase(side)
	if view.actor_keys.get(side,"") != key: return
	await _wait(120)
	if not result_key.is_empty() and result_gate!=result_key:
		if view.actor_keys.get(side,"")==key:view.portraits[side].modulate.a=1.0
		if knockout_done.get(side,"")==key:knockout_done.erase(side)
		return
	# Finish the announcement before exposing the replacement buttons, so the
	# native banner cannot cover the candidates or consume their touch area.
	if not result_key.is_empty():result_notice_epoch=dice.epoch+1
	await dice.message(label+(" 瀕死！" if side == "player" else " 倒下！"),"",760)

func _wait(ms: float) -> void:
	await get_tree().create_timer(maxf(0.001,ms/1000.0)).timeout

func _effect(event: Dictionary, profile: Dictionary, sounds: Dictionary, packet: Dictionary) -> String:
	var generic: bool=profile.is_empty()
	var sound: String="audio/board_game/sfx/game01/game01/"+("powerdown04.mp3" if packet.direction == "down" else "powerup05.mp3")
	var warm_sounds:=sounds.duplicate()
	if generic: warm_sounds.status=sound
	var error: String=await _warm(event,profile,warm_sounds)
	if not error.is_empty(): return error
	_pose(str(packet.poseSide),str(packet.pose),float(packet.duration) if event.type == "passive-opening" else 900)
	dice.message(str(packet.title),str(packet.label),850)
	_status_visual(event,packet,generic,sound)
	await _wait(320)
	if event.get("amount",0) > 0: numbers.spawn(float(event.amount),str(packet.target),{"heal":true})
	elif event.get("damage",0) > 0: numbers.spawn(float(event.damage),str(packet.target))
	var impact_at:=maxf(360,float(packet.delay))
	await _wait(impact_at-320)
	if not generic:
		fx.stage_size=view.size
		fx.play(profile,event,_anchor(str(packet.side)),_anchor(str(packet.target)),{"phase":"impact","actorSide":packet.side})
	audio.play_effect(str(sounds.get("cast","")),0.12)
	audio.play_effect(str(sounds.get("hit","")),0.16)
	await _wait(maxf(1,float(packet.duration)-impact_at))
	return ""

func _status_visual(event: Dictionary, packet: Dictionary, generic: bool, sound: String) -> void:
	if packet.delay > 0: await _wait(float(packet.delay))
	if generic:
		var group: Dictionary=status_layers[packet.target]
		var card: Control=view.portraits[packet.target]
		group.clip.position=card.position+card.size*Vector2(0.1,0.08)
		group.clip.size=card.size*Vector2(0.8,0.84)
		group.particles.play(packet,group.clip.size)
	await _wait(260)
	status_icons_ready.emit(str(packet.target),str(event.get("id","")))
	await _wait(240)
	if generic: audio.play_effect(sound,0.22)

func _warm(event: Dictionary, profile: Dictionary, sounds: Dictionary = {}) -> String:
	var paths: Array[String] = []
	if not profile.is_empty(): paths.append(str(profile.get("sheet","")))
	for actor in [event.get("actorCombatant",{}),event.get("targetCombatant",{})]:
		for pose in ["normal","attack","hitPlayerSide","hitEnemySide"]:
			var path: String = actor.get("battlePortraits",{}).get(pose,"")
			if not str(path).is_empty() and not paths.has(str(path)): paths.append(str(path))
	for path in paths: cache.request(path)
	for path in sounds.values(): audio.warm(str(path))
	var deadline := Time.get_ticks_msec()+10000
	while true:
		var ready := true
		for path in sounds.values():
			if audio.pending.has(path): ready=false
		for path in paths:
			if cache.failed.has(path): return "Native battle asset unavailable: "+path
			if cache.request(path) == null: ready = false
		if ready: return ""
		if Time.get_ticks_msec() > deadline: return "Native battle texture warm-up failed"
		await get_tree().process_frame
	return ""

func _pose(side: String, pose: String, duration: float) -> void:
	var epoch: int = int(pose_epochs.get(side,0))+1
	pose_epochs[side] = epoch
	view.set_pose(side,pose)
	if pose=="attack":view.portraits[side].play_attack_motion(duration)
	elif pose in ["hit","hitPlayerSide","hitEnemySide"]:view.portraits[side].play_hit_motion(duration)
	await _wait(duration)
	if pose_epochs.get(side) == epoch and not (side=="player" and nika_heartbeat.active): view.set_pose(side,"")

func _anchor(side: String) -> Vector2:
	var portrait: TextureRect = view.portraits[side]
	return portrait.position+portrait.size*Vector2(0.5,0.5)

func critical_hit(event: Dictionary,index: int) -> bool:
	# JSON.parse_string produces floats; Array.has(int) uses strict Variant types.
	# The source maps each supplied hit index through Number before comparison.
	if not event.get('criticalHitIndexes') is Array:return bool(event.get('critical',false))
	for value in event.criticalHitIndexes:
		if typeof(value) in [TYPE_INT,TYPE_FLOAT,TYPE_BOOL] and float(value)==float(index):return true
		if value==null and index==0:return true
		if value is String and ((value.strip_edges().is_empty() and index==0) or (value.is_valid_float() and value.to_float()==float(index))):return true
	return false

func _attack(event: Dictionary, profile: Dictionary, display_hp: Dictionary, sounds: Dictionary,status: Dictionary={}) -> String:
	if event.get('specialFx','')=='lucci-rokuogan':return await rokuogan.play(event,display_hp,status)
	var side: String = event.get("side","player")
	var target: String = event.get("targetSide","enemy" if side == "player" else "player")
	var hits: Array = event.get("hitDamages",[])
	if hits.is_empty(): hits = [event.get("damage",0)]
	var combo := hits.size() > 1
	var clone_blocks: Array = event.judgeCloneBlocks if event.get("judgeCloneBlocks") is Array else []
	var island_hits: Array=event.shikiIslandHitDamages if event.get("shikiIslandHitDamages") is Array else []
	var island_ids: Array=event.shikiIslandHitTargetIds if event.get("shikiIslandHitTargetIds") is Array else []
	var island_destroyed: Array=event.shikiIslandHitDestroyed if event.get("shikiIslandHitDestroyed") is Array else []
	var clone_count := 0
	if side == "player" and target == "enemy":
		var fallback := clone_blocks.filter(func(value):return bool(value)).size()
		clone_count=clampi(int(event.judgeCloneCountBefore if event.get("judgeCloneCountBefore")!=null else fallback),0,3)
	var first_delay := 360.0 if combo else 480.0
	var contact_delay := 230.0 if combo else 340.0
	var hit_duration := 420.0 if combo else 700.0
	var start_hp: Dictionary = event.startHp if event.get("startHp") is Dictionary else {}
	var final_hp_map: Dictionary = event.finalHp if event.get("finalHp") is Dictionary else {}
	var final_hp: float = display_hp.get("finalPlayerHp" if target == "player" else "finalEnemyHp",final_hp_map.get(target,view.hud[target].hp.value))
	var total_damage := 0.0
	for hit in hits: total_damage += maxf(0,float(hit))
	var hp: float = display_hp.get("playerHp" if target == "player" else "enemyHp",start_hp.get(target,minf(view.hud[target].hp.max_value,final_hp+total_damage)))
	view.set_display_hp(target,hp)
	var error: String = await _warm(event,profile,sounds)
	if not error.is_empty():
		view.release_display_hp(target)
		return error
	if clone_count>0:
		var deadline:=Time.get_ticks_msec()+15000
		while not judge_clones.warm():
			if Time.get_ticks_msec()>deadline:
				view.release_display_hp(target)
				return "Original clone guard image unavailable"
			await get_tree().process_frame
	judge_clones.deploy(clone_count)
	if not island_hits.is_empty():
		var deadline:=Time.get_ticks_msec()+15000
		while not view.shiki_islands.warm():
			if Time.get_ticks_msec()>deadline:
				view.release_display_hp(target);judge_clones.stop()
				return "Original floating island images unavailable"
			await get_tree().process_frame
	dice.message(str(event.get("moveName","戰鬥行動！")),"",850)
	fx.stage_size = view.size
	await _wait(first_delay)
	for i in range(hits.size()):
		_pose(side,"attack",520 if combo else 900)
		if i == 0: audio.play_effect(str(sounds.get("cast","")),0.12)
		var launched: bool = fx.play(profile,event,_anchor(side),_anchor(target),{"phase":"launch","actorSide":side,"durationMs":contact_delay}) if not profile.is_empty() else false
		await _wait(contact_delay)
		var damage := maxf(0,float(hits[i]))
		var fatal_guard: bool=event.get("fatalGuard",false) and i == hits.size()-1
		var critical: bool=critical_hit(event,i)
		var clone_blocked: bool=side=="player" and target=="enemy" and i<clone_blocks.size() and bool(clone_blocks[i])
		var intercept: Dictionary=judge_clones.intercept() if clone_blocked else {}
		var island_damage:=maxf(0,float(island_hits[i])) if i<island_hits.size() else 0.0
		var island_id: String=str(island_ids[i]) if i<island_ids.size() and not str(island_ids[i]).is_empty() else str(event.get("shikiIslandId",""))
		var hit_island: bool=not clone_blocked and not event.get("miss",false) and island_damage>0
		var connected: bool=not clone_blocked and not event.get("miss",false) and (damage>0 or hit_island)
		var impact_anchor: Vector2=intercept.get("impact",view.shiki_islands.impact_anchor(island_id) if hit_island else _anchor(target))
		if not (event.get("fatalGuard",false) and i < hits.size()-1 and damage <= 0) and (not hit_island or damage>0 or clone_blocked or fatal_guard):
			var number_options := {"hitIndex":i,"critical":critical,"miss":event.get("miss",false),"blocked":clone_blocked or fatal_guard,"blockedLabel":event.get("fatalGuardLabel","不屈") if fatal_guard else "GUARD"}
			if intercept.has("number"):number_options.anchor=intercept.number
			numbers.spawn(damage,target,number_options)
		if connected or fatal_guard or clone_blocked: audio.play_effect(str(sounds.get("hit","")),0.16)
		if connected or fatal_guard or clone_blocked: shake.play()
		if event.get("kingFlameGuarded",false) and side=="player" and target=="enemy" and not clone_blocked and not event.get("miss",false):king.hit(i==0)
		if connected:
			_pose(target,"hitPlayerSide" if target == "player" else "hitEnemySide",hit_duration)
			hp = maxf(final_hp,maxf(0,hp-damage))
			view.set_display_hp(target,hp)
			applied_hits += 1
		if (connected or fatal_guard or clone_blocked) and not profile.is_empty():
			var options := {"phase":"impact","actorSide":side,"durationMs":hit_duration,"impactHoldMs":0}
			if launched: options.frameStart = profile.launchFrames
			fx.play(profile,event,_anchor(side),impact_anchor,options)
		if hit_island:
			numbers.spawn(island_damage,"enemy",{"hitIndex":i+1,"critical":critical,"anchor":view.shiki_islands.impact_anchor(island_id)})
			if i<island_destroyed.size() and bool(island_destroyed[i]):view.shiki_islands.break_at_impact(event,island_id)
		if i < hits.size()-1: await _wait(660.0-contact_delay)
	await _wait(hit_duration+220)
	view.release_display_hp(target)
	if not island_hits.is_empty():view.shiki_islands.finish_attack(str(event.get("id","")))
	if clone_count>0:
		await _wait(340)
		judge_clones.stop()
	return ""
