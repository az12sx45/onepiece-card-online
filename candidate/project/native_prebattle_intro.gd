extends Control
## Original two-speaker intro, timed independently from incoming snapshots.
## No gameplay state is changed here; completion returns the source id/key.
signal completed(id: String, key: String)
signal unsupported(message: String)
var view: Control
var identity := ""
var epoch := 0
var played: Dictionary = {}
var active_intro: Dictionary = {}
var quote := Control.new()
var frames: Dictionary = {}
var speaker: Label
var dialogue := RichTextLabel.new()
var phase_history: Array[String] = []
var enma: Control
var cinematic_mode:=false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	z_index=300
	add_child(quote)
	quote.z_index=5
	quote.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["player","enemy"]:
		var art := NinePatchRect.new()
		art.mouse_filter = Control.MOUSE_FILTER_IGNORE
		art.scale = Vector2.ONE*0.2
		# The speaker plate is part of the left artwork. Keep it entirely in
		# the unstretched corner; stretching it with the center misaligns names.
		art.set_patch_margin(SIDE_LEFT,430)
		art.set_patch_margin(SIDE_RIGHT,50)
		art.set_patch_margin(SIDE_TOP,75)
		art.set_patch_margin(SIDE_BOTTOM,40)
		quote.add_child(art)
		view._image(art,"images/board/battle_hud_dialogue_ui/battle_dialogue_"+side+"_frame.webp")
		frames[side] = art
	speaker = view._label(quote,18)
	dialogue.mouse_filter = Control.MOUSE_FILTER_PASS
	dialogue.add_theme_color_override("default_color",Color("fff8df"))
	quote.add_child(dialogue)
	enma=preload("res://native_enma_intro.gd").new();enma.intro=self;add_child(enma)
	view.resized.connect(_layout)
	_layout()
	hide()

func _layout() -> void:
	size = view.size
	if size.x<=0 or size.y<=0:return
	if enma!=null:enma.size=size
	var compact := size.y <= 432
	quote.position = Vector2(10,size.y*0.72)
	quote.size = Vector2(size.x-20,size.y*0.258)
	var art_scale:=maxf(.4 if compact else .56,quote.size.y/320.0)
	for frame in frames.values():
		frame.scale=Vector2.ONE*art_scale
		frame.size=quote.size/art_scale
	speaker.add_theme_font_size_override("font_size",12 if compact else 18)
	speaker.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	speaker.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	speaker.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	speaker.position=Vector2(112,10)*art_scale
	speaker.size=Vector2(274,52)*art_scale
	dialogue.position=Vector2(24,28 if compact else 44)
	dialogue.size=quote.size-dialogue.position-Vector2(24,10)
	dialogue.add_theme_font_size_override("normal_font_size",19 if compact else 30)

func sync(model: Dictionary) -> void:
	var battle: Dictionary = model.get("battle",{})
	var intro: Dictionary = battle.prebattleIntro if battle.get("prebattleIntro") is Dictionary else {}
	var key := str(intro.get("key",intro.get("id","")))
	if intro.is_empty() or intro.get("done",false) or battle.get("result") or battle.get("needsReplacement",false):
		_cancel()
		return
	if key == identity: return
	_cancel()
	if played.has(key):
		# A repeated pre-completion snapshot cannot replay the dialogue. The
		# source dispatcher validates ownership and identity on every command.
		if battle.get("canControl",false): completed.emit(str(intro.get("id","")),key)
		return
	identity=key
	active_intro=intro.duplicate(true)
	var cinematic: Dictionary=intro.get("cinematic",{}) if intro.get("cinematic") is Dictionary else {}
	var source_frames: Array=cinematic.get("frames",[]) if cinematic.get("frames") is Array else []
	source_frames=source_frames.filter(func(frame):return frame is Dictionary and not str(frame.get("src","")).strip_edges().is_empty())
	if cinematic.get("kind","")=="enma_trial" and not source_frames.is_empty():
		cinematic_mode=true;enma.prepare(source_frames);_run_enma(epoch);return
	cinematic_mode=false
	_run(epoch)

func _cancel() -> void:
	if identity.is_empty(): return
	epoch += 1
	identity=""
	hide()
	enma.stop();cinematic_mode=false;modulate.a=1.0
	view.set_pose("player","")
	view.set_pose("enemy","")

func assets_ready() -> bool:return not cinematic_mode or enma.ready_assets()
func test_state_json() -> String:
	return JSON.stringify({"identity":identity,"visible":visible,"cinematic":cinematic_mode,"phaseHistory":phase_history,"speaker":speaker.text,"text":dialogue.text,"quoteInside":Rect2(Vector2.ZERO,size).encloses(Rect2(quote.position,quote.size)),"quoteSize":[quote.size.x,quote.size.y],"textSize":[dialogue.size.x,dialogue.size.y],"contentHeight":dialogue.get_content_height(),"scene":enma.test_state()})
func show_cinematic_line(frame: Dictionary) -> void:
	phase_history.append(str(frame.get("state","scene")))
	frames.player.show();frames.enemy.hide();quote.visible=not str(frame.get("text","")).strip_edges().is_empty()
	speaker.text=str(frame.get("speaker","新世界索隆"));dialogue.text=str(frame.get("text","")).strip_edges();dialogue.scroll_to_line(0)
func _wait_until(deadline: int,generation: int) -> bool:
	while Time.get_ticks_msec()<deadline:
		if generation!=epoch:return false
		await get_tree().process_frame
	return generation==epoch
func _run_enma(generation: int) -> void:
	show();quote.hide();enma.start()
	view.set_pose("player","");view.set_pose("enemy","")
	var deadline:=Time.get_ticks_msec()+int(maxf(1000,float(active_intro.get("showAfter",0))-Time.get_unix_time_from_system()*1000))
	var asset_deadline:=Time.get_ticks_msec()+15000
	while not enma.ready_assets():
		if generation!=epoch:return
		var failed: String=enma.failed_asset()
		if not failed.is_empty() or Time.get_ticks_msec()>asset_deadline:
			unsupported.emit("Original Enma artwork did not become ready: "+failed);_cancel();return
		await get_tree().process_frame
	for i in range(enma.frames.size()):
		if not await _wait_until(deadline,generation):return
		enma.show_frame(i)
		var duration: float=float(enma.frames[i].get("durationMs",1200))
		if duration==0:duration=1200
		deadline+=int(clampf(duration,650,5000))
	if not await _wait_until(deadline,generation):return
	enma.begin_close()
	if not await _wait_until(deadline+320,generation):return
	var id:=str(active_intro.get("id",""));var key:=identity;played[key]=true
	_cancel()
	if view.model.get("battle",{}).get("canControl",false):completed.emit(id,key)

func _run(generation: int) -> void:
	show()
	quote.hide()
	view.set_pose("player","attack")
	view.set_pose("enemy","attack")
	var delay := maxf(1000,float(active_intro.get("showAfter",0))-Time.get_unix_time_from_system()*1000)
	await get_tree().create_timer(delay/1000.0).timeout
	if generation != epoch: return
	var first := "enemy" if active_intro.get("firstSpeaker","") == "enemy" else "hero"
	_phase(first)
	await get_tree().create_timer(3.0).timeout
	if generation != epoch: return
	_phase("hero" if first == "enemy" else "enemy")
	await get_tree().create_timer(3.0).timeout
	if generation != epoch: return
	var fade := create_tween()
	fade.tween_property(quote,"modulate:a",0.0,0.32)
	await fade.finished
	if generation != epoch: return
	var id := str(active_intro.get("id",""))
	var key := identity
	played[key]=true
	_cancel()
	if view.model.get("battle",{}).get("canControl",false): completed.emit(id,key)

func _phase(who: String) -> void:
	phase_history.append(who)
	quote.modulate.a=1.0
	quote.show()
	frames.player.visible=who == "hero"
	frames.enemy.visible=who == "enemy"
	speaker.text=str(active_intro.get(who+"Name","夥伴" if who == "hero" else "敵人"))
	dialogue.text=str(active_intro.get(who+"Text","上吧。" if who == "hero" else "放馬過來。"))
	dialogue.scroll_to_line(0)
