extends Control
## Full-screen hospital with fixed service actions and scrollable original team.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var background:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var island:=TextureRect.new()
var copy:=RichTextLabel.new()
var scroll:=ScrollContainer.new()
var grid:=GridContainer.new()
var cards: Array[Dictionary]=[]
var actions: Array[Button]=[]
var epoch:=0
var prepared: Dictionary={}

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=13;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(margin,224)
	add_child(background)
	for label in [title,subtitle]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.clip_text=true;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.add_theme_font_size_override("font_size",21);title.add_theme_color_override("font_color",Color("f5e5c5"))
	_prepare_picture(island);add_child(island)
	copy.bbcode_enabled=false;copy.scroll_active=true;add_child(copy)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll)
	grid.columns=2;grid.size_flags_horizontal=Control.SIZE_EXPAND_FILL;grid.add_theme_constant_override("h_separation",6);grid.add_theme_constant_override("v_separation",6);scroll.add_child(grid)
	for index in range(6):
		var card:=Control.new();card.custom_minimum_size.y=88;card.size_flags_horizontal=Control.SIZE_EXPAND_FILL;grid.add_child(card)
		var frame:=_frame(card);var picture:=TextureRect.new();_prepare_picture(picture);card.add_child(picture)
		var name_label:=Label.new();name_label.clip_text=true;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;card.add_child(name_label)
		var status:=Label.new();status.clip_text=true;status.add_theme_font_size_override("font_size",11);card.add_child(status)
		var meters: Array=[]
		for color in [Color("62d39b"),Color("65beeb")]:
			var meter:=ProgressBar.new();meter.show_percentage=false;meter.mouse_filter=Control.MOUSE_FILTER_IGNORE
			var fill:=StyleBoxFlat.new();fill.bg_color=color;fill.set_corner_radius_all(2)
			var track:=StyleBoxFlat.new();track.bg_color=Color("0b1825");track.set_corner_radius_all(2)
			meter.add_theme_stylebox_override("fill",fill);meter.add_theme_stylebox_override("background",track);card.add_child(meter)
			var label:=Label.new();label.add_theme_font_size_override("font_size",11);label.mouse_filter=Control.MOUSE_FILTER_IGNORE;card.add_child(label);meters.append({"bar":meter,"label":label})
		cards.append({"root":card,"frame":frame,"picture":picture,"name":name_label,"status":status,"meters":meters});card.resized.connect(_layout_cards)
	for index in range(2):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",16);add_child(button)
		var frame:=_frame(button);frame.show_behind_parent=true;button.set_meta("frame",frame)
		button.pressed.connect(func():
			for action in actions:action.disabled=true
			command_requested.emit(str(button.get_meta("key")))
		);actions.append(button)
	resized.connect(_layout);hide()

func _prepare_picture(picture: TextureRect) -> void:
	picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;picture.mouse_filter=Control.MOUSE_FILTER_IGNORE

func _frame(parent: Control) -> NinePatchRect:
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*0.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(margin,160)
	parent.add_child(frame);return frame

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:epoch+=1;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png",value.image]
	for entry in value.crew:
		if not entry.empty and not str(entry.image).is_empty():paths.append(entry.image)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Native hospital asset failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Native hospital asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;prepared=available;background.texture=prepared[paths[0]];island.texture=prepared[model.image]
	title.text=model.title;subtitle.text=model.subtitle;copy.text=model.cost+" · "+model.name+"\n"+model.description
	for index in range(cards.size()):
		var entry: Dictionary=model.crew[index];var card: Dictionary=cards[index];card.frame.texture=prepared[paths[1]]
		card.picture.visible=not entry.empty;card.status.visible=not entry.empty
		for meter in card.meters:meter.bar.visible=not entry.empty;meter.label.visible=not entry.empty
		if entry.empty:card.name.text="空船員席位";continue
		card.picture.texture=prepared.get(entry.image);card.name.text=entry.name+" "+entry.level;card.name.tooltip_text=card.name.text;card.status.text=entry.status
		for pair in [[card.meters[0],entry.hp],[card.meters[1],entry.pp]]:pair[0].bar.value=pair[1].value;pair[0].label.text=pair[1].text
	for index in range(actions.size()):
		var action: Dictionary=model.actions[index];var button: Button=actions[index]
		button.set_meta("key",action.key);button.text=action.label;button.disabled=action.disabled;button.get_meta("frame").texture=prepared[paths[1]]
	_layout();call_deferred("_layout");show();surface_ready.emit()

func _layout() -> void:
	background.size=size/0.125;title.position=Vector2(24,18);title.size=Vector2(size.x-48,30)
	subtitle.position=Vector2(24,49);subtitle.size=Vector2(size.x-48,22)
	var left:=size.x*0.27
	island.position=Vector2(28,82);island.size=Vector2(left-42,88)
	copy.position=Vector2(28,178);copy.size=Vector2(left-42,maxf(40,size.y-258))
	scroll.position=Vector2(left,80);scroll.size=Vector2(size.x-left-30,size.y-160)
	for index in range(actions.size()):
		var button: Button=actions[index];button.position=Vector2(28+index*(size.x-48)/2.0,size.y-68);button.size=Vector2((size.x-68)/2.0,48);button.get_meta("frame").size=button.size/0.0625
	_layout_cards();queue_redraw()

func _layout_cards() -> void:
	for card in cards:
		var width: float=card.root.size.x;card.frame.size=card.root.size/0.0625
		card.picture.position=Vector2(8,12);card.picture.size=Vector2(48,60)
		card.name.position=Vector2(61,5);card.name.size=Vector2(maxf(0,width-69),22)
		card.status.position=Vector2(61,66);card.status.size=Vector2(maxf(0,width-69),18)
		for index in range(2):
			var meter: Dictionary=card.meters[index];meter.label.position=Vector2(61,26+index*20);meter.label.size=Vector2(maxf(0,width-69),16)
			meter.bar.position=Vector2(61,42+index*20);meter.bar.size=Vector2(maxf(0,width-69),3)

func close_surface() -> void:epoch+=1;hide()
func test_layout() -> bool:
	for button in actions:
		if not Rect2(Vector2.ZERO,size).encloses(button.get_rect()) or button.get_rect().intersects(scroll.get_rect()) or button.get_rect().intersects(copy.get_rect()):return false
	return scroll.size.y>0 and cards.size()==6 and grid.columns==2
func test_scroll_to_end() -> void:scroll.scroll_vertical=100000
func test_last_slot_visible() -> bool:
	var card: Control=cards.back().root
	return scroll.get_global_rect().encloses(card.get_global_rect())
func test_press(key: String) -> bool:
	if not visible:return false
	for button in actions:
		if not button.disabled and str(button.get_meta("key",""))==key:button.pressed.emit();return true
	return false
