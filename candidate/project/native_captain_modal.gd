extends Control
## Original captain artwork sampled in separate regions; portraits never stretch.
signal command_requested(key: String)
signal surface_ready
const PANEL="images/board/captain_selection_ui/captain_selection_panel_frame.webp"
const ROW="images/board/captain_selection_ui/captain_selection_row_frame.webp"
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var epoch:=0
var blocked:=false
var frame:=NinePatchRect.new()
var banner:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var list_title:=Label.new()
var detail_scroll:=ScrollContainer.new()
var detail:=VBoxContainer.new()
var portrait:=TextureRect.new()
var detail_copy:=RichTextLabel.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Dictionary={}
var actions: Dictionary={}
var image_refresh_queued:=false

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=13;theme=native_theme
	_art(frame,Rect2(585,249,930,535),0.3,45);add_child(frame)
	_art(banner,Rect2(485,88,700,108),0.35,70);add_child(banner)
	for label in [title,subtitle,list_title]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;add_child(label)
	title.add_theme_font_size_override("font_size",18);title.add_theme_color_override("font_color",Color("ffe6a4"));subtitle.add_theme_font_size_override("font_size",11);subtitle.add_theme_color_override("font_color",Color("83ccd3"));list_title.add_theme_font_size_override("font_size",12)
	detail_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(detail_scroll);detail.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail.add_theme_constant_override("separation",8);detail_scroll.add_child(detail)
	_picture(portrait);portrait.custom_minimum_size.y=120;detail.add_child(portrait)
	detail_copy.bbcode_enabled=false;detail_copy.fit_content=true;detail_copy.scroll_active=false;detail_copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail.add_child(detail_copy)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",6);scroll.add_child(list)
	scroll.get_v_scroll_bar().value_changed.connect(func(_value):_visible_images())
	list.sort_children.connect(_queue_visible_images)
	cache.asset_ready.connect(_asset_ready);resized.connect(_layout);hide()
func _art(node: NinePatchRect,region: Rect2,factor: float,margin: int) -> void:
	node.region_rect=region;node.scale=Vector2.ONE*factor;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:node.set_patch_margin(side,margin)
func _picture(node: TextureRect) -> void:node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("08111c"))
func apply_json(value: String) -> void:epoch+=1;blocked=true;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW,value.image];var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Captain artwork unavailable "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Captain artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	var old_scroll:=scroll.scroll_vertical;var prior_image: String=str(model.get("image",""));model=value;prepared=available;frame.texture=prepared[PANEL];banner.texture=prepared[PANEL];portrait.texture=prepared[model.image]
	title.text=model.title;subtitle.text=model.subtitle;list_title.text=model.listTitle
	detail_copy.text="\n".join([model.name,model.meta,model.passive,model.effect,model.stats,"",model.hint])
	var keep: Dictionary={}
	for index in range(model.entries.size()):
		var entry: Dictionary=model.entries[index];var key: String=entry.key;keep[key]=true
		if not rows.has(key):
			var button:=Button.new();button.flat=true;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;button.set_meta("key",key);list.add_child(button)
			var row_art:=NinePatchRect.new();_art(row_art,Rect2(870,26,820,284),0.3,35);button.add_child(row_art)
			var image:=TextureRect.new();_picture(image);button.add_child(image)
			var label:=Label.new();label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_size_override("font_size",12);button.add_child(label)
			rows[key]={"button":button,"frame":row_art,"image":image,"label":label,"path":""};button.pressed.connect(func():_press(key));button.resized.connect(func():_layout_row(key));label.minimum_size_changed.connect(func():_layout_row.call_deferred(key))
		var row: Dictionary=rows[key];list.move_child(row.button,index);row.button.disabled=entry.disabled;row.frame.texture=prepared[ROW];row.frame.self_modulate=Color("ffe5af") if entry.selected else Color.WHITE;row.path=entry.image
		row.label.text="\n".join([entry.name+" · "+entry.status,entry.meta,entry.hp,entry.passive,entry.effect]);row.button.modulate.a=0.55 if entry.disabled else 1.0
	for key in rows.keys():
		if not keep.has(key):rows[key].button.queue_free();rows.erase(key)
	for index in range(model.actions.size()):
		var action: Dictionary=model.actions[index];var key: String=action.key
		if not actions.has(key):
			var button:=Button.new();button.flat=true;button.set_meta("key",key);add_child(button);button.pressed.connect(func():_press(key));var art:=NinePatchRect.new();_art(art,Rect2(1032 if index==0 else 1271,800,230,95),0.45,32);art.show_behind_parent=true;button.add_child(art);button.set_meta("frame",art);actions[key]=button
		var button: Button=actions[key];button.text=action.label;button.disabled=action.disabled;button.get_meta("frame").texture=prepared[PANEL]
	if prior_image!=model.image:detail_scroll.scroll_vertical=0
	blocked=false;_layout();show();_restore_scroll.call_deferred(old_scroll);_visible_images.call_deferred();surface_ready.emit()
func _restore_scroll(value: int) -> void:scroll.scroll_vertical=value
func _layout_row(key: String) -> void:
	if not rows.has(key):return
	var row: Dictionary=rows[key];row.label.position=Vector2(76,9);row.label.size=Vector2(maxf(1,row.button.size.x-88),0)
	var height: float=maxf(116,row.label.get_minimum_size().y+18);row.button.custom_minimum_size.y=height;row.image.position=Vector2(9,12);row.image.size=Vector2(58,86);row.frame.size=row.button.size/row.frame.scale
func _layout() -> void:
	frame.size=size/frame.scale;banner.position=Vector2(size.x*0.2,6);banner.size=Vector2(size.x*0.6,48)/banner.scale
	title.position=Vector2(18,10);title.size=Vector2(size.x-36,24);subtitle.position=Vector2(18,35);subtitle.size=Vector2(size.x-36,16)
	var split: float=roundf(size.x*0.34);detail_scroll.position=Vector2(18,63);detail_scroll.size=Vector2(split-28,size.y-132);portrait.custom_minimum_size.y=maxf(90,(size.y-132)*0.55)
	list_title.position=Vector2(split,59);list_title.size=Vector2(size.x-split-18,20);scroll.position=Vector2(split,82);scroll.size=Vector2(size.x-split-18,size.y-151)
	var index:=0
	for key in actions:
		var button: Button=actions[key];button.position=Vector2(18+index*(size.x-28)/2,size.y-58);button.size=Vector2((size.x-44)/2,44);button.get_meta("frame").size=button.size/button.get_meta("frame").scale;index+=1
	for key in rows:_layout_row(key)
	_visible_images();queue_redraw()
func _visible_images() -> void:
	for row in rows.values():
		if visible and scroll.get_global_rect().grow(120).intersects(row.button.get_global_rect()):
			var texture: Texture2D=cache.request(row.path)
			if texture!=null:row.image.texture=texture
func _queue_visible_images() -> void:
	if image_refresh_queued:return
	image_refresh_queued=true
	_refresh_after_layout.call_deferred()
func _refresh_after_layout() -> void:
	image_refresh_queued=false
	_visible_images()
func _asset_ready(path: String,texture: Texture2D) -> void:
	for row in rows.values():
		if visible and row.path==path:row.image.texture=texture
func _press(key: String) -> void:
	if not visible or blocked:return
	blocked=true;command_requested.emit(key)
func close_surface() -> void:epoch+=1;hide();blocked=true
func test_reveal_button(key: String) -> bool:
	if rows.has(key):scroll.ensure_control_visible(rows[key].button);_visible_images();return true
	return actions.has(key)
func test_button_rect_json(key: String) -> String:
	var button: Button=actions.get(key) if actions.has(key) else rows.get(key,{}).get("button")
	if button==null or button.disabled:return "null"
	var box:=button.get_global_rect()
	if scroll.is_ancestor_of(button):box=box.intersection(scroll.get_global_rect())
	return JSON.stringify([box.position.x,box.position.y,box.size.x,box.size.y])
func test_layout_json() -> String:
	var contained:=true
	for row in rows.values():contained=contained and row.button.get_rect().size.y>=row.label.position.y+row.label.size.y
	return JSON.stringify({"rowsContained":contained,"footerClear":scroll.position.y+scroll.size.y<size.y-58 and detail_scroll.position.y+detail_scroll.size.y<size.y-58,"rows":rows.size()})
func test_visible_portraits_json() -> String:
	var entries: Array=[]
	for row in rows.values():
		if visible and scroll.get_global_rect().intersects(row.image.get_global_rect()):
			entries.append({"key":str(row.button.get_meta("key")),"path":row.path,"ready":row.image.texture!=null})
	return JSON.stringify(entries)
