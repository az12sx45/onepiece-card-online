extends Control
# Persistent native Controls. Source callbacks own every save/network operation.
signal command_requested(key: String)
signal input_changed(key: String, value: String)
var model: Dictionary = {}
var panel := Panel.new()
var header := HBoxContainer.new()
var tabs := HBoxContainer.new()
var footer := HBoxContainer.new()
var scroll := ScrollContainer.new()
var body := VBoxContainer.new()
var controls: Dictionary = {}
var commands: Dictionary = {}
var content_order: Array = []
var mode_key := ""
var textures: Dictionary = {}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	panel.add_theme_stylebox_override("panel",_style(Color(.92,.97,1,.96)));panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(panel)
	for row in [header,tabs,footer]:row.add_theme_constant_override("separation",8);add_child(row)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",8);scroll.add_child(body)
	resized.connect(_layout)

func _style(color: Color) -> StyleBoxFlat:
	var style:=StyleBoxFlat.new();style.bg_color=color;style.border_color=Color("8bb5c9");style.set_border_width_all(1);style.set_corner_radius_all(12)
	style.content_margin_left=12;style.content_margin_right=12;style.content_margin_top=8;style.content_margin_bottom=8;return style

func _place(key: String,control: Control,parent: Node) -> Control:
	controls[key]=control;parent.add_child(control);return control

func _touch(control: Control) -> void:
	control.show();var parent: Node=control.get_parent();var index:=0
	for sibling in parent.get_children():
		if sibling==control:continue
		if sibling.visible and sibling in content_order:index+=1
	parent.move_child(control,index);content_order.append(control)

func _label(key: String,value: String,parent: Node=null,font_size: int=14) -> Label:
	if not parent:parent=body
	var label: Label=controls.get(key)
	if not label:
		label=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.add_theme_color_override("font_color",Color("27536a"));_place(key,label,parent)
		if parent==header:label.autowrap_mode=TextServer.AUTOWRAP_OFF;label.clip_text=true;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	if label.text!=value:label.text=value
	label.add_theme_font_size_override("font_size",font_size);_touch(label);return label

func _button(action: Dictionary,parent: Node,key: String="") -> Button:
	if key.is_empty():key="button:"+str(action.key)
	var button: Button=controls.get(key)
	if not button:
		button=Button.new();button.custom_minimum_size.y=42;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		button.add_theme_stylebox_override("normal",_style(Color(1,1,1,.85)));button.add_theme_stylebox_override("hover",_style(Color("e2f3fb")));button.add_theme_stylebox_override("pressed",_style(Color("c6e6f5")));button.add_theme_stylebox_override("disabled",_style(Color("dde6ea")))
		button.add_theme_color_override("font_color",Color("27536a"));button.add_theme_font_size_override("font_size",13);button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		if parent==header:button.autowrap_mode=TextServer.AUTOWRAP_OFF;button.clip_text=true
		button.pressed.connect(func():command_requested.emit(str(button.get_meta("action"))));_place(key,button,parent)
	button.set_meta("action",action.key);commands[action.key]=button;button.text=action.label;button.disabled=action.disabled;_touch(button);return button

func _field(key: String,value: String,limit: int) -> LineEdit:
	var input: LineEdit=controls.get("input:"+key)
	if not input:
		input=LineEdit.new();input.max_length=limit;input.custom_minimum_size.y=42;input.add_theme_stylebox_override("normal",_style(Color.WHITE));input.add_theme_stylebox_override("focus",_style(Color("e2f3fb")));input.add_theme_color_override("font_color",Color("27536a"))
		input.text_changed.connect(func(text):input_changed.emit(key,text));_place("input:"+key,input,body)
	if input.text!=value:input.text=value
	_touch(input);return input

func _member(key: String,member: Dictionary) -> void:
	var row: HBoxContainer=controls.get(key)
	if not row:
		row=HBoxContainer.new();row.add_theme_constant_override("separation",8);_place(key,row,body)
		var image:=TextureRect.new();image.custom_minimum_size=Vector2(36,36);image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;row.add_child(image)
		var label:=Label.new();label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.add_theme_color_override("font_color",Color("27536a"));row.add_child(label)
	row.get_child(0).texture=textures.get(member.portrait);row.get_child(1).text=member.name+"  ·  "+member.location;_touch(row)

func apply(value: Dictionary,loaded: Dictionary) -> void:
	model=value;textures=loaded;commands.clear();content_order.clear()
	for control in controls.values():control.hide()
	var back_button:=_button(model.back,header,"header:back");back_button.size_flags_horizontal=Control.SIZE_SHRINK_BEGIN;back_button.custom_minimum_size.x=142
	_label("header:title",model.heading,header,18)
	var selected: Dictionary=model.selected if model.selected!=null else {}
	var next_mode: String=model.mode+":"+str(selected.get("id",""))
	if next_mode!=mode_key:scroll.scroll_vertical=0;mode_key=next_mode
	if model.mode=="list":
		var refresh_button:=_button(model.refresh,header,"header:refresh");refresh_button.size_flags_horizontal=Control.SIZE_SHRINK_END;refresh_button.custom_minimum_size.x=96
		for action in model.tabs:_button(action,tabs)
		_label("hint",model.hint,body,12)
		if model.cards.is_empty():_label("empty",model.empty)
		for card in model.cards:
			var label: String=card.title+"\n"+card.meta+"\n"+card.summary
			var action: Dictionary=card.select.duplicate();action.label=label
			var button:=_button(action,body);button.alignment=HORIZONTAL_ALIGNMENT_LEFT;button.custom_minimum_size.y=96
		_button(model.importAction,footer)
	elif model.mode=="remove":
		_label("remove:name",model.removal.name,body,19);_label("remove:scope",model.removal.scope)
		for action in model.removal.actions:_button(action,footer)
	elif model.mode=="import":
		if not model.importing.notes.is_empty():_label("import:note:0",model.importing.notes[0],body,13)
		_label("import:local-label","這台裝置中屬於你的舊紀錄")
		var options: OptionButton=controls.get("import:select")
		if not options:
			options=OptionButton.new();options.custom_minimum_size.y=42;options.fit_to_longest_item=false;options.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
			options.add_theme_stylebox_override("normal",_style(Color.WHITE));options.add_theme_color_override("font_color",Color("27536a"));_place("import:select",options,body)
			options.item_selected.connect(func(index):input_changed.emit("campaignLocalSave",str(options.get_item_metadata(index))))
		var fingerprint:=JSON.stringify(model.importing.options)
		if str(options.get_meta("fingerprint",""))!=fingerprint:
			options.clear();options.set_meta("fingerprint",fingerprint)
			for option in model.importing.options:options.add_item(option.label);options.set_item_metadata(options.item_count-1,option.value)
		for i in range(options.item_count):
			if str(options.get_item_metadata(i))==model.importing.value:options.select(i)
		_touch(options);_button(model.importing.local,body)
		_label("import:room-label","原存檔房號");_field("campaignLegacyRoom",model.importing.legacyValue,32);_button(model.importing.legacy,body)
		if not model.importing.validation.is_empty():_label("import:validation",model.importing.validation,body,13).add_theme_color_override("font_color",Color("a53d32"))
		for i in range(1,model.importing.notes.size()):_label("import:note:"+str(i),model.importing.notes[i],body,13)
	elif not selected.is_empty():
		_label("record:title",selected.title,body,18)
		if model.mode=="manage":
			_label("manage:name-label","紀錄名稱");_field(selected.name.key,selected.name.value,60);_button(selected.rename,body)
			for i in range(selected.notes.size()):_label("manage:note:"+str(i),selected.notes[i],body,13)
			for backup in selected.backups:
				var action: Dictionary=backup.action.duplicate();action.label=backup.text+"\n"+action.label;_button(action,body).custom_minimum_size.y=66
			if selected.legacy!=null:_button(selected.legacy,body)
		else:
			_label("record:meta",selected.meta,body,12);_label("record:summary",selected.summary)
			for i in range(selected.members.size()):_member("member:"+str(i),selected.members[i])
			if selected.managementVisible:_button(selected.manage,body)
			for action in selected.buttons:_button(action,footer)
	_layout()

func _layout() -> void:
	panel.position=Vector2.ZERO;panel.size=size
	header.position=Vector2(12,8);header.size=Vector2(size.x-24,42)
	tabs.visible=model.get("mode","")=="list";tabs.position=Vector2(12,58);tabs.size=Vector2(size.x-24,40)
	footer.position=Vector2(12,size.y-52);footer.size=Vector2(size.x-24,42)
	var top: float=106 if tabs.visible else 60
	var end: float=size.y-60 if footer.get_children().any(func(c):return c.visible) else size.y-12
	scroll.position=Vector2(12,top);scroll.size=Vector2(size.x-24,maxf(40,end-top))

func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for control in [header,tabs,footer,scroll]:
		if control.visible and not bounds.encloses(Rect2(control.position,control.size)):return false
	for row in [header,tabs,footer]:
		if not row.visible:continue
		for child in row.get_children():
			if child.visible and not Rect2(Vector2.ZERO,row.size).encloses(Rect2(child.position,child.size)):return false
	if header.size.y>42 or header.position.y+header.size.y>scroll.position.y:return false
	return true

func test_press(key: String) -> bool:
	var button: Button=commands.get(key)
	if not button or not button.is_visible_in_tree() or button.disabled:return false
	if button.get_parent()==body and not scroll.get_global_rect().has_point(button.get_global_rect().get_center()):return false
	button.pressed.emit();return true

func test_reveal(key: String) -> void:
	var button: Button=commands.get(key)
	if button and button.get_parent()==body:scroll.ensure_control_visible(button)

func test_input(key: String,value: String) -> bool:
	var input: LineEdit=controls.get("input:"+key)
	if not input or not input.is_visible_in_tree():return false
	input.grab_focus();input.text=value;input.caret_column=value.length();input.text_changed.emit(value);return true

func test_identity(key: String) -> int:
	var input: LineEdit=controls.get("input:"+key)
	return input.get_instance_id() if input else 0
