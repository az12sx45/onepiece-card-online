extends Control
## Full-screen phone command page using existing phone artwork. Original ship
## portrait, labels, icons, options and handlers come from the source template.
signal command_requested(kind: String, value: Dictionary)
signal surface_ready
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var title:=Label.new()
var summary:=Label.new()
var vessel:=TextureRect.new()
var vessel_name:=Label.new()
var close:=Button.new()
var selectors: Dictionary={}
var actions: Dictionary={}
var epoch:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(600);t.default_font_size=14;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,summary,vessel_name]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("ffe8b2"));label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;add_child(label)
	title.add_theme_font_size_override("font_size",22);summary.add_theme_font_size_override("font_size",13)
	vessel.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;vessel.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;vessel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(vessel)
	close.text="返回";add_child(close);close.pressed.connect(func():command_requested.emit("cpu-ship-close",{}))
	resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png",value.vessel];var loaded: Dictionary={}
	for action in value.actions:paths.append(action.icon)
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			var image: Texture2D=cache.request(path)
			if image:loaded[path]=image
			else:ready=false
			if cache.failed.has(path):push_error("CPU ship artwork failed: "+str(path));return
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("CPU ship artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;panel.texture=loaded[paths[0]];title.text=value.title;summary.text=value.summary;vessel.texture=loaded[value.vessel];vessel_name.text=value.vesselName
	_skin_control(close,loaded[paths[1]])
	for entry in value.selects:
		if not selectors.has(entry.key):
			var label:=Label.new();label.add_theme_color_override("font_color",Color("ffe8b2"));add_child(label)
			var select:=OptionButton.new();select.set_meta("key",entry.key);select.add_theme_color_override("font_color",Color("ffedc6"));select.get_popup().add_theme_constant_override("v_separation",12);add_child(select)
			select.item_selected.connect(func(index):if visible:command_requested.emit("cpu-ship-change",{"playerId":model.playerId,"key":select.get_meta("key"),"value":str(select.get_item_metadata(index))}))
			selectors[entry.key]={"label":label,"select":select}
		var nodes: Dictionary=selectors[entry.key];nodes.label.text=entry.label
		var select: OptionButton=nodes.select
		_skin_control(select,loaded[paths[1]])
		if select.get_meta("options",[])!=entry.options:
			select.clear()
			for option in entry.options:select.add_item(option.label);select.set_item_metadata(select.item_count-1,option.value)
			select.set_meta("options",entry.options)
		for index in range(select.item_count):
			if str(select.get_item_metadata(index))==str(entry.value):select.select(index)
	for entry in value.actions:
		if not actions.has(entry.key):
			var button:=Button.new();button.flat=true;button.set_meta("key",entry.key);button.add_theme_color_override("font_color",Color("fff0cc"));add_child(button)
			var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
			for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
			button.add_child(frame);button.set_meta("frame",frame)
			button.pressed.connect(func():if visible:command_requested.emit("cpu-ship-action",{"playerId":model.playerId,"key":button.get_meta("key")}))
			actions[entry.key]=button
		var button: Button=actions[entry.key];button.text=entry.label;button.icon=loaded[entry.icon];button.expand_icon=true;button.add_theme_constant_override("icon_max_width",30);button.get_meta("frame").texture=loaded[paths[1]]
	_layout();show();surface_ready.emit()

func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(32,22);title.size=Vector2(size.x-160,32);title.clip_text=true;summary.position=Vector2(32,55);summary.size=Vector2(size.x-64,26)
	close.position=Vector2(size.x-112,24);close.size=Vector2(78,36)
	if close.has_meta("frame"):close.get_meta("frame").size=close.size/.0625
	var body_height: float=maxf(125,size.y-155);vessel.position=Vector2(40,85);vessel.size=Vector2(size.x*.36,body_height-25);vessel_name.position=Vector2(40,85+body_height-25);vessel_name.size=Vector2(size.x*.36,25)
	if model.is_empty():return
	for index in range(model.selects.size()):
		var nodes: Dictionary=selectors[model.selects[index].key];var x: float=size.x*.48;var y: float=88+index*70
		nodes.label.position=Vector2(x,y);nodes.label.size=Vector2(size.x-x-42,22);nodes.select.position=Vector2(x,y+24);nodes.select.size=Vector2(size.x-x-42,38)
		if nodes.select.has_meta("frame"):nodes.select.get_meta("frame").size=nodes.select.size/.0625
	var width: float=(size.x-88)/3.0
	for index in range(model.actions.size()):
		var button: Button=actions[model.actions[index].key];button.position=Vector2(32+index*(width+12),size.y-58);button.size=Vector2(width,36);button.get_meta("frame").size=button.size/.0625
	queue_redraw()
func _skin_control(control: Button,texture: Texture2D) -> void:
	if not control.has_meta("frame"):
		var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
		for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
		control.add_child(frame);control.set_meta("frame",frame)
		for state in ["normal","pressed","disabled","focus"]:control.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		var hover:=StyleBoxFlat.new();hover.bg_color=Color(1,.8,.3,.12);control.add_theme_stylebox_override("hover",hover)
	control.get_meta("frame").texture=texture
func close_surface() -> void:
	epoch+=1
	for nodes in selectors.values():nodes.select.get_popup().hide()
	hide()
func test_select(key: String,value: String) -> bool:
	if not visible or not selectors.has(key):return false
	var select: OptionButton=selectors[key].select
	for index in range(select.item_count):
		if str(select.get_item_metadata(index))==value:select.select(index);select.item_selected.emit(index);return true
	return false
func test_action(key: String) -> bool:
	if not visible or not actions.has(key):return false
	actions[key].pressed.emit();return true
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,summary,vessel,vessel_name,close]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	for nodes in selectors.values():
		for node in nodes.values():
			if not bounds.encloses(Rect2(node.position,node.size)):return false
	for button in actions.values():
		if not bounds.encloses(Rect2(button.position,button.size)):return false
	return true
