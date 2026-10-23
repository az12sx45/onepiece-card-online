extends Control
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var epoch:=0
var busy:=false
var title: Label
var rule: Label
var hint: Label
var actions:=Button.new()
var pieces: Array=[]
var rows: Array=[]
func _piece(region: Rect2,left: int,right: int) -> NinePatchRect:
	var patch:=NinePatchRect.new();patch.mouse_filter=Control.MOUSE_FILTER_IGNORE;patch.scale=Vector2.ONE*.35;patch.set_meta("region",region);patch.set_patch_margin(SIDE_LEFT,left);patch.set_patch_margin(SIDE_RIGHT,right);patch.set_patch_margin(SIDE_TOP,38);patch.set_patch_margin(SIDE_BOTTOM,38);add_child(patch);pieces.append(patch);return patch
func _label(size_value: int) -> Label:
	var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_size_override("font_size",size_value);label.add_theme_color_override("font_color",Color("ffe1a0"));add_child(label);return label
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(750);theme=t
	_piece(Rect2(450,8,782,124),140,140);_piece(Rect2(196,126,1278,119),80,80)
	for i in range(5):_piece(Rect2(319,246+i*110,1043,102),160,218)
	_piece(Rect2(559,811,561,105),60,60)
	title=_label(17);rule=_label(12);hint=_label(11)
	for label in [title,rule,hint]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	for label in [rule,hint]:label.add_theme_color_override("font_color",Color("483621"))
	for i in range(5):
		var row: Array=[]
		for n in range(5):row.append(_label(12 if n<2 else 10))
		row[0].horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;row[0].add_theme_font_size_override("font_size",18);row[2].add_theme_color_override("font_color",Color("9bc8cb"));row[3].horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;row[4].horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;row[4].add_theme_color_override("font_color",Color("b7d6d2"));rows.append(row)
	add_child(actions);actions.add_theme_font_size_override("font_size",13);actions.add_theme_color_override("font_color",Color("ffe1a0"));actions.add_theme_stylebox_override("normal",StyleBoxEmpty.new());actions.pressed.connect(func():if visible and not busy:command_requested.emit(model.action.key));resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("07141e"));draw_rect(Rect2(1,1,size.x-2,size.y-2),Color("c29c58"),false,2)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;model=next;busy=true;_prepare(epoch)
func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000;var texture: Texture2D
	while token==epoch:
		texture=cache.request(model.frame)
		if texture:break
		if cache.failed.has(model.frame) or Time.get_ticks_msec()>deadline:push_error("Original inversion overview frame unavailable");return
		await get_tree().process_frame
	if token!=epoch:return
	for piece in pieces:var atlas:=AtlasTexture.new();atlas.atlas=texture;atlas.region=piece.get_meta("region");piece.texture=atlas
	title.text=model.title;rule.text=model.rule;hint.text=model.hint;actions.text=model.action.label
	for i in range(5):
		var shown: bool=i<model.rows.size();pieces[i+2].visible=shown
		for label in rows[i]:label.visible=shown
		if shown:
			var row: Dictionary=model.rows[i];var values: Array=[row.badge,row.title,row.destination,row.status,row.owner]
			for j in range(5):rows[i][j].text=values[j]
			rows[i][3].add_theme_color_override("font_color",Color("ef9f83" if row.claimed else "f3d486"))
	busy=false;_layout();show();surface_ready.emit()
func _place(piece: NinePatchRect,rect: Rect2) -> void:piece.position=rect.position;piece.size=rect.size/.35
func _layout() -> void:
	queue_redraw()
	if model.is_empty() or busy:return
	_place(pieces[0],Rect2(8,4,size.x-16,40));title.position=Vector2(28,12);title.size=Vector2(size.x-56,24);_place(pieces[1],Rect2(8,46,size.x-16,40));rule.position=Vector2(30,49);rule.size=Vector2(size.x-60,16);hint.position=Vector2(30,66);hint.size=Vector2(size.x-60,16)
	var row_height: float=(size.y-140)/5;var width:=size.x-24
	for i in range(5):
		var y:=91+i*(row_height+2);_place(pieces[i+2],Rect2(12,y,width,row_height));var row: Array=rows[i];var middle: float=width-149
		row[0].position=Vector2(29,y+(row_height-24)/2);row[0].size=Vector2(34,24);row[1].position=Vector2(72,y+2);row[1].size=Vector2(middle,16);row[2].position=Vector2(72,y+19);row[2].size=Vector2(middle,14);row[3].position=Vector2(size.x-91,y+3);row[3].size=Vector2(69,14);row[4].position=Vector2(size.x-91,y+19);row[4].size=Vector2(69,14)
	_place(pieces[7],Rect2((size.x-210)/2,size.y-39,210,35));actions.position=Vector2((size.x-190)/2,size.y-38);actions.size=Vector2(190,33)
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:return test_ready() and key==model.action.key
func test_button_rect_json(key: String) -> String:
	if key!=model.action.key:return "null"
	var r:=actions.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_layout_json() -> String:
	var bounded:=true;var text_fits:=true
	for row in rows:
		for label in row:
			if label.visible:bounded=bounded and get_global_rect().encloses(label.get_global_rect());text_fits=text_fits and label.get_minimum_size().x<=label.size.x and label.get_minimum_size().y<=label.size.y
	return JSON.stringify({"bounded":bounded,"textFits":text_fits,"readingClear":pieces[6].position.y+pieces[6].size.y*.35<actions.position.y})
