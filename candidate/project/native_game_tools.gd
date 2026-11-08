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
var audio_heading:=Label.new()
var audio_rows: Dictionary={}
var audio_sample:=Button.new()
var art_deadline:=0
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
	audio_heading.text="航海聲音";audio_heading.add_theme_font_size_override("font_size",18);content.add_child(audio_heading)
	for entry in [["bgm","背景音樂"],["sfx","操作音效"]]:
		var key: String=entry[0]
		var enabled:=CheckButton.new()
		enabled.text=entry[1]
		var volume:=HSlider.new()
		volume.max_value=100
		volume.step=1
		var percent:=Label.new()
		percent.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
		var commit:=Timer.new()
		commit.one_shot=true;commit.wait_time=.18
		volume.add_child(commit)
		for control in [enabled,volume,percent]:content.add_child(control)
		enabled.toggled.connect(func(value: bool):command_requested.emit("audio:"+key+":enabled",str(value)))
		volume.value_changed.connect(func(value: float):
			percent.text=str(roundi(value))+"%"
			commit.start())
		commit.timeout.connect(func():command_requested.emit("audio:"+key+":volume",str(roundi(volume.value))))
		audio_rows[key]={"enabled":enabled,"volume":volume,"percent":percent,"commit":commit}
	audio_sample.text="試聽音效";content.add_child(audio_sample)
	audio_sample.pressed.connect(func():command_requested.emit("audio:sample",""))
	resized.connect(_layout);hide();drawer.hide();set_process(false)

func _draw() -> void:
	if drawer.visible:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model:return
	model=next
	if not model.available:close_surface();return
	hud.prepare(model.turn,cache)
	art_deadline=Time.get_ticks_msec()+15000
	_update_controls()
	_process(0)

func _process(_delta: float) -> void:
	panel.texture=cache.request(PANEL)
	row_texture=cache.request(ROW)
	for button: Button in buttons.values():
		button.get_meta("frame").texture=row_texture
		button.flat=row_texture!=null
	set_process(Time.get_ticks_msec()<art_deadline and ((not panel.texture and not cache.failed.has(PANEL)) or (not row_texture and not cache.failed.has(ROW))))

func _update_controls() -> void:
	status.text=str(model.status)
	for button in buttons.values():button.hide()
	for action in model.actions:
		if not buttons.has(action.key):
			var button:=Button.new();button.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;button.set_meta("key",action.key);button.add_theme_color_override("font_color",Color("fff3da"));content.add_child(button)
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
	var audio: Dictionary=model.get("audio",{})
	audio_heading.visible=not audio.is_empty()
	audio_sample.visible=audio_heading.visible
	for key: String in audio_rows:
		var row: Dictionary=audio_rows[key]
		for control: Control in [row.enabled,row.volume,row.percent]:control.visible=audio.has(key)
		if not audio.has(key):continue
		row.enabled.set_pressed_no_signal(audio[key].enabled)
		if row.commit.is_stopped():
			row.volume.set_value_no_signal(audio[key].volume)
			row.percent.text=str(audio[key].volume)+"%"
	drawer.visible=model.open;hud.visible=not model.open;toggle.visible=not model.open;turn.visible=not model.open;_layout();show()

func _layout() -> void:
	hud.layout_physical(size)
	var margin:=clampf(size.x*.04,12,30)
	drawer.size=size;panel.size=size/.125
	heading.position=Vector2(margin,12);heading.size=Vector2(size.x-112-margin*2,38)
	back.position=Vector2(size.x-96-margin,10);back.size=Vector2(96,44)
	scroll.position=Vector2(margin,60);scroll.size=Vector2(size.x-margin*2,maxf(44,size.y-116))
	status.position=Vector2(margin,size.y-48);status.size=Vector2(size.x-margin*2,42)
	if model.is_empty():return
	var content_width:=scroll.size.x-14
	var columns:=2 if content_width>=360 else 1
	var gap:=10.0
	var width:=(content_width-gap*(columns-1))/columns
	for i in range(model.actions.size()):
		if not buttons.has(model.actions[i].key):continue
		var button: Button=buttons[model.actions[i].key]
		button.position=Vector2((i%columns)*(width+gap),floorf(float(i)/columns)*52)
		button.size=Vector2(width,46);button.get_meta("frame").size=button.size/.0625
	var bottom:=ceilf(float(model.actions.size())/columns)*52
	if model.cpu.visible:
		speed_label.position=Vector2(4,bottom);speed_label.size=Vector2(width-4,42)
		if columns==1:bottom+=42
		speed.position=Vector2((columns-1)*(width+gap),bottom);speed.size=Vector2(width,44);bottom+=52
	if audio_heading.visible:
		audio_heading.position=Vector2(4,bottom+8);audio_heading.size=Vector2(content_width-8,30);bottom+=42
		for key: String in audio_rows:
			var row: Dictionary=audio_rows[key]
			row.enabled.position=Vector2(4,bottom);row.enabled.size=Vector2(content_width-52,44)
			row.percent.position=Vector2(content_width-50,bottom);row.percent.size=Vector2(42,44);row.percent.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
			row.volume.position=Vector2(8,bottom+42);row.volume.size=Vector2(content_width-16,44);bottom+=90
		audio_sample.position=Vector2(4,bottom);audio_sample.size=Vector2(width-4,46);bottom+=54
	content.custom_minimum_size=Vector2(content_width,bottom)
	queue_redraw()

func close_surface() -> void:
	set_process(false);hud.set_process(false);hide()
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
