extends Control
## Original reward options: source art, descriptions and handlers; persistent cards.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var close_button:=Button.new()
var cards: Array[Dictionary]=[]
var epoch:=0
var busy:=false
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=12;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [heading,subtitle]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;add_child(label)
	heading.add_theme_font_size_override("font_size",21);heading.add_theme_color_override("font_color",Color("ffe8b2"));subtitle.add_theme_font_size_override("font_size",12)
	close_button.flat=true;close_button.add_theme_font_size_override("font_size",15);close_button.add_theme_color_override("font_color",Color("ffe8b2"));add_child(close_button);close_button.pressed.connect(func():_press(model.close.key))
	for i in range(4):
		var button:=Button.new();button.flat=true;add_child(button)
		var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
		button.add_child(frame)
		var icon:=preload("res://native_item_icon.gd").new();button.add_child(icon)
		var name_label:=Label.new();var description:=RichTextLabel.new();var action:=Label.new()
		for label in [name_label,action]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(label)
		name_label.add_theme_font_size_override("font_size",14);name_label.add_theme_color_override("font_color",Color("ffe8b2"))
		description.bbcode_enabled=false;description.scroll_active=true;description.mouse_filter=Control.MOUSE_FILTER_PASS;description.add_theme_font_size_override("normal_font_size",11);button.add_child(description)
		action.add_theme_color_override("font_color",Color("ffe8b2"));action.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;action.add_theme_font_size_override("font_size",11)
		button.pressed.connect(func():_press(str(button.get_meta("key",""))))
		cards.append({"button":button,"frame":frame,"icon":icon,"name":name_label,"description":description,"action":action})
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:
	epoch+=1;busy=true;_load(JSON.parse_string(value),epoch)
func _load(next: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png"];var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	for entry in next.entries:paths.append(entry.image)
	while loaded.size()<paths.size() and token==epoch:
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Reward image unavailable: "+path);return
			if not cache.records.has(path) and not cache.live_textures.has(path) and cache.pending.size()>=2:continue
			var texture: Texture2D=cache.request(path)
			if texture!=null:loaded[path]=texture
		if Time.get_ticks_msec()>deadline:push_error("Reward images timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=next;panel.texture=loaded[paths[0]];heading.text=model.title;subtitle.text=model.subtitle;close_button.text=model.close.label
	for i in range(cards.size()):
		var card: Dictionary=cards[i];var entry: Dictionary=model.entries[i];card.button.set_meta("key",entry.key);card.frame.texture=loaded[paths[1]];card.icon.present({"kind":"item","image":entry.image},loaded);card.name.text=entry.name;card.description.text=entry.tier+"\n"+entry.meta;card.action.text=entry.label
	busy=false;_layout();show();surface_ready.emit()
func _layout() -> void:
	panel.size=size/.125;heading.position=Vector2(20,12);heading.size=Vector2(size.x-40,28);subtitle.position=Vector2(20,43);subtitle.size=Vector2(size.x-40,30)
	close_button.position=Vector2(20,size.y-46);close_button.size=Vector2(size.x-40,34)
	var card_size:=Vector2((size.x-52)/2,(size.y-134)/2)
	for i in range(cards.size()):
		var card: Dictionary=cards[i];card.button.position=Vector2(20+(i%2)*(card_size.x+12),78+(i/2)*(card_size.y+8));card.button.size=card_size;card.frame.size=card_size/.0625
		var width:=minf(80,card_size.y-20);card.icon.position=Vector2(8,(card_size.y-width)/2);card.icon.size=Vector2(width,width)
		card.name.position=Vector2(width+14,7);card.name.size=Vector2(card_size.x-width-25,22);card.description.position=Vector2(width+14,31);card.description.size=Vector2(card_size.x-width-25,card_size.y-53);card.action.position=Vector2(width+14,card_size.y-20);card.action.size=Vector2(card_size.x-width-25,16)
	queue_redraw()
func _press(key: String) -> void:
	if not visible or busy:return
	busy=true;command_requested.emit(key)
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_press(key: String) -> bool:
	if not test_ready():return false
	if key==model.close.key:_press(key);return true
	for card in cards:
		if card.button.get_meta("key","")==key:_press(key);return true
	return false
func test_layout() -> bool:
	if not test_ready():return false
	var bounds:=get_global_rect()
	for card in cards:
		if not bounds.encloses(card.button.get_global_rect()):return false
		for node in [card.name,card.description,card.action,card.icon]:
			if not card.button.get_global_rect().encloses(node.get_global_rect()):return false
	return bounds.encloses(close_button.get_global_rect())
