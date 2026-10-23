extends Control
## Persistent full-screen native island/sea choices. Original JS owns actions.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var island_page: Control
var model: Dictionary={}
var background:=NinePatchRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var island:=TextureRect.new()
var description:=RichTextLabel.new()
var actions: Array[Button]=[]
var cards: Array[Dictionary]=[]
var targets: Array[Control]=[]
var epoch:=0
var prepared_textures: Dictionary={}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var font:=preload("res://native_fonts.gd").weighted(700)
	var native_theme:=Theme.new();native_theme.default_font=font;native_theme.default_font_size=16;theme=native_theme
	background.scale=Vector2.ONE*0.125
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(margin,224)
	background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background);targets.append(background)
	for label in [heading,subtitle]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.clip_text=true;label.max_lines_visible=2
		label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_color_override("font_color",Color("f3d18a"));add_child(label)
	heading.add_theme_font_size_override("font_size",22);subtitle.add_theme_font_size_override("font_size",14)
	heading.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(900))
	heading.autowrap_mode=TextServer.AUTOWRAP_OFF
	_prepare_image(island);add_child(island);targets.append(island)
	description.bbcode_enabled=false;description.scroll_active=true;description.add_theme_color_override("default_color",Color("f6ead3"));add_child(description)
	for index in range(2):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",16);add_child(button)
		button.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(900))
		var frame:=TextureRect.new();_prepare_image(frame);frame.stretch_mode=TextureRect.STRETCH_SCALE;button.add_child(frame);button.move_child(frame,0);targets.append(frame)
		# Draw frame beneath native text, never over the button label.
		frame.show_behind_parent=true
		button.set_meta("frame",frame);button.pressed.connect(func():_press(str(button.get_meta("key",""))))
		actions.append(button)
		var card_button:=Button.new();card_button.flat=true;add_child(card_button)
		var picture:=TextureRect.new();_prepare_image(picture);card_button.add_child(picture);targets.append(picture)
		var text:=RichTextLabel.new();text.bbcode_enabled=false;text.scroll_active=true;text.mouse_filter=Control.MOUSE_FILTER_PASS;card_button.add_child(text)
		card_button.pressed.connect(func():_press(str(card_button.get_meta("key",""))))
		cards.append({"button":card_button,"picture":picture,"text":text})
	island_page=preload("res://native_island_decision.gd").new();island_page.cache=cache;island_page.size=size;add_child(island_page);island_page.command_requested.connect(func(key):command_requested.emit(key));island_page.surface_ready.connect(_island_ready)
	cache.asset_ready.connect(_asset_ready);resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))

func _prepare_image(control: TextureRect) -> void:
	control.mouse_filter=Control.MOUSE_FILTER_IGNORE;control.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;control.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED

func _image(control: Control,path: String) -> void:
	control.set_meta("wanted",path)
	var texture: Texture2D=prepared_textures.get(path)
	if texture==null:texture=cache.request(path)
	if texture!=null:control.texture=texture;control.set_meta("loaded",path)

func _asset_ready(path: String,texture: Texture2D) -> void:
	for control in targets:
		if control.get_meta("wanted","")==path:control.texture=texture;control.set_meta("loaded",path)

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if str(next.kind).begins_with("island-"):
		epoch+=1;model=next;island_page.apply_json(value);return
	epoch+=1
	for button in actions:button.disabled=true
	for card in cards:card.button.disabled=true
	_load_then_apply(JSON.parse_string(value),epoch)

func _load_then_apply(value: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png"]
	if value.kind=="sea-choice":
		for entry in value.entries:paths.append(entry.image)
	else:
		paths.append(value.image)
	for action in value.get("actions",[]):paths.append(action.image)
	var available: Dictionary={}
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Native choice image failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Native choice images timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	prepared_textures=available;model=value
	_commit_model()

func _island_ready() -> void:
	for node in [background,heading,subtitle,island,description]+actions:node.hide()
	for card in cards:card.button.hide()
	show();surface_ready.emit()

func _commit_model() -> void:
	island_page.close_surface()
	background.show();heading.show();subtitle.show()
	_image(background,"mobile/art-ui/mobile-panel-v013.png")
	heading.text=model.title
	var is_island: bool=model.kind!="sea-choice"
	island.visible=is_island;description.visible=is_island
	subtitle.text=model.get("remaining",model.get("subtitle",""))
	if is_island:
		_image(island,model.image);description.text=model.brief+"\n\n"+model.hint
	for index in range(2):
		var button: Button=actions[index];var card: Dictionary=cards[index]
		button.visible=index<model.get("actions",[]).size();card.button.visible=not is_island
		button.disabled=false;card.button.disabled=false
		if button.visible:
			var action: Dictionary=model.actions[index]
			button.text=action.label;button.set_meta("key",action.key);_image(button.get_meta("frame"),action.image)
		if not is_island:
			var entry: Dictionary=model.entries[index]
			card.button.disabled=entry.get("readonly",false)
			card.button.set_meta("key",entry.key);_image(card.picture,entry.image)
			card.text.text=entry.label+"\n\n"+entry.teaser+("\n\n"+"\n".join(entry.details) if not entry.details.is_empty() else "")
	_layout();call_deferred("_layout");show();surface_ready.emit()

func _layout() -> void:
	queue_redraw()
	if island_page:
		island_page.size=size
		if str(model.get("kind","")).begins_with("island-"):return
	background.size=size/0.125
	heading.position=Vector2(36,20);heading.size=Vector2(size.x-72,30)
	subtitle.position=Vector2(36,52);subtitle.size=Vector2(size.x-72,40)
	island.position=Vector2(38,96);island.size=Vector2(size.x*0.34,size.y-174)
	description.position=Vector2(size.x*0.42,100);description.size=Vector2(size.x*0.58-42,size.y-180)
	for index in range(2):
		var button: Button=actions[index]
		button.position=Vector2(36+index*(size.x-64)/2.0,size.y-68);button.size=Vector2((size.x-80)/2.0,48)
		if model.get("actions",[]).size()==1:button.position.x=size.x*0.3;button.size.x=size.x*0.4
		var frame: TextureRect=button.get_meta("frame");frame.position=Vector2.ZERO;frame.size=button.size
		var card: Dictionary=cards[index]
		card.button.position=Vector2(28+index*(size.x-48)/2.0,98);card.button.size=Vector2((size.x-64)/2.0,size.y-124)
		if model.get("kind","")=="sea-choice" and not model.get("actions",[]).is_empty():card.button.size.y-=56
		var width:=minf(card.button.size.y*0.683,card.button.size.x*0.54)
		card.picture.position=Vector2.ZERO;card.picture.size=Vector2(width,card.button.size.y)
		card.text.position=Vector2(width+10,8);card.text.size=Vector2(card.button.size.x-width-12,card.button.size.y-16)

func _press(key: String) -> void:
	if key.is_empty():return
	for button in actions:button.disabled=true
	for card in cards:card.button.disabled=true
	command_requested.emit(key)

func close_surface() -> void:epoch+=1;island_page.close_surface();hide()

func test_press(key: String) -> bool:
	if island_page.visible:return island_page.test_press(key)
	if not visible:return false
	var buttons: Array=actions.duplicate()
	for card in cards:buttons.append(card.button)
	for button in buttons:
		if button.visible and not button.disabled and button.get_meta("key","")==key:button.pressed.emit();return true
	return false

func current_kind() -> String:return str(model.get("kind",""))

func test_ready() -> bool:return visible and island_page.test_ready()
func test_reveal_button(key: String) -> bool:return island_page.test_reveal_button(key)
func test_button_rect_json(key: String) -> String:return island_page.test_button_rect_json(key)
func test_layout_json() -> String:return island_page.test_layout_json()

