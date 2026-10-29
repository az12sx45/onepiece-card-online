extends Control
var game: Control
var bridge: Object
var preferences: Dictionary = {"gameDisplayMode":"fullscreen","minimizeToTrayOnGameLaunch":false}
var installed_version: String = "iOS"
var native_game_id: String = ""

func _ready() -> void:
	var backdrop := ColorRect.new()
	backdrop.color=Color("061722"); backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(backdrop); backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bridge=get_node("/root/IOSServices").bridge
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
			value.games={"board":{"status":"installed","hasInstalled":true,"removable":false,"installedVersion":installed_version,"remoteVersion":installed_version},"card":{"status":"installed","hasInstalled":true,"removable":false,"onlineOnly":true,"installedVersion":"線上版","remoteVersion":"線上版"},"chess":{"status":"installed","hasInstalled":true,"removable":false,"onlineOnly":true,"installedVersion":"線上版","remoteVersion":"線上版"}}
			if FileAccess.file_exists('res://native-card.tscn'):value.games.card={"status":"installed","hasInstalled":true,"removable":false,"installedVersion":installed_version,"remoteVersion":installed_version}
		return value
	if method=="savePreferences":
		if args.get("gameDisplayMode","fullscreen")!="fullscreen":return {"ok":false,"error":"iPhone 使用系統管理的橫向全螢幕。"}
		return {"ok":true,"preferences":preferences}
	if method=="launchGame":
		var target:=str(args.get("gameId",""))
		if not target in ["board","card","chess"]:return {"ok":false,"error":"無效的遊戲。"}
		var session: Variant=JSON.parse_string(bridge.call("session_request","getNativeState","{}"))
		if not session is Dictionary or str(session.get("secret","")).is_empty():return {"ok":false,"error":"請先登入"}
		var active:=str(bridge.call("web_game_active"))
		if not active.is_empty() and active!=target:return {"ok":false,"error":"請先回到原遊戲並按「結束遊戲」，再開另一款。"}
		if is_instance_valid(game) and native_game_id!=target:return {"ok":false,"error":"請先結束目前遊戲，再開另一款。"}
		if target!="board" and not (target=="card" and FileAccess.file_exists('res://native-card.tscn')):
			if is_instance_valid(game):return {"ok":false,"error":"請先結束航海錄，再開另一款。"}
			return {"ok":true} if bridge.call("web_game_open",target) else {"ok":false,"error":"遊戲無法開啟，請稍後再試。"}
		_start_game.call_deferred(target);return {"ok":true}
	if method=="chooseCacheLocation":return {"ok":bool(bridge.call("open_settings")),"cacheRoot":"iPhone App 儲存空間","managedSandbox":true}
	if "Update" in method:return {"ok":true,"state":{"status":"unavailable","currentVersion":installed_version,"message":"iOS 測試版請透過 iloader 安裝新版；遊戲圖片會按需下載。","error":"iOS 測試版請透過 iloader 安裝新版。"}}
	return {"ok":false,"error":"此操作目前不適用於 iOS 航海錄測試版。"}

func _start_game(target: String="board") -> void:
	if is_instance_valid(game):return
	bridge.call("launcher_hide")
	native_game_id=target
	game=load("res://native-card.tscn").instantiate() if target=="card" else preload("res://native-product.tscn").instantiate()
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
