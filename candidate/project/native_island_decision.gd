extends Control
signal command_requested(key: String)
signal surface_ready
const FRAME="images/board/island_decision_ui/island_decision_panel_frame.webp"
var cache: Node
var model: Dictionary={}
var epoch:=0
var busy:=false
var parts: Array=[]
var heading:=Label.new()
var portrait:=TextureRect.new()
var texts: Array=[]
var actions: Array=[]
func _part(region: Rect2) -> NinePatchRect:
	var patch:=NinePatchRect.new();patch.set_meta("region",region);patch.mouse_filter=Control.MOUSE_FILTER_IGNORE;patch.scale=Vector2.ONE*.25
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:patch.set_patch_margin(side,38)
	add_child(patch);parts.append(patch);return patch
func _place(patch: NinePatchRect,rect: Rect2) -> void:patch.position=rect.position;patch.size=rect.size/.25
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);theme=t
	for region in [Rect2(422,27,826,167),Rect2(98,165,575,569),Rect2(685,202,847,161),Rect2(685,374,847,120),Rect2(685,501,847,205)]:_part(region)
	portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(portrait)
	heading.add_theme_font_size_override("font_size",18);heading.add_theme_color_override("font_color",Color("ffdfa0"));heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(heading)
	for i in range(3):
		var text:=RichTextLabel.new();text.bbcode_enabled=false;text.scroll_active=true;text.add_theme_font_size_override("normal_font_size",14 if i!=1 else 15);text.add_theme_color_override("default_color",Color("f6e7c8"));add_child(text);texts.append(text)
	for i in range(2):
		var button:=Button.new();button.add_theme_font_size_override("font_size",15);button.add_theme_color_override("font_color",Color("ffe5aa"))
		for state in ["normal","pressed","hover","disabled"]:button.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		add_child(button);var frame:=TextureRect.new();frame.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;frame.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true;button.add_child(frame);actions.append({"button":button,"frame":frame});button.pressed.connect(func():if visible and not busy and not button.disabled:command_requested.emit(str(button.get_meta("key"))))
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071521"));draw_rect(Rect2(2,2,size.x-4,size.y-4),Color("a88045"),false,2)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(sequence: int) -> void:
	var textures: Dictionary={};var paths: Array=[FRAME,model.image];var deadline:=Time.get_ticks_msec()+20000
	for action in model.actions:paths.append(action.image)
	while sequence==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original island decision image unavailable: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Island decision image timeout");return
		await get_tree().process_frame
	if sequence!=epoch:return
	for patch in parts:var atlas:=AtlasTexture.new();atlas.atlas=textures[FRAME];atlas.region=patch.get_meta("region");patch.texture=atlas
	heading.text=model.title;portrait.texture=textures[model.image];texts[0].text=model.remaining;texts[1].text=model.brief;texts[2].text=model.hint
	for i in range(2):actions[i].button.text=model.actions[i].label;actions[i].button.disabled=false;actions[i].button.set_meta("key",model.actions[i].key);actions[i].frame.texture=textures[model.actions[i].image]
	busy=false;_layout();show();surface_ready.emit()
func _layout() -> void:
	queue_redraw()
	if model.is_empty() or busy:return
	_place(parts[0],Rect2(8,3,size.x-16,51));heading.position=Vector2(30,17);heading.size=Vector2(size.x-60,25)
	var area:=Rect2(8,62,size.x*.36-16,size.y-126);var region: Rect2=parts[1].get_meta("region");var factor:=minf(area.size.x/region.size.x,area.size.y/region.size.y);var extent:=region.size*factor;parts[1].scale=Vector2.ONE*factor;parts[1].size=region.size;parts[1].position=area.get_center()-extent*.5
	portrait.position=parts[1].position+extent*Vector2(.14,.14);portrait.size=extent*.72
	var x:=size.x*.36;var width:=size.x-x-10;var available:=size.y-126;var heights: Array=[available*.28,available*.25,available*.47-12];var y:=62.0
	for i in range(3):_place(parts[i+2],Rect2(x,y,width,heights[i]));texts[i].position=Vector2(x+12,y+9);texts[i].size=Vector2(width-24,heights[i]-18);y+=heights[i]+6
	for i in range(2):actions[i].button.position=Vector2(16+i*(size.x-24)/2,size.y-57);actions[i].button.size=Vector2((size.x-40)/2,48);actions[i].frame.position=Vector2.ZERO;actions[i].frame.size=actions[i].button.size
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_press(key: String) -> bool:
	for action in actions:if test_ready() and str(action.button.get_meta("key",""))==key and not action.button.disabled:action.button.pressed.emit();return true
	return false
func test_reveal_button(key: String) -> bool:
	for action in actions:if test_ready() and str(action.button.get_meta("key",""))==key and not action.button.disabled:return true
	return false
func test_button_rect_json(key: String) -> String:
	for action in actions:if str(action.button.get_meta("key",""))==key:var rect: Rect2=action.button.get_global_rect();return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,portrait]+texts+actions.map(func(a):return a.button):bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	return JSON.stringify({"bounded":bounded,"readingClear":texts[2].position.y+texts[2].size.y<actions[0].button.position.y,"titleFits":heading.get_theme_font("font").get_string_size(heading.text,HORIZONTAL_ALIGNMENT_LEFT,-1,18).x<=heading.size.x})
