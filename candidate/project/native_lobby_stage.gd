extends Control
signal command_requested(key: String)
signal input_changed(key: String, value: String)
var cache: Node
var model: Dictionary = {}
var background := TextureRect.new()
var shell := Panel.new()
var heading := Label.new()
var subtitle := Label.new()
var chat := RichTextLabel.new()
var chat_heading := Label.new()
var room_input := LineEdit.new()
var chat_input := LineEdit.new()
var seats: Dictionary = {}
var buttons: Dictionary = {}
var generation := 0
var applied_generation := 0
var room_scroll := ScrollContainer.new()
var room_list := VBoxContainer.new()
var room_rows: Dictionary = {}
var profile_text := Label.new()
var campaign_page: Control

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var theme_value:=Theme.new();theme_value.default_font=preload("res://native_fonts.gd").weighted(650);theme_value.default_font_size=14;theme=theme_value
	background.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background)
	shell.mouse_filter=Control.MOUSE_FILTER_IGNORE;shell.add_theme_stylebox_override("panel",_panel(Color(1,1,1,.36),18));add_child(shell)
	for label in [heading,subtitle]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("27536a"));add_child(label)
	heading.add_theme_font_size_override("font_size",18);heading.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;subtitle.add_theme_font_size_override("font_size",13)
	chat.scroll_active=true;chat.bbcode_enabled=false;chat.add_theme_color_override("default_color",Color("3a7088"));chat.add_theme_stylebox_override("normal",_panel(Color(1,1,1,.42),16));add_child(chat)
	chat.add_theme_font_size_override("normal_font_size",12);chat_heading.text="等待室聊天";chat_heading.add_theme_color_override("font_color",Color("27536a"));add_child(chat_heading)
	room_input.placeholder_text="輸入房號";room_input.text_changed.connect(func(value):input_changed.emit("roomCodeInput",value));add_child(room_input)
	chat_input.placeholder_text="輸入等待室訊息…";chat_input.text_changed.connect(func(value):input_changed.emit("boardLobbyChatInput",value));chat_input.text_submitted.connect(func(_value):command_requested.emit("boardLobbySendChatBtn"));add_child(chat_input)
	for input in [room_input,chat_input]:
		input.add_theme_stylebox_override("normal",_panel(Color(1,1,1,.55),12));input.add_theme_stylebox_override("focus",_panel(Color(1,1,1,.7),12));input.add_theme_color_override("font_color",Color("27536a"));input.add_theme_color_override("font_placeholder_color",Color("5c7f91"));input.add_theme_font_size_override("font_size",12)
	resized.connect(_layout)
	room_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(room_scroll);room_list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;room_list.add_theme_constant_override("separation",8);room_scroll.add_child(room_list)
	profile_text.add_theme_color_override("font_color",Color("27536a"));profile_text.add_theme_font_size_override("font_size",18);profile_text.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;add_child(profile_text)
	campaign_page=preload("res://native_campaign_page.gd").new();add_child(campaign_page);campaign_page.hide()
	campaign_page.command_requested.connect(func(key):command_requested.emit(key));campaign_page.input_changed.connect(func(key,value):input_changed.emit(key,value))

func _panel(color: Color,radius: int) -> StyleBoxFlat:
	var style:=StyleBoxFlat.new();style.bg_color=color;style.border_color=Color(1,1,1,.76);style.set_border_width_all(1);style.set_corner_radius_all(radius);style.content_margin_left=10;style.content_margin_right=10;style.content_margin_top=8;style.content_margin_bottom=8;return style

func _button(key: String) -> Button:
	if buttons.has(key):return buttons[key]
	var button:=Button.new();button.name=key.replace(":","_");button.add_theme_stylebox_override("normal",_panel(Color(1,1,1,.62),13));button.add_theme_stylebox_override("hover",_panel(Color(1,1,1,.86),13));button.add_theme_stylebox_override("pressed",_panel(Color("d9eef6"),13));button.add_theme_stylebox_override("disabled",_panel(Color(1,1,1,.32),13));button.add_theme_color_override("font_color",Color("27536a"));button.add_theme_color_override("font_hover_color",Color("17384b"));button.add_theme_color_override("font_disabled_color",Color("7f9da9"));button.pressed.connect(func():command_requested.emit(key));add_child(button);buttons[key]=button;return button

func _seat(key: String) -> Dictionary:
	if seats.has(key):return seats[key]
	var card:=Panel.new();card.add_theme_stylebox_override("panel",_panel(Color(1,1,1,.54),16));add_child(card)
	var portrait:=TextureRect.new();portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;card.add_child(portrait)
	var name_label:=Label.new();name_label.add_theme_font_size_override("font_size",14);name_label.add_theme_color_override("font_color",Color("27536a"));name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;card.add_child(name_label)
	var title_label:=Label.new();title_label.add_theme_font_size_override("font_size",11);title_label.add_theme_color_override("font_color",Color("5c7f91"));title_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;card.add_child(title_label)
	var tags:=Label.new();tags.add_theme_font_size_override("font_size",12);tags.add_theme_color_override("font_color",Color("3a7088"));card.add_child(tags)
	var result: Dictionary={"card":card,"portrait":portrait,"name":name_label,"title":title_label,"tags":tags};seats[key]=result;return result

func apply_json(value: String) -> void:
	generation+=1;_prepare(JSON.parse_string(value),generation)

func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=["images/board/backgrounds/board_bg_start.webp"]
	for entry in value.seats:
		if not str(entry.portrait).is_empty():paths.append(str(entry.portrait))
	if value.has("campaign") and value.campaign.selected!=null:
		for member in value.campaign.selected.members:
			if not str(member.portrait).is_empty():paths.append(str(member.portrait))
	var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==generation:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Lobby asset failed: "+path);return
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Lobby asset timeout");return
		await get_tree().process_frame
	if token!=generation:return
	model=value;background.texture=loaded[paths[0]]
	for button in buttons.values():button.hide()
	for card in seats.values():card.card.hide()
	for action in model.actions:
		var button:=_button(action.key);button.text=action.label;button.disabled=action.disabled;button.visible=action.visible;button.tooltip_text=action.title
		if action.key=="boardStartBtn":button.add_theme_stylebox_override("normal",_panel(Color("efbb56"),13));button.add_theme_color_override("font_color",Color("76501f"))
	for entry in model.seats:
		var card:=_seat(entry.key);card.card.show();card.name.text=entry.name;card.title.text=entry.title;card.tags.text="  ".join(entry.tags);card.portrait.texture=loaded.get(entry.portrait)
		if model.view=="lobby" and not str(entry.remove).is_empty():var remove:=_button(entry.remove);remove.text=entry.removeLabel;remove.show()
	var room_keys: Array=[]
	for entry in model.rooms:
		room_keys.append(entry.key)
		if not room_rows.has(entry.key):
			var panel:=PanelContainer.new();panel.add_theme_stylebox_override("panel",_panel(Color(1,1,1,.56),14));panel.custom_minimum_size.y=82;room_list.add_child(panel)
			var row:=HBoxContainer.new();panel.add_child(row);var label:=Label.new();label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.add_theme_color_override("font_color",Color("27536a"));label.add_theme_font_size_override("font_size",12);label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;row.add_child(label)
			var button:=Button.new();button.custom_minimum_size=Vector2(60,40);button.add_theme_stylebox_override("normal",_panel(Color(1,1,1,.75),12));button.add_theme_color_override("font_color",Color("27536a"));row.add_child(button);button.pressed.connect(func():command_requested.emit(str(button.get_meta("key"))));button.set_meta("key",entry.key)
			room_rows[entry.key]={"panel":panel,"label":label,"button":button}
		var item: Dictionary=room_rows[entry.key];item.label.text=entry.title+"\n"+entry.host+"\n"+entry.count;item.button.text=entry.label;item.button.disabled=entry.disabled
	for key in room_rows.keys():
		if key not in room_keys:room_rows[key].panel.queue_free();room_rows.erase(key)
	heading.text=model.title if model.view=="lobby" else ("新世界航海錄" if model.view=="home" else "選擇航海方式")
	subtitle.text="房號  "+model.code+"    "+model.count if model.view=="lobby" else model.player.name+"    "+model.player.title+"    金幣 "+model.player.coins
	var lines: String="\n\n".join(model.chat)
	if chat.text!=lines:chat.text=lines;chat.scroll_to_line(chat.get_line_count()-1)
	if room_input.text!=model.roomCode:room_input.text=model.roomCode
	if chat_input.text!=model.chatInput:chat_input.text=model.chatInput
	if model.has("campaign"):campaign_page.apply(model.campaign,loaded)
	_layout()
	applied_generation=token

func test_is_settled() -> bool:
	return presentation_is_ready()
func presentation_is_ready() -> bool:
	return applied_generation==generation and not model.is_empty()

func _layout() -> void:
	background.size=size;shell.position=Vector2(10,54);shell.size=Vector2(size.x-20,size.y-64)
	if model.is_empty():return
	campaign_page.visible=model.view=="campaigns";campaign_page.size=size
	heading.visible=not campaign_page.visible;subtitle.visible=not campaign_page.visible;shell.visible=not campaign_page.visible
	heading.position=Vector2(20,62);heading.size=Vector2(size.x-40,26);subtitle.position=Vector2(20,90);subtitle.size=Vector2(size.x-40,22)
	chat.visible=model.view=="lobby";chat_input.visible=chat.visible;room_input.visible=model.view=="modeSelect"
	chat_heading.visible=chat.visible
	room_scroll.visible=model.view=="modeSelect";profile_text.visible=bool(model.profileOpen)
	for card in seats.values():card.card.visible=false
	var footer: float=size.y-54
	if model.view=="lobby":
		buttons.leaveLobbyBtn.position=Vector2(10,6);buttons.leaveLobbyBtn.size=Vector2(108,40)
		var left_width: float=(size.x-36)*.55;var column_width: float=(left_width-8)/2;var row_height: float=(footer-122)/2
		for i in range(model.seats.size()):
			var entry: Dictionary=model.seats[i];var card: Dictionary=seats[entry.key];card.card.show();card.card.position=Vector2(18+(i%2)*(column_width+8),116+floorf(i/2.0)*(row_height+4));card.card.size=Vector2(column_width,row_height)
			card.portrait.position=Vector2(7,8);card.portrait.size=Vector2(36,36);card.name.position=Vector2(48,8);card.name.size=Vector2(column_width-55,20);card.title.position=Vector2(48,28);card.title.size=Vector2(column_width-55,17);card.tags.position=Vector2(8,49);card.tags.size=Vector2(column_width-16,22)
			if not str(entry.remove).is_empty():
				card.portrait.position=Vector2(7,6);card.portrait.size=Vector2(28,28);card.name.position=Vector2(42,6);card.name.size.x=column_width-49;card.title.position=Vector2(8,35);card.title.size=Vector2(column_width-76,15);card.title.add_theme_font_size_override("font_size",10);card.tags.position.y=53;card.tags.size.x=column_width-76;card.tags.add_theme_font_size_override("font_size",11)
				var remove: Button=buttons[entry.remove];remove.position=card.card.position+Vector2(column_width-60,row_height-40);remove.size=Vector2(54,36)
		var right_x: float=26+left_width;var right_width: float=size.x-right_x-18
		chat_heading.position=Vector2(right_x,116);chat_heading.size=Vector2(right_width,22);chat.position=Vector2(right_x,140);chat.size=Vector2(right_width,maxf(40,footer-188));chat_input.position=Vector2(right_x,footer-42);chat_input.size=Vector2(right_width-62,36);buttons.boardLobbySendChatBtn.position=Vector2(size.x-74,footer-42);buttons.boardLobbySendChatBtn.size=Vector2(56,36)
		var actions: Array=[]
		for key in ["boardAddCpuBtn","boardReadyBtn","boardStartBtn"]:
			if buttons[key].visible:actions.append(key)
		var width: float=(size.x-36-8*(actions.size()-1))/maxi(1,actions.size())
		for i in range(actions.size()):buttons[actions[i]].position=Vector2(18+i*(width+8),footer);buttons[actions[i]].size=Vector2(width,42)
	elif model.view=="modeSelect":
		buttons.backToHomeBtn.position=Vector2(10,6);buttons.backToHomeBtn.size=Vector2(108,40)
		var left: float=(size.x-56)*.42;var right_x: float=32+left
		room_input.position=Vector2(24,122);room_input.size=Vector2(left,38)
		for i in range(3):var key: String=["joinBoardRoomBtn","createBoardRoomBtn","refreshBoardRoomsBtn"][i];buttons[key].position=Vector2(24,166+i*44);buttons[key].size=Vector2(left,38)
		buttons.toggleBoardRoomsBtn.position=Vector2(right_x,122);buttons.toggleBoardRoomsBtn.size=Vector2(size.x-right_x-24,38)
		room_scroll.position=Vector2(right_x,168);room_scroll.size=Vector2(size.x-right_x-24,size.y-180)
	elif model.view!="campaigns":
		var keys: Array=[]
		for action in model.actions:
			if action.visible:keys.append(action.key)
		for i in range(keys.size()):buttons[keys[i]].position=Vector2(24+(i%2)*(size.x/2-20),130+floorf(i/2.0)*54);buttons[keys[i]].size=Vector2(size.x/2-28,46)
	if model.view=="campaigns":
		for button in buttons.values():button.hide()
	if model.profileOpen:
		for button in buttons.values():button.hide()
		var close: Button=buttons.closePlayerProfileBtn;close.show();close.position=Vector2(10,6);close.size=Vector2(108,40)
		heading.text="玩家資料";profile_text.text=model.player.name+"\n\n"+model.player.title+"\n\n金幣 "+model.player.coins;profile_text.position=Vector2(32,128);profile_text.size=Vector2(size.x-64,size.y-144)

func test_layout() -> bool:
	if campaign_page.visible:return campaign_page.test_layout()
	var bounds:=Rect2(Vector2.ZERO,size)
	for button in buttons.values():
		if button.visible and not bounds.encloses(Rect2(button.position,button.size)):return false
	for card in seats.values():
		if card.card.visible and not bounds.encloses(Rect2(card.card.position,card.card.size)):return false
	return true

func test_press(key: String) -> bool:
	if campaign_page.visible:return campaign_page.test_press(key)
	var button: Button=buttons.get(key)
	if not button and room_rows.has(key):button=room_rows[key].button
	if not button or not button.is_visible_in_tree() or button.disabled:return false
	button.pressed.emit();return true
