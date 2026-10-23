extends Control
signal command_requested(key: String,value: String)
var cache: Node
var panel:=NinePatchRect.new()
var heading:=Label.new()
var close_button:=Button.new()
var refresh_button:=Button.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var input:=LineEdit.new()
var submit:=Button.new()
var empty:=Label.new()
var rows: Dictionary={}
var model: Dictionary={}
var confirm:=ConfirmationDialog.new()
var pending_remove:=""

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=14;theme=t
	panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.scale=Vector2.ONE*.125
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel);add_child(heading);heading.add_theme_color_override("font_color",Color("ffe4a9"));heading.add_theme_font_size_override("font_size",20);heading.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	close_button.text="返回";close_button.pressed.connect(func():command_requested.emit("close",""));add_child(close_button)
	refresh_button.text="重新整理";refresh_button.pressed.connect(func():command_requested.emit("refresh",""));add_child(refresh_button)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",8);scroll.add_child(list)
	empty.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;empty.add_theme_color_override("font_color",Color("fff0cb"));list.add_child(empty)
	input.max_length=80;input.text_submitted.connect(func(value):if not submit.disabled:command_requested.emit("submit",value));add_child(input)
	submit.pressed.connect(func():command_requested.emit("submit",input.text));add_child(submit)
	confirm.title="移除好友";confirm.ok_button_text="移除";confirm.cancel_button_text="取消";confirm.confirmed.connect(func():command_requested.emit(pending_remove,""));add_child(confirm)
	resized.connect(_layout);_layout();hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func _process(_delta: float) -> void:
	if panel.texture==null and cache:panel.texture=cache.request("mobile/art-ui/mobile-panel-v013.png")
	if panel.texture:set_process(false)

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model:return
	var chat_changed: bool=next.chat!=model.get("chat",false)
	model=next;heading.text=model.title;empty.text=model.empty;empty.visible=model.rows.is_empty()
	input.placeholder_text="輸入訊息…" if model.chat else "輸入玩家名稱";input.max_length=400 if model.chat else 80
	submit.text="送出" if model.chat else "加好友";submit.disabled=model.busy or not model.ready;refresh_button.disabled=model.busy
	if chat_changed:input.clear();scroll.scroll_vertical=0
	var retained: Dictionary={};var index:=1
	for item in model.rows:
		var key: String=item.key;retained[key]=true
		if not rows.has(key):
			var box:=VBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(box)
			var label:=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.add_theme_color_override("font_color",Color("fff2d7"));box.add_child(label)
			var actions:=HBoxContainer.new();box.add_child(actions);rows[key]={"box":box,"label":label,"actions":actions,"buttons":{}}
		var row: Dictionary=rows[key];list.move_child(row.box,index);index+=1;row.label.text=item.text
		for button in row.buttons.values():button.hide()
		for action in item.actions:
			if not row.buttons.has(action.key):
				var button:=Button.new();button.custom_minimum_size=Vector2(100,38);button.set_meta("key",action.key);row.actions.add_child(button);row.buttons[action.key]=button
				button.pressed.connect(func():
					var command: String=button.get_meta("key")
					if command.begins_with("remove:"):pending_remove=command;confirm.dialog_text="確定移除這位好友？";confirm.popup_centered(Vector2i(360,150))
					else:command_requested.emit(command,"")
				)
			var button: Button=row.buttons[action.key];button.text=action.label;button.disabled=model.busy;button.show()
	for key in rows.keys():
		if not retained.has(key):rows[key].box.hide();rows[key].box.queue_free();rows.erase(key)
	_layout()

func _layout() -> void:
	panel.size=size/.125;heading.position=Vector2(26,18);heading.size=Vector2(maxf(80,size.x-260),36)
	close_button.position=Vector2(size.x-106,18);close_button.size=Vector2(80,38);refresh_button.position=Vector2(size.x-220,18);refresh_button.size=Vector2(106,38)
	scroll.position=Vector2(28,68);scroll.size=Vector2(size.x-56,maxf(40,size.y-142))
	input.position=Vector2(28,size.y-60);input.size=Vector2(size.x-150,40);submit.position=Vector2(size.x-112,size.y-60);submit.size=Vector2(84,40);queue_redraw()
func clear_input() -> void:input.clear()
func clear_submitted_input(value: String) -> void:
	if input.text==value:input.clear()
