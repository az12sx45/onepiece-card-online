extends Control
## Full-screen equipment inventory, persistent rows and fixed return/unequip.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var epoch:=0
var prepared: Dictionary={}
var background:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var picture:=TextureRect.new()
var current_name:=Label.new()
var copy:=RichTextLabel.new()
var empty:=Label.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Array[Dictionary]=[]
var actions: Array[Button]=[]
var slots: Array[Button]=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=13;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(side,224)
	add_child(background)
	for label in [title,subtitle,current_name,empty]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",19);title.add_theme_color_override("font_color",Color("f5e5c5"));subtitle.add_theme_font_size_override("font_size",12);current_name.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;current_name.add_theme_color_override("font_color",Color("ead197"));empty.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	_prepare_picture(picture);add_child(picture);copy.bbcode_enabled=false;copy.scroll_active=true;add_child(copy)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",7);scroll.add_child(list)
	for i in range(3):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",14);add_child(button);button.set_meta("frame",_frame(button));button.get_meta("frame").show_behind_parent=true
		button.pressed.connect(func():_press(str(button.get_meta("key"))));actions.append(button)
	for i in range(2):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",11);button.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;add_child(button);button.set_meta("frame",_frame(button));button.get_meta("frame").show_behind_parent=true
		button.pressed.connect(func():_press(str(button.get_meta("key"))));slots.append(button);button.hide()
	resized.connect(_layout);hide()
func _prepare_picture(image: TextureRect) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _frame(parent: Control) -> NinePatchRect:
	var frame:=NinePatchRect.new();frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*0.0625;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	parent.add_child(frame);return frame
func _new_row() -> Dictionary:
	var root:=Button.new();root.flat=true;root.custom_minimum_size.y=126;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(root);var frame:=_frame(root)
	var image:=TextureRect.new();_prepare_picture(image);root.add_child(image)
	var heading:=Label.new();heading.add_theme_font_size_override("font_size",15);heading.clip_text=true;heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(heading)
	var meta:=Label.new();meta.add_theme_font_size_override("font_size",11);meta.clip_text=true;meta.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(meta)
	var action:=Label.new();action.add_theme_color_override("font_color",Color("ead197"));action.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(action)
	var description:=RichTextLabel.new();description.bbcode_enabled=false;description.fit_content=true;description.scroll_active=false;description.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(description)
	root.pressed.connect(func():_press(str(root.get_meta("key"))));root.resized.connect(_layout_rows)
	return {"root":root,"frame":frame,"picture":image,"heading":heading,"meta":meta,"action":action,"description":description}
func _press(key: String) -> void:
	for button in actions:button.disabled=true
	for button in slots:button.disabled=true
	for row in rows:row.root.disabled=true
	command_requested.emit(key)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:epoch+=1;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW];if not str(value.image).is_empty():paths.append(value.image)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Carry asset failed "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Carry asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;prepared=available;background.texture=prepared[PANEL];title.text=model.title;subtitle.text=model.subtitle;picture.texture=prepared.get(model.image);current_name.text=model.name;copy.text=model.description;empty.text=model.empty;empty.visible=model.entries.is_empty()
	# Inventory indices can shift after equip/unequip. Reuse visible icons by
	# asset path without queuing downloads/decodes for every off-screen row.
	var visible_textures: Dictionary={}
	for row in rows:
		if row.picture.texture!=null:visible_textures[str(row.root.get_meta("path",""))]=row.picture.texture
	while rows.size()<model.entries.size():rows.append(_new_row())
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.root.visible=i<model.entries.size()
		if not row.root.visible:row.picture.texture=null;continue
		var entry: Dictionary=model.entries[i];row.root.disabled=entry.disabled;row.root.modulate.a=0.58 if entry.disabled else 1.0;row.root.set_meta("key",entry.key)
		if str(row.root.get_meta("path",""))!=str(entry.image):row.picture.texture=visible_textures.get(entry.image)
		row.root.set_meta("path",entry.image);row.frame.texture=prepared[ROW];row.heading.text=entry.name;row.heading.tooltip_text=entry.name;row.meta.text=entry.meta;row.action.text=entry.label;row.description.text=entry.description
	for i in range(actions.size()):
		var button: Button=actions[i];button.visible=i<model.actions.size()
		if button.visible:button.text=model.actions[i].label;button.disabled=model.actions[i].disabled;button.set_meta("key",model.actions[i].key);button.get_meta("frame").texture=prepared[ROW]
	for i in range(slots.size()):
		var button: Button=slots[i];button.visible=bool(model.get("arsenal",false))
		if button.visible:button.text=model.slots[i].label;button.tooltip_text=button.text;button.set_meta("key",model.slots[i].key);button.disabled=false;button.modulate=Color("f5dc96") if model.slots[i].active else Color.WHITE;button.get_meta("frame").texture=prepared[ROW]
	_layout();show();surface_ready.emit()
func _process(_delta: float) -> void:
	if not visible:return
	var viewport_rect:=scroll.get_global_rect().grow(56)
	for row in rows:
		if not row.root.visible:continue
		if not viewport_rect.intersects(row.root.get_global_rect()):row.picture.texture=null;continue
		if row.picture.texture==null:row.picture.texture=cache.request(str(row.root.get_meta("path")))
func _layout() -> void:
	background.size=size/background.scale;title.position=Vector2(25,12);title.size=Vector2(size.x-50,27);subtitle.position=Vector2(25,40);subtitle.size=Vector2(size.x-50,18)
	var left:=size.x*0.31;var bottom:=size.y-66.0;picture.position=Vector2(35,65);picture.size=Vector2(left-55,minf(102,(bottom-65)*0.46) if picture.texture!=null else 0.0);current_name.position=Vector2(26,picture.position.y+picture.size.y+3);current_name.size=Vector2(left-34,36)
	copy.position=Vector2(29,current_name.position.y+current_name.size.y+3);copy.size=Vector2(left-40,maxf(45,bottom-copy.position.y))
	if bool(model.get("arsenal",false)):
		picture.position=Vector2(34,64);picture.size=Vector2(52,52);current_name.position=Vector2(92,67);current_name.size=Vector2(left-101,44)
		for i in range(slots.size()):var button: Button=slots[i];button.position=Vector2(26,124+i*39);button.size=Vector2(left-34,34);button.get_meta("frame").size=button.size/button.get_meta("frame").scale
		copy.position=Vector2(29,204);copy.size=Vector2(left-40,maxf(40,bottom-copy.position.y))
	scroll.position=Vector2(left+5,65);scroll.size=Vector2(size.x-left-34,bottom-66);empty.position=scroll.position+Vector2(10,35);empty.size=scroll.size-Vector2(20,35)
	var visible_actions: Array=actions.filter(func(button):return button.visible);var width: float=(size.x-52-8*maxi(0,visible_actions.size()-1))/maxi(1,visible_actions.size())
	for i in range(visible_actions.size()):var button: Button=visible_actions[i];button.position=Vector2(26+i*(width+8),size.y-57);button.size=Vector2(width,42);button.get_meta("frame").size=button.size/button.get_meta("frame").scale
	_layout_rows()
func _layout_rows() -> void:
	for row in rows:
		var width: float=row.root.size.x;row.frame.size=row.root.size/row.frame.scale;row.picture.position=Vector2(10,13);row.picture.size=Vector2(60,70);row.heading.position=Vector2(79,13);row.heading.size=Vector2(maxf(30,width-140),22);row.action.position=Vector2(width-49,14);row.action.size=Vector2(38,20);row.meta.position=Vector2(79,37);row.meta.size=Vector2(maxf(30,width-91),16)
		row.description.position=Vector2(79,58);row.description.size=Vector2(maxf(30,width-94),0);row.root.custom_minimum_size.y=maxf(110,72+row.description.get_content_height())
func close_surface() -> void:
	epoch+=1;hide();model={};prepared.clear();picture.texture=null;scroll.scroll_vertical=0
	for row in rows:row.picture.texture=null
func test_press(key: String) -> bool:
	if not visible:return false
	for button in actions:
		if button.visible and not button.disabled and str(button.get_meta("key"))==key:button.pressed.emit();return true
	for button in slots:
		if button.visible and not button.disabled and str(button.get_meta("key",""))==key:button.pressed.emit();return true
	for row in rows:
		if row.root.visible and not row.root.disabled and str(row.root.get_meta("key"))==key:row.root.pressed.emit();return true
	return false
func test_layout() -> bool:
	if model.is_empty():return false
	for button in actions:
		if button.visible and not Rect2(Vector2.ZERO,size).encloses(button.get_rect()):return false
	for button in slots:
		if button.visible and (not Rect2(Vector2.ZERO,size).encloses(button.get_rect()) or button.get_rect().intersects(copy.get_rect())):return false
	for row in rows:
		if row.root.visible and row.description.position.y+row.description.get_content_height()>row.root.size.y-10:return false
	return scroll.position.y+scroll.size.y<=size.y-66
func test_scroll_end() -> void:scroll.scroll_vertical=99999
func test_last_row_visible() -> bool:return not model.entries.is_empty() and scroll.get_global_rect().encloses(rows[model.entries.size()-1].root.get_global_rect())
func test_last_content_visible() -> bool:
	if model.entries.is_empty():return true
	var last: Dictionary=rows[model.entries.size()-1];var tail: Vector2=last.description.global_position+Vector2(1,last.description.get_content_height()-1)
	return scroll.get_global_rect().has_point(tail)
func test_visible_images_ready() -> bool:
	var viewport_rect:=scroll.get_global_rect().grow(56)
	for row in rows:
		if row.root.visible and viewport_rect.intersects(row.root.get_global_rect()) and row.picture.texture==null:return false
	return true
func test_identity_json() -> String:
	var ids: Array=[background.get_instance_id(),background.texture.get_instance_id(),scroll.scroll_vertical]
	for row in rows:ids.append([row.root.get_instance_id(),row.picture.texture.get_instance_id() if row.picture.texture!=null else 0])
	for button in slots:if button.visible:ids.append(button.get_instance_id())
	return JSON.stringify(ids)
func test_slots_json() -> String:
	var result: Array=[]
	for button in slots:if button.visible:result.append({"key":str(button.get_meta("key")),"label":button.text,"active":button.modulate!=Color.WHITE})
	return JSON.stringify(result)
