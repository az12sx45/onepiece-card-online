extends Control
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
const HEIGHT=70
const Icon=preload("res://native_item_icon.gd")
var cache: Node
var model: Dictionary={}
var busy:=false
var epoch:=0
var panel:=NinePatchRect.new()
var detail_frame:=NinePatchRect.new()
var title:=Label.new()
var owner_label:=Label.new()
var tabs: Array[Button]=[]
var list_scroll:=ScrollContainer.new()
var spacer:=Control.new()
var detail_scroll:=ScrollContainer.new()
var detail:=VBoxContainer.new()
var preview:=Icon.new()
var name_label:=Label.new()
var tier:=Label.new()
var description:=Label.new()
var empty:=Label.new()
var use_button:=Button.new()
var close_button:=Button.new()
var rows: Array[Dictionary]=[]
var row_texture: Texture2D
var framed:=false
var images_pending:=false
var peak_pending:=0
var scroll_target:=""
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=13;theme=t
	for entry in [[panel,.125,224],[detail_frame,.0625,160]]:
		entry[0].scale=Vector2.ONE*entry[1];entry[0].mouse_filter=Control.MOUSE_FILTER_IGNORE
		for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:entry[0].set_patch_margin(side,entry[2])
		add_child(entry[0])
	detail_frame.region_rect=Rect2(0,204,2008,360)
	for label in [title,owner_label,empty]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",21);title.add_theme_color_override("font_color",Color("ffe8b2"));owner_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;owner_label.add_theme_font_size_override("font_size",11);empty.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	for i in range(5):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",12);button.pressed.connect(func():_press(str(button.get_meta("key",""))));add_child(button);tabs.append(button)
	for scroll in [list_scroll,detail_scroll]:scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	list_scroll.add_child(spacer);list_scroll.get_v_scroll_bar().value_changed.connect(func(_v):_rows())
	detail.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail.add_theme_constant_override("separation",8);detail_scroll.add_child(detail)
	var heading:=HBoxContainer.new();heading.add_theme_constant_override("separation",8);detail.add_child(heading);preview.custom_minimum_size=Vector2(90,90);heading.add_child(preview)
	var names:=VBoxContainer.new();names.size_flags_horizontal=Control.SIZE_EXPAND_FILL;names.add_theme_constant_override("separation",6);heading.add_child(names);names.add_child(name_label);names.add_child(tier);detail.add_child(description)
	for label in [name_label,tier,description]:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	name_label.add_theme_font_size_override("font_size",16);name_label.add_theme_color_override("font_color",Color("ffe3a5"));tier.add_theme_font_size_override("font_size",12)
	for button in [use_button,close_button]:button.flat=true;add_child(button)
	use_button.pressed.connect(func():_press("backpackPreviewAction"));close_button.pressed.connect(func():_press("closeItemModalBtn"));resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b2a"))
func _press(key: String) -> void:if visible and not busy and not key.is_empty():command_requested.emit(key)
func _request(path: String) -> Texture2D:
	if path.is_empty():return null
	var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
	if not cache.records.has(path) and not live and cache.pending.size()>=2:return null
	var texture: Texture2D=cache.request(path);peak_pending=maxi(peak_pending,cache.pending.size());return texture
func _icon_textures(icon: Dictionary) -> Dictionary:
	var result: Dictionary={}
	for field in ["image","portrait"]:
		var path: String=icon.get(field,"")
		if path.is_empty():continue
		if cache.failed.has(path):
			path=icon.get("fallback","")
			if path.is_empty() or cache.failed.has(path):push_error("Original backpack icon unavailable");return {}
		var texture: Texture2D=_request(path)
		if texture:result[path]=texture
		else:return {}
	return result
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;busy=true
	if not next.contentVisible:return
	_prepare(next,epoch)
func _prepare(next: Dictionary,token: int) -> void:
	var loaded: Dictionary={};var icon_textures: Dictionary={};var deadline:=Time.get_ticks_msec()+20000
	while epoch==token:
		for path in [PANEL,ROW]:
			if not loaded.has(path):
				var texture: Texture2D=_request(path)
				if texture:loaded[path]=texture
		icon_textures=_icon_textures(next.preview.icon)
		if loaded.size()==2 and not icon_textures.is_empty():break
		if Time.get_ticks_msec()>deadline:push_error("Backpack source artwork timeout");return
		await get_tree().process_frame
	if epoch!=token:return
	var changed_pocket: bool=model.get("active","")!=next.active;var changed_item: bool=model.get("preview",{}).get("name","")!=next.preview.name
	model=next;panel.texture=loaded[PANEL];row_texture=loaded[ROW];detail_frame.texture=row_texture
	if not framed:
		for button in tabs+[use_button,close_button]:_frame(button)
		framed=true
	title.text=model.title;owner_label.text=model.owner;empty.text=model.empty;empty.visible=model.entries.is_empty()
	for i in range(tabs.size()):tabs[i].text=model.categories[i].label+" "+model.categories[i].count;tabs[i].set_meta("key",model.categories[i].key);tabs[i].modulate=Color("ffe4a1") if model.categories[i].selected else Color(.75,.8,.84)
	preview.present(model.preview.icon,icon_textures);name_label.text=model.preview.name;tier.text=model.preview.tier;description.text=model.preview.meta;use_button.text=model.action.label;use_button.visible=not model.action.hidden;use_button.disabled=model.action.disabled;close_button.text=model.close.label
	_layout();show()
	if changed_pocket:list_scroll.scroll_vertical=0
	if changed_item:detail_scroll.scroll_vertical=0
	_rows()
	for i in range(3):
		await get_tree().process_frame
		if epoch!=token:return
	busy=false
	if not scroll_target.is_empty():scroll_to_key(scroll_target)
	surface_ready.emit()
func _frame(button: Button) -> void:
	var frame:=NinePatchRect.new();frame.texture=row_texture;frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*.0625;frame.show_behind_parent=true;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	button.add_child(frame);button.resized.connect(func():frame.size=button.size/.0625);frame.size=button.size/.0625
func _new_row() -> void:
	var button:=Button.new();button.flat=true;spacer.add_child(button);_frame(button);button.pressed.connect(func():_press(str(button.get_meta("key",""))))
	var icon:=Icon.new();button.add_child(icon);var name_text:=Label.new();var info:=Label.new()
	for label in [name_text,info]:label.clip_text=true;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(label)
	name_text.add_theme_font_size_override("font_size",14);info.add_theme_font_size_override("font_size",11);rows.append({"button":button,"icon":icon,"name":name_text,"info":info,"index":-1})
func _rows() -> void:
	if model.is_empty() or not visible:return
	var first:=maxi(0,int(list_scroll.scroll_vertical/HEIGHT)-1);var capacity:=mini(model.entries.size(),int(ceil(list_scroll.size.y/HEIGHT))+3)
	while rows.size()<capacity:_new_row()
	for i in range(rows.size()):
		var row: Dictionary=rows[i];var index:=first+i;row.button.visible=i<capacity and index<model.entries.size()
		if not row.button.visible:row.icon.present({},{});row.index=-1;continue
		var entry: Dictionary=model.entries[index]
		if row.index!=index or row.icon.model!=entry.icon:row.icon.present({}, {})
		row.index=index;row.button.position=Vector2(0,index*HEIGHT);row.button.size=Vector2(spacer.size.x,HEIGHT-5);row.button.set_meta("key",entry.key);row.button.modulate=Color("fff1b8") if entry.selected else Color.WHITE
		row.icon.position=Vector2(8,6);row.icon.size=Vector2(52,52);row.name.position=Vector2(68,9);row.name.size=Vector2(row.button.size.x-78,24);row.name.text=entry.name;row.info.position=Vector2(68,35);row.info.size=Vector2(row.button.size.x-78,23);row.info.text=entry.tier+"　× "+entry.count
	images_pending=true;_images();set_process(images_pending)
func _images() -> void:
	images_pending=false
	for row in rows:
		if not row.button.visible:continue
		var icon: Dictionary=model.entries[row.index].icon;var loaded:=_icon_textures(icon)
		if loaded.is_empty():images_pending=true
		else:row.icon.present(icon,loaded)
	set_process(images_pending)
func _process(_delta: float) -> void:if visible and images_pending:_images()
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(20,12);title.size=Vector2(180,30);owner_label.position=Vector2(208,17);owner_label.size=Vector2(size.x-228,25)
	var tab_width: float=(size.x-40)/5
	for i in range(tabs.size()):tabs[i].position=Vector2(20+i*tab_width,50);tabs[i].size=Vector2(tab_width-4,40)
	var left: float=floor((size.x-52)*.46);detail_frame.position=Vector2(20,99);detail_frame.size=Vector2(left,size.y-158)/.0625;detail_scroll.position=Vector2(30,109);detail_scroll.size=Vector2(left-20,size.y-178)
	spacer.custom_minimum_size=Vector2(size.x-left-66,model.get("entries",[]).size()*HEIGHT);spacer.size=spacer.custom_minimum_size;list_scroll.position=Vector2(left+32,99);list_scroll.size=Vector2(size.x-left-52,size.y-158);empty.position=list_scroll.position+Vector2(14,16);empty.size=list_scroll.size-Vector2(28,32)
	use_button.position=Vector2(20,size.y-51);use_button.size=Vector2(left,38);close_button.position=Vector2(left+32,size.y-51);close_button.size=Vector2(size.x-left-52,38);_rows();queue_redraw()
func close_surface() -> void:
	epoch+=1;busy=false;hide();set_process(false);preview.present({},{});scroll_target=""
	for row in rows:row.icon.present({}, {})
func scroll_to_key(key: String) -> void:
	if busy:scroll_target=key;return
	scroll_target=""
	for i in range(model.entries.size()):
		if model.entries[i].key==key:list_scroll.scroll_vertical=i*HEIGHT;_rows();return
func test_ready() -> bool:return visible and not busy and not images_pending
func test_press(key: String) -> bool:
	if not test_ready():return false
	for button in tabs:
		if button.get_meta("key","")==key:button.pressed.emit();return true
	if key=="backpackPreviewAction":
		if not use_button.visible or use_button.disabled:return false
		use_button.pressed.emit();return true
	if key=="closeItemModalBtn":close_button.pressed.emit();return true
	for row in model.entries:
		if row.key==key:scroll_to_key(key);command_requested.emit(key);return true
	return false
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,owner_label,list_scroll,detail_scroll,use_button,close_button]+tabs:
		if node.visible and not bounds.encloses(node.get_rect()):print("Backpack outside ",node.name," ",node.get_rect()," in ",bounds);return false
	if detail.size.x>detail_scroll.size.x+1:print("Backpack detail width ",detail.size.x," > ",detail_scroll.size.x);return false
	if peak_pending>2:print("Backpack peak loading ",peak_pending);return false
	return true
func test_resources_json() -> String:return JSON.stringify({"poolRows":rows.size(),"entries":model.get("entries",[]).size(),"peakPending":peak_pending,"cacheBytes":cache.resident_bytes})
