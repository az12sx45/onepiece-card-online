extends Control
## Original reward options: source art, descriptions and handlers; persistent cards.
signal command_requested(key: String)
signal surface_ready
const PANEL := "mobile/art-ui/mobile-panel-v013.png"
const ROW := "mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var close_button:=Button.new()
var scroll := ScrollContainer.new()
var content := Control.new()
var cards: Array[Dictionary]=[]
var pending_art: Array[String] = []
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
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll);scroll.add_child(content)
	for i in range(4):
		var button:=Button.new();content.add_child(button)
		var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
		button.add_child(frame)
		var icon:=preload("res://native_item_icon.gd").new();button.add_child(icon)
		var name_label:=Label.new();var description:=RichTextLabel.new();var action:=Label.new()
		for label in [name_label,action]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(label)
		name_label.add_theme_font_size_override("font_size",14);name_label.add_theme_color_override("font_color",Color("ffe8b2"))
		description.bbcode_enabled=false;description.scroll_active=false;description.mouse_filter=Control.MOUSE_FILTER_IGNORE;description.add_theme_font_size_override("normal_font_size",11);button.add_child(description)
		action.add_theme_color_override("font_color",Color("ffe8b2"));action.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;action.add_theme_font_size_override("font_size",11)
		button.pressed.connect(func():_press(str(button.get_meta("key",""))))
		cards.append({"button":button,"frame":frame,"icon":icon,"name":name_label,"description":description,"action":action})
	resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:
	model=JSON.parse_string(value)
	pending_art.assign([PANEL,ROW])
	heading.text=model.title;subtitle.text=model.subtitle;close_button.text=model.close.label
	for i in range(cards.size()):
		var card: Dictionary=cards[i];var entry: Dictionary=model.entries[i]
		card.button.set_meta("key",entry.key);card.button.disabled=entry.get("disabled",false)
		card.icon.present({},{});card.name.text=entry.name;card.description.text=entry.tier+"\n"+entry.meta;card.action.text=entry.label
		if not str(entry.image).is_empty() and not pending_art.has(entry.image):pending_art.append(entry.image)
	busy=false;_layout();scroll.scroll_vertical=0;show()
	_refresh_art();surface_ready.emit()

func _process(_delta: float) -> void:_refresh_art()

func _refresh_art() -> void:
	for path in pending_art.duplicate():
		if cache.failed.has(path):
			pending_art.erase(path)
			continue
		if not cache.records.has(path) and not cache.live_textures.has(path) and cache.pending.size()>=2:continue
		var texture: Texture2D=cache.request(path)
		if texture==null:continue
		pending_art.erase(path)
		if path==PANEL:panel.texture=texture
		elif path==ROW:
			for card in cards:
				card.frame.texture=texture;card.button.flat=true
		else:
			for i in range(cards.size()):
				if model.entries[i].image==path:cards[i].icon.present({"kind":"item","image":path},{path:texture})
	set_process(not pending_art.is_empty())

func _layout() -> void:
	const MARGIN := 16.0
	const GAP := 8.0
	var columns := 2 if size.x >= 540 else 1
	var row_count := 4 / columns
	panel.size=size/.125;heading.position=Vector2(MARGIN,8);heading.size=Vector2(size.x-2*MARGIN,28);subtitle.position=Vector2(MARGIN,38);subtitle.size=Vector2(size.x-2*MARGIN,34)
	close_button.position=Vector2(MARGIN,size.y-52);close_button.size=Vector2(size.x-2*MARGIN,44)
	scroll.position=Vector2(MARGIN,76);scroll.size=Vector2(size.x-2*MARGIN,maxf(0,size.y-136))
	var row_height := maxf(118,(scroll.size.y-(row_count-1)*GAP)/row_count)
	var content_height := row_count*row_height+(row_count-1)*GAP
	var bar_width := 16.0 if content_height>scroll.size.y else 0.0
	var card_size:=Vector2(maxf(0,(scroll.size.x-bar_width-(columns-1)*GAP)/columns),row_height)
	content.custom_minimum_size=Vector2(card_size.x*columns+(columns-1)*GAP,content_height)
	for i in range(cards.size()):
		var card: Dictionary=cards[i];card.button.position=Vector2((i%columns)*(card_size.x+GAP),(i/columns)*(card_size.y+GAP));card.button.size=card_size;card.frame.size=card_size/.0625
		var width:=minf(80,card_size.y-20);card.icon.position=Vector2(8,(card_size.y-width)/2);card.icon.size=Vector2(width,width)
		card.name.position=Vector2(width+14,7);card.name.size=Vector2(card_size.x-width-25,22);card.description.position=Vector2(width+14,31);card.description.size=Vector2(card_size.x-width-25,card_size.y-53);card.action.position=Vector2(width+14,card_size.y-20);card.action.size=Vector2(card_size.x-width-25,16)
	queue_redraw()
func _press(key: String) -> void:
	if not visible or busy:return
	busy=true;command_requested.emit(key)
func close_surface() -> void:
	busy=false;pending_art.clear();set_process(false);hide()
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
	var content_bounds:=Rect2(content.global_position,content.custom_minimum_size)
	for card in cards:
		if not content_bounds.encloses(card.button.get_global_rect()):return false
		for node in [card.name,card.description,card.action,card.icon]:
			if not card.button.get_global_rect().encloses(node.get_global_rect()):return false
	return bounds.encloses(scroll.get_global_rect()) and bounds.encloses(close_button.get_global_rect())
