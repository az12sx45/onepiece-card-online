extends SceneTree
var failures: Array[String] = []
var checks := 0

func check(value: bool, message: String) -> void:
	checks += 1
	if not value: failures.append(message)

func _initialize() -> void: _run.call_deferred()

func _run() -> void:
	for filename in ["ios_assets.gd","ios_session.gd","ios_video.gd","ios_services.gd","ios_host.gd","ios_product_root.gd","native_nika_video.gd","native_screen_metrics.gd"]:
		var resource: Resource = load("res://"+filename)
		check(resource != null and resource.can_instantiate(),"Script load: "+filename)
	if not failures.is_empty(): _finish(); return
	var screen: Control = load("res://ios_product_root.gd").new()
	root.add_child(screen)
	for dimensions in [Vector2(960,432),Vector2(740,360),Vector2(640,320)]:
		screen.size = dimensions
		screen.show_failure("offline")
		await process_frame
		await process_frame
		check(Rect2(Vector2.ZERO,dimensions).encloses(screen.return_button.get_rect()),"Return button bounds: "+str(dimensions))
		check(screen.return_button.text=="返回啟動器","Return preserves launcher navigation")
	var fonts=load("res://native_fonts.gd")
	for glyph in "航海錄登入夥伴戰鬥PIRATE0123456789":
		check(fonts.base().has_char(glyph.unicode_at(0)),"Font glyph: "+glyph)
	check(fonts.battle_dice().has_char(49),"Original dice font")
	for path in ["mobile/art-ui/icons-v006.png","mobile/art-ui/command-helm-v010.png","mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png","mobile/art-ui/map-hud-compact-v009.png","mobile/art-ui/map-static-v025.webp"]:
		var picture:=Image.new()
		check(picture.load("res://"+path)==OK and not picture.is_empty(),"Raw UI image decodes: "+path)
	screen.queue_free()
	await process_frame
	var assets: Node = load("res://ios_assets.gd").new()
	root.add_child(assets)
	var rejected: Array = []
	assets.resolved.connect(func(ticket: String,value: String): rejected.append([ticket,JSON.parse_string(value)]))
	assets.resolve_image("test-1","../secrets")
	assets.resolve_audio("test-2","https://example.com/test.mp3")
	assets.resolve_video("test-3","original-core.js")
	await process_frame
	await process_frame
	check(rejected.size()==3,"Unknown paths and game code rejected without network")
	for reply in rejected: check(reply[1].ok==false,"Rejected asset must fail closed")
	check(assets.active.is_empty(),"Invalid media must not start HTTP")
	assets.queue_free()
	await process_frame
	_finish()

func _finish() -> void:
	var result := {"checks":checks,"failures":failures,"windowsChecksPassed":failures.is_empty(),"macCompiled":false,"iphoneTested":false}
	var args := OS.get_cmdline_user_args()
	if args.size()==1:
		var file := FileAccess.open(args[0],FileAccess.WRITE)
		if file: file.store_string(JSON.stringify(result)); file.close()
	print("PO_IOS_WINDOWS_CHECK ",JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
