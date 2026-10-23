extends Control
## Persistent source-backed learning page. Selection never rebuilds rows/textures.
signal command_requested(key: String)
signal surface_ready
const ART="images/board/move_learn_ui/move_learn_panel_frame.webp"
var cache: Node
var model: Dictionary={}
var epoch:=0
var background:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var portrait:=TextureRect.new()
var caption:=Label.new()
var meta:=Label.new()
var new_title:=Label.new()
var new_copy:=RichTextLabel.new()
var new_frame:=NinePatchRect.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var hint_title:=Label.new()
var hint:=Label.new()
var rows: Array[Dictionary]=[]
var actions: Array[Button]=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=12;theme=native_theme
	background.scale=Vector2.ONE*0.25;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(side,80)
	# Only the original outer rim is used; its inner artwork is not stretched
	# over independently scrolling contents.
	background.draw_center=false;add_child(background)
	for label in [heading,subtitle,caption,meta,new_title,hint_title,hint]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;heading.add_theme_font_size_override("font_size",19);heading.add_theme_color_override("font_color",Color("f5dfaa"))
	subtitle.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;subtitle.add_theme_font_size_override("font_size",11)
	caption.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;caption.add_theme_font_size_override("font_size",15);meta.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;meta.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;meta.add_theme_font_size_override("font_size",10)
	new_title.add_theme_color_override("font_color",Color("f5cf80"));new_title.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;new_title.add_theme_font_size_override("font_size",15)
	_prepare_picture(portrait);add_child(portrait);new_copy.scroll_active=true;new_copy.bbcode_enabled=false;add_child(new_copy)
	_configure_frame(new_frame);add_child(new_frame);move_child(new_frame,1)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",6);scroll.add_child(list)
	hint_title.add_theme_color_override("font_color",Color("f5cf80"));hint_title.add_theme_font_size_override("font_size",12);hint_title.clip_text=true;hint.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;hint.add_theme_font_size_override("font_size",10)
	for i in range(2):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",13);add_child(button);var frame:=NinePatchRect.new();_configure_frame(frame);button.add_child(frame);frame.show_behind_parent=true;button.set_meta("frame",frame);button.pressed.connect(func():_press(str(button.get_meta("key"))));actions.append(button)
	resized.connect(_layout);hide()
func _prepare_picture(image: TextureRect) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _configure_frame(frame: NinePatchRect) -> void:
	frame.region_rect=Rect2(529,482,546,205);frame.scale=Vector2.ONE*0.5;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,24)
func _new_row() -> Dictionary:
	var root:=Button.new();root.flat=true;root.custom_minimum_size.y=96;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(root)
	var frame:=NinePatchRect.new();_configure_frame(frame);root.add_child(frame);frame.show_behind_parent=true
	var selected:=StyleBoxFlat.new();selected.bg_color=Color(0.88,0.4,0.18,0.12);selected.border_color=Color("f4c867");selected.set_border_width_all(2);selected.set_corner_radius_all(5)
	var outline:=Panel.new();outline.add_theme_stylebox_override("panel",selected);outline.mouse_filter=Control.MOUSE_FILTER_IGNORE;outline.hide();root.add_child(outline)
	var image:=TextureRect.new();_prepare_picture(image);root.add_child(image)
	var title:=Label.new();title.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;title.add_theme_font_size_override("font_size",13);title.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(title)
	var stats:=Label.new();stats.add_theme_font_size_override("font_size",10);stats.add_theme_color_override("font_color",Color("d6c59e"));stats.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(stats)
	var copy:=RichTextLabel.new();copy.fit_content=true;copy.scroll_active=false;copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy.add_theme_font_size_override("normal_font_size",11);root.add_child(copy)
	root.pressed.connect(func():_press(str(root.get_meta("key"))));root.resized.connect(_layout_rows)
	return {"root":root,"frame":frame,"outline":outline,"image":image,"title":title,"stats":stats,"copy":copy}
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b25"))
func apply_json(value: String) -> void:epoch+=1;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[ART,value.image];for entry in value.entries:paths.append(entry.image)
	var textures: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			if cache.failed.has(path):push_error("Move learn asset failed "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:textures[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Move learn asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;background.texture=textures[ART];new_frame.texture=textures[ART];heading.text=model.title;subtitle.text=model.subtitle;portrait.texture=textures[model.image];caption.text=model.name
	var meta_parts: PackedStringArray=str(model.meta).split(" ・ ");meta.text=" ・ ".join(meta_parts.slice(0,3))+"\n"+" ・ ".join(meta_parts.slice(3)) if meta_parts.size()>3 else str(model.meta);new_title.text=model.newName
	new_copy.text="類型　%s\n需求等級　%s\n最大 PP　%s　　威力　%s\n\n招式效果\n%s"%[model.type,model.level,model.pp,model.power,model.effect];hint_title.text=model.hintTitle;hint.text=model.hint
	while rows.size()<model.entries.size():rows.append(_new_row())
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.root.visible=i<model.entries.size()
		if not row.root.visible:continue
		var entry: Dictionary=model.entries[i];row.root.disabled=false;row.root.set_meta("key",entry.key);row.frame.texture=textures[ART];row.image.texture=textures[entry.image];row.title.text=entry.name;row.stats.text="PP %s　威力 %s"%[entry.pp,entry.power];row.copy.text=entry.description;row.outline.visible=entry.selected
	for i in range(actions.size()):var button: Button=actions[i];button.text=model.actions[i].label;button.disabled=model.actions[i].disabled;button.set_meta("key",model.actions[i].key);button.get_meta("frame").texture=textures[ART]
	_layout();show();surface_ready.emit()
func _press(key: String) -> void:
	if not key.begins_with("forget:"):
		for button in actions:button.disabled=true
		for row in rows:row.root.disabled=true
	command_requested.emit(key)
func set_selected(key: String,value: bool) -> void:
	for row in rows:
		if str(row.root.get_meta("key",""))==key:row.outline.visible=value
func set_control_disabled(key: String,value: bool) -> void:
	for button in actions:
		if str(button.get_meta("key",""))==key:button.disabled=value
func update_text(key: String,value: String) -> void:
	if key=="moveLearnSelectionTitle":hint_title.text=value;hint_title.tooltip_text=value
	elif key=="moveLearnSelectionText":hint.text=value
func _layout() -> void:
	background.size=size/background.scale;heading.position=Vector2(24,9);heading.size=Vector2(size.x-48,25);subtitle.position=Vector2(24,35);subtitle.size=Vector2(size.x-48,16)
	var body_top:=59.0;var body_bottom:=size.y-75.0;var left:=size.x*0.21;var mid:=size.x*0.30;var right:=left+mid+18.0
	portrait.position=Vector2(22,body_top);portrait.size=Vector2(left-28,maxf(32,body_bottom-body_top-58));caption.position=Vector2(20,body_bottom-55);caption.size=Vector2(left-24,23);meta.position=Vector2(20,body_bottom-31);meta.size=Vector2(left-24,30)
	new_frame.position=Vector2(left+3,body_top);new_frame.size=Vector2(mid+3,body_bottom-body_top)/new_frame.scale;new_title.position=new_frame.position+Vector2(12,10);new_title.size=Vector2(mid-20,42);new_copy.position=new_frame.position+Vector2(12,52);new_copy.size=Vector2(mid-20,body_bottom-new_copy.position.y-13)
	scroll.position=Vector2(right,body_top);scroll.size=Vector2(size.x-right-24,body_bottom-body_top)
	hint_title.position=Vector2(24,size.y-65);hint_title.size=Vector2(size.x*0.54-34,20);hint.position=Vector2(24,size.y-44);hint.size=Vector2(size.x*0.54-34,31)
	var width: float=(size.x*0.46-33)/2.0
	for i in range(2):var button: Button=actions[i];button.position=Vector2(size.x*0.54+i*(width+7),size.y-61);button.size=Vector2(width,43);button.get_meta("frame").size=button.size/button.get_meta("frame").scale
	_layout_rows()
func _layout_rows() -> void:
	for row in rows:
		var width: float=row.root.size.x;row.frame.size=row.root.size/row.frame.scale;row.outline.position=Vector2(4,4);row.outline.size=row.root.size-Vector2(8,8);row.image.position=Vector2(10,12);row.image.size=Vector2(31,31);row.title.position=Vector2(48,10);row.title.size=Vector2(maxf(40,width-62),34);row.stats.position=Vector2(48,44);row.stats.size=Vector2(width-62,16);row.copy.position=Vector2(12,64);row.copy.size=Vector2(maxf(40,width-26),0);row.root.custom_minimum_size.y=maxf(96,77+row.copy.get_content_height())
func close_surface() -> void:epoch+=1;hide();model={};scroll.scroll_vertical=0
func test_press(key: String) -> bool:
	if not visible:return false
	for button in actions:
		if not button.disabled and str(button.get_meta("key",""))==key:button.pressed.emit();return true
	for row in rows:
		if row.root.visible and not row.root.disabled and str(row.root.get_meta("key",""))==key:row.root.pressed.emit();return true
	return false
func test_selection_json() -> String:
	var selected: Array=[];for row in rows:if row.outline.visible:selected.append(str(row.root.get_meta("key")))
	return JSON.stringify({"selected":selected,"confirmDisabled":actions[0].disabled,"title":hint_title.text,"hint":hint.text})
func test_layout() -> bool:
	for button in actions:if not Rect2(Vector2.ZERO,size).encloses(button.get_rect()):return false
	for row in rows:if row.root.visible and row.copy.position.y+row.copy.get_content_height()>row.root.size.y-10:return false
	return scroll.position.y+scroll.size.y<=hint_title.position.y and new_copy.size.y>30
func test_scroll_end() -> void:scroll.scroll_vertical=99999
func test_last_row_visible() -> bool:return not model.entries.is_empty() and scroll.get_global_rect().encloses(rows[model.entries.size()-1].root.get_global_rect())
func test_identity_json() -> String:
	var ids: Array=[background.get_instance_id(),background.texture.get_instance_id(),scroll.scroll_vertical]
	for row in rows:ids.append([row.root.get_instance_id(),row.image.texture.get_instance_id()])
	return JSON.stringify(ids)
