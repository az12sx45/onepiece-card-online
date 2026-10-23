extends Control
## Native first-visit cinematic surface. Original JS owns playback and choices.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var background:=TextureRect.new()
var foreground:=TextureRect.new()
var accent:=TextureRect.new()
var portrait:=TextureRect.new()
var panel:=Panel.new()
var speaker:=Label.new()
var dialogue:=RichTextLabel.new()
var speed:=OptionButton.new()
var buttons: Dictionary={}
var epoch:=0
var blocked:=false
var image_writes:=0
var text_writes:=0
var opening_fx: Control
var cinematic_fx: Control

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=16;theme=native_theme
	for picture in [background,foreground,accent,portrait]:
		picture.mouse_filter=Control.MOUSE_FILTER_IGNORE;picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;add_child(picture)
	background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	for picture in [foreground,accent,portrait]:picture.z_index=2
	var style:=StyleBoxFlat.new();style.bg_color=Color(0.01,0.04,0.07,0.65);style.set_corner_radius_all(7)
	panel.add_theme_stylebox_override("panel",style);panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(panel)
	speaker.add_theme_color_override("font_color",Color("ffe6a6"));speaker.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(speaker)
	dialogue.bbcode_enabled=false;dialogue.scroll_active=true;dialogue.mouse_filter=Control.MOUSE_FILTER_PASS;dialogue.add_theme_color_override("default_color",Color("fff8eb"));add_child(dialogue)
	add_child(speed);speed.item_selected.connect(func(index):if not blocked:command_requested.emit("story-speed:"+str(model.speedOptions[index].value)))
	opening_fx=preload("res://native_opening_effects.gd").new();add_child(opening_fx)
	cinematic_fx=preload("res://native_cinematic_effects.gd").new();cinematic_fx.z_index=1;add_child(cinematic_fx)
	for control in [panel,speaker,dialogue,speed]:control.z_index=20
	resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color.BLACK)

func apply_json(value: String) -> void:
	epoch+=1;_prepare(JSON.parse_string(value),epoch)

func _prepare(value: Dictionary,token: int) -> void:
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for key in ["background","foreground","accent","portrait"]:
			var path: String=value[key]
			if path.is_empty() or available.has(path):continue
			if cache.failed.has(path):push_error("Native story image failed: "+path);return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Native story images timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	model=value;blocked=false
	for pair in [[background,"background"],[foreground,"foreground"],[accent,"accent"],[portrait,"portrait"]]:
		var picture: TextureRect=pair[0];var texture: Texture2D=available.get(model[pair[1]])
		picture.visible=texture!=null
		if picture.texture!=texture:picture.texture=texture;image_writes+=1
	foreground.modulate.a=model.foregroundOpacity;accent.modulate.a=model.accentOpacity
	if speaker.text!=model.speaker:speaker.text=model.speaker;text_writes+=1
	if dialogue.text!=model.text:dialogue.text=model.text;dialogue.scroll_to_line(0);text_writes+=1
	var keep: Dictionary={}
	for item in model.buttons:
		if item.key=="finalEndingSpeedSelect":continue
		var key: String=item.key;keep[key]=true
		if not buttons.has(key):
			var button:=Button.new();button.flat=true;button.z_index=20;button.set_meta("key",key);add_child(button)
			button.pressed.connect(func():if not blocked:command_requested.emit(key))
			buttons[key]=button
		var button: Button=buttons[key]
		button.text="⌄" if key=="finalEndingNextBtn" and item.label in ["繼續","下一幕"] else "‹" if key=="finalEndingPrevBtn" else item.label
		button.tooltip_text=item.label;button.disabled=item.disabled;button.visible=not item.hidden
		button.set_meta("choice",item.choice)
	for key in buttons:
		if not keep.has(key):buttons[key].hide()
	if speed.item_count!=model.speedOptions.size():
		speed.clear()
		for option in model.speedOptions:speed.add_item(option.label)
	for index in range(model.speedOptions.size()):
		if str(model.speedOptions[index].value)==str(model.speed):speed.select(index)
	_layout();call_deferred("_layout");show();surface_ready.emit()

func _inset_rect(value: String) -> Rect2:
	var parts:=value.split(" ",false)
	var numbers: Array[float]=[]
	for part in parts:numbers.append(float(part.trim_suffix("%"))/100.0)
	if numbers.is_empty():return Rect2(Vector2.ZERO,size)
	var top:=numbers[0];var right:=numbers[1] if numbers.size()>1 else top
	var bottom:=numbers[2] if numbers.size()>2 else top;var left:=numbers[3] if numbers.size()>3 else right
	return Rect2(Vector2(size.x*left,size.y*top),Vector2(size.x*(1-left-right),size.y*(1-top-bottom)))

func _layout() -> void:
	queue_redraw();background.size=size
	if model.is_empty():return
	for pair in [[foreground,"foregroundInset"],[accent,"accentInset"]]:
		var rect:=_inset_rect(model[pair[1]]);pair[0].position=rect.position;pair[0].size=rect.size
	var has_portrait: bool=not str(model.portrait).is_empty()
	var height: float=size.y*0.82*float(model.portraitScale)
	portrait.size=Vector2(size.x*0.36,height);portrait.position=Vector2(0,size.y-height+size.y*float(model.portraitY))
	var left: float=size.x*0.29 if has_portrait else 34.0
	if model.get("opening",false) and str(model.get("sceneClass","")).contains("scene-opening-execution"):
		portrait.position.x=size.x-portrait.size.x-clampf(size.x*.05,18,82);left=34
	panel.position=Vector2(left-12,size.y-112);panel.size=Vector2(size.x-left-18,100)
	speaker.position=Vector2(left+8,size.y-105);speaker.size=Vector2(panel.size.x-70,25)
	dialogue.position=Vector2(left+8,size.y-77);dialogue.size=Vector2(panel.size.x-78,60)
	var choices: Array=[]
	for key in buttons:
		var button: Button=buttons[key]
		if button.get_meta("choice",false) and button.visible:choices.append(button)
	if not choices.is_empty():
		panel.position.y=size.y-160;panel.size.y=148;speaker.position.y=size.y-151;dialogue.position.y=size.y-123;dialogue.size.y=57
		for index in range(choices.size()):
			choices[index].position=Vector2(left+index*(size.x-left-36)/choices.size(),size.y-59)
			choices[index].size=Vector2((size.x-left-42)/choices.size(),44)
	if buttons.has("finalEndingAutoBtn"):buttons.finalEndingAutoBtn.position=Vector2(size.x-254,8);buttons.finalEndingAutoBtn.size=Vector2(68,38)
	speed.position=Vector2(size.x-180,8);speed.size=Vector2(94,38)
	if buttons.has("finalEndingSkipBtn"):buttons.finalEndingSkipBtn.position=Vector2(size.x-80,8);buttons.finalEndingSkipBtn.size=Vector2(72,38)
	if buttons.has("finalEndingPrevBtn"):buttons.finalEndingPrevBtn.position=Vector2(size.x-72,size.y-105);buttons.finalEndingPrevBtn.size=Vector2(44,30)
	if buttons.has("finalEndingNextBtn"):
		var next: Button=buttons.finalEndingNextBtn;var width:=maxf(68,next.get_minimum_size().x+12);next.position=Vector2(size.x-width-18,size.y-67);next.size=Vector2(width,48)
		if next.visible and choices.is_empty():dialogue.size.x=maxf(80,next.position.x-dialogue.position.x-14)
	opening_fx.size=size;opening_fx.configure(model,foreground,background)
	cinematic_fx.size=size;cinematic_fx.configure(model,background,foreground,accent)

func _gui_input(event: InputEvent) -> void:
	if blocked:return
	if event is InputEventScreenTouch and not event.pressed:command_requested.emit("story-screen");accept_event()
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and not event.pressed:command_requested.emit("story-screen");accept_event()

func block_input() -> void:blocked=true
func close_surface() -> void:epoch+=1;hide();blocked=true;cinematic_fx.stop()
func current_text() -> String:return dialogue.text
func test_reveal_button(key: String) -> bool:return visible and not blocked and buttons.has(key) and buttons[key].visible and not buttons[key].disabled
func test_button_rect_json(key: String) -> String:
	if not test_reveal_button(key):return "null"
	var rect: Rect2=buttons[key].get_global_rect();return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
func test_persistent_identity() -> String:return JSON.stringify([background.get_instance_id(),foreground.get_instance_id(),accent.get_instance_id(),portrait.get_instance_id(),dialogue.get_instance_id(),cinematic_fx.get_instance_id()])
func test_reading_bounds() -> bool:
	var viewport:=get_global_rect()
	for control in [dialogue,speaker,speed]:
		if not viewport.encloses(control.get_global_rect()):print("Cinematic reading outside ",control.name," ",control.get_global_rect()," in ",viewport);return false
	for button in buttons.values():
		if button.visible and not viewport.encloses(button.get_global_rect()):print("Cinematic action outside ",button.text," ",button.get_global_rect()," in ",viewport);return false
	return dialogue.scroll_active
func test_press(key: String) -> bool:
	if not visible or blocked:return false
	if key=="story-screen":command_requested.emit(key);return true
	if key.begins_with("story-speed:"):
		var value:=key.trim_prefix("story-speed:")
		for index in range(model.speedOptions.size()):
			if str(model.speedOptions[index].value)==value:speed.select(index);speed.item_selected.emit(index);return true
		return false
	if not buttons.has(key) or not buttons[key].visible or buttons[key].disabled:return false
	buttons[key].pressed.emit();return true
