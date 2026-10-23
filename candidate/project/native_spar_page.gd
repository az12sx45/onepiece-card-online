extends Control
signal command_requested(key: String)
var cache: Node
var model: Dictionary={}
var busy:=false
var epoch:=0
var parts: Array=[]
var title:=Label.new()
var subtitle:=Label.new()
var center:=TextureRect.new()
var secret:=RichTextLabel.new()
var versus:=Label.new()
var privacy:=Label.new()
var sides: Array=[]
var lock_button:=Button.new()
var lock_label: Label
var detail: Control
func _label(parent: Node,font_size: int) -> Label:
	var label:=Label.new();label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("ffe6aa"));label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(label);return label
func _image(parent: Node) -> TextureRect:
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(image);return image
func _part(region: Rect2) -> NinePatchRect:
	var part:=NinePatchRect.new();part.set_meta("region",region);part.scale=Vector2.ONE*.25;part.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:part.set_patch_margin(side,65)
	add_child(part);parts.append(part);return part
func _place(part: NinePatchRect,rect: Rect2) -> void:part.position=rect.position;part.size=rect.size/.25
func _card(parent: Node) -> Dictionary:
	var button:=Button.new();button.flat=true;parent.add_child(button);var picture:=_image(button);var frame:=_image(button);var name_label:=_label(button,10);var meta:=_label(button,8);var attribute:=_label(button,11);var order:=_label(button,13)
	button.pressed.connect(func():if visible and not busy and model.inputReady:command_requested.emit(str(button.get_meta("key"))))
	return {"button":button,"picture":picture,"frame":frame,"name":name_label,"meta":meta,"attribute":attribute,"order":order}
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);theme=t
	for region in [Rect2(594,31,482,149),Rect2(84,90,566,716),Rect2(1020,90,569,716),Rect2(123,795,586,95),Rect2(967,795,586,95)]:_part(region)
	center.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;center.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;center.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(center);move_child(center,0)
	for label in [title,subtitle,versus,privacy]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_color",Color("ffe8b4"));add_child(label)
	title.add_theme_font_size_override("font_size",17);subtitle.add_theme_font_size_override("font_size",10);versus.add_theme_font_size_override("font_size",24);privacy.add_theme_font_size_override("font_size",10)
	secret.scroll_active=true;secret.add_theme_font_size_override("normal_font_size",11);secret.add_theme_color_override("default_color",Color("d5e9e7"));add_child(secret)
	for side in range(2):
		var scroll:=ScrollContainer.new();scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);var content:=Control.new();content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.mouse_filter=Control.MOUSE_FILTER_PASS;scroll.add_child(content);var cards: Array=[]
		for i in range(6):cards.append(_card(content))
		sides.append({"scroll":scroll,"content":content,"cards":cards,"name":_label(self,11),"ready":_label(self,10)})
	lock_button.add_theme_font_size_override("font_size",11);lock_button.add_theme_color_override("font_color",Color("241907"));var style:=StyleBoxFlat.new();style.bg_color=Color("d6ab57");style.border_color=Color("f9e3a3");style.set_border_width_all(2);style.set_corner_radius_all(5);lock_button.add_theme_stylebox_override("normal",style);add_child(lock_button);lock_label=_label(lock_button,11);lock_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;lock_label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;lock_label.add_theme_color_override("font_color",Color("241907"));lock_button.pressed.connect(func():if visible and not busy and model.inputReady and not lock_button.disabled:command_requested.emit(model.action.key))
	detail=preload("res://native_spar_detail.gd").new();detail.cache=cache;add_child(detail);detail.command_requested.connect(func(key):command_requested.emit(key));resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("040c13"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:return
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(sequence: int) -> void:
	var paths: Array=[model.frame];var textures: Dictionary={};var deadline:=Time.get_ticks_msec()+20000
	for side in model.sides:
		for card in side.cards:paths.append(card.frame);paths.append(card.image)
	while sequence==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original spar asset unavailable: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Spar image timeout");return
		await get_tree().process_frame
	if sequence!=epoch:return
	for part in parts:var atlas:=AtlasTexture.new();atlas.atlas=textures[model.frame];atlas.region=part.get_meta("region");part.texture=atlas
	var backdrop:=AtlasTexture.new();backdrop.atlas=textures[model.frame];backdrop.region=Rect2(651,179,372,611);center.texture=backdrop
	title.text=model.title;subtitle.text=model.subtitle;secret.text=model.secret;versus.text=model.versus;privacy.text=model.privacy;lock_label.text=model.action.label;lock_button.disabled=model.action.disabled or not model.inputReady;lock_label.add_theme_color_override("font_color",Color("ddd2ab" if lock_button.disabled else "241907"))
	for side in range(2):
		sides[side].name.text=model.sides[side].name;sides[side].ready.text=model.sides[side].ready
		for i in range(6):
			var card: Dictionary=sides[side].cards[i];card.button.visible=i<model.sides[side].cards.size()
			if not card.button.visible:continue
			var entry: Dictionary=model.sides[side].cards[i];card.button.set_meta("key",entry.key);card.button.tooltip_text=entry.aria;card.picture.texture=textures[entry.image];card.frame.texture=textures[entry.frame];card.name.text=entry.name;card.meta.text=entry.meta;card.attribute.text=entry.attribute;card.order.text=entry.order;card.order.visible=entry.selected;card.button.modulate=Color("777777") if (entry.locked or entry.revealed) and not entry.selected else Color.WHITE
			var style:=StyleBoxFlat.new();style.bg_color=Color(0,0,0,0);style.border_color=Color("58e5dd" if side==0 else "ff6960");style.set_border_width_all(2 if entry.selected else 0);style.set_corner_radius_all(5);card.button.add_theme_stylebox_override("normal",style)
	busy=false;_layout();show()
	if model.detail:detail.apply_json(JSON.stringify(model.detail))
	else:detail.close_surface()
func _layout() -> void:
	queue_redraw();detail.size=size
	if busy or model.is_empty():return
	_place(parts[0],Rect2(size.x*.29,1,size.x*.42,52));title.position=Vector2(size.x*.29,14);title.size=Vector2(size.x*.42,24);subtitle.position=Vector2(size.x*.25,39);subtitle.size=Vector2(size.x*.5,16)
	var side_width:=size.x*.395;var top:=58.0;var height:=size.y-113
	for side in range(2):
		var x:=8.0 if side==0 else size.x-side_width-8;_place(parts[1+side],Rect2(x,top,side_width,height));sides[side].scroll.position=Vector2(x+12,top+12);sides[side].scroll.size=Vector2(side_width-24,height-24)
		var width: float=(side_width-40)/2;var card_height:=width*4.0/3.0;var gap:=5.0
		for i in range(6):
			var card: Dictionary=sides[side].cards[i];card.button.position=Vector2((i%2)*(width+2),(i/2)*(card_height+gap));card.button.size=Vector2(width,card_height);card.frame.position=Vector2.ZERO;card.frame.size=card.button.size
			card.picture.position=card.button.size*Vector2(.173,.102);card.picture.size=card.button.size*Vector2(.654,.557);card.name.position=card.button.size*Vector2(.145,.675);card.name.size=card.button.size*Vector2(.71,.11);card.meta.position=card.button.size*Vector2(.18,.827);card.meta.size=card.button.size*Vector2(.64,.09);card.attribute.position=card.button.size*Vector2(.19,.115);card.attribute.size=Vector2(18,18);card.order.position=card.button.size*Vector2(.71,.11);card.order.size=Vector2(18,18)
			var font_size:=10;var font: Font=card.name.get_theme_font("font")
			while font_size>7 and font.get_string_size(card.name.text,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x>card.name.size.x:font_size-=1
			card.name.add_theme_font_size_override("font_size",font_size)
		sides[side].content.custom_minimum_size=Vector2(0,ceilf(float(model.sides[side].cards.size())/2)*(card_height+gap));_place(parts[3+side],Rect2(x,size.y-48,side_width,34));sides[side].name.position=Vector2(x+8,size.y-44);sides[side].name.size=Vector2(side_width*.53-8,23);sides[side].ready.position=Vector2(x+side_width*.53,size.y-43);sides[side].ready.size=Vector2(side_width*.47-8,22)
	var cx:=side_width+20;var cw:=size.x-2*cx;center.position=Vector2(cx,58);center.size=Vector2(cw,size.y-125);versus.position=Vector2(cx,size.y*.32);versus.size=Vector2(cw,32);secret.position=Vector2(cx+2,size.y*.51);secret.size=Vector2(cw-4,size.y*.23);lock_button.position=Vector2(cx,size.y-75);lock_button.size=Vector2(cw,40);lock_label.position=Vector2(4,2);lock_label.size=Vector2(cw-8,36);privacy.position=Vector2(8,size.y-20);privacy.size=Vector2(size.x-16,20)
func close_surface() -> void:epoch+=1;busy=false;detail.close_surface();hide()
func test_ready() -> bool:return visible and not busy and model.inputReady and (not model.detail or detail.test_ready())
func test_reveal_button(key: String) -> bool:
	if model.detail:return detail.test_reveal_button(key)
	if key=="id:lockBtn":return test_ready() and not lock_button.disabled
	for side in sides:
		for card in side.cards:if card.button.visible and str(card.button.get_meta("key",""))==key:side.scroll.scroll_vertical=int(card.button.position.y);return test_ready()
	return false
func test_button_rect_json(key: String) -> String:
	if model.detail:return detail.test_button_rect_json(key)
	var target: Control=lock_button if key=="id:lockBtn" else null
	for side in sides:
		for card in side.cards:if card.button.visible and str(card.button.get_meta("key",""))==key:target=card.button
	if target:var r:=target.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func test_layout_json() -> String:
	if model.detail:return detail.test_layout_json()
	var bounded:=true
	for node in [title,subtitle,secret,privacy,lock_button]+sides.map(func(s):return s.scroll):bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	return JSON.stringify({"bounded":bounded,"readingClear":secret.position.y+secret.size.y<lock_button.position.y,"cards":model.sides[0].cards.size()+model.sides[1].cards.size()})




