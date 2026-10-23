extends Control
signal source_input(uid: String)
signal confirmation_answer(accepted: bool)
const SourceButton=preload("res://native_boss_prompt_button.gd")
var battle_view: Control
var lanes: Dictionary={}
var controls: Dictionary={}
var packet: Dictionary={}
var dialog:=Control.new()
var dialog_frame:=NinePatchRect.new()
var dialog_copy:=Label.new()
var accept_button:=Button.new()
var cancel_button:=Button.new()
var builds:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=235;hide()
	for world in ["real","song"]:
		var panel:=Control.new();panel.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(panel)
		var frame:=NinePatchRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.12
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,128)
		panel.add_child(frame)
		var heading:=Label.new();heading.add_theme_font_size_override("font_size",12);heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;heading.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;panel.add_child(heading)
		var scroll:=ScrollContainer.new();scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;panel.add_child(scroll)
		var body:=VBoxContainer.new();body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",3);scroll.add_child(body)
		var notice:=Label.new();notice.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;notice.add_theme_font_size_override("font_size",12);body.add_child(notice)
		var grid:=GridContainer.new();grid.columns=2;grid.add_theme_constant_override("h_separation",4);grid.add_theme_constant_override("v_separation",4);body.add_child(grid)
		lanes[world]={"panel":panel,"frame":frame,"heading":heading,"scroll":scroll,"body":body,"notice":notice,"grid":grid,"keys":[],"rebuilds":0}
	add_child(dialog);dialog.mouse_filter=Control.MOUSE_FILTER_STOP;dialog.hide()
	var shade:=ColorRect.new();shade.color=Color(0,0,0,.55);shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;dialog.add_child(shade);shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dialog_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;dialog_frame.scale=Vector2.ONE*.15
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:dialog_frame.set_patch_margin(side,128)
	dialog.add_child(dialog_frame);dialog.add_child(dialog_copy);dialog_copy.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;dialog_copy.add_theme_font_size_override("font_size",16)
	for button in [cancel_button,accept_button]:dialog.add_child(button);battle_view._button_art(button);button.add_theme_font_size_override("font_size",15)
	accept_button.text="確定";cancel_button.text="取消";accept_button.pressed.connect(func():confirmation_answer.emit(true));cancel_button.pressed.connect(func():confirmation_answer.emit(false))
	resized.connect(_layout)

func _write(label: Label,value: String) -> void:
	if label.text!=value:label.text=value
func _key(world: String,data: Dictionary) -> String:
	return world+":"+JSON.stringify(data.dataset)
func apply_source_json(json: String) -> void:
	packet=JSON.parse_string(json)
	if not packet.get("visible",false):hide();dialog.hide();return
	for column in packet.columns:
		var lane: Dictionary=lanes[str(column.world)];battle_view._image(lane.frame,str(column.frame));_write(lane.heading,str(column.title)+"　"+str(column.subtitle))
		var copy: String=str(column.heading)
		if not str(column.selectedTitle).is_empty():copy=str(column.selectedTitle)+"\n"+str(column.selectedDetail)
		if not str(column.empty).is_empty():copy=str(column.empty)
		_write(lane.notice,copy);lane.notice.visible=not copy.is_empty()
		var keys: Array=[]
		for data in column.controls:keys.append(_key(str(column.world),data))
		if keys!=lane.keys:
			for key in lane.keys:
				var old: Control=controls[key].button;old.get_parent().remove_child(old);old.queue_free();controls.erase(key)
			lane.keys=keys;lane.rebuilds+=1;builds+=1;lane.scroll.scroll_vertical=0
			for data in column.controls:_create(lane.grid,_key(str(column.world),data))
		for data in column.controls:
			var item: Dictionary=controls[_key(str(column.world),data)];var button: Button=item.button
			button.source_uid=str(data.uid);button.disabled=data.disabled;button.tooltip_text=str(data.label)
			_write(item.name,str(data.name));_write(item.detail,str(data.detail));item.detail.visible=not str(data.detail).is_empty();item.image.visible=not str(data.image).is_empty()
			if item.image.visible:battle_view._image(item.image,str(data.image))
			button.custom_minimum_size.y=40 if str(data.detail).is_empty() else 66
	show();_layout();_hide_standard_controls()
	if packet.get("confirmation")!=null:
		_write(dialog_copy,str(packet.confirmation.message));battle_view._image(dialog_frame,"images/board/battle_switch_ui/battle_switch_panel_frame.webp");dialog.show()
	else:dialog.hide()

func _create(parent: Node,key: String) -> void:
	var button:=SourceButton.new();button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;parent.add_child(button);battle_view._button_art(button)
	button.source_event.connect(func(uid,_type,_transfer):source_input.emit(uid))
	var row:=HBoxContainer.new();row.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(row);row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);row.offset_left=6;row.offset_right=-6;row.offset_top=3;row.offset_bottom=-3
	var image:=TextureRect.new();image.custom_minimum_size=Vector2(28,28);image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;row.add_child(image)
	var stack:=VBoxContainer.new();stack.mouse_filter=Control.MOUSE_FILTER_IGNORE;stack.size_flags_horizontal=Control.SIZE_EXPAND_FILL;stack.size_flags_vertical=Control.SIZE_SHRINK_CENTER;stack.add_theme_constant_override("separation",1);row.add_child(stack)
	var title:=Label.new();title.add_theme_font_size_override("font_size",12);title.add_theme_color_override("font_color",Color("fff0c8"));title.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;title.mouse_filter=Control.MOUSE_FILTER_IGNORE;stack.add_child(title)
	var detail:=Label.new();detail.add_theme_font_size_override("font_size",10);detail.add_theme_color_override("font_color",Color("d8ebeb"));detail.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;detail.mouse_filter=Control.MOUSE_FILTER_IGNORE;stack.add_child(detail)
	controls[key]={"button":button,"name":title,"detail":detail,"image":image,"stack":stack}
	# Long source descriptions increase their row; they never escape the frame.
	stack.minimum_size_changed.connect(func():button.custom_minimum_size.y=maxf(40,stack.get_combined_minimum_size().y+10))

func _hide_standard_controls() -> void:
	if not visible:return
	battle_view.command_strip.hide();battle_view.attack_strip.hide();battle_view.sheets.hide()
func _layout() -> void:
	dialog.size=size
	var dialog_size:=Vector2(minf(440,size.x-40),150);var origin:=(size-dialog_size)*.5
	dialog_frame.position=origin;dialog_frame.size=dialog_size/.15;dialog_copy.position=origin+Vector2(20,20);dialog_copy.size=dialog_size-Vector2(40,80)
	cancel_button.position=origin+Vector2(20,95);accept_button.position=origin+Vector2(dialog_size.x*.5+5,95)
	cancel_button.size=Vector2(dialog_size.x*.5-25,36);accept_button.size=cancel_button.size
	var top:=.615 if size.y<=520 else .645;var bottom:=.008 if size.y<=520 else .01;var gap:=clampf(size.x*.007,5,12);var width:=(size.x*.976-gap)/2
	for i in range(2):
		var lane: Dictionary=lanes[["real","song"][i]];var panel: Control=lane.panel
		panel.position=Vector2(size.x*.012+i*(width+gap),size.y*top);panel.size=Vector2(width,size.y*(1-top-bottom));lane.frame.size=panel.size/.12
		lane.heading.position=Vector2(12,10);lane.heading.size=Vector2(width-24,18)
		lane.scroll.position=Vector2(12,29);lane.scroll.size=Vector2(width-24,panel.size.y-39)

func test_reveal_uid(uid: String) -> void:
	for item in controls.values():
		if item.button.source_uid==uid:
			for lane in lanes.values():
				if lane.scroll.is_ancestor_of(item.button):lane.scroll.ensure_control_visible(item.button)
func test_click_uid(uid: String) -> bool:
	for item in controls.values():
		var button: Button=item.button
		if button.source_uid!=uid:continue
		if button.disabled:return false
		var rect: Rect2=button.get_global_rect();var viewport_rect:=Rect2(Vector2.ZERO,size)
		for lane in lanes.values():
			if lane.scroll.is_ancestor_of(button):viewport_rect=viewport_rect.intersection(lane.scroll.get_global_rect())
		var visible_rect:=rect.intersection(viewport_rect);assert(visible_rect.size.x>5 and visible_rect.size.y>5,"Tot option not reachable")
		_pointer(visible_rect.get_center());return true
	return false
func _pointer(point: Vector2) -> void:
	for down in [true,false]:
		var event:=InputEventMouseButton.new();event.position=point;event.global_position=point;event.button_index=MOUSE_BUTTON_LEFT;event.pressed=down;get_viewport().push_input(event,true)
func test_answer(accepted: bool) -> void:
	assert(dialog.visible)
	var button: Button=accept_button if accepted else cancel_button
	_pointer(button.get_global_rect().get_center())
func test_bounds_json() -> String:
	var errors: Array=[]
	for world in lanes:
		var lane: Dictionary=lanes[world]
		if lane.body.size.x>lane.scroll.size.x+1:errors.append(str(world)+" horizontal overflow")
		if not Rect2(Vector2.ZERO,size+Vector2.ONE).encloses(lane.panel.get_global_rect()):errors.append(str(world)+" panel outside screen")
	for item in controls.values():
		if item.stack.get_combined_minimum_size().y>item.button.size.y-5:errors.append("text outside button")
	return JSON.stringify({"errors":errors,"builds":builds})
func test_capture(path: String) -> void:_capture(path)
func _capture(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
