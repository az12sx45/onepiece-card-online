extends Control
## Original journal content and handlers; persistent landscape reading panes.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var epoch:=0
var busy:=false
var panel:=NinePatchRect.new()
var detail_frame:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var list_scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Array[Dictionary]=[]
var detail_scroll:=ScrollContainer.new()
var detail:=VBoxContainer.new()
var heading:=HBoxContainer.new()
var rank:=TextureRect.new()
var name_label:=Label.new()
var type_label:=Label.new()
var condition_title:=Label.new()
var condition:=Label.new()
var progress_box:=HBoxContainer.new()
var progress_label:=Label.new()
var progress:=ProgressBar.new()
var progress_text:=Label.new()
var reward_title:=Label.new()
var reward:=Label.new()
var note:=Label.new()
var actions: Array[Dictionary]=[]
var row_texture: Texture2D
var framed:=false

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=14;theme=native_theme
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,subtitle]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;add_child(label)
	title.add_theme_font_size_override("font_size",20);title.add_theme_color_override("font_color",Color("ffe3a5"));subtitle.add_theme_font_size_override("font_size",12)
	detail_frame.scale=Vector2.ONE*.0625;detail_frame.region_rect=Rect2(0,204,2008,360);detail_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:detail_frame.set_patch_margin(side,160)
	add_child(detail_frame)
	for scroll in [list_scroll,detail_scroll]:scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	for box in [list,detail]:box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_theme_constant_override("separation",6)
	list_scroll.add_child(list);detail_scroll.add_child(detail)
	detail.add_child(heading);heading.add_theme_constant_override("separation",8);_picture(rank);rank.custom_minimum_size=Vector2(42,50);heading.add_child(rank)
	var copy:=VBoxContainer.new();copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;heading.add_child(copy);copy.add_child(name_label);copy.add_child(type_label)
	name_label.add_theme_font_size_override("font_size",16);name_label.add_theme_color_override("font_color",Color("ffe3a5"));type_label.add_theme_font_size_override("font_size",12)
	for label in [name_label,type_label,condition_title,condition,progress_label,progress_text,reward_title,reward,note]:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for label in [condition_title,condition]:detail.add_child(label)
	detail.add_child(progress_box);progress_box.add_theme_constant_override("separation",8);progress_box.add_child(progress_label);progress_label.custom_minimum_size.x=64;progress_label.add_theme_font_size_override("font_size",12)
	progress.show_percentage=false;progress.size_flags_horizontal=Control.SIZE_EXPAND_FILL;progress.custom_minimum_size.y=10;progress.size_flags_vertical=Control.SIZE_SHRINK_CENTER;progress.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var bg:=StyleBoxFlat.new();bg.bg_color=Color("082b36");var fill:=StyleBoxFlat.new();fill.bg_color=Color("cab26d");progress.add_theme_stylebox_override("background",bg);progress.add_theme_stylebox_override("fill",fill);progress_box.add_child(progress);progress_box.add_child(progress_text);progress_text.custom_minimum_size.x=76;progress_text.add_theme_font_size_override("font_size",12)
	for label in [reward_title,reward,note]:detail.add_child(label)
	for label in [condition_title,reward_title]:label.add_theme_color_override("font_color",Color("ffe3a5"))
	note.add_theme_font_size_override("font_size",12);note.add_theme_color_override("font_color",Color("cebd9a"))
	for index in range(3):
		var button:=Button.new();button.flat=true;add_child(button);button.pressed.connect(func():_press(str(button.get_meta("key",""))))
		var label:=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_size_override("font_size",13);button.add_child(label);label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);label.offset_left=10;label.offset_right=-10;label.offset_top=3;label.offset_bottom=-3;actions.append({"button":button,"label":label})
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b2a"))
func _picture(node: TextureRect) -> void:node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _press(key: String) -> void:if not busy and not key.is_empty():command_requested.emit(key)
func _frame(button: Button) -> void:
	var frame:=NinePatchRect.new();frame.texture=row_texture;frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*.0625;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	button.add_child(frame);button.resized.connect(func():frame.size=button.size/.0625);frame.size=button.size/.0625
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	var list_top:=list_scroll.scroll_vertical if visible else 0
	var detail_top:=detail_scroll.scroll_vertical if visible and not model.is_empty() and model.detail.title==next.detail.title else 0
	model=next;epoch+=1;busy=true;_prepare(epoch,list_top,detail_top)
func _prepare(token: int, list_top: int, detail_top: int) -> void:
	var paths: Array=[PANEL,ROW];var loaded: Dictionary={}
	for entry in model.entries:if not entry.image.is_empty():paths.append(entry.image)
	if not model.detail.image.is_empty():paths.append(model.detail.image)
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var complete:=true
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Journal source image failed: "+str(path));return
			var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
			if not cache.records.has(path) and not live and cache.pending.size()>=2:complete=false;continue
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:complete=false
		if complete:break
		if Time.get_ticks_msec()>deadline:push_error("Journal source image timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	panel.texture=loaded[PANEL];row_texture=loaded[ROW];detail_frame.texture=row_texture
	if not framed:
		for action in actions:_frame(action.button)
		framed=true
	title.text=model.title;subtitle.text=model.subtitle
	while rows.size()<model.entries.size():_new_row()
	for index in range(rows.size()):
		var row: Dictionary=rows[index];row.button.visible=index<model.entries.size()
		if not row.button.visible:row.image.texture=null;continue
		var entry: Dictionary=model.entries[index];row.button.set_meta("key",entry.key);row.button.disabled=entry.get("disabled",false);row.image.texture=loaded.get(entry.image);row.title.text=entry.title;row.subtitle.text=entry.subtitle;row.status.text=entry.status;row.button.modulate=Color("fff1b8") if entry.selected else Color.WHITE
	rank.texture=loaded.get(model.detail.image);rank.visible=rank.texture!=null;name_label.text=model.detail.title;type_label.text=model.detail.subtitle;condition_title.text=model.detail.conditionTitle;condition_title.visible=not condition_title.text.is_empty();condition.text=model.detail.condition;progress_label.text=model.detail.progressLabel;progress_text.text=model.detail.progress;progress.value=model.detail.progressPercent;reward_title.text=model.detail.rewardTitle;reward.text=model.detail.reward;note.text=model.detail.note;note.visible=not note.text.is_empty()
	for index in range(actions.size()):
		var entry: Dictionary=model.actions[index];actions[index].button.set_meta("key",entry.key);actions[index].button.disabled=entry.disabled;actions[index].label.text=entry.label;actions[index].label.modulate=Color(1,1,1,.48 if entry.disabled else 1)
	_layout();show()
	for pass_index in range(3):
		await get_tree().process_frame
		if token!=epoch:return
		_fit_rows()
	list_scroll.scroll_vertical=list_top;detail_scroll.scroll_vertical=detail_top;busy=false;surface_ready.emit()
func _new_row() -> void:
	var button:=Button.new();button.flat=true;button.custom_minimum_size.y=82;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(button);_frame(button);button.pressed.connect(func():_press(str(button.get_meta("key",""))))
	var box:=VBoxContainer.new();box.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(box)
	var top:=HBoxContainer.new();top.mouse_filter=Control.MOUSE_FILTER_IGNORE;top.add_theme_constant_override("separation",6);box.add_child(top)
	var image:=TextureRect.new();_picture(image);image.custom_minimum_size=Vector2(30,40);top.add_child(image)
	var copy:=VBoxContainer.new();copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;top.add_child(copy)
	var row_title:=Label.new();row_title.add_theme_font_size_override("font_size",13);row_title.add_theme_color_override("font_color",Color("ffe3a5"));copy.add_child(row_title)
	var row_subtitle:=Label.new();row_subtitle.add_theme_font_size_override("font_size",11);copy.add_child(row_subtitle)
	var status:=Label.new();status.add_theme_font_size_override("font_size",11);status.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;status.add_theme_color_override("font_color",Color("8ce4d5"));box.add_child(status)
	for label in [row_title,row_subtitle,status]:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	button.resized.connect(func():box.position=Vector2(10,8);box.size=button.size-Vector2(20,16))
	box.minimum_size_changed.connect(func():button.custom_minimum_size.y=maxf(82,box.get_combined_minimum_size().y+16))
	rows.append({"button":button,"box":box,"image":image,"title":row_title,"subtitle":row_subtitle,"status":status})
func _fit_rows() -> void:
	for row in rows:
		if row.button.visible:row.button.custom_minimum_size.y=maxf(82,row.box.get_combined_minimum_size().y+16)
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(20,12);title.size=Vector2(size.x-40,27);subtitle.position=Vector2(20,39);subtitle.size=Vector2(size.x-40,20)
	var left: float=clampf(size.x*.29,176,280);list_scroll.position=Vector2(18,66);list_scroll.size=Vector2(left-18,size.y-132)
	detail_frame.position=Vector2(left+12,66);detail_frame.size=Vector2(size.x-left-30,size.y-132)/.0625;detail_scroll.position=detail_frame.position+Vector2(12,8);detail_scroll.size=Vector2(size.x-left-54,size.y-148)
	for index in range(2):actions[index].button.position=Vector2(left+12+index*(size.x-left-24)/2,size.y-58);actions[index].button.size=Vector2((size.x-left-36)/2,44)
	actions[2].button.position=Vector2(18,size.y-58);actions[2].button.size=Vector2(left-18,44);queue_redraw();call_deferred("_fit_rows")
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_press(key: String) -> bool:
	if not test_ready():return false
	for row in rows:
		if row.button.visible and not row.button.disabled and row.button.get_meta("key","")==key:row.button.pressed.emit();return true
	for action in actions:
		if action.button.get_meta("key","")==key and not action.button.disabled:action.button.pressed.emit();return true
	return false
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,subtitle,list_scroll,detail_scroll]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	for action in actions:
		if not action.button.visible:continue
		if not bounds.encloses(Rect2(action.button.position,action.button.size)) or not Rect2(Vector2.ZERO,action.button.size).encloses(Rect2(action.label.position,action.label.size)):return false
	for row in rows:
		if not row.button.visible:continue
		var row_bounds: Rect2=row.button.get_global_rect()
		for label in [row.title,row.subtitle,row.status]:
			if not row_bounds.encloses(label.get_global_rect()):return false
	return list.size.x<=list_scroll.size.x+1 and detail.size.x<=detail_scroll.size.x+1
func test_scroll_end() -> void:list_scroll.scroll_vertical=int(list.size.y);detail_scroll.scroll_vertical=int(detail.size.y)
func test_scroll_json() -> String:return JSON.stringify({"list":list_scroll.scroll_vertical,"detail":detail_scroll.scroll_vertical})
