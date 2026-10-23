extends Control
signal command_requested(key: String)
signal surface_ready
const ART="images/board/cosmetic_frame_ui/cosmetic_frame_panel_frame.webp"
const Preview=preload("res://native_cosmetic_preview.gd")
var cache: Node
var model: Dictionary={}
var epoch:=0
var background:=NinePatchRect.new()
var header:=NinePatchRect.new()
var left_frame:=NinePatchRect.new()
var right_frame:=NinePatchRect.new()
var heading:=Label.new()
var preview:=Preview.new()
var preview_name:=Label.new()
var preview_label:=Label.new()
var current:=Label.new()
var unlock:=Label.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Array[Dictionary]=[]
var actions: Array[Button]=[]
var requested_scroll:=0
var committing:=false
var styles: Array[StyleBoxFlat]=[]
var gradients: Array[GradientTexture2D]=[]
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=12;theme=native_theme
	_frame(background,Rect2(),0.2,100);background.draw_center=false;add_child(background)
	_frame(header,Rect2(492,9,695,124),0.25,150);header.patch_margin_top=20;header.patch_margin_bottom=20;add_child(header)
	_frame(left_frame,Rect2(90,113,850,546),0.25,66);add_child(left_frame);_frame(right_frame,Rect2(997,141,542,687),0.25,90);add_child(right_frame)
	for label in [heading,preview_name,preview_label,current,unlock]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	heading.add_theme_font_size_override("font_size",19);heading.add_theme_color_override("font_color",Color("fff0c0"));preview_name.add_theme_font_size_override("font_size",14);preview_name.add_theme_color_override("font_color",Color("fff0c4"));preview_label.add_theme_color_override("font_color",Color("77d7e2"));current.add_theme_font_size_override("font_size",10);current.add_theme_color_override("font_color",Color("f2d89c"));unlock.add_theme_font_size_override("font_size",10);unlock.add_theme_color_override("font_color",Color("8acbd2"));unlock.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	add_child(preview);scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",6);scroll.add_child(list)
	for selected in [false,true]:
		var gradient:=Gradient.new();gradient.colors=PackedColorArray([Color(8.0/255,39.0/255,50.0/255,.98),Color(16.0/255,73.0/255,78.0/255,.9)] if selected else [Color(2.0/255,14.0/255,24.0/255,.93),Color(12.0/255,35.0/255,47.0/255,.86)]);var tex:=GradientTexture2D.new();tex.width=64;tex.height=16;tex.gradient=gradient;tex.fill_from=Vector2(0,0.412);tex.fill_to=Vector2(1,0.588);gradients.append(tex)
		var style:=StyleBoxFlat.new();style.bg_color=Color.TRANSPARENT;style.border_color=Color("73d7e5") if selected else Color(195.0/255,141.0/255,55.0/255,.5);style.set_border_width_all(1);style.set_corner_radius_all(9);styles.append(style)
	for i in range(2):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",14);add_child(button);var frame:=NinePatchRect.new();_frame(frame,Rect2(439 if i==0 else 867,844,365,82),0.5,50);button.add_child(frame);frame.show_behind_parent=true;button.set_meta("frame",frame);button.pressed.connect(func():_press(str(button.get_meta("key"))));actions.append(button)
	resized.connect(_layout);hide()
func _frame(frame: NinePatchRect,region: Rect2,factor: float,margin: int) -> void:
	frame.region_rect=region;frame.scale=Vector2.ONE*factor;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,margin)
func _new_row() -> Dictionary:
	var root:=Button.new();root.flat=true;root.custom_minimum_size.y=65;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(root)
	var fill:=TextureRect.new();fill.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;fill.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(fill);fill.show_behind_parent=true
	var edge:=Panel.new();edge.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(edge)
	var name:=Label.new();name.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;name.add_theme_font_size_override("font_size",13);name.add_theme_color_override("font_color",Color("ffe9b2"));name.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(name)
	var description:=Label.new();description.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;description.add_theme_font_size_override("font_size",10);description.add_theme_color_override("font_color",Color("87c8ce"));description.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(description)
	var state:=Label.new();state.add_theme_font_size_override("font_size",10);state.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(state)
	root.pressed.connect(func():_press(str(root.get_meta("key"))));root.resized.connect(_layout_rows)
	return {"root":root,"fill":fill,"edge":edge,"name":name,"description":description,"state":state}
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b25"))
func apply_json(value: String) -> void:epoch+=1;committing=true;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[ART,value.image];for layer in value.layers:paths.append(layer.image)
	var textures: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			if cache.failed.has(path):push_error("Cosmetic asset failed "+str(path));return
			var image: Texture2D=cache.request(path)
			if image!=null:textures[path]=image
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Cosmetic assets timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value
	for frame in [background,header,left_frame,right_frame]:frame.texture=textures[ART]
	heading.text=model.title;preview_name.text=model.name;preview_label.text=model.previewLabel;current.text=model.current;unlock.text=model.unlock
	while rows.size()<model.entries.size():rows.append(_new_row())
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.root.visible=i<model.entries.size()
		if not row.root.visible:continue
		var entry: Dictionary=model.entries[i];row.root.set_meta("key",entry.key);row.root.disabled=false;row.name.text=entry.name;row.description.text=entry.description;row.state.text=entry.label;row.fill.texture=gradients[1 if entry.selected else 0];row.edge.add_theme_stylebox_override("panel",styles[1 if entry.selected else 0])
	for i in range(2):actions[i].text=model.actions[i].label;actions[i].set_meta("key",model.actions[i].key);actions[i].disabled=model.actions[i].disabled;actions[i].get_meta("frame").texture=textures[ART]
	_layout();preview.configure(model,textures);committing=false;show();call_deferred("_apply_scroll",token);surface_ready.emit()
func _press(key: String) -> void:
	for button in actions:button.disabled=true
	for row in rows:row.root.disabled=true
	command_requested.emit(key)
func scroll_to_index(index: int) -> void:requested_scroll=maxi(0,index);if not committing:call_deferred("_apply_scroll",epoch)
func _apply_scroll(token: int) -> void:
	if token!=epoch or requested_scroll>=rows.size():return
	scroll.scroll_vertical=roundi(rows[requested_scroll].root.position.y)
func _layout() -> void:
	background.size=size/background.scale;header.position=Vector2(size.x*.25,8);header.size=Vector2(size.x*.5,33)/header.scale;heading.position=header.position;heading.size=Vector2(size.x*.5,33)
	var middle:=size.x*.5;var bottom:=size.y-70
	left_frame.position=Vector2(20,48);left_frame.size=Vector2(middle-25,bottom-48)/left_frame.scale;right_frame.position=Vector2(middle+3,48);right_frame.size=Vector2(size.x-middle-24,bottom-48)/right_frame.scale
	preview.position=left_frame.position+Vector2(9,9);preview.size=Vector2(middle-43,maxf(60,bottom-48-71));preview_name.position=Vector2(26,bottom-59);preview_name.size=Vector2(middle-37,21);preview_label.position=Vector2(26,bottom-37);preview_label.size=Vector2(middle-37,18)
	current.position=Vector2(26,size.y-65);current.size=Vector2(middle-37,16);unlock.position=Vector2(middle+10,size.y-65);unlock.size=Vector2(size.x-middle-36,16)
	scroll.position=right_frame.position+Vector2(12,12);scroll.size=Vector2(size.x-middle-49,bottom-72)
	for i in range(2):actions[i].position=Vector2(25+i*(size.x-44)/2.0,size.y-47);actions[i].size=Vector2((size.x-59)/2.0,36);actions[i].get_meta("frame").size=actions[i].size/actions[i].get_meta("frame").scale
	_layout_rows()
func _layout_rows() -> void:
	for row in rows:
		var width: float=row.root.size.x;row.fill.position=Vector2(2,2);row.fill.size=row.root.size-Vector2(4,4);row.edge.size=row.root.size;row.name.position=Vector2(12,9);row.name.size=Vector2(maxf(40,width-72),0);row.description.position=Vector2(12,14+row.name.get_minimum_size().y);row.description.size=Vector2(maxf(40,width-24),0);row.state.position=Vector2(width-53,11);row.state.size=Vector2(45,18);row.root.custom_minimum_size.y=maxf(65,row.description.position.y+row.description.get_minimum_size().y+11)
func close_surface() -> void:epoch+=1;committing=false;hide();preview.stop();model={}
func test_press(key: String) -> bool:
	if not visible:return false
	for button in actions:
		if not button.disabled and str(button.get_meta("key",""))==key:button.pressed.emit();return true
	for row in rows:
		if row.root.visible and not row.root.disabled and str(row.root.get_meta("key",""))==key:row.root.pressed.emit();return true
	return false
func test_layout() -> bool:
	for button in actions:if not Rect2(Vector2.ZERO,size).encloses(button.get_rect()):return false
	for row in rows:if row.root.visible and row.description.position.y+row.description.get_minimum_size().y>row.root.size.y-7:return false
	return scroll.position.y+scroll.size.y<current.position.y
func test_scroll_end() -> void:scroll.scroll_vertical=99999
func test_last_row_visible() -> bool:return not model.entries.is_empty() and scroll.get_global_rect().encloses(rows[model.entries.size()-1].root.get_global_rect())
func test_identity_json() -> String:
	var ids: Array=[preview.test_identity_json(),background.texture.get_instance_id(),scroll.scroll_vertical]
	for row in rows:ids.append(row.root.get_instance_id())
	return JSON.stringify(ids)
