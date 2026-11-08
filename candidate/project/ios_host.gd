extends Control
var game: Control
var bridge: Object
var preferences: Dictionary = {"gameDisplayMode":"fullscreen","minimizeToTrayOnGameLaunch":false}
var installed_version: String = "iOS"
var native_game_id: String = ""
var board_updates: Node
var board_revision := ""
var board_config: Dictionary = {}

func _ready() -> void:
	var backdrop := ColorRect.new()
	backdrop.color=Color("061722"); backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(backdrop); backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bridge=get_node("/root/IOSServices").bridge
	board_updates=preload("res://ios_board_update.gd").new()
	add_child(board_updates)
	board_updates.connect("changed",_board_state_changed)
	var config: Variant=JSON.parse_string(FileAccess.get_file_as_string("res://ios-board-program-v1.json"))
	if config is Dictionary:board_config=config
	board_updates.setup(board_config)
	resized.connect(_layout)
	if bridge!=null:bridge.call("launcher_show",true)
	else:push_error("iOS launcher bridge unavailable")

func _process(_delta: float) -> void:
	if bridge==null:return
	var batch: Variant=JSON.parse_string(bridge.call("launcher_requests"))
	if not batch is Array:return
	for request in batch:
		if not request is Dictionary:continue
		var args: Variant=request.get("args",{})
		if not args is Dictionary:args={}
		var result:=_request(str(request.get("method","")),args)
		bridge.call("launcher_reply",str(request.get("id","")),JSON.stringify(result))

func _request(method: String,args: Dictionary) -> Dictionary:
	if method in ["getNativeState","saveSession","clearSession"]:
		var value: Variant=JSON.parse_string(bridge.call("session_request",method,JSON.stringify(args)))
		if not value is Dictionary:return {"ok":false,"error":"secure storage unavailable"}
		if method=="getNativeState":
			installed_version=str(value.get("appVersion","iOS"))
			value.preferences=preferences;value.cacheRoot="iPhone App 儲存空間";value.freeBytes=null
			var board_state: Dictionary=board_updates.state()
			board_state.programRevision=board_revision
			board_state.appVersion=installed_version
			value.games={"marineford":_marineford_request("state"),"board":board_state,"card":{"status":"installed","hasInstalled":true,"removable":false,"onlineOnly":true,"installedVersion":"線上版","remoteVersion":"線上版"},"chess":{"status":"installed","hasInstalled":true,"removable":false,"onlineOnly":true,"installedVersion":"線上版","remoteVersion":"線上版"}}
		return value
	if method=="savePreferences":
		if args.get("gameDisplayMode","fullscreen")!="fullscreen":return {"ok":false,"error":"iPhone 使用系統管理的橫向全螢幕。"}
		return {"ok":true,"preferences":preferences}
	if method in ["installGame","cancelInstall","uninstallGame"] and args.get("gameId")=="marineford":
		return _marineford_request(method)
	if args.get("gameId")=="board" and method in ["installGame","cancelInstall","rollbackBoardProgram","checkBoardProgram"]:
		return _board_request(method)
	if method=="launchGame":
		var target:=str(args.get("gameId",""))
		if not target in ["board","card","chess","marineford"]:return {"ok":false,"error":"無效的遊戲。"}
		var session: Variant=JSON.parse_string(bridge.call("session_request","getNativeState","{}"))
		if not session is Dictionary or str(session.get("secret","")).is_empty():return {"ok":false,"error":"請先登入"}
		var active:=str(bridge.call("web_game_active"))
		if not active.is_empty() and active!=target:return {"ok":false,"error":"請先回到原遊戲並按「結束遊戲」，再開另一款。"}
		if is_instance_valid(game) and native_game_id!=target:return {"ok":false,"error":"請先結束目前遊戲，再開另一款。"}
		if target!="board":
			if is_instance_valid(game):return {"ok":false,"error":"請先結束航海錄，再開另一款。"}
			return {"ok":true} if bridge.call("web_game_open",target) else {"ok":false,"error":"遊戲無法開啟，請稍後再試。"}
		if not board_updates.prepare_board():return {"ok":false,"error":"請關閉並重新開啟 App，以回到可用的航海錄版本。"}
		_start_game.call_deferred(target);return {"ok":true}
	if method=="chooseCacheLocation":return {"ok":bool(bridge.call("open_settings")),"cacheRoot":"iPhone App 儲存空間","managedSandbox":true}
	if "Update" in method:return {"ok":true,"state":{"status":"unavailable","currentVersion":installed_version,"message":"iOS 測試版請透過 iloader 安裝新版；遊戲圖片會按需下載。","error":"iOS 測試版請透過 iloader 安裝新版。"}}
	return {"ok":false,"error":"此操作目前不適用於 iOS 航海錄測試版。"}

func _marineford_request(method: String) -> Dictionary:
	var result: Variant=JSON.parse_string(bridge.call("marineford_request",method))
	return result if result is Dictionary else {"ok":false,"status":"error","error":"素材儲存空間無法使用。"}

func _board_request(method: String) -> Dictionary:
	if method=="cancelInstall":return {"ok":bool(board_updates.cancel())}
	if method=="checkBoardProgram":
		board_updates.check_remote()
		return {"ok":true}
	if is_instance_valid(game):return {"ok":false,"error":"請先結束航海錄。"}
	var began: bool=board_updates.rollback() if method=="rollbackBoardProgram" else board_updates.install()
	return {"ok":true} if began else {"ok":false,"error":"目前沒有可套用的航海錄更新，請稍後再試。"}

func _board_state_changed() -> void:
	if bridge!=null:bridge.call("launcher_games_changed")

func board_program_preflight() -> bool:
	var script := load("res://native_battle_stage.gd") as GDScript
	if script==null or not script.can_instantiate():return false
	var stage: Variant=script.new()
	if not stage is Control:return false
	stage.free()
	if not board_updates.needs_full_preflight():return true
	for path: String in board_config.resourceLimits:
		if path.ends_with(".gdc"):
			var checked := ResourceLoader.load("res://"+path.trim_suffix(".gdc")+".gd","GDScript") as GDScript
			if checked==null or not checked.can_instantiate():return false
		elif path.ends_with(".gdshader"):
			var shader := ResourceLoader.load("res://"+path,"Shader") as Shader
			if shader==null or shader.code.is_empty():return false
	return true

func board_program_preflight_modules() -> String:
	var modules: Array[String] = []
	if board_updates.needs_full_preflight():
		for path: String in board_config.resourceLimits:
			if path.ends_with(".js"):modules.append(path.trim_suffix(".js"))
	return JSON.stringify(modules)

func board_program_failed() -> void:
	board_updates.fail_board()
	return_to_launcher()
	bridge.call("launcher_game_failed")

func board_program_ready(revision: String) -> void:
	if native_game_id!="board" or not is_instance_valid(game):return
	board_revision=revision.left(48)
	board_updates.confirm_board()
	_board_state_changed()

func _start_game(target: String="board") -> void:
	if is_instance_valid(game):return
	var scene := load("res://native-product.tscn") as PackedScene
	if scene==null or not scene.can_instantiate():
		board_updates.fail_board()
		bridge.call("launcher_game_failed")
		return
	game=scene.instantiate() as Control
	if game==null:
		board_updates.fail_board()
		bridge.call("launcher_game_failed")
		return
	bridge.call("launcher_hide")
	native_game_id=target
	add_child(game);game.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT);_layout()

func return_to_launcher() -> void:
	if is_instance_valid(game):game.queue_free()
	game=null
	native_game_id=""
	if bridge!=null:bridge.call("launcher_show",false)

func _layout() -> void:
	if not is_instance_valid(game): return
	var area := Rect2(Vector2.ZERO,size)
	if OS.get_name()=="iOS":
		var safe := DisplayServer.get_display_safe_area()
		var inverse := get_viewport().get_final_transform().affine_inverse()
		if safe.size.x>0 and safe.size.y>0:
			area = (inverse * Rect2(safe)).intersection(area)
	game.position=area.position; game.size=area.size
