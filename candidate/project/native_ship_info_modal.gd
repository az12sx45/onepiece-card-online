extends Control
## Four source tabs; fixed actions, aspect-preserved vessel and scrolling data.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var vessel:=TextureRect.new()
var caption:=Label.new()
var status:=Label.new()
var scroll:=ScrollContainer.new()
var content:=VBoxContainer.new()
var tabs: Dictionary={}
var actions: Dictionary={}
var rows: Array[Dictionary]=[]
var epoch:=0
var textures: Dictionary={}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=13;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,subtitle,caption,status]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_color",Color("ffe8b2"));add_child(label)
	title.add_theme_font_size_override("font_size",21);subtitle.add_theme_font_size_override("font_size",12);status.add_theme_font_size_override("font_size",11);caption.add_theme_font_size_override("font_size",12)
	vessel.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;vessel.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;vessel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(vessel)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_theme_constant_override("separation",8);scroll.add_child(content)
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:surface_ready.emit();return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW,value.vessel];var loaded: Dictionary={}
	for key in ["slots","upgrades","items"]:
		for row in value[key]:
			if not str(row.image).is_empty():paths.append(row.image)
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			var image: Texture2D=cache.request(path)
			if image:loaded[path]=image
			else:ready=false
			if cache.failed.has(path):push_error("Ship info artwork failed: "+str(path));return
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Ship info artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	var reset_scroll: bool=model.get("active","")!=value.active
	model=value;textures=loaded;panel.texture=loaded[PANEL];title.text=value.title;subtitle.text=value.subtitle;vessel.texture=loaded[value.vessel];caption.text=value.owner+"\n"+value.name;status.text=" · ".join(value.status)
	for tab in value.tabs:
		var button: Button=_button(tabs,tab.key);button.text=tab.label;button.modulate=Color.WHITE if tab.selected else Color(.7,.75,.8)
	for action in value.actions:
		var button: Button=_button(actions,action.key);button.text=action.label;button.disabled=action.disabled
	var entries: Array=[]
	match value.active:
		"overview":
			for entry in value.overview:
				var lines: Array=[]
				if not str(entry.headline).is_empty():lines.append({"text":entry.headline,"active":true})
				if not str(entry.text).is_empty():lines.append({"text":entry.text,"active":true})
				for pair in entry.pairs:lines.append({"text":pair.name+"　"+pair.value,"active":true})
				entries.append({"title":entry.title,"image":"","lines":lines})
		"slots":
			for entry in value.slots:entries.append({"title":entry.number+" · "+entry.name+("" if entry.name==entry.status else " · "+entry.status),"image":entry.image,"lines":[{"text":entry.detail,"active":entry.unlocked}]})
		"upgrades":
			for entry in value.upgrades:
				var lines: Array=[]
				for effect in entry.effects:lines.append({"text":effect.level+"　"+effect.text,"active":effect.active})
				for text in [entry.next.title,entry.next.text,entry.next.cost]:lines.append({"text":text,"active":true})
				entries.append({"title":entry.name+" · "+entry.level,"image":entry.image,"lines":lines})
		"items":
			for entry in value.items:entries.append({"title":entry.name+" · "+entry.count,"image":entry.image,"lines":[{"text":entry.rank+" · "+entry.kind,"active":true},{"text":entry.effect,"active":true},{"text":entry.description,"active":true}]})
			if entries.is_empty():entries.append({"title":value.empty,"image":"","lines":[]})
	for row in rows:row.root.hide()
	for index in range(entries.size()):
		var nodes: Dictionary=_row(index);var entry: Dictionary=entries[index];nodes.root.show();nodes.title.text=entry.title;nodes.image.texture=loaded.get(entry.image);nodes.image.visible=not str(entry.image).is_empty()
		while nodes.lines.size()<entry.lines.size():
			var label:=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;nodes.body.add_child(label);nodes.lines.append(label)
		for item in range(nodes.lines.size()):
			var label: Label=nodes.lines[item];label.visible=item<entry.lines.size()
			if label.visible:label.text=entry.lines[item].text;label.modulate=Color.WHITE if entry.lines[item].active else Color(.66,.7,.75)
	_layout();show()
	if reset_scroll:scroll.scroll_vertical=0
	surface_ready.emit()
func _button(collection: Dictionary,key: String) -> Button:
	if collection.has(key):return collection[key]
	var button:=Button.new();button.flat=true;button.set_meta("key",key);button.pressed.connect(func():if visible and not button.disabled:command_requested.emit(str(button.get_meta("key"))));add_child(button);collection[key]=button;_frame(button);return button
func _frame(control: Control) -> void:
	var carrier:=Node2D.new();carrier.show_behind_parent=true;control.add_child(carrier)
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.texture=textures[ROW];frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;carrier.add_child(frame)
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	control.resized.connect(func():frame.size=control.size/.0625);frame.size=control.size/.0625
func _row(index: int) -> Dictionary:
	if index<rows.size():return rows[index]
	var root:=MarginContainer.new();root.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	for side in ["margin_left","margin_right","margin_top","margin_bottom"]:root.add_theme_constant_override(side,12)
	content.add_child(root);_frame(root)
	var horizontal:=HBoxContainer.new();horizontal.add_theme_constant_override("separation",10);root.add_child(horizontal)
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.custom_minimum_size=Vector2(42,46);image.size_flags_vertical=Control.SIZE_SHRINK_BEGIN;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;horizontal.add_child(image)
	var body:=VBoxContainer.new();body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",6);horizontal.add_child(body)
	var heading:=Label.new();heading.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;heading.add_theme_color_override("font_color",Color("ffe8b2"));heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;body.add_child(heading)
	var row: Dictionary={"root":root,"body":body,"image":image,"title":heading,"lines":[]};rows.append(row);return row
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(32,15);title.size=Vector2(size.x-64,28);subtitle.position=Vector2(32,44);subtitle.size=Vector2(size.x-64,22)
	if model.is_empty():return
	var width: float=(size.x-88)/4
	for index in range(model.tabs.size()):var button: Button=tabs[model.tabs[index].key];button.position=Vector2(32+index*(width+8),72);button.size=Vector2(width,32)
	var side: float=clampf(size.x*.26,150,230);var body_height: float=size.y-186
	vessel.position=Vector2(28,112);vessel.size=Vector2(side,body_height-34);caption.position=Vector2(28,112+body_height-34);caption.size=Vector2(side,34)
	scroll.position=Vector2(side+40,112);scroll.size=Vector2(size.x-side-68,body_height)
	status.position=Vector2(28,size.y-71);status.size=Vector2(size.x-56,20)
	var action_width: float=(size.x-76)/2
	for index in range(model.actions.size()):var button: Button=actions[model.actions[index].key];button.position=Vector2(32+index*(action_width+12),size.y-47);button.size=Vector2(action_width,30)
	queue_redraw()
func close_surface() -> void:epoch+=1;hide()
func test_press(key: String) -> bool:
	if not visible:return false
	var button: Button=tabs.get(key,actions.get(key))
	if button==null or button.disabled:return false
	button.pressed.emit();return true
func test_scroll_end() -> void:scroll.scroll_vertical=int(content.size.y)
func test_disabled(key: String) -> bool:return actions[key].disabled
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,subtitle,vessel,caption,status,scroll]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	for button in tabs.values()+actions.values():
		if not bounds.encloses(Rect2(button.position,button.size)):return false
	return content.size.x<=scroll.size.x+1
func test_identity_json() -> String:
	var result: Dictionary={"content":content.get_instance_id()}
	for key in tabs:result[key]=tabs[key].get_instance_id()
	return JSON.stringify(result)
