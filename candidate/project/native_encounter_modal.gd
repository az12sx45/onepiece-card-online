extends Control
signal command_requested(key: String)
signal surface_ready
const FRAME="images/board/encounter_ui/encounter_panel_frame.webp"
const ACTION="images/board/encounter_ui/encounter_action_button_frame.webp"
var frame_path: String=FRAME
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var epoch:=0
var busy:=false
var parts: Array=[]
var heading: RichTextLabel
var caption: RichTextLabel
var context: RichTextLabel
var message: RichTextLabel
var detail: RichTextLabel
var portrait:=TextureRect.new()
var portrait_fallback:=Label.new()
var reward_image:=TextureRect.new()
var reward_button:=Button.new()
var stats: Array=[]
var actions: Array=[]
func _copy(font_size: int=12) -> RichTextLabel:
	var label:=RichTextLabel.new();label.bbcode_enabled=false;label.scroll_active=true;label.add_theme_font_size_override("normal_font_size",font_size);label.add_theme_color_override("default_color",Color("f4e2b2"));add_child(label);return label
func _part(region: Rect2,margin: int=28) -> NinePatchRect:
	var patch:=NinePatchRect.new();patch.mouse_filter=Control.MOUSE_FILTER_IGNORE;patch.set_meta("region",region);patch.scale=Vector2.ONE*.4
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:patch.set_patch_margin(side,margin)
	add_child(patch);parts.append(patch);return patch
func _place(patch: NinePatchRect,rect: Rect2) -> void:patch.position=rect.position;patch.size=rect.size/.4
func _picture(image: TextureRect) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(image)
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);t.default_font_size=12;theme=t
	# Reuse independent regions of the original frame. Nine-slice corners retain
	# ornament proportions; mobile reading areas resize without stretching art.
	_part(Rect2(485,40,708,146),48);_part(Rect2(129,193,506,467),32);_part(Rect2(129,667,506,88),24);_part(Rect2(672,193,867,89),28);_part(Rect2(673,411,866,230),28);_part(Rect2(673,643,866,110),28)
	for i in range(6):_part(Rect2(675+(i%3)*287,287+(i/3)*51,278,46),8)
	_picture(portrait);portrait_fallback.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;portrait_fallback.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;portrait_fallback.add_theme_font_size_override("font_size",64);add_child(portrait_fallback);heading=_copy(13);heading.bbcode_enabled=true;caption=_copy(11);context=_copy(11);message=_copy(12);detail=_copy(11)
	for i in range(6):stats.append(_copy(11))
	reward_button.flat=true;reward_button.add_theme_font_size_override("font_size",11);reward_button.alignment=HORIZONTAL_ALIGNMENT_LEFT;add_child(reward_button);_picture(reward_image);reward_button.pressed.connect(func():if visible and not busy and model.reward:command_requested.emit(model.reward.key))
	for i in range(4):
		var button:=Button.new();button.add_theme_font_size_override("font_size",13);button.add_theme_color_override("font_color",Color("ffe3a0"));button.add_theme_color_override("font_disabled_color",Color("837b6d"))
		for state in ["normal","hover","pressed","disabled"]:button.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		add_child(button);var art:=NinePatchRect.new();art.mouse_filter=Control.MOUSE_FILTER_IGNORE;art.scale=Vector2.ONE*.05;art.show_behind_parent=true
		for side in [SIDE_LEFT,SIDE_RIGHT]:art.set_patch_margin(side,400)
		for side in [SIDE_TOP,SIDE_BOTTOM]:art.set_patch_margin(side,180)
		button.add_child(art);button.set_meta("art",art);button.pressed.connect(func():if visible and not busy and not button.disabled:command_requested.emit(str(button.get_meta("key"))));actions.append(button)
	resized.connect(_layout);hide()
func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size),Color("030b12"));draw_rect(Rect2(Vector2(2,2),size-Vector2(4,4)),Color("ad874a"),false,2)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	var paths=[frame_path,ACTION]
	if model.reward:paths.append(model.reward.image)
	var portrait_path: String=str(model.portrait)
	while token==epoch:
		var ready:=true
		if not portrait_path.is_empty() and not textures.has(portrait_path):
			var picture: Texture2D=cache.request(portrait_path)
			if picture:textures[portrait_path]=picture
			elif cache.failed.has(portrait_path):portrait_path=str(model.fallback) if portrait_path!=str(model.fallback) else "";ready=false
			else:ready=false
		for path in paths:
			if str(path).is_empty() or textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):
				if path in [frame_path,ACTION]:push_error("Original encounter frame unavailable: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Original encounter asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	for patch in parts:var atlas:=AtlasTexture.new();atlas.atlas=textures[frame_path];atlas.region=patch.get_meta("region");patch.texture=atlas
	portrait.texture=textures.get(portrait_path);portrait_fallback.visible=portrait.texture==null;portrait_fallback.text=str(model.name).left(1);heading.text="[center]"+str(model.title).replace("[","[lb]")+("\n[font_size=10]"+str(model.eyebrow).replace("[","[lb]")+"[/font_size]" if model.eyebrow else "")+"[/center]";caption.text=model.name+"\n"+model.meta;context.text=model.context+"\n"+model.contextDetail;message.text=model.message
	assert(model.stats.size()==6 and model.actions.size()<=actions.size(),"Original encounter structure changed")
	for i in range(6):stats[i].text=model.stats[i].label+"  "+model.stats[i].value
	for i in range(actions.size()):
		actions[i].visible=i<model.actions.size()
		if actions[i].visible:actions[i].text=model.actions[i].label;actions[i].disabled=model.actions[i].disabled;actions[i].set_meta("key",model.actions[i].key);actions[i].get_meta("art").texture=textures[ACTION];actions[i].add_theme_color_override("font_color",Color("b9d7d7" if model.actions[i].secondary else "ffe3a0"))
	busy=false;_detail();_layout();message.scroll_to_line(0);show();surface_ready.emit()
func update_detail_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value);model.detailText=next.detailText;model.reward=next.reward;_detail()
func _detail() -> void:
	detail.text=(model.detailLabel+"\n" if model.detailLabel else "")+model.detailText;reward_button.visible=model.reward!=null;reward_image.visible=reward_button.visible
	if model.reward:reward_button.set_meta("key",model.reward.key);reward_button.text=model.reward.name+"\n"+model.reward.rate;reward_image.texture=textures.get(model.reward.image);reward_button.modulate=Color("fff0ba" if model.reward.expanded else "ffffff")
func _layout() -> void:
	if busy or model.is_empty():return
	queue_redraw();var left:=size.x*.31;var x:=left+16;var width:=size.x-x-10;var bottom:=size.y-54;var top:=52.0
	_place(parts[0],Rect2(8,4,size.x-16,44));heading.position=Vector2(26,9);heading.size=Vector2(size.x-52,34)
	_place(parts[1],Rect2(8,top,left,bottom-top-48));portrait.position=Vector2(20,top+12);portrait.size=Vector2(left-24,bottom-top-72);portrait_fallback.position=portrait.position;portrait_fallback.size=portrait.size
	_place(parts[2],Rect2(8,bottom-44,left,44));caption.position=Vector2(18,bottom-40);caption.size=Vector2(left-20,36)
	_place(parts[3],Rect2(x,top,width,43));context.position=Vector2(x+10,top+4);context.size=Vector2(width-20,35)
	for i in range(6):var rect:=Rect2(x+(i%3)*(width+4)/3,top+47+(i/3)*27,(width-8)/3,25);_place(parts[6+i],rect);stats[i].position=rect.position+Vector2(5,2);stats[i].size=rect.size-Vector2(10,4)
	var detail_height:=64.0 if model.reward else 51.0;var message_top:=top+105;var detail_top:=bottom-detail_height;_place(parts[4],Rect2(x,message_top,width,detail_top-message_top-4));message.position=Vector2(x+10,message_top+5);message.size=Vector2(width-20,maxf(22,detail_top-message_top-14))
	_place(parts[5],Rect2(x,detail_top,width,detail_height));detail.position=Vector2(x+10,detail_top+7);detail.size=Vector2(width-20,detail_height-14)
	if model.reward:reward_image.position=Vector2(x+9,detail_top+8);reward_image.size=Vector2(36,36);reward_button.position=Vector2(x+48,detail_top+7);reward_button.size=Vector2(width*.4-40,detail_height-14);detail.position.x=x+width*.43;detail.size.x=width*.57-10
	var count: int=model.actions.size();var action_width: float=minf(260,(size.x-24-(count-1)*8)/maxi(1,count));var start: float=(size.x-(action_width*count+(count-1)*8))*.5
	for i in range(count):actions[i].position=Vector2(start+i*(action_width+8),size.y-47);actions[i].size=Vector2(action_width,40);actions[i].get_meta("art").size=actions[i].size/.05
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:
	if model.reward and key==model.reward.key:return test_ready()
	for b in actions:if b.visible and str(b.get_meta("key",""))==key:return test_ready() and not b.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for b in [reward_button]+actions:
		if b.visible and (b==reward_button and model.reward and key==model.reward.key or str(b.get_meta("key",""))==key):var rect: Rect2=b.get_global_rect();return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,caption,context,message,detail]+stats+actions:
		if node.visible:bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	var single_lines:=true
	for label in stats:single_lines=single_lines and label.get_content_height()<=label.size.y
	return JSON.stringify({"bounded":bounded,"readingClear":message.position.y+message.size.y<detail.position.y and detail.position.y+detail.size.y<size.y-47,"statLinesVisible":single_lines})


