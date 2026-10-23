extends "res://native_player_shell.gd"
signal retry_requested
signal return_requested
var retry_button:=Button.new()
var return_button:=Button.new()
var return_dialog:=ConfirmationDialog.new()
var social_page: Control
var toast_layer: Control
var failure_kind:=""
var entropy:=Crypto.new()

func _ready() -> void:
	super._ready()
	get_tree().auto_accept_quit=false
	for button in [retry_button,return_button]:
		button.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(600));button.add_theme_font_size_override("font_size",16);curtain.add_child(button);button.hide()
	retry_button.text="重試";retry_button.pressed.connect(func():retry_requested.emit())
	return_button.text="返回啟動器";return_button.pressed.connect(func():return_requested.emit())
	return_dialog.title="返回啟動器";return_dialog.dialog_text="要返回啟動器嗎？";return_dialog.ok_button_text="返回";return_dialog.cancel_button_text="留在遊戲";return_dialog.confirmed.connect(func():return_requested.emit());add_child(return_dialog)
	social_page=preload("res://native_product_social.gd").new();social_page.cache=cache;social_page.size=size;social_page.z_index=900;add_child(social_page)
	toast_layer=preload("res://native_shared_toasts.gd").new();toast_layer.size=size;toast_layer.z_index=1100;add_child(toast_layer)
	_layout()

func _layout() -> void:
	super._layout()
	if retry_button.is_inside_tree():
		message.size=Vector2(size.x-72,maxf(50,size.y-130));retry_button.position=Vector2(size.x/2-154,size.y-80);retry_button.size=Vector2(144,44);return_button.position=Vector2(size.x/2+10,size.y-80);return_button.size=Vector2(144,44)
	if is_instance_valid(social_page):social_page.size=size
	if is_instance_valid(toast_layer):toast_layer.size=size

func show_loading() -> void:
	failure_kind="";retry_button.hide();return_button.hide();super.show_loading()
func show_failure(kind: String) -> void:
	failure_kind=kind
	var copy: Dictionary={"offline":"連線暫時無法完成，請確認網路後重試。","sign-in":"請先回到啟動器登入帳號。","session-changed":"帳號已變更，請重新進入遊戲。","storage":"存檔資料目前無法讀取，請返回啟動器後再試。","unavailable":"目前無法進入航海錄，請確認更新與網路後重試。"}
	super.show_error(str(copy.get(kind,copy.unavailable)));retry_button.visible=kind!="sign-in";return_button.show();_layout()
func show_error(_value: String) -> void:show_failure("unavailable")
func notify_player(value: String) -> void:toast_layer.show_message(value)
func random_hex(byte_count: int) -> String:
	assert(byte_count>0 and byte_count<=65536,"Random byte count out of range")
	return entropy.generate_random_bytes(byte_count).hex_encode()
func _notification(what: int) -> void:
	if what==NOTIFICATION_WM_GO_BACK_REQUEST or what==NOTIFICATION_WM_CLOSE_REQUEST:
		if is_instance_valid(social_page) and social_page.visible:social_page.command_requested.emit("close","")
		elif curtain.visible:return_requested.emit()
		else:return_dialog.popup_centered(Vector2i(360,150))
func test_recovery_json() -> String:
	return JSON.stringify({"kind":failure_kind,"visible":curtain.visible,"retry":retry_button.visible,"return":return_button.visible,"bounded":Rect2(Vector2.ZERO,size).encloses(return_button.get_rect()) and Rect2(Vector2.ZERO,size).encloses(retry_button.get_rect())})
