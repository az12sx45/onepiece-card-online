extends Control
var game: Control
var bridge: Object
var preferences: Dictionary = {"gameDisplayMode":"fullscreen","minimizeToTrayOnGameLaunch":false}

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
			value.preferences=preferences;value.cacheRoot="iPhone App 儲存空間";value.freeBytes=null
			value.games={"board":{"status":"installed","hasInstalled":true,"removable":false,"installedVersion":"iOS 39","remoteVersion":"iOS 39"},"card":{"status":"unavailable","hasInstalled":false,"removable":false,"error":"此 iOS 測試包目前提供航海錄。"},"chess":{"status":"unavailable","hasInstalled":false,"removable":false,"error":"此 iOS 測試包目前提供航海錄。"}}
		return value
	if method=="savePreferences":return {"ok":true,"preferences":preferences}
	if method=="launchGame":
		if args.get("gameId","")!="board":return {"ok":false,"error":"此 iOS 測試包目前提供航海錄。"}
		var session: Variant=JSON.parse_string(bridge.call("session_request","getNativeState","{}"))
		if not session is Dictionary or str(session.get("secret","")).is_empty():return {"ok":false,"error":"請先登入"}
		_start_game.call_deferred();return {"ok":true}
	if method=="chooseCacheLocation":return {"ok":true,"cacheRoot":"iPhone App 儲存空間","managedSandbox":true}
	if "Update" in method:return {"ok":true,"state":{"status":"unavailable","currentVersion":"iOS 39","message":"iOS 測試版請透過 iloader 安裝新版；遊戲圖片會按需下載。","error":"iOS 測試版請透過 iloader 安裝新版。"}}
	return {"ok":false,"error":"此操作目前不適用於 iOS 航海錄測試版。"}

func _start_game() -> void:
	if is_instance_valid(game):return
	bridge.call("launcher_hide")
	game=preload("res://native-product.tscn").instantiate()
	add_child(game);game.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT);_layout()

func return_to_launcher() -> void:
	if is_instance_valid(game):game.queue_free()
	game=null
	if bridge!=null:bridge.call("launcher_show",true)

func _layout() -> void:
	if not is_instance_valid(game): return
	var area := Rect2(Vector2.ZERO,size)
	if OS.get_name()=="iOS":
		var safe := DisplayServer.get_display_safe_area()
		var inverse := get_viewport().get_final_transform().affine_inverse()
		if safe.size.x>0 and safe.size.y>0:
			area = (inverse * Rect2(safe)).intersection(area)
	game.position=area.position; game.size=area.size
