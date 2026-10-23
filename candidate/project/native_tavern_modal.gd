extends Control
## Original tavern data and handlers; persistent fullscreen native controls.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var epoch:=0
var prepared: Dictionary={}
var background:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var money:=Label.new()
var keeper:=TextureRect.new()
var keeper_copy:=RichTextLabel.new()
var heading:=Label.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Dictionary={}
var detail_scroll:=ScrollContainer.new()
var detail_column:=VBoxContainer.new()
var portrait:=TextureRect.new()
var detail_name:=Label.new()
var detail_meta:=Label.new()
var detail_text:=RichTextLabel.new()
var actions: Dictionary={}
var wanted_scroll:=0
var row_writes:=0
var blocked:=false
var inert:=false
var keeper_path:=""
var impel_result: Control

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=14;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(margin,224)
	add_child(background)
	for label in [title,subtitle,money,heading]:label.clip_text=true;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",20);title.add_theme_color_override("font_color",Color("f5e5c5"));money.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	subtitle.add_theme_font_size_override("font_size",12);heading.add_theme_font_size_override("font_size",12)
	_picture(keeper);add_child(keeper);keeper_copy.bbcode_enabled=false;keeper_copy.scroll_active=true;add_child(keeper_copy)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",6);scroll.add_child(list)
	scroll.get_v_scroll_bar().value_changed.connect(func(_value):_visible_thumbnails())
	detail_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(detail_scroll);detail_column.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail_column.add_theme_constant_override("separation",7);detail_scroll.add_child(detail_column)
	_picture(portrait);portrait.custom_minimum_size.y=96;detail_column.add_child(portrait)
	for label in [detail_name,detail_meta]:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail_column.add_child(label)
	detail_name.add_theme_color_override("font_color",Color("ffe1a4"));detail_meta.add_theme_font_size_override("font_size",12)
	detail_text.bbcode_enabled=false;detail_text.fit_content=true;detail_text.scroll_active=false;detail_text.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail_column.add_child(detail_text)
	impel_result=preload("res://native_impel_recruit_result.gd").new();add_child(impel_result)
	impel_result.command_requested.connect(func(key):
		if blocked or inert:return
		blocked=true;command_requested.emit(key)
	)
	cache.asset_ready.connect(_asset_ready);resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func _picture(value: TextureRect) -> void:value.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;value.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;value.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _frame(button: Control) -> NinePatchRect:
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*0.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(margin,160)
	button.add_child(frame);button.set_meta("frame",frame);return frame
func _button(key: String,parent: Node) -> Button:
	var button:=Button.new();button.flat=true;button.set_meta("key",key);parent.add_child(button);_frame(button)
	button.pressed.connect(func():
		if blocked or inert:return
		blocked=true;command_requested.emit(key)
	);return button
func apply_json(value: String) -> void:epoch+=1;blocked=true;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png"]
	if value.kind=="tavern":paths.append(value.keeper);paths.append(value.detail.image)
	else:paths.append(value.image)
	if value.kind=="impel-recruit-result":
		paths.append(value.art.frame)
		if value.full:
			paths.append(value.art.replacementFrame)
			for row in value.replacements:paths.append(row.image)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	for path in paths:
		if prepared.has(path):available[path]=prepared[path]
	while token==epoch:
		var ready:=true
		for path in paths:
			if str(path).is_empty() or available.has(path):continue
			if cache.failed.has(path):push_error("Native tavern asset failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Native tavern asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;prepared=available;blocked=false;_commit()
func _commit() -> void:
	if model.kind=="impel-recruit-result":
		for node in [background,title,subtitle,money,heading,keeper,keeper_copy,scroll,detail_scroll]:node.hide()
		for button in actions.values():button.hide()
		impel_result.size=size;impel_result.apply(model,prepared);show();surface_ready.emit();return
	impel_result.hide();background.show();title.show();subtitle.show();detail_scroll.show()
	background.texture=prepared["mobile/art-ui/mobile-panel-v013.png"];title.text=model.title;subtitle.text=model.subtitle
	var main: bool=model.kind=="tavern"
	keeper.visible=main;keeper_copy.visible=main;money.visible=main;heading.visible=main
	var entries: Array=model.rows if main else model.replacements
	scroll.visible=main or not entries.is_empty()
	if main:
		portrait.custom_minimum_size.y=96
		money.text=model.money;keeper_path=model.keeper;keeper.texture=prepared[keeper_path];keeper_copy.text=model.keeperText;heading.text=model.listHeading
		portrait.texture=prepared.get(model.detail.image);detail_name.text=model.detail.name;detail_meta.text=model.detail.meta;detail_text.text=model.detail.text
	else:
		portrait.texture=prepared[model.image];detail_name.text=model.name;detail_meta.text=model.meta;detail_text.text=model.detail if entries.is_empty() else model.subtitle
		if str(model.kind).begins_with("impel-"):detail_text.text=model.detail+"\n\n"+model.subtitle
	var keep: Dictionary={}
	for index in range(entries.size()):
		var item: Dictionary=entries[index];var key: String=item.key;keep[key]=true
		if not rows.has(key):
			var button:=_button(key,list);button.custom_minimum_size.y=100;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
			var picture:=TextureRect.new();_picture(picture);button.add_child(picture)
			var text:=Label.new();text.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;text.mouse_filter=Control.MOUSE_FILTER_IGNORE;text.add_theme_font_size_override("font_size",12);button.add_child(text)
			text.minimum_size_changed.connect(func():_layout_row.call_deferred(key))
			rows[key]={"button":button,"picture":picture,"text":text,"path":item.image};button.resized.connect(func():_layout_row(key));row_writes+=1
		var row: Dictionary=rows[key];list.move_child(row.button,index);row.button.custom_minimum_size.y=100 if main else 126;row.button.disabled=item.get("disabled",false);row.path=item.image
		row.button.get_meta("frame").texture=prepared["mobile/art-ui/mobile-row-v013.png"];row.button.get_meta("frame").self_modulate=Color("ffe1a4") if item.get("selected",false) else Color.WHITE
		row.text.text=(item.grade+" · "+item.name+"\n"+item.meta+"\n"+item.bottom) if main else item.name+"\n"+item.detail
	for key in rows.keys():
		if not keep.has(key):rows[key].button.queue_free();rows.erase(key)
	keep.clear()
	for item in model.actions:
		var key: String=item.key;keep[key]=true
		if not actions.has(key):actions[key]=_button(key,self)
		var button: Button=actions[key];button.show();button.text=item.label;button.disabled=item.disabled;button.get_meta("frame").texture=prepared["mobile/art-ui/mobile-row-v013.png"]
	for key in actions:
		if not keep.has(key):actions[key].hide()
	_layout();call_deferred("_layout");show();surface_ready.emit();call_deferred("set_list_scroll_top",wanted_scroll);call_deferred("_visible_thumbnails")
func _layout_row(key: String) -> void:
	if not rows.has(key):return
	var row: Dictionary=rows[key];var width: float=row.button.size.x
	row.button.get_meta("frame").size=row.button.size/0.0625;row.picture.position=Vector2(8,10);row.picture.size=Vector2(44,80)
	row.text.position=Vector2(58,8);row.text.size=Vector2(maxf(1,width-68),row.button.size.y-16)
func _layout() -> void:
	if impel_result:impel_result.size=size
	if model.get("kind","")=="impel-recruit-result":return
	background.size=size/0.125;title.position=Vector2(28,16);title.size=Vector2(size.x-190,28)
	subtitle.position=Vector2(28,47);subtitle.size=Vector2(size.x-56,25)
	money.position=Vector2(size.x-180,16);money.size=Vector2(150,28)
	if model.is_empty():return
	var main: bool=model.kind=="tavern";var top:=80.0;var height:=size.y-160
	var first:=size.x*0.19;var second:=size.x*0.36
	if main:
		keeper.position=Vector2(28,top);keeper.size=Vector2(first-38,96);keeper_copy.position=Vector2(28,top+100);keeper_copy.size=Vector2(first-38,maxf(40,height-100))
		heading.position=Vector2(first,top);heading.size=Vector2(second-8,32)
		scroll.position=Vector2(first,top+36);scroll.size=Vector2(second-8,height-36)
		detail_scroll.position=Vector2(first+second,top);detail_scroll.size=Vector2(size.x-first-second-28,height)
	else:
		title.size.x=size.x-56;scroll.position=Vector2(28,top);scroll.size=Vector2(size.x*0.48-34,height)
		detail_scroll.position=Vector2(size.x*0.5 if not model.replacements.is_empty() else 28,top)
		detail_scroll.size=Vector2(size.x-detail_scroll.position.x-28,height)
		portrait.custom_minimum_size.y=120
	var index:=0
	for item in model.actions:
		var button: Button=actions[item.key];button.position=Vector2(28+index*(size.x-48)/model.actions.size(),size.y-68);button.size=Vector2((size.x-48)/model.actions.size()-8,48);button.get_meta("frame").size=button.size/0.0625;index+=1
	for key in rows:_layout_row(key)
	_visible_thumbnails();queue_redraw()
func _visible_thumbnails() -> void:
	for row in rows.values():
		if not visible or not scroll.visible or not scroll.get_global_rect().grow(100).intersects(row.button.get_global_rect()):row.picture.texture=null;continue
		if row.picture.texture!=null and row.picture.get_meta("loaded","")==row.path:continue
		var texture: Texture2D=cache.request(row.path)
		if texture!=null:row.picture.texture=texture;row.picture.set_meta("loaded",row.path)
func _asset_ready(path: String,texture: Texture2D) -> void:
	if visible and model.get("kind","")=="tavern" and path==keeper_path:keeper.texture=texture
	for row in rows.values():
		if row.path==path and visible and scroll.visible and scroll.get_global_rect().grow(100).intersects(row.button.get_global_rect()):row.picture.texture=texture;row.picture.set_meta("loaded",path)
func keeper_frame(path: String) -> void:
	keeper_path=path
	var texture: Texture2D=cache.request(path)
	if texture!=null and model.get("kind","")=="tavern":keeper.texture=texture
func list_scroll_top() -> int:return scroll.scroll_vertical
func set_list_scroll_top(value: int) -> void:wanted_scroll=maxi(0,value);scroll.scroll_vertical=wanted_scroll
func close_surface() -> void:epoch+=1;hide();blocked=true;impel_result.hide();_visible_thumbnails()
func current_kind() -> String:return str(model.get("kind",""))
func test_reveal_button(key: String) -> bool:
	if model.get("kind","")=="impel-recruit-result":return impel_result.reveal(key)
	var button: Button=actions.get(key) if actions.has(key) else rows.get(key,{}).get("button")
	if button==null or not button.is_visible_in_tree():return false
	if scroll.is_ancestor_of(button):scroll.ensure_control_visible(button)
	return true
func test_button_rect_json(key: String) -> String:
	if model.get("kind","")=="impel-recruit-result":return impel_result.button_rect(key)
	var button: Button=actions.get(key) if actions.has(key) else rows.get(key,{}).get("button")
	if button==null or not button.is_visible_in_tree() or button.disabled:return "null"
	var box:=button.get_global_rect()
	if scroll.is_ancestor_of(button):box=box.intersection(scroll.get_global_rect())
	return JSON.stringify([box.position.x,box.position.y,box.size.x,box.size.y])
func set_control_disabled(key: String,value: bool) -> void:
	if model.get("kind","")=="impel-recruit-result":
		var target: Button=impel_result.buttons.get(key)
		if target!=null:target.disabled=value
		return
	var button: Button=actions.get(key) if actions.has(key) else rows.get(key,{}).get("button")
	if button!=null:button.disabled=value
func release_action_lock() -> void:blocked=false
func set_inert(value: bool) -> void:inert=value;blocked=false
func test_layout_json() -> String:
	if model.get("kind","")=="impel-recruit-result":return impel_result.layout_json()
	var rows_contained:=true
	var row_bounds: Array=[]
	for row in rows.values():rows_contained=rows_contained and row.button.get_global_rect().encloses(row.text.get_global_rect())
	for row in rows.values():
		var b: Rect2=row.button.get_global_rect();var t: Rect2=row.text.get_global_rect();row_bounds.append({"button":[b.position.x,b.position.y,b.size.x,b.size.y],"text":[t.position.x,t.position.y,t.size.x,t.size.y]})
	var footer_clear:=true
	for button in actions.values():
		if button.visible:footer_clear=footer_clear and not button.get_global_rect().intersects(scroll.get_global_rect()) and not button.get_global_rect().intersects(detail_scroll.get_global_rect())
	return JSON.stringify({"rowsContained":rows_contained,"footerClear":footer_clear,"rows":rows.size(),"rowWrites":row_writes,"rowBounds":row_bounds})
func test_press(key: String) -> bool:
	if not visible or blocked or inert:return false
	if model.get("kind","")=="impel-recruit-result":
		var target: Button=impel_result.buttons.get(key)
		if target==null or not target.is_visible_in_tree() or target.disabled:return false
		target.pressed.emit();return true
	var button: Button=actions.get(key) if actions.has(key) else rows.get(key,{}).get("button")
	if button==null or not button.visible or button.disabled:return false
	button.pressed.emit();return true
