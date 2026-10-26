extends Control
## Native scene ownership for integration; production account/save/network entry
## is not provided by this stage or by the fixture-based probe beneath it.
signal map_command_json(value: String)
signal helm_command_json(value: String)
signal map_controls_visibility_changed
signal board_dice_finished(id: String, result: int, error: String)
signal modal_command(key: String)
signal audio_unlock_requested
signal ui_control_activated(value: String)

func report_cpu_diagnostic(value: String) -> void:
	print("[PO_CPU] ", value)

func report_native_perf(area: String, milliseconds: float) -> void:
	if milliseconds>=40:print("[PO_PERF] ",JSON.stringify({"area":area,"ms":milliseconds}))

const Cache=preload("res://native_asset_cache.gd")
const MapView=preload("res://native_map_view.gd")
const Helm=preload("res://native_captain_helm.gd")
const Dice=preload("res://native_board_dice.gd")
const ChoiceModal=preload("res://native_choice_modal.gd")
const BoardNotice=preload("res://native_board_notice.gd")
const ShopModal=preload("res://native_shop_modal.gd")
const StoryModal=preload("res://native_story_modal.gd")
const HospitalModal=preload("res://native_hospital_modal.gd")
const TavernModal=preload("res://native_tavern_modal.gd")
const TavernReveal=preload("res://native_tavern_reveal.gd")
const CrewModal=preload("res://native_crew_modal.gd")
const CaptainModal=preload("res://native_captain_modal.gd")
const CarryModal=preload("res://native_carry_modal.gd")
const TrainingModal=preload("res://native_training_modal.gd")
const MoveLearnModal=preload("res://native_move_learn_modal.gd")
const CosmeticModal=preload("res://native_cosmetic_modal.gd")
const EvolutionHud=preload("res://native_evolution_hud.gd")
const NikaVideo=preload("res://native_nika_video.gd")
const NikaPost=preload("res://native_nika_post.gd")
const Draft=preload("res://native_draft_modal.gd")
var map_view: Control
var map_cache: Node
var helm: Control
var dice: Control
var choice_modal: Control
var board_notice: Control
var shop_modal: Control
var modal_pending:=false
var story_modal: Control
var modal_generation:=0
var hospital_modal: Control
var tavern_modal: Control
var tavern_reveal: Control
var crew_modal: Control
var captain_modal: Control
var carry_modal: Control
var training_modal: Control
var move_learn_modal: Control
var cosmetic_modal: Control
var evolution_hud: Control
var nika_video: Control
var marineford_video: Control
var nika_post: Control
var sea_splash: Control
var draft_modal: Control
var cpu_strategy_modal: Control
var cpu_ship_menu: Control
var fleet_modal: Control
var ship_info_modal: Control
var codex_modal: Control
var water_seven_page: Control
var marineford_page: Control
var impel_down_page: Control
var mission_journal_modal: Control
var sea_train_layer: Control
var item_reveal_hud: Control
var sea_chest_modal: Control
var research_modal: Control
var reward_choice_modal: Control
var backpack_target_modal: Control
var backpack_modal: Control
var mission_board_modal: Control
var save_modal: Control
var trade_modal: Control
var final_imu_modal: Control
var final_ritual_modal: Control
var final_route_effect: Control
var kuma_effect: Control
var compass_modal: Control
var map_info_modal: Control
var egghead_effect: Control
var york_page: Control
var spar_page: Control
var judicial_entry_modal: Control
var arena_modal: Control
var inversion_overview_modal: Control
var encounter_modal: Control
var yonko_modal: Control
var game_tools: Control
var shared_toasts: Control
var music_audio: Node
var ui_sound: Node
var frame_watch: Dictionary={}

func _ready() -> void:
	preload("res://native_scroll_input.gd").install(self)
	shared_toasts=preload("res://native_shared_toasts.gd").new();shared_toasts.size=size;shared_toasts.z_index=340;add_child(shared_toasts);resized.connect(func():shared_toasts.size=size)
	map_cache=Cache.new()
	map_cache.use_mipmaps=true
	map_cache.asset_root=ProjectSettings.globalize_path("res://../../public")
	map_cache.mount_roots={"mobile":ProjectSettings.globalize_path("res://../../android/web")}
	add_child(map_cache)
	music_audio=preload("res://native_audio_transport.gd").new();music_audio.asset_root=map_cache.asset_root;add_child(music_audio)
	ui_sound=preload("res://native_sound_transport.gd").new();ui_sound.asset_root=map_cache.asset_root;add_child(ui_sound)
	get_tree().node_added.connect(_watch_audio_control)
	_watch_audio_subtree(self)
	game_tools=preload("res://native_game_tools.gd").new();game_tools.cache=map_cache;game_tools.size=size;game_tools.z_index=104;add_child(game_tools);resized.connect(func():game_tools.size=size)
	map_view=MapView.new()
	map_view.cache=map_cache
	map_view.size=size
	map_view.z_index=0
	add_child(map_view)
	move_child(map_view,0)
	final_route_effect=preload("res://native_final_route_effect.gd").new();final_route_effect.cache=map_cache;final_route_effect.z_index=28;map_view.world.add_child(final_route_effect)
	kuma_effect=preload("res://native_kuma_effect.gd").new();kuma_effect.cache=map_cache;kuma_effect.z_index=30;map_view.world.add_child(kuma_effect)
	map_view.command_requested.connect(func(type,payload):map_command_json.emit(JSON.stringify({"type":type,"payload":payload})))
	helm=Helm.new()
	helm.cache=map_cache;helm.size=size;helm.hide()
	helm.z_index=100
	add_child(helm)
	# GUI hit testing follows sibling order, independently of z_index.
	# The full-screen tools must receive touches before the wheel underneath.
	move_child(game_tools,helm.get_index()+1)
	helm.command_requested.connect(func(action,player):helm_command_json.emit(JSON.stringify({"action":action,"playerId":player})))
	dice=Dice.new();dice.cache=map_cache;dice.size=size;dice.z_index=150
	add_child(dice)
	dice.finished.connect(func(id,result,error):board_dice_finished.emit(id,result,error))
	dice.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	choice_modal=ChoiceModal.new();choice_modal.cache=map_cache;choice_modal.size=size;choice_modal.z_index=120
	add_child(choice_modal);choice_modal.command_requested.connect(func(key):modal_command.emit(key))
	choice_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	shop_modal=ShopModal.new();shop_modal.cache=map_cache;shop_modal.size=size;shop_modal.z_index=120
	add_child(shop_modal);shop_modal.command_requested.connect(func(key):modal_command.emit(key))
	shop_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	story_modal=StoryModal.new();story_modal.cache=map_cache;story_modal.size=size;story_modal.z_index=120
	add_child(story_modal);story_modal.command_requested.connect(func(key):modal_command.emit(key))
	story_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	hospital_modal=HospitalModal.new();hospital_modal.cache=map_cache;hospital_modal.size=size;hospital_modal.z_index=120
	add_child(hospital_modal);hospital_modal.command_requested.connect(func(key):modal_command.emit(key))
	hospital_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	tavern_modal=TavernModal.new();tavern_modal.cache=map_cache;tavern_modal.size=size;tavern_modal.z_index=120
	add_child(tavern_modal);tavern_modal.command_requested.connect(func(key):modal_command.emit(key))
	tavern_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	captain_modal=CaptainModal.new();captain_modal.cache=map_cache;captain_modal.size=size;captain_modal.z_index=120
	add_child(captain_modal);captain_modal.command_requested.connect(func(key):modal_command.emit(key))
	captain_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	crew_modal=CrewModal.new();crew_modal.cache=map_cache;crew_modal.size=size;crew_modal.z_index=120
	add_child(crew_modal);crew_modal.command_requested.connect(func(key):modal_command.emit(key))
	crew_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	carry_modal=CarryModal.new();carry_modal.cache=map_cache;carry_modal.size=size;carry_modal.z_index=120
	add_child(carry_modal);carry_modal.command_requested.connect(func(key):modal_command.emit(key))
	carry_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	training_modal=TrainingModal.new();training_modal.cache=map_cache;training_modal.size=size;training_modal.z_index=120
	add_child(training_modal);training_modal.command_requested.connect(func(key):modal_command.emit(key))
	training_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	move_learn_modal=MoveLearnModal.new();move_learn_modal.cache=map_cache;move_learn_modal.size=size;move_learn_modal.z_index=120
	add_child(move_learn_modal);move_learn_modal.command_requested.connect(func(key):modal_command.emit(key))
	move_learn_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	cosmetic_modal=CosmeticModal.new();cosmetic_modal.cache=map_cache;cosmetic_modal.size=size;cosmetic_modal.z_index=120
	add_child(cosmetic_modal);cosmetic_modal.command_requested.connect(func(key):modal_command.emit(key))
	cosmetic_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	tavern_reveal=TavernReveal.new();tavern_reveal.cache=map_cache;tavern_reveal.size=size;tavern_reveal.z_index=200
	add_child(tavern_reveal)
	evolution_hud=EvolutionHud.new();evolution_hud.cache=map_cache;evolution_hud.size=size;evolution_hud.z_index=210
	add_child(evolution_hud)
	evolution_hud.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	nika_video=NikaVideo.new();nika_video.size=size;add_child(nika_video)
	marineford_video=NikaVideo.new();marineford_video.size=size;add_child(marineford_video)
	nika_post=NikaPost.new();nika_post.cache=map_cache;nika_post.size=size;add_child(nika_post)
	sea_splash=preload("res://native_sea_splash.gd").new();sea_splash.size=size;add_child(sea_splash)
	sea_splash.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():sea_splash.size=size)
	for surface in [nika_video,nika_post,marineford_video]:surface.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	resized.connect(func():nika_video.size=size;nika_post.size=size;marineford_video.size=size)
	resized.connect(func():evolution_hud.size=size)
	resized.connect(func():tavern_reveal.size=size)
	draft_modal=Draft.new();draft_modal.cache=map_cache;draft_modal.size=size;draft_modal.z_index=120;add_child(draft_modal);draft_modal.command_requested.connect(func(key):modal_command.emit(key));draft_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():draft_modal.size=size)
	save_modal=preload("res://native_save_load_modal.gd").new();save_modal.cache=map_cache;save_modal.size=size;save_modal.z_index=120;add_child(save_modal);save_modal.command_requested.connect(func(key):modal_command.emit(key));save_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():save_modal.size=size)
	trade_modal=preload("res://native_trade_modal.gd").new();trade_modal.cache=map_cache;trade_modal.size=size;trade_modal.z_index=120;add_child(trade_modal);trade_modal.command_requested.connect(func(key):modal_command.emit(key));trade_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():trade_modal.size=size)
	final_imu_modal=preload("res://native_final_imu_modal.gd").new();final_imu_modal.cache=map_cache;final_imu_modal.size=size;final_imu_modal.z_index=120;add_child(final_imu_modal);final_imu_modal.command_requested.connect(func(key):modal_command.emit(key));final_imu_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():final_imu_modal.size=size)
	final_ritual_modal=preload("res://native_final_ritual_modal.gd").new();final_ritual_modal.cache=map_cache;final_ritual_modal.size=size;final_ritual_modal.z_index=120;add_child(final_ritual_modal);final_ritual_modal.command_requested.connect(func(key):modal_command.emit(key));final_ritual_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():final_ritual_modal.size=size)
	encounter_modal=preload("res://native_encounter_modal.gd").new();encounter_modal.cache=map_cache;encounter_modal.size=size;encounter_modal.z_index=120;add_child(encounter_modal);encounter_modal.command_requested.connect(func(key):modal_command.emit(key));encounter_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():encounter_modal.size=size)
	compass_modal=preload("res://native_compass_modal.gd").new();compass_modal.cache=map_cache;compass_modal.size=size;compass_modal.z_index=120;add_child(compass_modal);compass_modal.command_requested.connect(func(key):modal_command.emit(key));compass_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():compass_modal.size=size)
	map_info_modal=preload("res://native_map_info_modal.gd").new();map_info_modal.cache=map_cache;map_info_modal.size=size;map_info_modal.z_index=120;add_child(map_info_modal);map_info_modal.command_requested.connect(func(key):modal_command.emit(key));map_info_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():map_info_modal.size=size)
	inversion_overview_modal=preload("res://native_inversion_overview_modal.gd").new();inversion_overview_modal.cache=map_cache;inversion_overview_modal.size=size;inversion_overview_modal.z_index=120;add_child(inversion_overview_modal);inversion_overview_modal.command_requested.connect(func(key):modal_command.emit(key));inversion_overview_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():inversion_overview_modal.size=size)
	arena_modal=preload("res://native_arena_modal.gd").new();arena_modal.cache=map_cache;arena_modal.size=size;arena_modal.z_index=120;add_child(arena_modal);arena_modal.command_requested.connect(func(key):modal_command.emit(key));arena_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():arena_modal.size=size)
	judicial_entry_modal=preload("res://native_judicial_entry.gd").new();judicial_entry_modal.cache=map_cache;judicial_entry_modal.size=size;judicial_entry_modal.z_index=120;add_child(judicial_entry_modal);judicial_entry_modal.command_requested.connect(func(key):modal_command.emit(key));judicial_entry_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():judicial_entry_modal.size=size)
	yonko_modal=preload("res://native_yonko_modal.gd").new();yonko_modal.cache=map_cache;yonko_modal.size=size;yonko_modal.z_index=120;add_child(yonko_modal);yonko_modal.command_requested.connect(func(key):modal_command.emit(key));yonko_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():yonko_modal.size=size)
	cpu_strategy_modal=preload("res://native_cpu_strategy_modal.gd").new();cpu_strategy_modal.cache=map_cache;cpu_strategy_modal.size=size;cpu_strategy_modal.z_index=120;add_child(cpu_strategy_modal);cpu_strategy_modal.command_requested.connect(func(key):modal_command.emit(key));cpu_strategy_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():cpu_strategy_modal.size=size)
	cpu_ship_menu=preload("res://native_cpu_ship_menu.gd").new();cpu_ship_menu.cache=map_cache;cpu_ship_menu.size=size;cpu_ship_menu.z_index=110;add_child(cpu_ship_menu);cpu_ship_menu.command_requested.connect(func(kind,value):map_command_json.emit(JSON.stringify({"type":kind,"payload":value})));cpu_ship_menu.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():cpu_ship_menu.size=size)
	fleet_modal=preload("res://native_fleet_modal.gd").new();fleet_modal.cache=map_cache;fleet_modal.size=size;fleet_modal.z_index=120;add_child(fleet_modal);fleet_modal.command_requested.connect(func(key):modal_command.emit(key));fleet_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():fleet_modal.size=size)
	ship_info_modal=preload("res://native_ship_info_modal.gd").new();ship_info_modal.cache=map_cache;ship_info_modal.size=size;ship_info_modal.z_index=120;add_child(ship_info_modal);ship_info_modal.command_requested.connect(func(key):modal_command.emit(key));ship_info_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():ship_info_modal.size=size)
	codex_modal=preload("res://native_codex_modal.gd").new();codex_modal.cache=map_cache;codex_modal.size=size;codex_modal.z_index=120;add_child(codex_modal);codex_modal.command_requested.connect(func(key):modal_command.emit(key));codex_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():codex_modal.size=size)
	sea_train_layer=preload("res://native_sea_train_layer.gd").new();sea_train_layer.cache=map_cache;sea_train_layer.map_view=map_view;map_view.world.add_child(sea_train_layer)
	item_reveal_hud=preload("res://native_item_reveal_hud.gd").new();item_reveal_hud.cache=map_cache;item_reveal_hud.size=size;item_reveal_hud.z_index=395;add_child(item_reveal_hud);item_reveal_hud.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():item_reveal_hud.size=size)
	research_modal=preload("res://native_research_modal.gd").new();research_modal.cache=map_cache;research_modal.size=size;research_modal.z_index=120;add_child(research_modal);research_modal.command_requested.connect(func(key):modal_command.emit(key));research_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():research_modal.size=size)
	sea_chest_modal=preload("res://native_sea_chest_modal.gd").new();sea_chest_modal.cache=map_cache;sea_chest_modal.size=size;sea_chest_modal.z_index=120;add_child(sea_chest_modal);sea_chest_modal.command_requested.connect(func(key):modal_command.emit(key));sea_chest_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():sea_chest_modal.size=size)
	reward_choice_modal=preload("res://native_reward_choice_modal.gd").new();reward_choice_modal.cache=map_cache;reward_choice_modal.size=size;reward_choice_modal.z_index=120;add_child(reward_choice_modal);reward_choice_modal.command_requested.connect(func(key):modal_command.emit(key));reward_choice_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():reward_choice_modal.size=size)
	backpack_target_modal=preload("res://native_backpack_target_modal.gd").new();backpack_target_modal.cache=map_cache;backpack_target_modal.size=size;backpack_target_modal.z_index=120;add_child(backpack_target_modal);backpack_target_modal.command_requested.connect(func(key):modal_command.emit(key));backpack_target_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():backpack_target_modal.size=size)
	backpack_modal=preload("res://native_backpack_modal.gd").new();backpack_modal.cache=map_cache;backpack_modal.size=size;backpack_modal.z_index=120;add_child(backpack_modal);backpack_modal.command_requested.connect(func(key):modal_command.emit(key));backpack_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():backpack_modal.size=size)
	mission_board_modal=preload("res://native_mission_board_modal.gd").new();mission_board_modal.cache=map_cache;mission_board_modal.size=size;mission_board_modal.z_index=120;add_child(mission_board_modal);mission_board_modal.command_requested.connect(func(key):modal_command.emit(key));mission_board_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():mission_board_modal.size=size)
	mission_journal_modal=preload("res://native_mission_journal_modal.gd").new();mission_journal_modal.cache=map_cache;mission_journal_modal.size=size;mission_journal_modal.z_index=120;add_child(mission_journal_modal);mission_journal_modal.command_requested.connect(func(key):modal_command.emit(key));mission_journal_modal.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():mission_journal_modal.size=size)
	water_seven_page=preload("res://native_water_seven_page.gd").new();water_seven_page.cache=map_cache;water_seven_page.size=size;water_seven_page.z_index=120;add_child(water_seven_page);water_seven_page.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():water_seven_page.size=size)
	marineford_page=preload("res://native_marineford_page.gd").new();marineford_page.cache=map_cache;marineford_page.size=size;marineford_page.z_index=120;add_child(marineford_page);marineford_page.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():marineford_page.size=size)
	impel_down_page=preload("res://native_impel_down_page.gd").new();impel_down_page.cache=map_cache;impel_down_page.size=size;impel_down_page.z_index=19;add_child(impel_down_page);impel_down_page.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():impel_down_page.size=size)
	spar_page=preload("res://native_spar_page.gd").new();spar_page.cache=map_cache;spar_page.size=size;spar_page.z_index=121;add_child(spar_page);spar_page.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():spar_page.size=size)
	york_page=preload("res://native_york_page.gd").new();york_page.cache=map_cache;york_page.size=size;york_page.z_index=122;add_child(york_page);york_page.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():york_page.size=size)
	egghead_effect=preload("res://native_egghead_effect.gd").new();egghead_effect.cache=map_cache;egghead_effect.map_view=map_view;egghead_effect.size=size;egghead_effect.z_index=123;add_child(egghead_effect);egghead_effect.visibility_changed.connect(func():map_controls_visibility_changed.emit());resized.connect(func():egghead_effect.size=size)
	for surface in [choice_modal,shop_modal,story_modal,hospital_modal,tavern_modal,captain_modal,crew_modal,carry_modal,training_modal,move_learn_modal,cosmetic_modal,draft_modal,save_modal,trade_modal,final_imu_modal,yonko_modal,encounter_modal,compass_modal,map_info_modal,arena_modal,judicial_entry_modal,inversion_overview_modal,final_ritual_modal,cpu_strategy_modal,cpu_ship_menu,fleet_modal,ship_info_modal,codex_modal,mission_journal_modal,mission_board_modal,backpack_modal,backpack_target_modal,reward_choice_modal,sea_chest_modal,research_modal]:
		surface.surface_ready.connect(func():_modal_ready(surface))
	board_notice=BoardNotice.new();board_notice.cache=map_cache;board_notice.size=size;board_notice.z_index=15
	add_child(board_notice)
	var battle: Control=get_node("Battle")
	battle.z_index=20
	battle.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	# Loading a save also closes an already hidden battle. Its transition still
	# locks commands for 260 ms; the battle itself emits no visibility change
	# when that lock ends. Observe the actual transition surface as well.
	battle.entry.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	battle.timeline.turn_banner.visibility_changed.connect(func():map_controls_visibility_changed.emit())
	resized.connect(func():map_view.size=size;helm.size=size;dice.size=size;choice_modal.size=size;board_notice.size=size;shop_modal.size=size;story_modal.size=size;hospital_modal.size=size;tavern_modal.size=size;tavern_reveal.size=size;crew_modal.size=size;captain_modal.size=size;carry_modal.size=size;training_modal.size=size;move_learn_modal.size=size;cosmetic_modal.size=size)

func _input(event: InputEvent) -> void:
	if (event is InputEventScreenTouch and event.pressed) or (event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT) or (event is InputEventKey and event.pressed and not event.echo and event.keycode in [KEY_ENTER,KEY_SPACE]):audio_unlock_requested.emit()

func _modal_ready(current: Control) -> void:
	modal_pending=false
	for surface in [choice_modal,shop_modal,story_modal,hospital_modal,tavern_modal,captain_modal,crew_modal,carry_modal,training_modal,move_learn_modal,cosmetic_modal,draft_modal,save_modal,trade_modal,final_imu_modal,yonko_modal,encounter_modal,compass_modal,map_info_modal,arena_modal,judicial_entry_modal,inversion_overview_modal,final_ritual_modal,cpu_strategy_modal,cpu_ship_menu,fleet_modal,ship_info_modal,codex_modal,mission_journal_modal,mission_board_modal,backpack_modal,backpack_target_modal,reward_choice_modal,sea_chest_modal,research_modal]:
		if surface!=current:surface.close_surface()

func can_show_commands() -> bool:
	if sea_splash.visible:return false
	if egghead_effect.visible or york_page.visible or spar_page.visible or impel_down_page.visible:return false
	if marineford_page.visible:return false
	if research_modal.visible or sea_chest_modal.visible or sea_train_layer.active or item_reveal_hud.visible or reward_choice_modal.visible or backpack_target_modal.visible or backpack_modal.visible or water_seven_page.visible or mission_journal_modal.visible or mission_board_modal.visible:return false
	if draft_modal.visible or save_modal.visible or trade_modal.visible or final_imu_modal.visible or yonko_modal.visible or encounter_modal.visible or compass_modal.visible or map_info_modal.visible or judicial_entry_modal.visible or arena_modal.visible or inversion_overview_modal.visible or final_ritual_modal.visible or cpu_strategy_modal.visible or cpu_ship_menu.visible or fleet_modal.visible or ship_info_modal.visible or codex_modal.visible:return false
	var battle: Control=get_node("Battle")
	return not battle.visible and not (battle.entry and (battle.entry.active or battle.entry.closing)) and not battle.timeline.turn_banner.visible and not dice.visible and not choice_modal.visible and not shop_modal.visible and not story_modal.visible and not hospital_modal.visible and not tavern_modal.visible and not crew_modal.visible and not captain_modal.visible and not carry_modal.visible and not training_modal.visible and not move_learn_modal.visible and not cosmetic_modal.visible and not evolution_hud.visible and not nika_video.visible and not nika_post.visible and not modal_pending
func modal_button_state_json(key: String) -> String:
	# CPU source queries use the same persistent buttons that receive touch.
	# Hidden pages and pending transitions cannot expose clickable controls.
	var result: Dictionary={"visible":false,"rect":{"x":0,"y":0,"width":0,"height":0}}
	if modal_pending:return JSON.stringify(result)
	for node in find_children("*","Button",true,false):
		if not node.is_visible_in_tree() or str(node.get_meta("key",""))!=key:continue
		var rect: Rect2=node.get_global_rect()
		result={"visible":not node.disabled,"rect":{"x":rect.position.x,"y":rect.position.y,"width":rect.size.x,"height":rect.size.y}}
		break
	return JSON.stringify(result)

func presentation_is_ready() -> bool:
	if impel_down_page.visible:return not impel_down_page.busy
	if marineford_page.visible:return not marineford_page.busy
	if water_seven_page.visible:return true
	if modal_pending:return false
	for surface in [choice_modal,shop_modal,story_modal,hospital_modal,tavern_modal,captain_modal,crew_modal,carry_modal,training_modal,move_learn_modal,cosmetic_modal,draft_modal,save_modal,trade_modal,final_imu_modal,yonko_modal,encounter_modal,compass_modal,map_info_modal,arena_modal,judicial_entry_modal,inversion_overview_modal,final_ritual_modal,cpu_strategy_modal,cpu_ship_menu,fleet_modal,ship_info_modal,codex_modal,mission_journal_modal,mission_board_modal,backpack_modal,backpack_target_modal,reward_choice_modal,sea_chest_modal,research_modal]:
		if surface.visible:return true
	var battle: Control=get_node("Battle")
	if battle.visible:return battle.assets_ready()
	return map_view.background.texture!=null

func show_choice_modal(value: String) -> void:modal_generation+=1;modal_pending=true;story_modal.block_input();choice_modal.apply_json(value)
func begin_modal_transition() -> void:modal_generation+=1;modal_pending=true;story_modal.block_input()
func close_choice_modal() -> void:choice_modal.close_surface();modal_pending=false
func show_shop_modal(value: String) -> void:modal_generation+=1;modal_pending=true;story_modal.block_input();shop_modal.apply_json(value)
func close_shop_modal() -> void:shop_modal.close_surface();modal_pending=false
func show_story_modal(value: String) -> void:modal_generation+=1;modal_pending=true;story_modal.apply_json(value)
func show_hospital_modal(value: String) -> void:begin_modal_transition();hospital_modal.apply_json(value)
func show_tavern_modal(value: String) -> void:begin_modal_transition();tavern_modal.apply_json(value)
func show_captain_modal(value: String) -> void:begin_modal_transition();captain_modal.apply_json(value)
func show_crew_modal(value: String) -> void:begin_modal_transition();crew_modal.apply_json(value)
func show_carry_modal(value: String) -> void:begin_modal_transition();carry_modal.apply_json(value)
func show_training_modal(value: String) -> void:begin_modal_transition();training_modal.apply_json(value)
func show_move_learn_modal(value: String) -> void:begin_modal_transition();move_learn_modal.apply_json(value)
func show_cosmetic_modal(value: String) -> void:begin_modal_transition();cosmetic_modal.apply_json(value)
func show_reward_choice_modal(value: String) -> void:begin_modal_transition();reward_choice_modal.apply_json(value)
func show_backpack_target_modal(value: String) -> void:begin_modal_transition();backpack_target_modal.apply_json(value)
func show_backpack_modal(value: String) -> void:begin_modal_transition();backpack_modal.apply_json(value)
func show_mission_board_modal(value: String) -> void:begin_modal_transition();mission_board_modal.apply_json(value)
func show_mission_journal_modal(value: String) -> void:begin_modal_transition();mission_journal_modal.apply_json(value)
func show_codex_modal(value: String) -> void:begin_modal_transition();codex_modal.apply_json(value)
func show_ship_info_modal(value: String) -> void:begin_modal_transition();ship_info_modal.apply_json(value)
func show_fleet_modal(value: String) -> void:begin_modal_transition();fleet_modal.apply_json(value)
func show_cpu_strategy_modal(value: String) -> void:begin_modal_transition();cpu_strategy_modal.apply_json(value)
func show_final_ritual_modal(value: String) -> void:begin_modal_transition();final_ritual_modal.apply_json(value)
func show_judicial_entry_modal(value: String) -> void:begin_modal_transition();judicial_entry_modal.apply_json(value)
func show_arena_modal(value: String) -> void:begin_modal_transition();arena_modal.apply_json(value)
func show_inversion_overview_modal(value: String) -> void:begin_modal_transition();inversion_overview_modal.apply_json(value)
func show_map_info_modal(value: String) -> void:begin_modal_transition();map_info_modal.apply_json(value)
func show_compass_modal(value: String) -> void:begin_modal_transition();compass_modal.apply_json(value)
func show_encounter_modal(value: String) -> void:begin_modal_transition();encounter_modal.apply_json(value)
func show_yonko_modal(value: String) -> void:begin_modal_transition();yonko_modal.apply_json(value)
func show_final_imu_modal(value: String) -> void:begin_modal_transition();final_imu_modal.apply_json(value)
func show_trade_modal(value: String) -> void:modal_generation+=1;modal_pending=true;story_modal.block_input();trade_modal.apply_json(value)
func show_save_modal(value: String) -> void:begin_modal_transition();save_modal.apply_json(value)
func show_draft_modal(value: String) -> void:begin_modal_transition();draft_modal.apply_json(value)
func request_modal_close() -> void:
	modal_generation+=1;modal_pending=false;story_modal.block_input()
	var token:=modal_generation
	call_deferred("_close_modal_if_current",token)
func _close_modal_if_current(token: int) -> void:
	if token!=modal_generation:return
	for surface in [choice_modal,shop_modal,story_modal,hospital_modal,tavern_modal,captain_modal,crew_modal,carry_modal,training_modal,move_learn_modal,cosmetic_modal,draft_modal,save_modal,trade_modal,final_imu_modal,yonko_modal,encounter_modal,compass_modal,map_info_modal,arena_modal,judicial_entry_modal,inversion_overview_modal,final_ritual_modal,cpu_strategy_modal,cpu_ship_menu,fleet_modal,ship_info_modal,codex_modal,mission_journal_modal,mission_board_modal,backpack_modal,backpack_target_modal,reward_choice_modal,sea_chest_modal,research_modal]:surface.close_surface()
func show_board_notice(value: String) -> void:board_notice.apply_json(value)

func play_board_dice(id: String, value: String) -> void:dice.start(id,JSON.parse_string(value))
func cancel_board_dice(remote_id: String) -> void:dice.cancel(remote_id)
func hide_board_dice() -> void:dice.hide()

func open_helm_json(value: String) -> void:
	if not helm.visible:helm.motion.angle=0;helm.motion.inertia=false;helm.pointer=-1
	helm.apply_model(JSON.parse_string(value))
	helm._update_selection(true)
	helm.show()

func close_helm() -> void:
	helm.hide();helm.motion.inertia=false;helm.pointer=-1

func apply_map_json(value: String) -> void:
	map_view.apply_model(JSON.parse_string(value))

func test_map_ready() -> bool:
	return map_view.background.texture != null and map_view.surroundings.texture != null and map_cache.pending.is_empty()

func test_resize_window(width: int,height: int) -> void:get_window().size=Vector2i(width,height)
func test_frame_hash() -> String:
	var context:=HashingContext.new();context.start(HashingContext.HASH_SHA256);context.update(get_viewport().get_texture().get_image().get_data());return context.finish().hex_encode()
func test_begin_frame_watch() -> void:
	assert(not RenderingServer.frame_post_draw.is_connected(_test_record_frame),"Frame watch already active")
	frame_watch={"expected":test_frame_hash(),"frames":0,"changedFrames":0}
	RenderingServer.frame_post_draw.connect(_test_record_frame)
func _test_record_frame() -> void:
	frame_watch.frames+=1
	if test_frame_hash()!=frame_watch.expected:
		if frame_watch.changedFrames==0:get_viewport().get_texture().get_image().save_png("res://native-first-changed-frame.png")
		frame_watch.changedFrames+=1
func test_end_frame_watch_json() -> String:
	RenderingServer.frame_post_draw.disconnect(_test_record_frame)
	return JSON.stringify(frame_watch)
func test_frame_count() -> int:return int(frame_watch.get("frames",0))
func test_warm_assets_json(value: String) -> bool:
	return warm_assets_json(value)
func warm_assets_json(value: String) -> bool:
	var ready:=true
	for path in JSON.parse_string(value):
		if map_cache.request(path)==null:ready=false
	return ready

func _watch_audio_subtree(node: Node) -> void:
	_watch_audio_control(node)
	for child in node.get_children():_watch_audio_subtree(child)

func _watch_audio_control(node: Node) -> void:
	if not node is BaseButton or not is_ancestor_of(node) or node.has_meta('po_audio_hook'):return
	node.set_meta('po_audio_hook',true)
	node.pressed.connect(func():
		if not is_instance_valid(node) or node.disabled:return
		ui_control_activated.emit(JSON.stringify({'id':str(node.get_meta('original_control_id',node.name)),'text':node.text if node is Button else '', 'label':node.tooltip_text,'select':node is CheckBox or node is CheckButton or node.toggle_mode,'cue':str(node.get_meta('board_sfx','')),'disabled':node.disabled}))
	)

func test_shared_fonts() -> bool:
	var fonts=preload("res://native_fonts.gd")
	return fonts.file_reads==1 and fonts.weighted(550).base_font==fonts.base() and fonts.weighted(800).base_font==fonts.base() and fonts.weighted(850).base_font==fonts.base() and fonts.weighted(550)==fonts.weighted(550)

func test_map_after_battle(capture: bool=true) -> void:
	assert(not map_view.model.is_empty())
	assert(map_cache.failed.is_empty())
	assert(not get_node("Battle").visible)
	assert(helm.visible,"Own-turn helm did not appear after battle")
	assert(helm.z_index>get_node("Battle").z_index and get_node("Battle").z_index>5,"Map hit targets escaped underneath-scene ordering")
	var before: float=map_view.zoom
	map_view.fit_all()
	map_view.zoom_at(1.2,map_view.size/2.0)
	assert(map_view.zoom > 0 and before > 0)
	if capture:_capture_after_battle()

func _capture_after_battle() -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("res://native-map-after-battle-check.png")






