extends Control
## Virtualized source catalogue. Only visible portraits and the selected detail
## own textures; rows are pooled and decoding requests are bounded here.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
const ROW_HEIGHT=72
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var nav_scroll:=ScrollContainer.new()
var spacer:=Control.new()
var detail_scroll:=ScrollContainer.new()
var detail:=HBoxContainer.new()
var artwork:=VBoxContainer.new()
var portrait:=TextureRect.new()
var mystery:=Label.new()
var rank:=TextureRect.new()
var rank_label:=Label.new()
var copy:=VBoxContainer.new()
var name_label:=Label.new()
var summary:=Label.new()
var source:=Label.new()
var location:=Label.new()
var stats: Array[Label]=[]
var kpis: Array[Dictionary]=[]
var rows: Array[Dictionary]=[]
var actions: Dictionary={}
var epoch:=0
var images_pending:=false
var row_texture: Texture2D
var peak_pending:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=12;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,subtitle]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",21);title.add_theme_color_override("font_color",Color("ffe8b2"));subtitle.add_theme_font_size_override("font_size",11)
	for index in range(3):
		var icon:=TextureRect.new();_picture(icon);add_child(icon);var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label);kpis.append({"icon":icon,"label":label})
	for scroll in [nav_scroll,detail_scroll]:scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	nav_scroll.add_child(spacer);nav_scroll.get_v_scroll_bar().value_changed.connect(func(_value):_refresh_rows())
	detail.size_flags_horizontal=Control.SIZE_EXPAND_FILL;detail.add_theme_constant_override("separation",10);detail_scroll.add_child(detail);artwork.custom_minimum_size.x=90;detail.add_child(artwork)
	_picture(portrait);portrait.custom_minimum_size=Vector2(90,130);artwork.add_child(portrait);mystery.text="????";mystery.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;mystery.custom_minimum_size=Vector2(90,130);mystery.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;artwork.add_child(mystery)
	_picture(rank);rank.custom_minimum_size=Vector2(80,30);artwork.add_child(rank);rank_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;artwork.add_child(rank_label)
	copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;copy.add_theme_constant_override("separation",8);detail.add_child(copy)
	for label in [name_label,summary]:_text(label);copy.add_child(label)
	name_label.add_theme_font_size_override("font_size",17);name_label.add_theme_color_override("font_color",Color("ffe8b2"))
	for index in range(4):var label:=Label.new();_text(label);copy.add_child(label);stats.append(label)
	for label in [source,location]:_text(label);copy.add_child(label)
	resized.connect(_layout);hide();set_process(false)
func _picture(node: TextureRect) -> void:node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _text(label: Label) -> void:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("061722"))
func _request(path: String) -> Texture2D:
	if path.is_empty():return null
	var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
	if not cache.records.has(path) and not live and cache.pending.size()>=2:return null
	var texture: Texture2D=cache.request(path);peak_pending=maxi(peak_pending,cache.pending.size());return texture
func _portrait_texture(path: String,fallback: String) -> Texture2D:
	if path.is_empty():return null
	if cache.failed.has(path):return _request(fallback) if not fallback.is_empty() and fallback!=path and not cache.failed.has(fallback) else null
	return _request(path)
func _portrait_settled(path: String,fallback: String) -> bool:
	if path.is_empty():return true
	if not cache.failed.has(path):return false
	return fallback.is_empty() or fallback==path or cache.failed.has(fallback)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:surface_ready.emit();return
	epoch+=1;_prepare(next,epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ROW];var loaded: Dictionary={}
	for entry in value.kpis:paths.append(entry.icon)
	if not value.detail.get("rank","").is_empty():paths.append(value.detail.rank)
	var deadline:=Time.get_ticks_msec()+20000
	var detail_texture: Texture2D
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			var texture: Texture2D=_request(path)
			if texture:loaded[path]=texture
			else:ready=false
			if cache.failed.has(path):push_error("Codex UI artwork failed: "+str(path));return
		var path: String=value.detail.get("image","");var fallback: String=value.detail.get("fallback","")
		detail_texture=_portrait_texture(path,fallback)
		if not detail_texture and not _portrait_settled(path,fallback):ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Codex selected artwork timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	var changed_detail: bool=model.get("detail",{})!=value.detail
	model=value;panel.texture=loaded[PANEL];row_texture=loaded[ROW];title.text=value.title;subtitle.text=value.subtitle
	for index in range(value.kpis.size()):kpis[index].icon.texture=loaded[value.kpis[index].icon];kpis[index].label.text=value.kpis[index].label+"　"+value.kpis[index].value
	portrait.texture=detail_texture;portrait.visible=detail_texture!=null;mystery.visible=detail_texture==null;rank.texture=loaded.get(value.detail.get("rank",""));rank.visible=rank.texture!=null;rank_label.visible=not rank.visible;rank_label.text=value.detail.get("rankLabel","")
	name_label.text=value.detail.get("name",value.detail.get("empty",""));summary.text=value.detail.get("summary",value.detail.get("message",""));source.text=value.detail.get("source","");location.text=value.detail.get("location","")
	var info: Array=value.detail.get("stats",[])
	for index in range(stats.size()):stats[index].visible=index<info.size();stats[index].text=info[index].label+"　"+info[index].value if index<info.size() else ""
	for action in value.actions:
		if not actions.has(action.key):
			var button:=Button.new();button.flat=true;button.set_meta("key",action.key);button.pressed.connect(func():if visible:command_requested.emit(str(button.get_meta("key"))));add_child(button);actions[action.key]=button;_frame(button)
		actions[action.key].text=action.label
	_layout();show();_refresh_rows()
	if changed_detail:detail_scroll.scroll_vertical=0
	surface_ready.emit()
func _frame(control: Control) -> void:
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.texture=row_texture;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	control.add_child(frame);control.resized.connect(func():frame.size=control.size/.0625);frame.size=control.size/.0625
func _new_row() -> Dictionary:
	var root:=Button.new();root.flat=true;spacer.add_child(root);_frame(root);root.pressed.connect(func():if visible:command_requested.emit(str(root.get_meta("key"))))
	var image:=TextureRect.new();_picture(image);root.add_child(image)
	var question:=Label.new();question.text="????";question.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;question.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;question.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(question)
	var name_text:=Label.new();name_text.mouse_filter=Control.MOUSE_FILTER_IGNORE;name_text.clip_text=true;name_text.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;name_text.add_theme_font_size_override("font_size",12);root.add_child(name_text)
	var status_text:=Label.new();status_text.mouse_filter=Control.MOUSE_FILTER_IGNORE;status_text.clip_text=true;status_text.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;status_text.add_theme_font_size_override("font_size",10);root.add_child(status_text)
	var result: Dictionary={"root":root,"image":image,"question":question,"name":name_text,"status":status_text,"index":-1,"path":"","fallback":""};rows.append(result);return result
func _refresh_rows() -> void:
	if model.is_empty() or not visible:return
	var first: int=maxi(0,int(nav_scroll.scroll_vertical/ROW_HEIGHT)-1);var count: int=mini(model.entries.size()-first,int(ceil(nav_scroll.size.y/ROW_HEIGHT))+3)
	# Allocate for the viewport even at the last entry, where fewer rows are
	# visible. Scrolling then only rebinds the same controls.
	var capacity: int=mini(model.entries.size(),int(ceil(nav_scroll.size.y/ROW_HEIGHT))+3)
	while rows.size()<capacity:_new_row()
	for slot in range(rows.size()):
		var row: Dictionary=rows[slot]
		if slot>=count:row.root.hide();row.image.texture=null;row.path="";row.index=-1;continue
		var index: int=first+slot;var entry: Dictionary=model.entries[index];row.root.show();row.root.position=Vector2(0,index*ROW_HEIGHT);row.root.size=Vector2(spacer.size.x,ROW_HEIGHT-5);row.root.set_meta("key",entry.key)
		if row.index!=index or row.path!=entry.image:row.image.texture=null
		row.index=index;row.path=entry.image;row.fallback=entry.fallback;row.name.text=entry.name;row.status.text=entry.status+" · "+entry.statusLabel+"\n"+entry.location;row.root.modulate=Color.WHITE if entry.selected else Color(.77,.81,.86)
		row.image.position=Vector2(8,6);row.image.size=Vector2(42,54);row.question.position=row.image.position;row.question.size=row.image.size;row.name.position=Vector2(56,5);row.name.size=Vector2(row.root.size.x-64,22);row.status.position=Vector2(56,28);row.status.size=Vector2(row.root.size.x-64,34)
	images_pending=true;set_process(true);_refresh_images()
func _refresh_images() -> void:
	images_pending=false
	for row in rows:
		if not row.root.visible:continue
		var texture: Texture2D=_portrait_texture(row.path,row.fallback)
		if texture and row.image.texture!=texture:row.image.texture=texture
		row.image.visible=row.image.texture!=null;row.question.visible=not row.image.visible
		if not texture and not _portrait_settled(row.path,row.fallback):images_pending=true
	set_process(images_pending)
func _process(_delta: float) -> void:if visible and images_pending:_refresh_images()
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(32,15);title.size=Vector2(size.x-64,28);subtitle.position=Vector2(28,46);subtitle.size=Vector2(size.x-56,22)
	var width: float=(size.x-64)/3
	for index in range(3):kpis[index].icon.position=Vector2(32+index*width,72);kpis[index].icon.size=Vector2(26,27);kpis[index].label.position=Vector2(64+index*width,73);kpis[index].label.size=Vector2(width-32,26)
	var nav_width: float=clampf(size.x*.35,224,320);nav_scroll.position=Vector2(28,107);nav_scroll.size=Vector2(nav_width,size.y-166);spacer.custom_minimum_size=Vector2(nav_width-14,model.get("entries",[]).size()*ROW_HEIGHT);spacer.size=spacer.custom_minimum_size
	detail_scroll.position=Vector2(nav_width+42,107);detail_scroll.size=Vector2(size.x-nav_width-70,size.y-166)
	if model.is_empty():return
	var action_width: float=(size.x-76)/2
	for index in range(model.actions.size()):var button: Button=actions[model.actions[index].key];button.position=Vector2(32+index*(action_width+12),size.y-47);button.size=Vector2(action_width,30)
	_refresh_rows();queue_redraw()
func close_surface() -> void:
	epoch+=1;hide();set_process(false);portrait.texture=null;rank.texture=null
	for row in rows:row.image.texture=null
func test_press(key: String) -> bool:
	if not visible:return false
	if actions.has(key):actions[key].pressed.emit();return true
	for index in range(model.entries.size()):
		if model.entries[index].key==key:
			nav_scroll.scroll_vertical=index*ROW_HEIGHT;_refresh_rows()
			for row in rows:
				if row.index==index:row.root.pressed.emit();return true
	return false
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,subtitle,nav_scroll,detail_scroll]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	for button in actions.values():
		if not bounds.encloses(Rect2(button.position,button.size)):return false
	return detail.size.x<=detail_scroll.size.x+1 and rows.size()<=int(ceil(432.0/ROW_HEIGHT))+3
func test_images_ready() -> bool:return not images_pending
func test_scroll_list(index: int) -> void:nav_scroll.scroll_vertical=index*ROW_HEIGHT;_refresh_rows()
func test_scroll_detail_end() -> void:detail_scroll.scroll_vertical=int(detail.size.y)
func test_resources_json() -> String:return JSON.stringify({"poolRows":rows.size(),"dataRows":model.get("entries",[]).size(),"peakPending":peak_pending,"cacheBytes":cache.resident_bytes,"cacheLimit":cache.byte_limit,"decodes":cache.decode_count})
func test_identity_json() -> String:
	var result: Array=[]
	for row in rows:result.append(row.root.get_instance_id())
	return JSON.stringify(result)
