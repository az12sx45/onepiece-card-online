extends Control
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var epoch:=0
var busy:=false
var pieces: Array=[]
var frame_texture: Texture2D
var heading:=Label.new()
var points:=Label.new()
var opponent_heading:=Label.new()
var crew_heading:=Label.new()
var portrait:=TextureRect.new()
var rules:=RichTextLabel.new()
var scroll:=ScrollContainer.new()
var content:=Control.new()
var cells: Array=[]
var crew_cells: Array=[]
var actions: Array=[]
var columns:=4
var cell_width:=100.0
const ROW_HEIGHT:=74.0
func _image(image: TextureRect,parent: Node) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(image)
func _piece(region: Rect2,parent: Node=null) -> NinePatchRect:
	var patch:=NinePatchRect.new();patch.mouse_filter=Control.MOUSE_FILTER_IGNORE;patch.scale=Vector2.ONE*.35;patch.set_meta("region",region)
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:patch.set_patch_margin(side,26)
	if parent==null:parent=self
	parent.add_child(patch);return patch
func _texture(patch: NinePatchRect) -> void:
	var atlas:=AtlasTexture.new();atlas.atlas=frame_texture;atlas.region=patch.get_meta("region");patch.texture=atlas
func _place(patch: NinePatchRect,rect: Rect2) -> void:patch.position=rect.position;patch.size=rect.size/.35
func _cell(parent: Node) -> Dictionary:
	var button:=Button.new();button.flat=true;parent.add_child(button);var art:=_piece(Rect2(482,672,126,152),button);art.show_behind_parent=true;var image:=TextureRect.new();_image(image,button)
	var name_label:=Label.new();name_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;name_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;name_label.add_theme_font_size_override("font_size",10);name_label.add_theme_color_override("font_color",Color("ffe6ac"));name_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(name_label)
	var meta:=Label.new();meta.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;meta.add_theme_font_size_override("font_size",9);meta.add_theme_color_override("font_color",Color("b4cbd2"));meta.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(meta)
	var badge:=Label.new();badge.add_theme_font_size_override("font_size",13);badge.add_theme_color_override("font_color",Color("78e9ef"));badge.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(badge)
	var cell: Dictionary={"button":button,"art":art,"picture":image,"name":name_label,"meta":meta,"badge":badge,"data":{}}
	button.pressed.connect(func():if visible and not busy and not button.disabled and not cell.data.is_empty():command_requested.emit(cell.data.key));return cell
func _ready() -> void:
	clip_contents=true;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;mouse_filter=Control.MOUSE_FILTER_STOP;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(700);theme=t
	for region in [Rect2(461,52,750,113),Rect2(110,235,327,306),Rect2(113,546,327,323),Rect2(458,187,977,437),Rect2(460,638,835,224)]:pieces.append(_piece(region))
	for label in [heading,points,opponent_heading,crew_heading]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("ffe4a4"));add_child(label)
	heading.add_theme_font_size_override("font_size",17);heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;points.add_theme_font_size_override("font_size",11);opponent_heading.add_theme_font_size_override("font_size",11);crew_heading.add_theme_font_size_override("font_size",11)
	_image(portrait,self);rules.add_theme_font_size_override("normal_font_size",11);rules.add_theme_color_override("default_color",Color("dfd4b5"));rules.scroll_active=true;add_child(rules)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;scroll.follow_focus=false;scroll.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(scroll);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.mouse_filter=Control.MOUSE_FILTER_PASS;scroll.add_child(content);scroll.get_v_scroll_bar().value_changed.connect(func(_v):_visible_cells())
	for i in range(6):crew_cells.append(_cell(self))
	for i in range(2):
		var button:=Button.new();button.add_theme_font_size_override("font_size",13);button.add_theme_color_override("font_color",Color("ffe4a4"));button.add_theme_stylebox_override("normal",StyleBoxEmpty.new());add_child(button);var art:=_piece(Rect2(1326,666+i*91,295,76),button);art.show_behind_parent=true;actions.append({"button":button,"art":art});button.pressed.connect(func():if visible and not busy and not button.disabled:command_requested.emit(str(button.get_meta("key"))))
	cache.asset_ready.connect(_asset_ready);cache.asset_failed.connect(func(_path,_error):if visible:_refresh_images());resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("09141c"));draw_rect(Rect2(1,1,size.x-2,size.y-2),Color("98703e"),false,2)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	if not visible:scroll.scroll_vertical=0;rules.scroll_to_line(0)
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(sequence: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	while sequence==epoch:
		frame_texture=cache.request(model.frame)
		if frame_texture:break
		if cache.failed.has(model.frame) or Time.get_ticks_msec()>deadline:push_error("Original arena frame unavailable");return
		await get_tree().process_frame
	if sequence!=epoch:return
	for patch in pieces:_texture(patch)
	heading.text=model.title;points.text=model.points;opponent_heading.text=model.opponentHeading+"  "+model.opponentCount;crew_heading.text=model.crewHeading+"  "+model.crewCount;rules.text="\n\n".join(model.rules)
	for i in range(6):
		crew_cells[i].button.visible=i<model.crew.size()
		if i<model.crew.size():_bind(crew_cells[i],model.crew[i])
	for i in range(2):
		actions[i].button.visible=i<model.actions.size()
		if i<model.actions.size():actions[i].button.text=model.actions[i].label;actions[i].button.disabled=model.actions[i].disabled;actions[i].button.set_meta("key",model.actions[i].key);_texture(actions[i].art)
	busy=false;_layout();_refresh_images();show();surface_ready.emit()
func _path(data: Dictionary) -> String:
	var primary: String=str(data.get("image",""));return str(data.get("fallback","")) if cache.failed.has(primary) else primary
func _assign(image: TextureRect,data: Dictionary) -> void:
	var path:=_path(data)
	if str(image.get_meta("path",""))!=path:image.texture=null;image.set_meta("path",path)
	if path.is_empty() or cache.failed.has(path):return
	var texture: Texture2D=cache.request(path)
	if texture and image.texture!=texture:image.texture=texture
func _bind(cell: Dictionary,data: Dictionary) -> void:
	if cell.data==data:return
	cell.data=data;cell.button.disabled=data.disabled;cell.name.text=data.name;cell.meta.text=data.meta;cell.badge.text=data.order;_texture(cell.art)
	var style:=StyleBoxFlat.new();style.bg_color=Color(0,0,0,0);style.border_color=Color("64e4ee" if data.selected else "806642");style.set_border_width_all(2 if data.selected else 0);style.set_corner_radius_all(5);cell.button.add_theme_stylebox_override("normal",style);_assign(cell.picture,data)
func _refresh_images() -> void:
	if model.is_empty():return
	_assign(portrait,model.portrait)
	for cell in crew_cells+cells:if cell.button.visible and not cell.data.is_empty():_assign(cell.picture,cell.data)
func _asset_ready(path: String,texture: Texture2D) -> void:
	if not visible:return
	for image in [portrait]+(crew_cells+cells).map(func(cell):return cell.picture):
		if image.is_visible_in_tree() and str(image.get_meta("path",""))==path and image.texture!=texture:image.texture=texture
func _cell_layout(cell: Dictionary,rect: Rect2,crew: bool) -> void:
	cell.button.position=rect.position;cell.button.size=rect.size;_place(cell.art,Rect2(Vector2.ZERO,rect.size));cell.picture.position=Vector2(5,4);cell.picture.size=Vector2(rect.size.x-10,rect.size.y-44);cell.name.position=Vector2(4,rect.size.y-40);cell.name.size=Vector2(rect.size.x-8,27);cell.meta.position=Vector2(3,rect.size.y-14);cell.meta.size=Vector2(rect.size.x-6,12);cell.badge.position=Vector2(5,3);cell.badge.size=Vector2(20,18)
func _visible_cells() -> void:
	if model.is_empty() or busy or scroll.size.x<1:return
	columns=maxi(3,int((scroll.size.x-12)/100));cell_width=(scroll.size.x-14)/columns;content.custom_minimum_size=Vector2(0,ceilf(float(model.opponents.size())/columns)*ROW_HEIGHT)
	var first:=maxi(0,int(scroll.scroll_vertical/ROW_HEIGHT))*columns;var count:=columns*(int(ceilf(scroll.size.y/ROW_HEIGHT))+1)
	while cells.size()<count:cells.append(_cell(content))
	for i in range(cells.size()):
		var index:=first+i;cells[i].button.visible=i<count and index<model.opponents.size()
		if cells[i].button.visible:_bind(cells[i],model.opponents[index]);_cell_layout(cells[i],Rect2((index%columns)*cell_width,(index/columns)*ROW_HEIGHT,cell_width-4,ROW_HEIGHT-4),false)
func _layout() -> void:
	queue_redraw()
	if busy or model.is_empty():return
	var left:=size.x*.24;var right:=size.x-left-18;var top:=51.0;var main_height:=size.y-185
	_place(pieces[0],Rect2(8,3,size.x-16,43));heading.position=Vector2(40,12);heading.size=Vector2(size.x-80,24);points.position=Vector2(18,28);points.size=Vector2(left-8,16)
	_place(pieces[1],Rect2(8,top,left-8,main_height*.61));portrait.position=Vector2(18,top+10);portrait.size=Vector2(left-28,main_height*.61-20);_place(pieces[2],Rect2(8,top+main_height*.61+4,left-8,size.y-top-main_height*.61-53));rules.position=Vector2(18,top+main_height*.61+12);rules.size=Vector2(left-28,size.y-rules.position.y-61)
	_place(pieces[3],Rect2(left+6,top,right,main_height));opponent_heading.position=Vector2(left+18,top+6);opponent_heading.size=Vector2(right-24,16);scroll.position=Vector2(left+14,top+25);scroll.size=Vector2(right-16,main_height-33)
	var crew_top:=top+main_height+6;_place(pieces[4],Rect2(left+6,crew_top,right,82));crew_heading.position=Vector2(left+18,crew_top+3);crew_heading.size=Vector2(right-24,16)
	for i in range(6):_cell_layout(crew_cells[i],Rect2(left+14+i*(right-16)/6,crew_top+22,(right-16)/6-3,56),true)
	for i in range(model.actions.size()):actions[i].button.position=Vector2(size.x*.5-208+i*212,size.y-42);actions[i].button.size=Vector2(204,36);_place(actions[i].art,Rect2(Vector2.ZERO,actions[i].button.size))
	_visible_cells()
func capture_scroll_json() -> String:return JSON.stringify([{"key":"arena-opponent-list:0","top":scroll.scroll_vertical},{"key":"arena-rules:0","top":rules.get_v_scroll_bar().value}])
func restore_scroll_json(value: String) -> void:
	for entry in JSON.parse_string(value):
		if entry.key=="arena-opponent-list:0":scroll.scroll_vertical=int(entry.top)
		elif entry.key=="arena-rules:0":rules.get_v_scroll_bar().value=entry.top
	_visible_cells()
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:
	if not visible or busy:return false
	for image in [portrait]+(crew_cells+cells).map(func(cell):return cell.picture):
		if image.is_visible_in_tree() and image.texture==null and not cache.failed.has(str(image.get_meta("path",""))):return false
	return true
func test_reveal_button(key: String) -> bool:
	if key.begins_with("opponent:"):
		for i in range(model.opponents.size()):if model.opponents[i].key==key:scroll.scroll_vertical=int(i/columns)*int(ROW_HEIGHT);_visible_cells();break
	for cell in crew_cells+cells:if cell.button.visible and not cell.data.is_empty() and cell.data.key==key:return test_ready() and not cell.button.disabled
	for action in actions:if action.button.visible and str(action.button.get_meta("key",""))==key:return test_ready() and not action.button.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for cell in crew_cells+cells:
		if cell.button.visible and not cell.data.is_empty() and cell.data.key==key:var rect: Rect2=cell.button.get_global_rect();return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
	for action in actions:
		if action.button.visible and str(action.button.get_meta("key",""))==key:var rect: Rect2=action.button.get_global_rect();return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,points,portrait,rules,scroll,crew_heading,opponent_heading]+crew_cells.map(func(c):return c.button)+actions.map(func(a):return a.button):if node.visible:bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	return JSON.stringify({"bounded":bounded,"readingClear":crew_cells[0].button.position.y+crew_cells[0].button.size.y<actions[0].button.position.y,"pooledCells":cells.size(),"opponents":model.opponents.size()})


