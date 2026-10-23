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
	var login: Control = load("res://ios_product_root.gd").new()
	root.add_child(login)
	for dimensions in [Vector2(960,432),Vector2(740,360),Vector2(640,320)]:
		login.size = dimensions
		login.show_sign_in()
		await process_frame
		await process_frame
		check(Rect2(Vector2.ZERO,dimensions).encloses(login.login_box.get_rect()),"Login bounds: "+str(dimensions)+" actual "+str(login.login_box.get_rect()))
		check(login.password.secret,"Password input must be masked")
		check(login.return_button.text=="回到登入畫面","No Android launcher label on iOS")
	login.queue_free()
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
