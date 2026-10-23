extends Control
var attribute_override: Dictionary={}
var phase_dialogue_active:=false
const PortraitCard = preload("res://native_portrait_card.gd")
const PortraitState=preload("res://native_portrait_state.gd")
var portrait_sources: Dictionary={}
var portrait_warm: Dictionary={}
## Persistent native nodes consuming the original getBattleView contract.
## This base stage is not yet the complete story/boss/reward presentation.
signal command_requested(type: String, payload: Dictionary)
signal item_targets_requested(item_id: String)
var cache: Node
var model: Dictionary = {}
var background := TextureRect.new()
var portraits: Dictionary = {}
var hud: Dictionary = {}
var command_buttons: Array[Button] = []
var command_strip := Control.new()
var attack_strip := Control.new()
var matchup: Label
var catalog: Dictionary
var image_targets: Array[Control] = []
var text_writes := 0
var texture_writes := 0
var sheets := Control.new()
var sheet_list := GridContainer.new()
var sheet_title: Label
var sheet_frame := NinePatchRect.new()
var sheet_back_button: Button
var sheet_scroll := ScrollContainer.new()
var page := "commands"
var selected_item := ""
var target_menu: Dictionary = {}
var menu_signature := ""
var move_buttons: Array[Button] = []
var target_can_act := false
var pose_overrides: Dictionary = {}
var hp_overrides: Dictionary = {}
var actor_keys: Dictionary = {}
var battle_identity := ""
var replacement_signature := ""
var result_signature := ""
var finish_pending_until := 0
var pending_choice: Dictionary = {}
var choice_detail: RichTextLabel
var choice_confirm: Button
var choice_frame: NinePatchRect
var escape_buttons: Array[Button] = []
var escape_notice: RichTextLabel
var escape_frame: NinePatchRect
var boss_panel: Control
var boss_button := Button.new()
var boss_image := TextureRect.new()
var boss_badge := Label.new()
var shiki_islands: Control
var status_detail: Control
var move_detail_pages: Array[String]=[]
var move_detail_index:=0
var selected_move: Dictionary={}
const MoveDetail=preload("res://native_move_detail.gd")

func _ready() -> void:
	catalog = JSON.parse_string(FileAccess.get_file_as_string("res://battle-visual-catalog.json"))
	var native_theme := Theme.new()
	var weighted_font := preload("res://native_fonts.gd").weighted(550.0)
	native_theme.default_font = weighted_font
	native_theme.default_font_size = 22
	theme = native_theme
	cache.asset_ready.connect(_asset_ready)
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	status_detail=preload("res://native_status_detail.gd").new();add_child(status_detail)
	for side in ["player","enemy"]:
		var portrait := PortraitCard.new()
		portrait.enemy = side == "enemy"
		portrait.cache = cache
		portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(portrait)
		portraits[side] = portrait
		var panel := Control.new()
		add_child(panel)
		var frame := NinePatchRect.new()
		frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
		frame.scale = Vector2(0.25,0.25)
		for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: frame.set_patch_margin(margin,80)
		panel.add_child(frame)
		_image(frame,"images/board/battle_hud_dialogue_ui/battle_hud_"+side+"_frame.webp")
		var title := _label(panel,24)
		var badge := _label(panel,20)
		badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		var attribute:=preload("res://native_attribute_badge.gd").new();panel.add_child(attribute)
		var meta := _label(panel,18)
		var track := ProgressBar.new()
		track.show_percentage = false
		track.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var hp_fill := StyleBoxFlat.new()
		hp_fill.bg_color = Color("43d78b") if side == "player" else Color("ed6861")
		var hp_back := StyleBoxFlat.new()
		hp_back.bg_color = Color("08131e")
		track.add_theme_stylebox_override("fill",hp_fill)
		track.add_theme_stylebox_override("background",hp_back)
		panel.add_child(track)
		var effects := preload("res://native_status_row.gd").new()
		effects.battle_view=self
		effects.detail_requested.connect(func(value,anchor):status_detail.show_for(value,anchor,size))
		var effect_scroll := ScrollContainer.new()
		effect_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		effect_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
		panel.add_child(effect_scroll)
		effect_scroll.add_child(effects)
		hud[side] = {"panel":panel,"frame":frame,"title":title,"badge":badge,"attribute":attribute,"meta":meta,"hp":track,"effects":effects,"scroll":effect_scroll,"effectKey":""}
	matchup = preload("res://native_attribute_matchup.gd").new()
	add_child(matchup)
	matchup.detail_requested.connect(func():
		status_detail.show_for({"label":"屬性相剋表","result":matchup.tooltip_text,"description":"力克技 x2；技克速 x2；速克力 x2。被克制時 x0.5，同屬性 x1。"},matchup.get_rect(),size)
	)
	add_child(command_strip)
	for entry in [["attack","攻擊"],["partners","夥伴"],["items","道具"],["escape","逃跑"]]:
		var button := Button.new()
		button.flat = true
		button.text = entry[1]
		var command_padding := StyleBoxEmpty.new()
		command_padding.content_margin_left = 86
		command_padding.content_margin_right = 10
		for state in ["normal","hover","pressed","disabled","focus"]: button.add_theme_stylebox_override(state,command_padding)
		button.add_theme_font_size_override("font_size",26)
		button.add_theme_color_override("font_color",Color("ffe8bc"))
		command_strip.add_child(button)
		var art := NinePatchRect.new()
		art.scale = Vector2.ONE*(80.0/424.0)
		art.set_patch_margin(SIDE_LEFT,460)
		art.set_patch_margin(SIDE_RIGHT,120)
		art.set_patch_margin(SIDE_TOP,80)
		art.set_patch_margin(SIDE_BOTTOM,80)
		art.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(art)
		button.move_child(art,0)
		art.show_behind_parent = true
		button.resized.connect(func():
			var factor := button.size.y/424.0
			art.scale=Vector2.ONE*factor
			art.size=button.size/factor
			command_padding.content_margin_left=button.size.y*1.08
		)
		_image(art,"images/board/battle_command_ui/battle_command_action_button_frame.webp")
		var icon := TextureRect.new()
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		button.add_child(icon)
		_image(icon,"images/board/battle_command_ui/battle_command_icon_"+entry[0]+".webp")
		button.set_meta("icon",icon)
		button.pressed.connect(_select_mode.bind(entry[0]))
		command_buttons.append(button)
	add_child(attack_strip)
	attack_strip.hide()
	add_child(sheets)
	sheets.visible = false
	var sheet_back := ColorRect.new()
	sheet_back.color = Color("071b2a")
	sheets.add_child(sheet_back)
	sheet_back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	sheet_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sheet_frame.scale = Vector2.ONE*0.125
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: sheet_frame.set_patch_margin(margin,224)
	sheets.add_child(sheet_frame)
	_image(sheet_frame,"mobile/art-ui/mobile-panel-v013.png")
	sheet_title = _label(sheets,28)
	var back := Button.new()
	sheet_back_button = back
	back.text = "返回"
	back.position = Vector2(24,16)
	back.size = Vector2(100,48)
	sheets.add_child(back)
	_button_art(back)
	back.pressed.connect(_back)
	sheets.add_child(sheet_scroll)
	sheet_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sheet_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sheet_list.add_theme_constant_override("h_separation",8)
	sheet_list.add_theme_constant_override("v_separation",8)
	sheet_scroll.add_child(sheet_list)
	boss_panel = preload("res://native_boss_mechanics.gd").new()
	boss_panel.battle_view = self
	boss_panel.size = size
	add_child(boss_panel)
	hud.enemy.panel.add_child(boss_button)
	boss_button.flat = true
	boss_button.hide()
	boss_button.name = "OriginalBossMechanic"
	boss_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	boss_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	boss_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	boss_button.add_child(boss_image)
	boss_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	boss_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	boss_badge.add_theme_font_size_override("font_size",10)
	boss_badge.add_theme_color_override("font_color",Color("ffdf97"))
	boss_badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	boss_button.add_child(boss_badge)
	boss_badge.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	boss_button.pressed.connect(boss_panel.open)
	shiki_islands=preload("res://native_shiki_archipelago.gd").new();shiki_islands.view=self;add_child(shiki_islands)
	resized.connect(_layout)
	_layout()

func _label(parent: Node, font_size: int) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size",font_size)
	label.add_theme_color_override("font_color",Color("ffe8bc"))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label

func _compact_layout() -> bool:
	# canvas_items/expand can make a 960-wide phone taller than the base
	# 432 viewport. Keep those phones on the same landscape controls.
	return size.x <= 1000 or size.y <= 432

func _display_number(value: Variant) -> String:
	if value is int: return str(value)
	if value is float:
		if is_finite(value) and value == floor(value): return str(int(value))
		return String.num(value)
	return str(value)

func _layout() -> void:
	if hud.is_empty(): return
	var mechanic: Variant=model.get("battle",{}).get("postgameBossMechanic")
	var result_layer:=240 if page=="result" and mechanic is Dictionary and mechanic.get("key","")=="postgame_tot_musica" else 0
	sheets.z_index=result_layer
	attack_strip.z_index=result_layer
	background.size = size
	var panel_width := (size.x-108)*0.5
	var compact := _compact_layout()
	var panel_height := 48.0 if compact else 86.0
	var command_height := 56.0 if compact else 80.0
	for side in hud:
		var h: Dictionary = hud[side]
		h.panel.position = Vector2(8 if side == "player" else size.x-panel_width-8,4 if compact else 10)
		h.panel.size = Vector2(panel_width,panel_height)
		h.frame.size = Vector2(panel_width,panel_height)*4
		h.title.position = Vector2(12 if compact else 18,3 if compact else 8)
		h.title.size = Vector2(panel_width-(126 if compact else 158),22 if compact else 31)
		h.title.add_theme_font_size_override("font_size",12 if compact else 24)
		h.title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		h.badge.position = Vector2(panel_width-(100 if compact else 132),3 if compact else 8)
		h.badge.size = Vector2(47 if compact else 78,22 if compact else 31)
		h.badge.add_theme_font_size_override("font_size",12 if compact else 20)
		h.attribute.position=Vector2(panel_width-(45 if compact else 48),4 if compact else 9)
		h.attribute.size=Vector2(27,20) if compact else Vector2(30,29)
		h.attribute.add_theme_font_size_override("font_size",12 if compact else 20)
		var status_width := minf(panel_width*0.36,220) if h.effects.get_child_count() > 0 else 0.0
		var boss_width := (24.0 if compact else 34.0) if side == "enemy" and boss_button.visible else 0.0
		h.scroll.position = Vector2(panel_width-status_width-18-boss_width,22 if compact else 40)
		h.scroll.size = Vector2(status_width,20 if compact else 28)
		for icon in h.effects.get_children(): icon.custom_minimum_size=Vector2.ONE*(18 if compact else 28)
		h.meta.position = Vector2(12 if compact else 18,22 if compact else 41)
		h.meta.size = Vector2(panel_width-36-status_width-boss_width,20 if compact else 25)
		h.meta.add_theme_font_size_override("font_size",11 if compact else 18)
		h.meta.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		h.hp.position = Vector2(12 if compact else 18,42 if compact else 70)
		h.hp.size = Vector2(panel_width-(24 if compact else 36),3 if compact else 6)
		var portrait_size := minf(size.x*0.28,size.y*(0.56 if compact else 0.62))
		var portrait_top := panel_height+(20.0 if compact else 28.0)
		var portrait_bottom := size.y-command_height-24
		portraits[side].set_layout_rect(Vector2(size.x*0.07 if side == "player" else size.x*0.93-portrait_size,(portrait_top+portrait_bottom-portrait_size)*0.5),Vector2.ONE*portrait_size)
	matchup.position = Vector2((size.x-74)*0.5,2 if compact else 27)
	boss_button.position = Vector2(panel_width-(36 if compact else 48),22 if compact else 40)
	boss_button.size = Vector2.ONE*(20 if compact else 30)
	if is_instance_valid(boss_panel): boss_panel.size=size
	matchup.size = Vector2(74,52)
	matchup.add_theme_font_size_override("font_size",11)
	command_strip.position = Vector2(12 if compact else 20,size.y-command_height-8)
	command_strip.size = Vector2(size.x-(24 if compact else 40),command_height)
	attack_strip.position = command_strip.position
	attack_strip.size = command_strip.size
	if page=="attack":
		attack_strip.size.y=clampf(size.y*.21,68,96)
		attack_strip.position.y=size.y-attack_strip.size.y-8
	_layout_moves()
	_layout_escape()
	var width := (command_strip.size.x-24)/4
	for i in range(command_buttons.size()):
		var button := command_buttons[i]
		button.position = Vector2(i*(width+8),0)
		button.size = Vector2(width,command_height)
		button.add_theme_font_size_override("font_size",18 if compact else 26)
		var icon: TextureRect = button.get_meta("icon")
		icon.size = Vector2.ONE*command_height*0.65
		icon.position = Vector2(command_height*0.55-icon.size.x/2,(command_height-icon.size.y)/2)
	sheets.size = size
	sheet_frame.size = size/0.125
	sheet_title.position = Vector2(24,14)
	sheet_title.size = Vector2(size.x-160,42)
	sheet_title.add_theme_font_size_override("font_size",18 if compact else 28)
	sheet_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	sheet_back_button.position = Vector2(size.x-116,12)
	sheet_back_button.size = Vector2(92,40)
	sheet_scroll.position = Vector2(24,64)
	sheet_scroll.size = Vector2(size.x-48,size.y-160)
	if page == "items": sheet_scroll.size.x=size.x*0.62-32
	_layout_confirmation()

func _layout_moves() -> void:
	for i in range(move_buttons.size()):
		var width := (attack_strip.size.x*0.38-10)/2
		var height := (attack_strip.size.y-4)/2
		move_buttons[i].position = Vector2((i%2)*(width+10),int(i/2)*(height+4))
		move_buttons[i].size = Vector2(width,height)
	if is_instance_valid(choice_confirm): _layout_confirmation()

func _back() -> void:
	if page == "item-targets":
		selected_item = ""
		_select_mode("items")
	else:
		page = "commands"
		sheets.hide()
		attack_strip.hide()
		command_strip.show()

func _can_act() -> bool:
	if phase_dialogue_active:return false
	var battle: Dictionary = model.get("battle",{})
	var intro: Dictionary = battle.get("prebattleIntro",{}) if battle.get("prebattleIntro") != null else {}
	return battle.get("canControl",false) and battle.get("canAct",false) and (intro.is_empty() or intro.get("done",false) or battle.get("result")) and not battle.get("needsReplacement",false) and not battle.get("canFinish",false) and battle.get("result","") != "round-pause"

func apply_view(view: Dictionary) -> void:
	model = view
	if view.is_empty():
		portraits.enemy.sync_demon({},"normal")
		boss_panel.sync(null)
		boss_button.hide()
		shiki_islands.clear()
		return
	boss_panel.sync(view.get("_nativeMechanic"))
	var mechanic: Dictionary = boss_panel.model
	var boss_was_visible := boss_button.visible
	boss_button.visible = not mechanic.is_empty()
	if not mechanic.is_empty():
		_image(boss_image,str(mechanic.icon))
		_text(boss_badge,str(mechanic.badge))
		boss_button.tooltip_text=str(mechanic.title)
	if boss_was_visible != boss_button.visible: _layout()
	var enemy: Dictionary = view.enemy
	var key := str(enemy.get("key",enemy.get("id",""))).strip_edges().to_lower()
	var name := str(enemy.get("name","")).strip_edges().to_lower()
	_image(background,str(catalog.BATTLE_BACKGROUND_BY_ENEMY_KEY.get(key,catalog.BATTLE_BACKGROUND_BY_ENEMY_NAME.get(name,catalog.DEFAULT_BATTLE_BACKGROUND))))
	for side in hud:
		var actor: Dictionary = view.activeCard if side == "player" else enemy
		var actor_key := battle_identity+"|"+str(actor.get("id",actor.get("key",actor.name)))+":"+str(view.battle.get("activeCrewIndex",0) if side == "player" else view.battle.get("islandId",""))
		if actor_keys.get(side,"") != actor_key:
			portraits[side].stop_attack_motion()
			portraits[side].stop_hit_motion()
			actor_keys[side]=actor_key
			portraits[side].modulate.a=1.0
			pose_overrides.erase(side)
		var h: Dictionary = hud[side]
		_text(h.title,str(actor.name))
		_text(h.badge,"Lv."+str(int(actor.get("level",1))))
		var displayed_attribute: Dictionary=attribute_override if not attribute_override.is_empty() else view.get("_nativeAttribute",{})
		h.attribute.set_attribute(str(displayed_attribute.get("attribute",actor.get("attribute",""))) if side=="player" else str(actor.get("attribute","")))
		var carry: Dictionary = actor.get("carryItem",{})
		var display_hp: float = hp_overrides.get(side,actor.currentHp)
		_text(h.meta,"HP %d / %d" %[display_hp,actor.maxHp]+("     "+str(carry.get("name","")) if not str(carry.get("id","")).is_empty() else ""))
		h.meta.tooltip_text = str(carry.get("name",""))+" "+str(carry.get("summary",""))
		if h.hp.max_value != actor.maxHp: h.hp.max_value = actor.maxHp
		if h.hp.value != display_hp: h.hp.value = display_hp
		_warm_portraits(side,actor)
		_refresh_portrait(side,actor)
		var prior_builds: int=h.effects.builds
		h.effects.apply_source(actor.get("_nativeStatusIcons",[]))
		if prior_builds != h.effects.builds: _layout()
	var attribute_packet: Dictionary=attribute_override if not attribute_override.is_empty() else view.get("_nativeAttribute",{})
	_text(matchup,_matchup_label(attribute_packet,view))
	matchup.tooltip_text=str(attribute_packet.get("description",""))
	for button in command_buttons: button.disabled = not _can_act()
	if page == "replacement":
		if view.battle.get("needsReplacement",false) and not view.battle.get("luffyGearFifthAwakeningPending",false) and not view.battle.get("keepPlayerPortraitOnKnockout",false): show_replacement()
		else: _back_to_commands()
	elif page == "result":
		if view.battle.get("result") or view.battle.get("canFinish",false): show_result()
		else: _back_to_commands()
	# An unchanged network snapshot must not rebuild the open list or reset its
	# scroll position. Eligibility and counts still refresh when the data changes.
	var signature := JSON.stringify([view.player,view.battle.get("canAct"),view.battle.get("canControl"),view.battle.get("prebattleIntro"),view.battle.get("needsReplacement"),view.battle.get("canFinish"),view.battle.get("result")])
	if signature != menu_signature:
		menu_signature = signature
		if page in ["partners","items","attack","escape"]:
			var scroll := sheet_scroll.scroll_vertical
			_select_mode(page)
			sheet_scroll.set_deferred("scroll_vertical",scroll)
		elif page == "item-targets": item_targets_requested.emit(selected_item)
	shiki_islands.sync(view)
	if phase_dialogue_active:_hide_phase_controls()

func _hide_phase_controls() -> void:
	command_strip.hide();attack_strip.hide();sheets.hide()

func set_phase_dialogue_active(value: bool) -> void:
	if phase_dialogue_active==value:return
	phase_dialogue_active=value
	_back_to_commands()
	if value:_hide_phase_controls()
	for button in command_buttons:button.disabled=not _can_act()

func set_attribute_override(value: Dictionary) -> void:
	attribute_override=value.duplicate()
	hud.player.attribute.set_attribute(str(value.attribute))
	_text(matchup,str(value.matchup));matchup.tooltip_text=str(value.description)

func _matchup_label(packet: Dictionary,value: Dictionary) -> String:
	if packet.has("matchup"):return str(packet.matchup)
	var source: Dictionary=value.get("attributeMatchup",{})
	if source.has("playerAttackMultiplier"):return "x"+str(source.playerAttackMultiplier).trim_suffix(".0")
	return "相剋"

func clear_attribute_override() -> void:
	attribute_override.clear();hud.player.attribute.clear_pulse()
	if not model.has("activeCard"):return
	var value: Dictionary=model.get("_nativeAttribute",{})
	hud.player.attribute.set_attribute(str(value.get("attribute",model.activeCard.get("attribute",""))))
	_text(matchup,_matchup_label(value,model));matchup.tooltip_text=str(value.get("description",""))

func set_pose(side: String, pose: String) -> void:
	if pose!="attack":portraits[side].stop_attack_motion()
	if pose not in ["hit","hitPlayerSide","hitEnemySide"]:portraits[side].stop_hit_motion()
	if pose.is_empty(): pose_overrides.erase(side)
	else: pose_overrides[side] = pose
	if not model.is_empty():_refresh_portrait(side,model.activeCard if side=="player" else model.enemy)

func _warm_portraits(side: String,actor: Dictionary) -> void:
	var source: Dictionary=actor.get("battlePortraits",{});var key:=JSON.stringify(source)
	if portrait_sources.get(side,"")==key:return
	portrait_sources[side]=key;portrait_warm[side]={}
	var paths: Array=[]
	for pose in ["normal","stealth","attack","hit","morale","weak","dizzy"]:
		paths.append(PortraitState.path(side,source,pose))
	for path in paths:
		if str(path).is_empty() or portrait_warm[side].has(path):continue
		portrait_warm[side][path]=cache.request(str(path))

func _refresh_portrait(side: String,actor: Dictionary) -> void:
	var hp: float=hp_overrides.get(side,actor.currentHp)
	var pose:=PortraitState.state(str(pose_overrides.get(side,"normal")),hp,float(actor.maxHp))
	portraits[side].set_idle_pose(pose=="normal" and hp>0)
	_image(portraits[side],PortraitState.path(side,actor.get("battlePortraits",{}),pose))
	if side=="enemy":portraits[side].sync_demon(actor.get("_nativeDemon",{}),pose)

func _refresh_display_hp(side: String) -> void:
	if model.is_empty():return
	var actor: Dictionary=model.activeCard if side=="player" else model.enemy
	var hp: float=hp_overrides.get(side,actor.currentHp);var carry: Dictionary=actor.get("carryItem",{})
	hud[side].hp.value=hp
	_text(hud[side].meta,"HP %d / %d" %[hp,actor.maxHp]+("     "+str(carry.get("name","")) if not str(carry.get("id","" )).is_empty() else ""))
	_refresh_portrait(side,actor)

func set_display_hp(side: String, value: float) -> void:
	hp_overrides[side] = value
	_refresh_display_hp(side)

func release_display_hp(side: String) -> void:
	hp_overrides.erase(side)
	_refresh_display_hp(side)

func _text(label: Label, value: String) -> void:
	if label.text == value: return
	label.text = value
	text_writes += 1

func _image(target: Control, path: String) -> void:
	if path.is_empty() or target.get_meta("wanted_asset","") == path: return
	target.set_meta("wanted_asset",path)
	if not image_targets.has(target): image_targets.append(target)
	var texture: Texture2D = cache.request(path)
	if texture != null:
		if target.has_method("set_asset_texture"):target.set_asset_texture(texture)
		else:target.set("texture",texture)
		target.set_meta("loaded_asset",path)
		texture_writes += 1

func _asset_ready(path: String, texture: Texture2D) -> void:
	for warmed in portrait_warm.values():
		if warmed.has(path):warmed[path]=texture
	image_targets = image_targets.filter(func(target):return is_instance_valid(target))
	for target in image_targets:
		if is_instance_valid(target) and target.get_meta("wanted_asset","") == path:
			if target.has_method("set_asset_texture"):target.set_asset_texture(texture)
			else:target.set("texture",texture)
			target.set_meta("loaded_asset",path)
			texture_writes += 1

func _select_mode(mode: String) -> void:
	# Full-screen party/item pages emit the original command contract. Additional
	# target, boss, story and reward pages remain required before player release.
	if mode == "escape": _open_escape();return
	page = mode
	pending_choice = {}
	if mode == "attack":
		move_buttons.clear()
		command_strip.hide()
		attack_strip.show()
		for child in attack_strip.get_children(): attack_strip.remove_child(child);child.queue_free()
		var back := Button.new()
		back.text = "返回"
		back.name = "AttackBack"
		back.size = Vector2(60,80)
		back.add_theme_font_size_override("font_size",14 if _compact_layout() else 18)
		back.position = Vector2(attack_strip.size.x-60,0)
		attack_strip.add_child(back)
		_button_art(back,true)
		back.get_theme_stylebox("normal").content_margin_left = 6
		back.get_theme_stylebox("normal").content_margin_right = 6
		back.pressed.connect(func():attack_strip.hide();command_strip.show();page="commands")
		var moves: Array = model.activeCard.moves
		for i in range(moves.size()):
			var move: Dictionary = moves[i]
			var button := Button.new()
			button.add_theme_font_size_override("font_size",14 if _compact_layout() else 18)
			var width := (attack_strip.size.x*0.38-10)/2
			button.position = Vector2((i%2)*(width+10),int(i/2)*42)
			button.size = Vector2(width,38)
			var move_name := _label(button,14 if _compact_layout() else 18)
			move_name.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
			move_name.text = str(move.get("displayName",move.name))
			move_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			var pp := _label(button,15)
			pp.hide()
			pp.text = "PP %d/%d" %[move.currentPP,move.pp]
			pp.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			var layout_text := func():
				move_name.position=Vector2(10,2)
				move_name.size=Vector2(maxf(0,button.size.x-20),button.size.y-4)
				pp.position=Vector2(button.size.x-98,5)
				pp.size=Vector2(82,28)
			button.resized.connect(layout_text)
			layout_text.call()
			button.tooltip_text = str(move.get("effectText",""))
			button.disabled = move.currentPP <= 0 or not _can_act()
			attack_strip.add_child(button)
			_button_art(button,true)
			button.get_theme_stylebox("normal").content_margin_top = 1
			button.get_theme_stylebox("normal").content_margin_bottom = 1
			move_buttons.append(button)
			button.pressed.connect(func():_choose("move",{"moveId":move.id},str(move.get("displayName",move.name)),"PP %d/%d  %s  威力 %s  命中 %s%%\n%s" %[move.currentPP,move.pp,move.get("attribute",""),_display_number(move.get("power","—")),_display_number(move.get("accuracy","—")),move.get("effectText","")]))
		_confirmation(attack_strip,"使用")
		_layout()
		return
	sheets.show()
	sheet_list.columns = 3 if mode == "partners" else 1
	_text(sheet_title,{"attack":"選擇招式","partners":"選擇夥伴","items":"戰鬥道具"}.get(mode,""))
	for child in sheet_list.get_children(): sheet_list.remove_child(child);child.queue_free()
	_confirmation(sheets,"換人" if mode == "partners" else "使用")
	var entries: Array = model.activeCard.moves if mode == "attack" else (model.player.crew if mode == "partners" else model.player.battleItems)
	for entry in entries:
		var button := Button.new()
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size",14 if _compact_layout() else 20)
		button.custom_minimum_size = Vector2(0,82)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.text = str(entry.get("displayName",entry.get("name","")))
		if mode == "attack":
			button.text += "  PP %d / %d\n%s" %[entry.currentPP,entry.pp,entry.get("effectText","")]
			button.disabled = entry.currentPP <= 0
			button.pressed.connect(func():command_requested.emit("move",{"moveId":entry.id});sheets.hide())
		elif mode == "partners":
			button.set_meta("crew_index",entry.index)
			button.custom_minimum_size.y = 112
			button.text += "  Lv.%d  %s\nHP %d / %d   PP %d" %[entry.level,entry.attribute,entry.currentHp,entry.maxHp,entry.totalPP]
			button.text += "\n攜帶："+str(entry.get("carryItem",{}).get("name","無"))
			button.disabled = entry.get("isActive",false) or entry.currentHp <= 0 or not _can_act()
			button.pressed.connect(func():_choose("switch",{"nextIndex":entry.index},str(entry.name),button.text))
		else:
			button.set_meta("item_id",entry.id)
			button.text += "  ×%d" %int(entry.get("count",0))
			button.text += "\n"+str(entry.get("desc",""))
			button.disabled = entry.get("count",0) <= 0 or not _can_act()
			button.pressed.connect(func():_choose("select-item",{"itemId":entry.id},str(entry.name),str(entry.get("desc",""))))
		sheet_list.add_child(button)
		_button_art(button)
		if mode == "partners":
			var portrait := TextureRect.new()
			portrait.position = Vector2(10,18)
			portrait.size = Vector2(44,72)
			portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
			button.add_child(portrait)
			_image(portrait,str(entry.get("battlePortraits",{}).get("normal","")))
			button.get_theme_stylebox("normal").content_margin_left = 62
	_layout()

func _submit(type: String, payload: Dictionary) -> void:
	if not _can_act(): return
	if type == "move": payload=boss_panel.move_payload(str(payload.moveId))
	_back_to_commands()
	command_requested.emit(type,payload)

func _open_escape(confirm_surrender: bool = false) -> void:
	page = "escape"
	move_buttons.clear()
	escape_buttons.clear()
	command_strip.hide()
	sheets.hide()
	attack_strip.show()
	for child in attack_strip.get_children(): attack_strip.remove_child(child);child.queue_free()
	var battle: Dictionary = model.get("battle",{})
	var threshold := int(battle.get("escapeThreshold",0))
	var raid: bool = battle.get("raidInfo") != null and not battle.get("raidInfo",{}).is_empty()
	var message := "司法島討伐戰無法逃跑；必要時可以投降，讓隊伍全員瀕死並退出整備。" if raid else ("隊伍裡沒有移動型夥伴，不能嘗試逃跑；仍可選擇投降。" if threshold <= 0 else "逃跑需要擲出 %d+。若成功就脫離戰鬥，失敗會消耗本回合行動。" %threshold)
	escape_frame=NinePatchRect.new()
	escape_frame.scale=Vector2.ONE*0.18
	escape_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: escape_frame.set_patch_margin(side,80)
	attack_strip.add_child(escape_frame)
	_image(escape_frame,"images/board/battle_command_ui/battle_command_notice_frame.webp")
	escape_notice=RichTextLabel.new()
	escape_notice.text="確定要投降嗎？隊伍會全員瀕死。" if confirm_surrender else message
	escape_notice.add_theme_font_size_override("normal_font_size",13 if _compact_layout() else 20)
	escape_notice.add_theme_color_override("default_color",Color("ffe8bc"))
	attack_strip.add_child(escape_notice)
	var choices: Array = [["確定投降","surrender"],["取消","cancel"]] if confirm_surrender else [["嘗試逃跑","escape"],["投降","ask-surrender"],["返回","back"]]
	for entry in choices:
		var button:=Button.new()
		button.text=entry[0]
		button.disabled=not _can_act() if entry[1] != "back" else false
		if entry[1] == "escape": button.disabled=button.disabled or threshold <= 0 or raid
		button.set_meta("action",entry[1])
		button.add_theme_font_size_override("font_size",14 if _compact_layout() else 20)
		attack_strip.add_child(button)
		_button_art(button)
		button.get_theme_stylebox("normal").content_margin_left=6
		button.get_theme_stylebox("normal").content_margin_right=6
		button.pressed.connect(func():
			match entry[1]:
				"back": _back_to_commands()
				"cancel": _open_escape()
				"ask-surrender": _open_escape(true)
				_: _submit(entry[1],{})
		)
		escape_buttons.append(button)
	_layout_escape()

func _layout_escape() -> void:
	if page != "escape" or not is_instance_valid(escape_notice): return
	var width:=attack_strip.size.x
	var height:=attack_strip.size.y
	escape_frame.size=Vector2(width*0.58-8,height)/0.18
	escape_notice.position=Vector2(12,6)
	escape_notice.size=Vector2(width*0.58-32,height-12)
	var button_width: float=(width*0.42-8*(escape_buttons.size()-1))/maxi(1,escape_buttons.size())
	for i in range(escape_buttons.size()):
		escape_buttons[i].position=Vector2(width*0.58+i*(button_width+8),0)
		escape_buttons[i].size=Vector2(button_width,height)

func _back_to_commands() -> void:
	page = "commands"
	sheets.hide()
	attack_strip.hide()
	command_strip.show()
	sheet_back_button.show()

func show_replacement() -> void:
	var battle: Dictionary = model.get("battle",{})
	if not battle.get("needsReplacement",false) or battle.get("luffyGearFifthAwakeningPending",false) or battle.get("keepPlayerPortraitOnKnockout",false): return
	var signature:=JSON.stringify([battle.get("replacementCandidates",[]),battle.get("canControl",false),battle.get("replacementReason",""),battle.get("viewerLockedReason","")])
	if page == "replacement" and replacement_signature == signature: return
	replacement_signature=signature
	page="replacement"
	sheets.show()
	sheet_back_button.hide()
	sheet_list.columns=3
	for child in sheet_list.get_children(): sheet_list.remove_child(child);child.queue_free()
	_confirmation(sheets,"換人")
	choice_confirm.hide()
	choice_detail.text="目前角色已完成行動，選擇下一名船員上場準備下一回合。" if battle.get("replacementReason","") == "relay-pirate-flag" else "選擇下一位上場夥伴。"
	_text(sheet_title,"交棒海賊旗啟動" if battle.get("replacementReason","") == "relay-pirate-flag" else "選擇替補夥伴")
	if not battle.get("canControl",false):
		choice_detail.text=str(battle.get("viewerLockedReason","等待目前行動玩家選擇替補。"))
	else:
		for entry in battle.get("replacementCandidates",[]):
			if entry.get("currentHp",0) <= 0: continue
			var button:=Button.new()
			button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
			button.custom_minimum_size=Vector2(0,104)
			button.text="%s\nLv.%d ・ %s\nHP %d/%d ・ 剩餘 PP %d" %[entry.name,entry.get("level",1),entry.get("attribute",""),entry.currentHp,entry.maxHp,entry.totalPP]
			button.add_theme_font_size_override("font_size",14 if _compact_layout() else 20)
			button.set_meta("replacement_index",entry.index)
			sheet_list.add_child(button)
			_button_art(button)
			button.pressed.connect(func():
				if not model.battle.get("canControl",false) or not model.battle.get("needsReplacement",false): return
				# Original compulsory replacement commits immediately. Ordinary
				# party switching keeps its separate confirmation workflow.
				command_requested.emit("replacement",{"nextIndex":entry.index})
			)
		if sheet_list.get_child_count() == 0: choice_detail.text="沒有可替補的夥伴，請返回地圖結算。"
	_layout()

func show_result() -> void:
	var data: Dictionary=model.get("_nativeResult",{})
	if data.is_empty(): return
	var signature:=JSON.stringify([data,model.battle.get("canFinish",false)])
	if page == "result" and result_signature == signature: return
	result_signature=signature
	page="result"
	var compact_result: bool=data.rewardEntries.is_empty()
	if compact_result:
		sheets.hide()
		command_strip.hide()
		attack_strip.show()
		move_buttons.clear()
		for child in attack_strip.get_children(): attack_strip.remove_child(child);child.queue_free()
	else: sheets.show()
	sheet_back_button.hide()
	_text(sheet_title,str(data.resultText))
	for child in sheet_list.get_children(): sheet_list.remove_child(child);child.queue_free()
	sheet_list.columns=mini(maxi(1,data.rewardEntries.size()),2 if _compact_layout() else 4)
	_confirmation(attack_strip if compact_result else sheets,str(data.finishLabel))
	choice_detail.text=str(data.resultText) if compact_result else ("" if model.battle.get("canFinish",false) else str(model.battle.get("viewerLockedReason","等待戰鬥結算。")))
	choice_confirm.disabled=not model.battle.get("canFinish",false) or Time.get_ticks_msec() < finish_pending_until
	for connection in choice_confirm.pressed.get_connections(): choice_confirm.pressed.disconnect(connection.callable)
	choice_confirm.pressed.connect(func():
		if not model.battle.get("canFinish",false) or Time.get_ticks_msec() < finish_pending_until: return
		finish_pending_until=Time.get_ticks_msec()+2000
		choice_confirm.disabled=true
		command_requested.emit("finish",{})
		_retry_finish_after_cooldown(choice_confirm,finish_pending_until)
	)
	for entry in data.rewardEntries:
		var card:=Control.new()
		card.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		card.custom_minimum_size=Vector2(0,100 if _compact_layout() else 150)
		sheet_list.add_child(card)
		var art:=NinePatchRect.new()
		art.mouse_filter=Control.MOUSE_FILTER_IGNORE
		art.scale=Vector2.ONE*0.18
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: art.set_patch_margin(side,80)
		card.add_child(art)
		art.show_behind_parent=true
		card.resized.connect(func():art.size=card.size/0.18)
		_image(art,"images/board/battle_result_ui/battle_result_player_card_frame.webp" if entry.get("isPerformance",false) else "images/board/battle_command_ui/battle_command_choice_button_frame.webp")
		var text:=Label.new()
		text.text=str(entry.name)+"\n"+"\n".join(entry.lines)
		text.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		text.add_theme_font_size_override("font_size",14 if _compact_layout() else 21)
		text.add_theme_color_override("font_color",Color("ffe8bc"))
		card.add_child(text)
		text.position=Vector2(16,12)
		card.resized.connect(func():text.size=card.size-Vector2(32,24))
		text.minimum_size_changed.connect(func():card.custom_minimum_size.y=maxf(100,text.get_minimum_size().y+24))
	_layout()

func _retry_finish_after_cooldown(button: Button, deadline: int) -> void:
	await get_tree().create_timer(2.0).timeout
	# A rejected/temporarily locked source command must remain retryable. Never
	# enable a stale button from an earlier result or a new scene generation.
	if not is_instance_valid(button) or button.is_queued_for_deletion(): return
	if page != "result" or button != choice_confirm or deadline != finish_pending_until: return
	button.disabled = not model.get("battle",{}).get("canFinish",false)

func show_item_targets(menu: Dictionary) -> void:
	if menu.has("immediate"):
		_submit("item",menu.immediate)
		return
	var changed := JSON.stringify(menu) != JSON.stringify(target_menu) or target_can_act != _can_act()
	if page == "item-targets" and not changed: return
	target_menu = menu
	target_can_act = _can_act()
	page = "item-targets"
	sheet_list.columns = 3
	sheets.show()
	_text(sheet_title,str(menu.get("title","道具目標")))
	for child in sheet_list.get_children(): sheet_list.remove_child(child);child.queue_free()
	_confirmation(sheets,"使用")
	for entry in menu.get("entries",[]):
		var button := Button.new()
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.add_theme_font_size_override("font_size",14 if _compact_layout() else 20)
		button.custom_minimum_size = Vector2(0,100)
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.text = str(entry.name)+"\n"+str(entry.get("detail",""))
		if not entry.get("enabled",false): button.text += "  "+str(entry.get("hint",""))
		button.disabled = not entry.get("enabled",false) or not _can_act()
		button.set_meta("target_payload",entry.payload)
		sheet_list.add_child(button)
		_button_art(button)
		button.pressed.connect(func():_choose("item",entry.payload,str(entry.name),str(entry.get("detail",""))))
	_layout()

func _choose(type: String, payload: Dictionary, heading: String, detail: String) -> void:
	if not _can_act(): return
	pending_choice = {"type":type,"payload":payload}
	choice_detail.text = heading+"\n"+detail
	choice_confirm.disabled = false
	if type=="move":
		for move in model.activeCard.moves:
			if str(move.id)==str(payload.moveId):
				selected_move=move;move_detail_index=0;_show_move_detail();break

func _show_move_detail() -> void:
	move_detail_pages=MoveDetail.pages(selected_move,choice_detail)
	move_detail_index=clampi(move_detail_index,0,move_detail_pages.size()-1)
	choice_detail.text=move_detail_pages[move_detail_index]
	choice_detail.tooltip_text="點說明切換下一頁" if move_detail_pages.size()>1 else ""

func _confirmation(parent: Control, action: String) -> void:
	for old in [choice_detail,choice_confirm,choice_frame]:
		if is_instance_valid(old):
			if old.get_parent() != null: old.get_parent().remove_child(old)
			if not old.is_queued_for_deletion(): old.queue_free()
	choice_frame = NinePatchRect.new()
	choice_frame.scale = Vector2.ONE*0.18
	choice_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: choice_frame.set_patch_margin(side,80)
	parent.add_child(choice_frame)
	_image(choice_frame,"images/board/battle_command_ui/battle_command_notice_frame.webp")
	choice_detail = RichTextLabel.new()
	choice_detail.clip_contents=true
	choice_detail.scroll_active=parent!=attack_strip
	choice_detail.gui_input.connect(func(event):
		if page=="attack" and event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and event.pressed and move_detail_pages.size()>1:
			move_detail_index=(move_detail_index+1)%move_detail_pages.size();choice_detail.text=move_detail_pages[move_detail_index];choice_detail.accept_event()
	)
	choice_detail.add_theme_font_size_override("normal_font_size",12 if _compact_layout() else 16)
	choice_detail.add_theme_color_override("default_color",Color("ffe8bc"))
	choice_detail.text = "選擇項目\n"+("選擇夥伴後按換人" if action == "換人" else "點選後查看說明，再按使用")
	parent.add_child(choice_detail)
	choice_confirm = Button.new()
	choice_confirm.text = action
	choice_confirm.disabled = true
	parent.add_child(choice_confirm)
	_button_art(choice_confirm,true)
	choice_confirm.pressed.connect(_confirm_choice)
	_layout_confirmation()

func _layout_confirmation() -> void:
	if not is_instance_valid(choice_confirm) or choice_confirm.is_queued_for_deletion(): return
	var compact := _compact_layout()
	var detail_rect: Rect2
	if choice_confirm.get_parent() == attack_strip:
		var back: Button = attack_strip.get_node_or_null("AttackBack")
		if back:
			back.position=Vector2(attack_strip.size.x-64,attack_strip.size.y*.5+2)
			back.size=Vector2(64,attack_strip.size.y*.5-2)
		var x := attack_strip.size.x*.38+8
		detail_rect = Rect2(x,0,maxf(40,attack_strip.size.x-x-72),attack_strip.size.y)
		choice_confirm.position = Vector2(attack_strip.size.x-64,0)
		choice_confirm.size = Vector2(64,attack_strip.size.y*.5-2)
		choice_confirm.get_theme_stylebox("normal").content_margin_left = 6
		choice_confirm.get_theme_stylebox("normal").content_margin_right = 6
	else:
		detail_rect = Rect2(20,size.y-88,size.x-150,68)
		choice_confirm.position = Vector2(size.x-122,size.y-88)
		choice_confirm.size = Vector2(102,68)
		if page == "items":
			var side_x := size.x*0.62
			detail_rect = Rect2(side_x,64,size.x-side_x-20,size.y-160)
			choice_confirm.position.x = side_x
			choice_confirm.size.x = size.x-side_x-20
	choice_frame.position = detail_rect.position
	choice_frame.size = detail_rect.size/0.18
	choice_detail.position = detail_rect.position+Vector2(18,10)
	choice_detail.size = detail_rect.size-Vector2(36,20)
	if page=="attack":
		choice_detail.position=detail_rect.position+Vector2(14,7)
		choice_detail.size=detail_rect.size-Vector2(28,14)
		if not selected_move.is_empty():_show_move_detail()
	choice_confirm.add_theme_font_size_override("font_size",14 if compact else 20)
	if page == "result":
		if choice_confirm.get_parent() == attack_strip:
			choice_frame.show()
			choice_frame.position=Vector2.ZERO
			choice_frame.size=Vector2(attack_strip.size.x*0.58-8,attack_strip.size.y)/0.18
			choice_detail.position=Vector2(16,8)
			choice_detail.size=Vector2(attack_strip.size.x*0.58-40,attack_strip.size.y-16)
			choice_confirm.position=Vector2(attack_strip.size.x*0.58,0)
			choice_confirm.size=Vector2(attack_strip.size.x*0.42,attack_strip.size.y)
		else:
			choice_frame.hide()
			choice_confirm.position=Vector2(size.x-280,size.y-76)
			choice_confirm.size=Vector2(256,52)

func _confirm_choice() -> void:
	if pending_choice.is_empty() or not _can_act(): return
	var choice := pending_choice.duplicate(true)
	pending_choice = {}
	choice_confirm.disabled = true
	if choice.type == "select-item":
		selected_item = choice.payload.itemId
		item_targets_requested.emit(selected_item)
	else: _submit(choice.type,choice.payload)

func _button_art(button: Button,source_choice: bool=false) -> void:
	# Preserve the ornamental corners; a scaled nine-patch extends only the
	# neutral center instead of stretching a character circle or border.
	button.flat = true
	button.add_theme_color_override("font_color",Color("ffe8bc"))
	var padding := StyleBoxEmpty.new()
	padding.content_margin_left = 16
	padding.content_margin_right = 16
	padding.content_margin_top = 5
	padding.content_margin_bottom = 5
	for state in ["normal","hover","pressed","disabled","focus"]: button.add_theme_stylebox_override(state,padding)
	var art := NinePatchRect.new()
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.scale = Vector2(0.18,0.18)
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: art.set_patch_margin(side,80)
	if source_choice:
		# Original single-row encounter art; the battle choice art has a
		# center divider intended for two separate text rows.
		art.region_rect=Rect2(54,76,2064,572)
		art.set_patch_margin(SIDE_LEFT,360);art.set_patch_margin(SIDE_RIGHT,360)
		art.set_patch_margin(SIDE_TOP,130);art.set_patch_margin(SIDE_BOTTOM,130)
	button.add_child(art)
	art.show_behind_parent = true
	button.move_child(art,0)
	var update_size := func():
		var factor:=minf(.18,maxf(1,button.size.y)/572.0) if source_choice else .18
		art.scale=Vector2.ONE*factor
		art.size=button.size/factor
	button.resized.connect(update_size)
	update_size.call()
	_image(art,"images/board/encounter_ui/encounter_action_button_frame.webp" if source_choice else "images/board/battle_hud_dialogue_ui/battle_hud_player_frame.webp")

func test_status_press(side: String,index: int) -> void:
	hud[side].effects.test_press(index)

func test_status_state_json() -> String:
	var report: Dictionary={"sides":{},"popup":{"visible":status_detail.visible,"inside":Rect2(Vector2.ZERO,size).encloses(status_detail.get_rect()),"texts":[]}}
	for label in status_detail.labels:report.popup.texts.append(label.text)
	for side in hud:
		var row=hud[side].effects
		report.sides[side]={"builds":row.builds,"rows":row.rows,"ready":row.assets_ready(),"inside":Rect2(Vector2.ZERO,size).encloses(hud[side].scroll.get_global_rect()),"scrollWidth":hud[side].scroll.size.x,"rowWidth":row.size.x}
	return JSON.stringify(report)
