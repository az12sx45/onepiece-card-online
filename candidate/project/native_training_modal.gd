extends Control
## Native training pages share source data; tabs only change phone presentation.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var epoch:=0
var material_tab:=false
var background:=NinePatchRect.new()
var title:=Label.new()
var portrait:=TextureRect.new()
var radar:=preload("res://native_training_radar.gd").new()
var rules:=RichTextLabel.new()
var scroll:=ScrollContainer.new()
var stats:=VBoxContainer.new()
var materials:=VBoxContainer.new()
var stat_rows: Array[Dictionary]=[]
var material_rows: Array[Dictionary]=[]
var actions: Array[Button]=[]
var tabs: Array[Button]=[]
var empty:=Label.new()
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=13;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(side,224)
	add_child(background);title.add_theme_font_size_override("font_size",19);title.add_theme_color_override("font_color",Color("f5e5c5"));title.clip_text=true;add_child(title)
	_prepare_picture(portrait);add_child(portrait);add_child(radar);radar.pressed.connect(func():command_requested.emit("training:radar"))
	rules.bbcode_enabled=false;rules.scroll_active=true;add_child(rules)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	var stack:=VBoxContainer.new();stack.size_flags_horizontal=Control.SIZE_EXPAND_FILL;scroll.add_child(stack)
	for box in [stats,materials]:box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_theme_constant_override("separation",6);stack.add_child(box)
	empty.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;materials.add_child(empty)
	for i in range(6):
		var root:=Control.new();root.custom_minimum_size.y=62;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;stats.add_child(root);var frame:=_frame(root)
		var image:=TextureRect.new();_prepare_picture(image);root.add_child(image)
		var heading:=Label.new();heading.add_theme_font_size_override("font_size",14);root.add_child(heading)
		var points:=Label.new();points.add_theme_font_size_override("font_size",11);points.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;root.add_child(points)
		var copy:=Label.new();copy.add_theme_font_size_override("font_size",11);root.add_child(copy)
		var total:=Label.new();total.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;total.add_theme_color_override("font_color",Color("f0c56e"));root.add_child(total)
		var bar:=ProgressBar.new();bar.show_percentage=false;root.add_child(bar)
		var fill:=StyleBoxFlat.new();fill.bg_color=Color("59c9c5");var track:=StyleBoxFlat.new();track.bg_color=Color("061c22");bar.add_theme_stylebox_override("fill",fill);bar.add_theme_stylebox_override("background",track)
		stat_rows.append({"root":root,"frame":frame,"image":image,"heading":heading,"points":points,"copy":copy,"total":total,"bar":bar});root.resized.connect(_layout_rows)
	for i in range(2):
		var tab:=Button.new();tab.text="修行數值" if i==0 else "修行材料";tab.flat=true;tab.set_meta("frame",_frame(tab));tab.get_meta("frame").show_behind_parent=true;add_child(tab);tab.pressed.connect(func():_select_tab(i==1));tabs.append(tab)
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",14);button.set_meta("frame",_frame(button));button.get_meta("frame").show_behind_parent=true;add_child(button);button.pressed.connect(func():_press(str(button.get_meta("key"))));actions.append(button)
	resized.connect(_layout);hide()
func _prepare_picture(image: TextureRect) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _frame(parent: Control) -> NinePatchRect:
	var frame:=NinePatchRect.new();frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*0.0625;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	parent.add_child(frame);return frame
func _new_material() -> Dictionary:
	var root:=Button.new();root.flat=true;root.custom_minimum_size.y=104;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;materials.add_child(root);var frame:=_frame(root)
	var image:=TextureRect.new();_prepare_picture(image);root.add_child(image)
	var heading:=Label.new();heading.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;heading.add_theme_font_size_override("font_size",13);heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(heading)
	var copy:=RichTextLabel.new();copy.fit_content=true;copy.bbcode_enabled=false;copy.scroll_active=false;copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(copy)
	root.pressed.connect(func():_press(str(root.get_meta("key"))));root.resized.connect(_layout_rows)
	return {"root":root,"frame":frame,"image":image,"heading":heading,"copy":copy}
func _select_tab(value: bool) -> void:material_tab=value;scroll.scroll_vertical=0;_layout()
func _press(key: String) -> void:
	for button in actions:button.disabled=true
	for row in material_rows:row.root.disabled=true
	command_requested.emit(key)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:epoch+=1;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW,value.image]
	for row in value.rows:paths.append(row.icon)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Training asset failed "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Training asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;prepared=available;background.texture=prepared[PANEL];portrait.texture=prepared[model.image];title.text=model.title;rules.text=model.rules;radar.apply_model(model.radar)
	for i in range(6):
		var row: Dictionary=stat_rows[i];var data: Dictionary=model.rows[i];row.frame.texture=prepared[ROW];row.image.texture=prepared[data.icon];row.heading.text=data.name;row.points.text=data.points;row.copy.text=data.copy;row.total.text=data.total;row.bar.value=data.value
	while material_rows.size()<model.entries.size():material_rows.append(_new_material())
	for i in range(material_rows.size()):
		var row: Dictionary=material_rows[i];row.root.visible=i<model.entries.size()
		if not row.root.visible:row.image.texture=null;continue
		var entry: Dictionary=model.entries[i];row.root.disabled=entry.disabled;row.root.modulate.a=0.55 if entry.disabled else 1.0;row.root.set_meta("key",entry.key)
		if str(row.root.get_meta("path",""))!=str(entry.image):row.image.texture=null
		row.root.set_meta("path",entry.image);row.frame.texture=prepared[ROW];row.heading.text=entry.name;row.copy.text=entry.description
	empty.text=model.empty;empty.visible=model.entries.is_empty()
	for i in range(2):actions[i].text=model.actions[i].label;actions[i].set_meta("key",model.actions[i].key);actions[i].disabled=model.actions[i].disabled;actions[i].get_meta("frame").texture=prepared[ROW];tabs[i].get_meta("frame").texture=prepared[ROW]
	_layout();show();surface_ready.emit()
func apply_radar_json(value: String) -> void:model.radar=JSON.parse_string(value);radar.apply_model(model.radar)
func _process(_delta: float) -> void:
	if not visible:return
	var area:=scroll.get_global_rect().grow(56)
	for row in material_rows:
		if not material_tab or not row.root.visible or not area.intersects(row.root.get_global_rect()):row.image.texture=null;continue
		if row.image.texture==null:row.image.texture=cache.request(str(row.root.get_meta("path")))
func _layout() -> void:
	background.size=size/background.scale;title.position=Vector2(27,17);title.size=Vector2(size.x*0.4-32,30)
	for i in range(2):tabs[i].position=Vector2(size.x*0.43+i*size.x*0.255,13);tabs[i].size=Vector2(size.x*0.245,37);tabs[i].get_meta("frame").size=tabs[i].size/tabs[i].get_meta("frame").scale;tabs[i].modulate=Color("f4dfa3") if material_tab==(i==1) else Color.WHITE
	var bottom:=size.y-65;var left:=size.x*0.39;var content_height:=bottom-62;var radar_height: float=(left-45)/2.0
	portrait.position=Vector2(28,60);portrait.size=Vector2(left-42,maxf(60,content_height-radar_height-8));radar.position=Vector2(24,portrait.position.y+portrait.size.y+5);radar.size=Vector2(left-34,radar_height)
	rules.position=Vector2(28,portrait.position.y+portrait.size.y+5);rules.size=Vector2(left-43,radar_height);rules.visible=material_tab;radar.visible=not material_tab;stats.visible=not material_tab;materials.visible=material_tab
	scroll.position=Vector2(left+4,61);scroll.size=Vector2(size.x-left-31,content_height)
	for i in range(2):actions[i].position=Vector2(26+i*(size.x-44)/2.0,size.y-57);actions[i].size=Vector2((size.x-60)/2.0,42);actions[i].get_meta("frame").size=actions[i].size/actions[i].get_meta("frame").scale
	_layout_rows()
func _layout_rows() -> void:
	for row in stat_rows:
		var width: float=row.root.size.x;row.frame.size=row.root.size/row.frame.scale;row.image.position=Vector2(9,13);row.image.size=Vector2(34,34);row.heading.position=Vector2(50,9);row.heading.size=Vector2(60,20);row.points.position=Vector2(width-130,9);row.points.size=Vector2(112,18);row.copy.position=Vector2(50,31);row.copy.size=Vector2(width-114,17);row.total.position=Vector2(width-64,29);row.total.size=Vector2(46,18);row.bar.position=Vector2(50,51);row.bar.size=Vector2(width-68,4)
	for row in material_rows:
		var width: float=row.root.size.x;row.frame.size=row.root.size/row.frame.scale;row.image.position=Vector2(10,17);row.image.size=Vector2(48,56);row.heading.position=Vector2(66,13);row.heading.size=Vector2(maxf(40,width-82),0);row.copy.position=Vector2(66,18+row.heading.get_minimum_size().y);row.copy.size=Vector2(maxf(40,width-82),0);row.root.custom_minimum_size.y=maxf(98,row.copy.position.y+row.copy.get_content_height()+17)
func close_surface() -> void:
	epoch+=1;hide();model={};prepared.clear();portrait.texture=null
	for row in material_rows:row.image.texture=null
func test_press(key: String) -> bool:
	if not visible:return false
	if key=="training:radar" and radar.visible:radar.pressed.emit();return true
	for button in actions:
		if not button.disabled and str(button.get_meta("key"))==key:button.pressed.emit();return true
	for row in material_rows:
		if material_tab and row.root.visible and not row.root.disabled and str(row.root.get_meta("key"))==key:row.root.pressed.emit();return true
	return false
func test_material_tab(value: bool) -> void:_select_tab(value)
func test_layout() -> bool:
	for button in actions:
		if not Rect2(Vector2.ZERO,size).encloses(button.get_rect()) or button.get_rect().intersects(scroll.get_rect()):return false
	return scroll.size.y>140 and radar.size.x>=200
func test_scroll_end() -> void:scroll.scroll_vertical=99999
func test_last_stat_visible() -> bool:return scroll.get_global_rect().encloses(stat_rows[-1].root.get_global_rect())
func test_radar_json() -> String:return JSON.stringify(model.radar)
func test_identity_json() -> String:
	var ids: Array=[background.get_instance_id(),background.texture.get_instance_id(),portrait.texture.get_instance_id(),scroll.scroll_vertical,material_tab]
	for row in stat_rows:ids.append([row.root.get_instance_id(),row.image.texture.get_instance_id()])
	for row in material_rows:ids.append([row.root.get_instance_id(),row.image.texture.get_instance_id() if row.image.texture!=null else 0])
	return JSON.stringify(ids)
func test_visible_images_ready() -> bool:
	if not material_tab:return portrait.texture!=null
	var area:=scroll.get_global_rect().grow(56)
	for row in material_rows:
		if row.root.visible and area.intersects(row.root.get_global_rect()) and row.image.texture==null:return false
	return true
