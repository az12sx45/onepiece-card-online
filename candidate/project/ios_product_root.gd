extends "res://native_product_root.gd"
signal login_requested(username: String, password: String)
var login_box := VBoxContainer.new()
var username := LineEdit.new()
var password := LineEdit.new()
var login_button := Button.new()
var login_note := Label.new()

func _ready() -> void:
	super._ready()
	return_button.text = "回到登入畫面"
	return_dialog.title = "回到登入畫面"
	return_dialog.dialog_text = "離開目前航海，回到登入畫面嗎？"
	curtain.add_child(login_box)
	login_box.add_theme_constant_override("separation", 10)
	username.placeholder_text = "帳號"
	password.placeholder_text = "密碼"; password.secret = true
	username.max_length = 24; password.max_length = 128
	login_button.text = "登入航海錄"
	for input in [username,password,login_button]:
		input.custom_minimum_size = Vector2(0,44)
		input.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(600))
		input.add_theme_font_size_override("font_size",18)
		login_box.add_child(input)
	login_note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	login_note.max_lines_visible = 2
	login_note.custom_minimum_size = Vector2(0,42)
	login_note.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(500))
	login_note.add_theme_font_size_override("font_size",14)
	login_note.add_theme_color_override("font_color", Color("ffe4a9"))
	login_box.add_child(login_note)
	login_button.pressed.connect(_submit_login)
	password.text_submitted.connect(func(_value: String): _submit_login())
	login_box.hide(); _layout()

func _layout() -> void:
	super._layout()
	if login_box.is_inside_tree():
		var width := minf(420.0,size.x-48)
		login_box.position = Vector2((size.x-width)*0.5,maxf(64.0,(size.y-210.0)*0.5))
		login_box.size = Vector2(width,210)
		if login_box.visible: message.position=Vector2(24,10); message.size=Vector2(size.x-48,44)

func _submit_login() -> void:
	if login_button.disabled: return
	if username.text.strip_edges().is_empty() or password.text.is_empty():
		login_note.text="請輸入帳號與密碼。"; return
	var supplied := password.text
	password.clear()
	login_busy(true)
	login_requested.emit(username.text.strip_edges(),supplied)

func login_busy(value: bool) -> void:
	login_button.disabled=value; username.editable=not value; password.editable=not value
	login_note.text="正在登入…" if value else "使用原本的遊戲帳號；首次載入素材需要網路。"

func login_failed() -> void:
	login_busy(false); login_note.text="登入未完成，請檢查帳號、密碼與網路後重試。"

func show_sign_in() -> void:
	curtain.show(); retry_button.hide(); return_button.hide(); login_box.show()
	message.text="PIRATE ODYSSEY"; login_busy(false); _layout()

func show_loading() -> void:
	login_box.hide(); super.show_loading()

func show_failure(kind: String) -> void:
	if kind in ["sign-in","session-changed"]: show_sign_in()
	else: login_box.hide(); super.show_failure(kind)
