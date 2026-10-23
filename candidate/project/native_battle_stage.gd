extends Control
## JSON-only boundary between QuickJS source rules and persistent native controls.
## This stage is under integration; unsupported cinematics fail visibly in QA.
signal command_json(value: String)
signal targets_requested(item_id: String)
signal presentation_finished(id: String, error: String)
signal status_icons_ready(side: String, id: String)
signal cinematic_music_hold(held: bool)
signal katakuri_music_focus(held: bool)
const Cache = preload("res://native_asset_cache.gd")
const View = preload("res://native_battle_view.gd")
const Timeline = preload("res://native_battle_timeline.gd")
const Intro = preload("res://native_prebattle_intro.gd")
var cache: Node
var view: Control
var timeline: Node
var intro: Control
var lineage_view: Control
var command_count := 0
var open_epoch := 0
var entry: Control
var boss_prompt: Control
var tot_actions: Control
var tot_stage: Control
var judicial_reward: Control
var zephyr_story: Control
var matte:=ColorRect.new()
var external_presentations: Dictionary={}

func _ready() -> void:
	hide()
	cache = Cache.new()
	cache.asset_root = ProjectSettings.globalize_path("res://../../public")
	cache.mount_roots = {"mobile":ProjectSettings.globalize_path("res://../../android/web")}
	add_child(cache)
	matte.color=Color("041526");matte.size=size;matte.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(matte)
	view = View.new()
	view.cache = cache
	view.size = size
	add_child(view)
	timeline = Timeline.new()
	timeline.cache = cache
	timeline.view = view
	add_child(timeline)
	timeline.finished.connect(func(id,error):presentation_finished.emit(id,error))
	timeline.status_icons_ready.connect(func(side,id):status_icons_ready.emit(side,id))
	timeline.rokuogan.music_hold_requested.connect(func(held):cinematic_music_hold.emit(held))
	timeline.katakuri.focus_changed.connect(func(held):katakuri_music_focus.emit(held))
	view.command_requested.connect(func(type,payload):
		command_count += 1
		command_json.emit(JSON.stringify({"type":type,"payload":payload}))
	)
	view.item_targets_requested.connect(func(id):targets_requested.emit(id))
	intro = Intro.new()
	intro.view = view
	view.add_child(intro)
	intro.completed.connect(func(id,key):command_json.emit(JSON.stringify({"type":"intro-done","payload":{"introId":id,"introKey":key}})))
	intro.unsupported.connect(func(message):presentation_finished.emit("prebattle-error",message))
	lineage_view=preload("res://native_lineage_stage.gd").new()
	lineage_view.cache=cache;lineage_view.battle_view=view;lineage_view.size=size
	add_child(lineage_view)
	lineage_view.surface_closed.connect(func():
		if visible:timeline.sync_result(view.model)
	)
	entry=preload("res://native_battle_entry.gd").new();entry.battle=self
	get_parent().add_child.call_deferred(entry)
	boss_prompt=preload("res://native_boss_prompt_stage.gd").new();boss_prompt.battle_view=view;boss_prompt.size=size;boss_prompt.theme=view.theme;add_child(boss_prompt)
	tot_actions=preload("res://native_tot_actions.gd").new();tot_actions.battle_view=view;tot_actions.size=size;tot_actions.theme=view.theme;add_child(tot_actions)
	resized.connect(func():tot_actions.size=size)
	tot_stage=preload("res://native_tot_stage.gd").new();tot_stage.battle_view=view;tot_stage.actions=tot_actions;tot_stage.size=size;tot_stage.theme=view.theme;add_child(tot_stage)
	resized.connect(func():tot_stage.size=size)
	zephyr_story=preload("res://native_zephyr_story.gd").new();zephyr_story.cache=cache;zephyr_story.size=size;add_child(zephyr_story)
	resized.connect(func():zephyr_story.size=size)
	resized.connect(func():boss_prompt.size=size)
	resized.connect(func():view.size=size;lineage_view.size=size;matte.size=size)
	judicial_reward=preload("res://native_judicial_reward.gd").new();judicial_reward.cache=cache;judicial_reward.size=size;add_child(judicial_reward)
	resized.connect(func():judicial_reward.size=size)

func reset_battle_actor_visuals(identity: String) -> void:
	# Match the source resetBattleSessionVisualState boundary. A healed captain
	# can enter another battle in the same slot after fading out on defeat.
	timeline.reset_actor_presentation()
	view.battle_identity=identity
	view.actor_keys.clear()
	view.pose_overrides.clear()
	view.hp_overrides.clear()
	view.finish_pending_until=0
	for portrait in view.portraits.values():portrait.modulate.a=1.0

func apply_view_json(value: String) -> void:
	var started:=Time.get_ticks_usec()
	var model: Dictionary = JSON.parse_string(value)
	view.apply_view(model)
	timeline.king.sync(model)
	timeline.nika_heartbeat.sync(model)
	intro.sync(model)
	timeline.sync_replacement(model)
	if not model.get("battle",{}).get("lineageExtraction"):timeline.sync_result(model)
	else:timeline.suspend_result()
	if lineage_view.visible:lineage_view._hide_battle_controls()
	if tot_actions.visible:tot_actions._hide_standard_controls()
	tot_stage.sync_controls_visibility()
	var elapsed:=(Time.get_ticks_usec()-started)/1000.0
	if elapsed>=40:print("[PO_PERF] ",JSON.stringify({"area":"battle-view","ms":elapsed,"chars":value.length()}))

func assets_ready() -> bool:
	if not intro.assets_ready():return false
	if not tot_stage.assets_ready():return false
	for target in [view.background,view.portraits.player,view.portraits.enemy]:
		if target.texture == null or target.get_meta("loaded_asset","") != target.get_meta("wanted_asset",""): return false
	return true

func request_open() -> void:
	request_open_json('{"skip":true}')

func request_open_json(value: String) -> void:
	var packet: Dictionary=JSON.parse_string(value)
	if packet.get("repeat",false):
		if visible:entry.reopen()
		return
	open_epoch+=1
	if visible:return
	entry.begin(packet)
	_open_when_ready(open_epoch)

func presentation_ready() -> bool:return visible and assets_ready() and entry.presentation_ready()
func begin_close() -> void:entry.begin_close()
func entry_history_json() -> String:return JSON.stringify(entry.history)

func _open_when_ready(epoch: int) -> void:
	# Original openBattleWindow is called before notifyBattleWindow. Yield once
	# so readiness refers to the incoming battle, not a retained previous image.
	await get_tree().process_frame
	var deadline := Time.get_ticks_msec()+15000
	while is_inside_tree() and epoch==open_epoch:
		if assets_ready() and entry.can_open():show();return
		for target in [view.background,view.portraits.player,view.portraits.enemy]:
			var path: String=target.get_meta("wanted_asset","")
			if cache.failed.has(path):
				presentation_finished.emit("prebattle-error","Native battle required image failed: "+path)
				return
		if Time.get_ticks_msec()>deadline:
			presentation_finished.emit("prebattle-error","Native battle images did not become ready")
			return
		await get_tree().process_frame

func close_surface() -> void:
	open_epoch+=1
	zephyr_story.close_surface()
	view.portraits.enemy.sync_demon({},"normal")
	timeline.katakuri.cancel()
	timeline.king.stop()
	timeline.sanji.cancel()
	timeline.kyubi.cancel()
	timeline.phase_dialogue.cancel()
	timeline.black_turn.cancel()
	timeline.lucci_six.cancel()
	timeline.oars.cancel()
	timeline.saga.cancel()
	timeline.bullet.cancel()
	intro._cancel()
	entry.reset()
	timeline.suspend_result()
	hide()
	lineage_view.close_surface()

func test_capture_intro() -> void:
	_capture_png("native-intro-check.png")

func test_replacement_ready() -> bool:
	return view.page == "replacement"

func test_result_ready() -> bool:
	return view.page == "result"

func test_capture_result(index: String) -> void:
	_capture_png("native-result-"+index+"-check.png")

func test_press_finish() -> void:
	assert(view.page == "result")
	assert(not view.choice_confirm.disabled)
	view.choice_confirm.pressed.emit()

func test_capture_replacement() -> void:
	_capture_png("native-replacement-check.png")

func test_capture_status(kind: String) -> void:
	_capture_png("native-status-"+kind+"-check.png")

func diagnostics_json() -> String:
	return JSON.stringify({"audioLoads":timeline.audio.load_count,"audioPlays":timeline.audio.play_count,"audioFailures":timeline.audio.failed,"audioPlayers":timeline.audio.players.size(),"damageNumbers":timeline.numbers.emitted,"numberPool":timeline.numbers.pool.size()})

func test_press_replacement(index: int) -> void:
	assert(view.page == "replacement")
	assert(not view.sheet_back_button.visible)
	for button in view.sheet_list.get_children():
		if button.get_meta("replacement_index",-1) == index:
			button.pressed.emit()
			return
	push_error("Original replacement candidate was missing from native list")

func _capture_png(filename: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path("res://"+filename))

func test_assert_intro_completed() -> void:
	assert(intro.phase_history == ["hero","enemy"])
	assert(not intro.visible)
	assert(view._can_act())

func test_escape_menu() -> void:
	var before:=command_count
	view.command_buttons[3].pressed.emit()
	assert(view.page == "escape")
	assert(command_count == before)
	assert(view.escape_buttons[0].disabled == (int(view.model.battle.escapeThreshold) <= 0))
	view.escape_buttons[1].pressed.emit()
	assert(command_count == before)
	assert(view.escape_buttons[0].text == "確定投降")
	view.escape_buttons[1].pressed.emit()
	assert(command_count == before)
	assert(view.escape_buttons[0].text == "嘗試逃跑")
	_capture_png("native-escape-check.png")

func apply_targets_json(value: String) -> void:
	view.show_item_targets(JSON.parse_string(value))

func present_json(id: String, value: String) -> void:
	var packet: Dictionary = JSON.parse_string(value)
	timeline.present(id,packet.event,packet.profile,packet.dice,packet.hp,packet.get("sounds",{}),packet.get("status",{}),packet.get("kyubi",{}),packet.get("blackTurn",{}),packet.get("lucciSix",{}),packet.get("oars",{}),packet.get("saga",{}),packet.get("bullet",{}))

func black_turn_geometry_json() -> String:
	var geometry: Dictionary={"stage":{"left":0,"top":0,"width":view.size.x,"height":view.size.y},"enemyImage":view.portraits.enemy.get_meta("loaded_asset","")}
	for side in ["player","enemy"]:
		var card: Control=view.portraits[side];geometry[side]={"left":card.position.x,"top":card.position.y,"width":card.size.x,"height":card.size.y}
	return JSON.stringify(geometry)

func cancel_black_turn_visual() -> void:timeline.black_turn.cancel()
func cancel_lucci_six_visual() -> void:timeline.lucci_six.cancel()
func cancel_oars_visual() -> void:timeline.oars.cancel()
func cancel_saga_visual() -> void:timeline.saga.cancel()

func cancel_sanji_visual() -> void:
	if not timeline.sanji.event_id.is_empty():timeline.sanji.cancel()

func cancel_kyubi_visual() -> void:
	if timeline.kyubi.visible:timeline.kyubi.cancel()

func begin_external_presentation(id: String) -> void:
	assert(not external_presentations.has(id),"Duplicate external battle presentation")
	external_presentations[id]=true
	timeline.active_jobs+=1

func end_external_presentation(id: String) -> void:
	assert(external_presentations.has(id),"Unknown external battle presentation")
	external_presentations.erase(id)
	timeline.active_jobs-=1
	assert(timeline.active_jobs>=0,"Unbalanced battle presentation gate")

func wait_ms(milliseconds: float) -> void:
	await get_tree().create_timer(maxf(0.001,milliseconds/1000.0)).timeout

func test_press_move() -> void:
	view._select_mode("attack")
	if view.move_buttons.is_empty() or view.move_buttons[0].disabled:
		push_error("Original battle did not permit the native move button")
		return
	var before := command_count
	view.move_buttons[0].pressed.emit()
	assert(command_count == before)
	view.choice_confirm.pressed.emit()
	assert(command_count == before+1)

func test_press_partner(index: int) -> void:
	view._select_mode("partners")
	for button in view.sheet_list.get_children():
		if button.get_meta("crew_index",-1) == index and not button.disabled:
			var before := command_count
			button.pressed.emit()
			assert(command_count == before)
			view.choice_confirm.pressed.emit()
			assert(command_count == before+1)
			return
	push_error("Original battle did not permit the native partner button")

func test_press_item(item_id: String, target_index: int) -> void:
	view._select_mode("items")
	for button in view.sheet_list.get_children():
		if button.get_meta("item_id","") == item_id and not button.disabled:
			var before := command_count
			button.pressed.emit()
			assert(command_count == before)
			view.choice_confirm.pressed.emit()
			if view.page == "item-targets":
				assert(command_count == before)
				for target in view.sheet_list.get_children():
					if target.get_meta("target_payload",{}).get("targetIndex",-1) == target_index and not target.disabled:
						target.pressed.emit()
						assert(command_count == before)
						view.choice_confirm.pressed.emit()
						assert(command_count == before+1)
						return
				push_error("Original battle did not permit the native item target")
			return
	push_error("Original battle did not permit the native item button")
