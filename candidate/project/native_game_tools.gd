extends Control
## Original map tools in a persistent native drawer; no controls over story or
## battle scenes. Fixed frame, scrolling actions, source-owned labels/locks.
signal command_requested(key: String,value: String)
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var hud:=preload("res://native_map_hud.gd").new()
var toggle: Button=hud.toggle
var turn: Label=hud.turn
var drawer:=Control.new()
var panel:=NinePatchRect.new()
var heading:=Label.new()
var back:=Button.new()
var scroll:=ScrollContainer.new()
var content:=Control.new()
var status:=Label.new()
var speed:=OptionButton.new()
var speed_label:=Label.new()
var buttons: Dictionary={}
var epoch:=0
var row_texture: Texture2D

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=14;theme=t
	add_child(hud)
	toggle.pressed.connect(func():command_requested.emit("boardToolsToggle",""))
	drawer.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(drawer)
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	drawer.add_child(panel)
	heading.text="地圖工具";heading.add_theme_font_size_override("font_size",22);heading.add_theme_color_override("font_color",Color("ffe4a9"));drawer.add_child(heading)
	back.text="返回";drawer.add_child(back);back.pressed.connect(func():command_requested.emit("boardToolsToggle",""))
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;drawer.add_child(scroll);scroll.add_child(content)
	content.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;status.add_theme_font_size_override("font_size",12);status.add_theme_color_override("font_color",Color("ffe4a9"));drawer.add_child(status)
	speed_label.add_theme_color_override("font_color",Color("fff3da"));content.add_child(speed_label);content.add_child(speed)
	speed.item_selected.connect(func(index):if visible and not speed.disabled:command_requested.emit("cpuSpeedSelect",str(speed.get_item_metadata(index))))
	resized.connect(_layout);hide();drawer.hide()

func _draw() -> void:
	if drawer.visible:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model:return
	model=next;epoch+=1
	if not model.available:hide();return
	_prepare(epoch)

func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		panel.texture=cache.request(PANEL);row_texture=cache.request(ROW)
		if panel.texture and row_texture:break
		if cache.failed.has(PANEL) or cache.failed.has(ROW) or Time.get_ticks_msec()>deadline:push_error("Native game tool artwork unavailable");return
		await get_tree().process_frame
	if token!=epoch:return
	if not await hud.prepare(model.turn,cache) or token!=epoch:return
	status.text=str(model.status)
	for button in buttons.values():button.hide()
	for action in model.actions:
		if not buttons.has(action.key):
			var button:=Button.new();button.flat=true;button.set_meta("key",action.key);button.add_theme_color_override("font_color",Color("fff3da"));content.add_child(button)
			var frame:=NinePatchRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.show_behind_parent=true
			for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
			button.add_child(frame);button.set_meta("frame",frame);button.pressed.connect(func():if visible and drawer.visible and not button.disabled:command_requested.emit(str(button.get_meta("key")),""));buttons[action.key]=button
		var button: Button=buttons[action.key];button.text=action.label;button.disabled=action.disabled;button.get_meta("frame").texture=row_texture;button.show()
	if speed.get_meta("options",[])!=model.cpu.options:
		speed.clear()
		for option in model.cpu.options:speed.add_item(str(option.label));speed.set_item_metadata(speed.item_count-1,str(option.value))
		speed.set_meta("options",model.cpu.options)
	for index in range(speed.item_count):
		if str(speed.get_item_metadata(index))==str(model.cpu.value):speed.select(index)
	speed.disabled=model.cpu.disabled;speed.visible=model.cpu.visible;speed_label.visible=model.cpu.visible;speed_label.text="CPU 回合倍速 · "+str(model.cpu.hint)
	drawer.visible=model.open;hud.visible=not model.open;toggle.visible=not model.open;turn.visible=not model.open;_layout();show()

func _layout() -> void:
	hud.layout_physical(size)
	drawer.size=size;panel.size=size/.125;heading.position=Vector2(30,20);heading.size=Vector2(size.x-170,30);back.position=Vector2(size.x-126,16);back.size=Vector2(96,40)
	content.custom_minimum_size.x=0
	scroll.position=Vector2(30,68);scroll.size=Vector2(size.x-60,maxf(80,size.y-126));status.position=Vector2(34,size.y-48);status.size=Vector2(size.x-68,34)
	if model.is_empty():return
	var width: float=(scroll.size.x-24)/2
	for i in range(model.actions.size()):
		if not buttons.has(model.actions[i].key):continue
		var button: Button=buttons[model.actions[i].key];button.position=Vector2((i%2)*(width+10),floorf(float(i)/2)*52);button.size=Vector2(width,44);button.get_meta("frame").size=button.size/.0625
	var rows:=ceili(float(model.actions.size())/2);var bottom: float=rows*52
	speed_label.position=Vector2(4,bottom);speed_label.size=Vector2(width,42);speed.position=Vector2(width+10,bottom);speed.size=Vector2(width,42)
	content.custom_minimum_size=Vector2(scroll.size.x-14,bottom+(48 if model.cpu.visible else 0));queue_redraw()

func close_surface() -> void:epoch+=1;hide()
func test_reveal_button(key: String) -> bool:
	if not visible or not drawer.visible or not buttons.has(key) or buttons[key].disabled:return false
	scroll.ensure_control_visible(buttons[key]);return true
func test_button_rect_json(key: String) -> String:
	if not visible or not drawer.visible or not buttons.has(key):return "null"
	var r: Rect2=buttons[key].get_global_rect()
	if not scroll.get_global_rect().encloses(r):return "null"
	return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_press(key: String) -> bool:
	if not visible:return false
	if key=="boardToolsToggle":
		if drawer.visible:back.pressed.emit()
		else:toggle.pressed.emit()
		return true
	if not drawer.visible or not buttons.has(key) or buttons[key].disabled:return false
	var button: Button=buttons[key];scroll.ensure_control_visible(button)
	if not scroll.get_global_rect().has_point(button.get_global_rect().get_center()):return false
	button.pressed.emit();return true
func test_layout() -> bool:
	if not visible:return false
	var viewport:=Rect2(Vector2.ZERO,size)
	if not drawer.visible:return viewport.encloses(Rect2(toggle.position,toggle.size)) and viewport.encloses(Rect2(turn.position,turn.size))
	return viewport.encloses(Rect2(scroll.position,scroll.size)) and viewport.encloses(Rect2(back.position,back.size)) and scroll.position.y+scroll.size.y<=status.position.y
func test_layout_json() -> String:
	return JSON.stringify({"visible":visible,"drawer":drawer.visible,"size":[size.x,size.y],"scroll":[scroll.position.x,scroll.position.y,scroll.size.x,scroll.size.y],"back":[back.position.x,back.position.y,back.size.x,back.size.y],"status":[status.position.x,status.position.y,status.size.x,status.size.y]})
