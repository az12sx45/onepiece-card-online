extends Control
## Source-backed fleet roles with independent navigation/detail scroll areas.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var nav_scroll:=ScrollContainer.new()
var nav:=VBoxContainer.new()
var detail_scroll:=ScrollContainer.new()
var detail:=VBoxContainer.new()
var detail_heading:=Label.new()
var detail_count:=Label.new()
var inherent:=Label.new()
var current:=Label.new()
var kpis: Array[Dictionary]=[]
var roles: Dictionary={}
var stages: Array[Dictionary]=[]
var actions: Dictionary={}
var epoch:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=13;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,subtitle]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.clip_text=true;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",21);title.add_theme_color_override("font_color",Color("ffe8b2"));subtitle.add_theme_font_size_override("font_size",12)
	for index in range(4):
		var icon:=TextureRect.new();icon.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;icon.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;icon.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(icon)
		var label:=Label.new();label.add_theme_font_size_override("font_size",11);label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label);kpis.append({"icon":icon,"label":label})
	for scroll in [nav_scroll,detail_scroll]:scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	nav.size_flags_horizontal=Control.SIZE_EXPAND_FILL;nav.add_theme_constant_override("separation",6);nav_scroll.add_child(nav)
	detail.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail.add_theme_constant_override("separation",8);detail_scroll.add_child(detail)
	for label in [detail_heading,detail_count,inherent]:_text(label);detail.add_child(label)
	detail_heading.add_theme_font_size_override("font_size",17);detail_heading.add_theme_color_override("font_color",Color("ffe8b2"));detail_count.add_theme_font_size_override("font_size",12)
	for index in range(3):
		var box:=MarginContainer.new();detail.add_child(box)
		for side in ["margin_left","margin_right","margin_top","margin_bottom"]:box.add_theme_constant_override(side,10)
		var inner:=VBoxContainer.new();inner.add_theme_constant_override("separation",6);box.add_child(inner)
		var heading:=Label.new();_text(heading);heading.add_theme_font_size_override("font_size",14);inner.add_child(heading)
		var text:=Label.new();_text(text);inner.add_child(text)
		stages.append({"box":box,"heading":heading,"text":text})
	_text(current);current.add_theme_color_override("font_color",Color("efce86"));detail.add_child(current)
	resized.connect(_layout);hide()
func _text(label: Label) -> void:
	label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:surface_ready.emit();return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW];var loaded: Dictionary={}
	for item in value.kpis:paths.append(item.icon)
	for item in value.entries:paths.append(item.icon)
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			var image: Texture2D=cache.request(path)
			if image:loaded[path]=image
			else:ready=false
			if cache.failed.has(path):push_error("Fleet artwork failed: "+str(path));return
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Fleet artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	var changed_role: bool=model.get("detail",{}).get("title","")!=value.detail.title
	model=value;panel.texture=loaded[PANEL];title.text=value.title;subtitle.text=value.subtitle
	for index in range(value.kpis.size()):kpis[index].icon.texture=loaded[value.kpis[index].icon];kpis[index].label.text=value.kpis[index].label+"\n"+value.kpis[index].value
	for entry in value.entries:
		if not roles.has(entry.key):
			var button:=Button.new();button.flat=true;button.custom_minimum_size.y=60;button.expand_icon=true;button.add_theme_constant_override("icon_max_width",40);button.add_theme_font_size_override("font_size",11);button.set_meta("key",entry.key);button.pressed.connect(func():if visible:command_requested.emit(str(button.get_meta("key"))));nav.add_child(button);roles[entry.key]=button;_frame(button,loaded[ROW])
		var button: Button=roles[entry.key];button.icon=loaded[entry.icon];button.text=entry.title+" · "+entry.status+"\n"+entry.count;button.modulate=Color.WHITE if entry.selected else Color(.72,.76,.8);button.tooltip_text=entry.count
	detail_heading.text=value.detail.title;detail_count.text=value.detail.count;inherent.text=value.detail.inherent;current.text="目前生效\n"+value.detail.current
	for index in range(3):
		var entry: Dictionary=value.detail.stages[index];var nodes: Dictionary=stages[index];nodes.heading.text=entry.title+" · "+entry.status;nodes.text.text=entry.text;nodes.box.modulate=Color.WHITE if entry.active else Color(.72,.76,.8);_frame(nodes.box,loaded[ROW])
	for entry in value.actions:
		if not actions.has(entry.key):
			var button:=Button.new();button.flat=true;button.set_meta("key",entry.key);button.pressed.connect(func():if visible and not button.disabled:command_requested.emit(str(button.get_meta("key"))));add_child(button);actions[entry.key]=button;_frame(button,loaded[ROW])
		actions[entry.key].text=entry.label;actions[entry.key].disabled=entry.disabled
	_layout();show()
	if changed_role:detail_scroll.scroll_vertical=0
	surface_ready.emit()
func _frame(control: Control,texture: Texture2D) -> void:
	if control.has_meta("frame"):return
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.texture=texture;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	var carrier:=Node2D.new();carrier.show_behind_parent=true;control.add_child(carrier);carrier.add_child(frame);control.set_meta("frame",frame);control.resized.connect(func():frame.size=control.size/.0625);frame.size=control.size/.0625
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(32,16);title.size=Vector2(size.x-64,30);subtitle.position=Vector2(32,47);subtitle.size=Vector2(size.x-64,22)
	var kpi_width: float=(size.x-64)/4
	for index in range(4):kpis[index].icon.position=Vector2(32+index*kpi_width,74);kpis[index].icon.size=Vector2(26,32);kpis[index].label.position=Vector2(62+index*kpi_width,74);kpis[index].label.size=Vector2(kpi_width-36,38)
	var nav_width: float=clampf(size.x*.33,210,300);nav_scroll.position=Vector2(28,118);nav_scroll.size=Vector2(nav_width,size.y-181);detail_scroll.position=Vector2(40+nav_width,118);detail_scroll.size=Vector2(size.x-nav_width-68,size.y-181)
	if model.is_empty():return
	var width: float=(size.x-88)/3
	for index in range(model.actions.size()):var button: Button=actions[model.actions[index].key];button.position=Vector2(32+index*(width+12),size.y-54);button.size=Vector2(width,32)
	queue_redraw()
func close_surface() -> void:epoch+=1;hide()
func test_press(key: String) -> bool:
	if not visible:return false
	var button: Button=roles.get(key,actions.get(key))
	if button==null or button.disabled:return false
	if roles.has(key):nav_scroll.ensure_control_visible(button)
	button.pressed.emit();return true
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,subtitle,nav_scroll,detail_scroll]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	for button in actions.values():
		if not bounds.encloses(Rect2(button.position,button.size)):return false
	return detail.size.x<=detail_scroll.size.x+1 and nav.size.x<=nav_scroll.size.x+1
func test_scroll_end() -> void:detail_scroll.scroll_vertical=int(detail.size.y)
func test_identity_json() -> String:
	var result: Dictionary={"detail":detail.get_instance_id()}
	for key in roles:result[key]=roles[key].get_instance_id()
	return JSON.stringify(result)
