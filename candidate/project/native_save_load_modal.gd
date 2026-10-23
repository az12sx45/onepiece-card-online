extends Control
## Original save messages/actions, fixed mobile action tray and scrolling body.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ACTION="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var body:=RichTextLabel.new()
var buttons: Dictionary={}
var epoch:=0
var reward_scroll:=ScrollContainer.new()
var reward_list:=VBoxContainer.new()
var scenery:=TextureRect.new()
var reading_frame:=NinePatchRect.new()

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=14;theme=t
	scenery.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;scenery.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;scenery.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(scenery);scenery.hide()
	reading_frame.scale=Vector2.ONE*.125;reading_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:reading_frame.set_patch_margin(side,224)
	add_child(reading_frame);reading_frame.hide()
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [heading,subtitle]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.clip_text=true;label.add_theme_color_override("font_color",Color("ffe4a9"));add_child(label)
	heading.add_theme_font_size_override("font_size",23);subtitle.add_theme_font_size_override("font_size",13)
	body.bbcode_enabled=false;body.scroll_active=true;body.add_theme_color_override("default_color",Color("fff3da"));add_child(body)
	reward_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(reward_scroll)
	reward_list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;reward_list.add_theme_constant_override("separation",10);reward_scroll.add_child(reward_list)
	resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:surface_ready.emit();return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ACTION]
	if value.get("kind","")=="marineford-entry":paths.append(value.background)
	var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Save screen asset failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Save screen asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;panel.texture=loaded[PANEL];heading.text=value.title;subtitle.text=value.subtitle
	var is_entry: bool=value.kind=="marineford-entry"
	scenery.visible=is_entry;reading_frame.visible=is_entry;panel.draw_center=not is_entry
	scenery.texture=loaded.get(value.get("background",""));reading_frame.texture=loaded[PANEL]
	if body.text!=value.body:body.text=value.body;body.scroll_to_line(0)
	body.visible=value.kind!="spectator-rewards";reward_scroll.visible=not body.visible
	for child in reward_list.get_children():reward_list.remove_child(child);child.queue_free()
	for entry in value.get("cards",[]):
		var card:=PanelContainer.new();card.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		var frame:=StyleBoxFlat.new();frame.bg_color=Color("122f3d");frame.border_color=Color("b79b64");frame.set_border_width_all(1);frame.set_content_margin_all(12);frame.set_corner_radius_all(5);card.add_theme_stylebox_override("panel",frame)
		var lines:=VBoxContainer.new();card.add_child(lines)
		for copy in [entry.tier,entry.name,entry.detail]:
			if copy.is_empty():continue
			var label:=Label.new();label.text=copy;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.add_theme_color_override("font_color",Color("ffe4a9") if copy==entry.name else Color("fff3da"));lines.add_child(label)
		reward_list.add_child(card)
	for button in buttons.values():button.hide()
	for action in value.actions:
		if not buttons.has(action.key):
			var button:=Button.new();button.flat=true;button.set_meta("key",action.key);button.add_theme_font_size_override("font_size",14);add_child(button)
			var frame:=NinePatchRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.show_behind_parent=true
			for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
			button.add_child(frame);button.set_meta("frame",frame)
			button.pressed.connect(func():if visible and not button.disabled:command_requested.emit(str(button.get_meta("key"))))
			buttons[action.key]=button
		var button: Button=buttons[action.key];button.text=action.label;button.disabled=action.get("disabled",false);button.get_meta("frame").texture=loaded[ACTION];button.show()
	_layout();show();surface_ready.emit()

func _layout() -> void:
	panel.size=size/.125;queue_redraw()
	scenery.size=size
	if model.is_empty():return
	heading.position=Vector2(30,20);heading.size=Vector2(size.x-60,30);subtitle.position=Vector2(30,52);subtitle.size=Vector2(size.x-60,22)
	if model.actions.is_empty():
		body.position=Vector2(38,86);body.size=Vector2(size.x-76,maxf(40,size.y-116));return
	var columns: int=2 if size.x<850 and model.actions.size()>2 else model.actions.size();var rows:=ceili(float(model.actions.size())/columns)
	var footer:=size.y-20-rows*44-(rows-1)*6;var width: float=(size.x-64-(columns-1)*8)/columns
	body.position=Vector2(38,86);body.size=Vector2(size.x-76,maxf(40,footer-98))
	if model.kind=="marineford-entry":
		reading_frame.position=Vector2(size.x*.48,72);reading_frame.size=Vector2(size.x*.52-28,footer-82)/.125
		body.position=reading_frame.position+Vector2(18,16);body.size=reading_frame.size*.125-Vector2(36,32)
	reward_scroll.position=body.position;reward_scroll.size=body.size
	for i in range(model.actions.size()):
		var button: Button=buttons[model.actions[i].key];button.position=Vector2(32+(i%columns)*(width+8),footer+floorf(float(i)/columns)*50);button.size=Vector2(width,44);button.get_meta("frame").size=button.size/.0625

func close_surface() -> void:epoch+=1;hide()
func test_reveal_button(key: String) -> bool:return visible and buttons.has(key) and buttons[key].visible and not buttons[key].disabled
func test_button_rect_json(key: String) -> String:
	if not test_reveal_button(key):return "null"
	var r: Rect2=buttons[key].get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_press(key: String) -> bool:
	if not visible or not buttons.has(key) or not buttons[key].visible or buttons[key].disabled:return false
	buttons[key].pressed.emit();return true
func test_layout() -> bool:
	var viewport:=Rect2(Vector2.ZERO,size)
	for button in buttons.values():
		if button.visible and (not viewport.encloses(Rect2(button.position,button.size)) or body.position.y+body.size.y>button.position.y or button.size.y<40):return false
	return true
func test_ready() -> bool:return visible and not model.is_empty()
func test_layout_json() -> String:return JSON.stringify({"bounded":test_layout(),"readingClear":test_layout()})
func test_actions_json() -> String:
	var result: Array=[]
	for action in model.actions:result.append({"key":action.key,"label":buttons[action.key].text,"disabled":buttons[action.key].disabled})
	return JSON.stringify(result)
