extends Control
## Original authored panel/row frames, preserved portrait aspect, native
## selectors and a scrollable list; source handlers retain host authority.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var note:=Label.new()
var close:=Button.new()
var scroll:=ScrollContainer.new()
var content:=Control.new()
var rows: Dictionary={}
var epoch:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(600);t.default_font_size=12;theme=t
	panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.set_patch_margin(SIDE_LEFT,220);panel.set_patch_margin(SIDE_RIGHT,220);panel.set_patch_margin(SIDE_TOP,300);panel.set_patch_margin(SIDE_BOTTOM,248);add_child(panel)
	for label in [heading,subtitle,note]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("ffedbf"));add_child(label)
	heading.add_theme_font_size_override("font_size",20);subtitle.add_theme_font_size_override("font_size",11);note.add_theme_font_size_override("font_size",11)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);scroll.add_child(content);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	close.flat=true;close.add_theme_font_size_override("font_size",16);close.add_theme_color_override("font_color",Color("fff0c6"));add_child(close);close.pressed.connect(func():if visible:command_requested.emit("closeCpuStrategyBtn"))
	resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:surface_ready.emit();return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[value.frame];var loaded: Dictionary={}
	for row in value.rows:paths.append(row.frame);paths.append(row.portrait)
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("CPU artwork failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("CPU artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;panel.texture=loaded[value.frame];heading.text=value.title;subtitle.text=value.subtitle;note.text=value.note;close.text=value.close
	for row in rows.values():row.root.hide()
	for entry in value.rows:
		var row: Dictionary=_row(str(entry.id));row.root.show();row.frame.texture=loaded[entry.frame];row.portrait.texture=loaded[entry.portrait];row.name.text=str(entry.name)+" · "+str(entry.status);row.description.text=entry.description;row.caption.text=entry.caption
		var select: OptionButton=row.select
		if select.get_meta("options",[])!=entry.options:
			select.clear()
			for option in entry.options:select.add_item(str(option.label));select.set_item_metadata(select.item_count-1,str(option.value))
			select.set_meta("options",entry.options)
		select.disabled=entry.disabled
		for index in range(select.item_count):
			if str(select.get_item_metadata(index))==str(entry.value):select.select(index)
	_layout();show();surface_ready.emit()

func _row(id: String) -> Dictionary:
	if rows.has(id):return rows[id]
	var root:=Control.new();content.add_child(root)
	var frame:=NinePatchRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.32;frame.region_rect=Rect2(13,245,2135,224);frame.set_patch_margin(SIDE_LEFT,360);frame.set_patch_margin(SIDE_RIGHT,550);frame.set_patch_margin(SIDE_TOP,32);frame.set_patch_margin(SIDE_BOTTOM,32);root.add_child(frame)
	var portrait:=TextureRect.new();portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(portrait)
	var name_label:=Label.new();name_label.add_theme_font_size_override("font_size",13);name_label.clip_text=true;root.add_child(name_label)
	var desc:=Label.new();desc.add_theme_font_size_override("font_size",11);desc.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;root.add_child(desc)
	var caption:=Label.new();caption.add_theme_font_size_override("font_size",11);root.add_child(caption)
	for label in [name_label,desc,caption]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("fff0ca"))
	var select:=OptionButton.new();select.add_theme_font_size_override("font_size",13);select.add_theme_color_override("font_color",Color("fff0ca"));root.add_child(select);select.get_popup().add_theme_constant_override("v_separation",18)
	for state in ["normal","pressed","disabled","focus"]:select.add_theme_stylebox_override(state,StyleBoxEmpty.new())
	var hover:=StyleBoxFlat.new();hover.bg_color=Color(1,.8,.3,.12);select.add_theme_stylebox_override("hover",hover)
	var popup_style:=StyleBoxFlat.new();popup_style.bg_color=Color("241b11");popup_style.border_color=Color("b5904b");popup_style.set_border_width_all(2);popup_style.set_content_margin_all(10);select.get_popup().add_theme_stylebox_override("panel",popup_style);select.get_popup().add_theme_color_override("font_color",Color("fff0ca"))
	select.item_selected.connect(func(index):
		if visible and not select.disabled:command_requested.emit("cpu-change:"+JSON.stringify({"playerId":id,"value":select.get_item_metadata(index)})))
	var row: Dictionary={"root":root,"frame":frame,"portrait":portrait,"name":name_label,"description":desc,"caption":caption,"select":select};rows[id]=row;return row

func _layout() -> void:
	var factor: float=size.y/941.0
	panel.scale=Vector2.ONE*factor;panel.size=size/factor
	var side: float=230*factor;var body_width: float=size.x-2*side
	heading.position=Vector2(360*factor,80*factor);heading.size=Vector2(size.x-720*factor,100*factor)
	subtitle.position=Vector2(330*factor,200*factor);subtitle.size=Vector2(size.x-660*factor,80*factor)
	content.custom_minimum_size.x=0;scroll.position=Vector2(side,292*factor);scroll.size=Vector2(body_width,394*factor)
	note.position=Vector2(340*factor,716*factor);note.size=Vector2(size.x-680*factor,64*factor)
	close.position=Vector2(size.x*.5-120,850*factor-20);close.size=Vector2(240,40)
	if model.is_empty():return
	var width: float=scroll.size.x-14
	for index in range(model.rows.size()):
		var row: Dictionary=rows[str(model.rows[index].id)];row.root.position=Vector2(0,index*80);row.root.size=Vector2(width,72);row.frame.size=row.root.size/.32;row.portrait.position=Vector2(26,7);row.portrait.size=Vector2(58,58)
		row.name.position=Vector2(112,4);row.name.size=Vector2(maxf(90,width-280),22);row.description.position=Vector2(112,28);row.description.size=Vector2(maxf(90,width-280),40)
		row.caption.position=Vector2(width-150,4);row.caption.size=Vector2(122,22);row.select.position=Vector2(width-150,30);row.select.size=Vector2(122,36)
	content.custom_minimum_size=Vector2(width,model.rows.size()*80);queue_redraw()

func close_surface() -> void:
	epoch+=1
	for row in rows.values():row.select.get_popup().hide()
	hide()
func test_select(id: String,value: String) -> bool:
	if not visible or not rows.has(id):return false
	var row: Dictionary=rows[id];var select: OptionButton=row.select
	if select.disabled:return false
	scroll.ensure_control_visible(select)
	if not scroll.get_global_rect().has_point(select.get_global_rect().get_center()):return false
	for index in range(select.item_count):
		if str(select.get_item_metadata(index))==value:select.select(index);select.item_selected.emit(index);return true
	return false
func test_close() -> void:close.pressed.emit()
func test_popup(id: String) -> bool:
	if not visible or not rows.has(id) or rows[id].select.disabled:return false
	var select: OptionButton=rows[id].select;scroll.ensure_control_visible(select);select.show_popup();return true
func test_popup_bounds(id: String) -> bool:
	var popup: PopupMenu=rows[id].select.get_popup()
	if not popup.visible:return false
	return Rect2i(Vector2i.ZERO,get_window().size).encloses(Rect2i(popup.position,popup.size)) if popup.is_embedded() else Rect2i(get_window().position,get_window().size).encloses(Rect2i(popup.position,popup.size))
func test_close_popup(id: String) -> void:rows[id].select.get_popup().hide()
func test_layout() -> bool:
	var viewport:=Rect2(Vector2.ZERO,size)
	if not viewport.encloses(Rect2(scroll.position,scroll.size)) or not viewport.encloses(Rect2(close.position,close.size)):return false
	for row in rows.values():
		if not row.root.visible:continue
		var bounds:=Rect2(Vector2.ZERO,row.root.size)
		for node in [row.portrait,row.name,row.description,row.caption,row.select]:
			if not bounds.encloses(Rect2(node.position,node.size)):return false
	return true
func test_identity_json() -> String:
	var ids: Dictionary={}
	for id in rows:ids[id]=rows[id].select.get_instance_id()
	return JSON.stringify(ids)
