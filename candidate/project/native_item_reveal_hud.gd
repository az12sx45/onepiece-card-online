extends Control
signal clicked
const Motion=preload("res://native_evolution_motion.gd")
const RevealMotion=preload("res://native_item_reveal_motion.gd")
const FilterImage=preload("res://native_css_filtered_image.gd")
var cache: Node
var model: Dictionary={}
var decoded_images: Dictionary={}
var requested_images: Dictionary={}
var failed_image: Texture2D
var backdrop:=ColorRect.new()
var card:=Control.new()
var frame: Control
var picture: Control
var clue:=preload("res://native_item_icon.gd").new()
var clue_view:=SubViewport.new()
var clue_image: Control
var dialogue:=VBoxContainer.new()
var kicker:=Label.new()
var name_label:=Label.new()
var line:=RichTextLabel.new()
var hint:=TextureRect.new()
var started:=0
var awaiting_tick:=0
var frozen_time:=-1.0
var card_origin:=Vector2.ZERO
var picture_origin:=Vector2.ZERO
var clue_origin:=Vector2.ZERO
var dialogue_origin:=Vector2.ZERO
func _ready() -> void:
	cache.asset_ready.connect(_asset_ready)
	cache.asset_failed.connect(_asset_failed)
	hide();set_process(false);mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(850);theme=t
	var veil:=ShaderMaterial.new();veil.shader=preload("res://native_item_reveal_backdrop.gdshader");backdrop.material=veil;backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(backdrop)
	card.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(card);frame=FilterImage.new();card.add_child(frame);picture=FilterImage.new();card.add_child(picture)
	clue_view.disable_3d=true;clue_view.transparent_bg=true;clue_view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(clue_view);clue_view.add_child(clue);clue_image=FilterImage.new();card.add_child(clue_image)
	dialogue.mouse_filter=Control.MOUSE_FILTER_IGNORE;dialogue.add_theme_constant_override("separation",1);card.add_child(dialogue)
	for label in [kicker,name_label]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;dialogue.add_child(label)
	kicker.add_theme_color_override("font_color",Color("ffd46f"));name_label.add_theme_color_override("font_color",Color("fff9df"));line.add_theme_color_override("default_color",Color("fff6da"));line.bbcode_enabled=false;line.scroll_active=true;line.size_flags_vertical=Control.SIZE_EXPAND_FILL;line.mouse_filter=Control.MOUSE_FILTER_PASS;dialogue.add_child(line)
	hint.mouse_filter=Control.MOUSE_FILTER_IGNORE;hint.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;hint.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;card.add_child(hint)
	gui_input.connect(func(event):
		if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and event.pressed:clicked.emit();accept_event()
		elif event is InputEventScreenTouch and event.pressed:clicked.emit();accept_event())
	resized.connect(func():if visible:_layout();_animate(_elapsed()))
func request_decode(path: String) -> void:
	requested_images[path]=true
	var texture: Texture2D=cache.request(path)
	if texture!=null:decoded_images[path]=texture
	elif cache.failed.has(path) and not decoded_images.has(path):decoded_images[path]=_failed_texture()
func asset_is_ready(path: String) -> bool:
	request_decode(path)
	return decoded_images.has(path) and not cache.failed.has(path)
func _image(key: String) -> Texture2D:
	var path:=str(model.images[key].src)
	if path.is_empty():return null
	request_decode(path)
	return decoded_images.get(path)
func _failed_texture() -> Texture2D:
	# Retain the original text/continue control if an optional picture fails.
	# The asset cache still records failure; this is not a successful decode.
	if failed_image==null:
		var image:=Image.create(1,1,false,Image.FORMAT_RGBA8);image.fill(Color.TRANSPARENT)
		failed_image=ImageTexture.create_from_image(image)
	return failed_image
func _asset_failed(path: String,_error: int) -> void:
	if requested_images.has(path):_asset_ready(path,_failed_texture())
func _asset_ready(path: String,texture: Texture2D) -> void:
	if not requested_images.has(path):return
	decoded_images[path]=texture
	if bool(model.get("show",false)) and not visible:apply_json(JSON.stringify(model))
func asset_has_failed(path: String) -> bool:return cache.failed.has(path)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value);var was_visible:=visible;var was_requested: bool=model.get("show",false);var previous_awaiting: bool=model.get("awaiting",false);model=next
	if not model.show:
		hide();set_process(false);frame.stop();picture.stop();clue_image.stop()
		if was_visible or was_requested:decoded_images.clear();requested_images.clear()
		return
	if not was_visible:
		if not _configure():return
		started=Time.get_ticks_msec();show()
	if model.awaiting and (not previous_awaiting or not was_visible):awaiting_tick=Time.get_ticks_msec()
	_animate(_elapsed());set_process(true)
func _configure() -> bool:
	var required: Array=["itemRevealPanelFrame","postgameClueRevealFrame","postgameClueRevealIsland"] if model.clue else ["itemRevealPanelFrame","itemRevealImage"]
	for key in required:
		if _image(key)==null:return false
	kicker.text=model.texts.itemRevealTitle;name_label.text=model.texts.itemRevealName;line.text=model.texts.itemRevealLine
	picture.visible=not model.clue;clue.visible=model.clue;clue_image.visible=model.clue
	if model.clue:
		var icon_model: Dictionary={"kind":"clue","reveal":true,"image":model.images.postgameClueRevealFrame.src,"portrait":model.images.postgameClueRevealIsland.src,"rank":model.texts.postgameClueRevealRank};var textures: Dictionary={}
		for path in [icon_model.image,icon_model.portrait]:textures[path]=decoded_images[path]
		clue.present(icon_model,textures)
	hint.texture=cache.request("images/board/map_hud_ui/action_icons/action_notice_icon_treasure.webp");_layout();return true
func _layout() -> void:
	if model.is_empty() or not model.show:return
	backdrop.size=size;backdrop.material.set_shader_parameter("extent",size);var width:=minf(1480,minf(size.x-16,(size.y-10)*1.776833));card.size=Vector2(width,width*941/1672);card_origin=(size-card.size)/2
	frame.configure(_image("itemRevealPanelFrame"),card.size);frame.apply_filters([{"kind":"drop-shadow","x":0,"y":24,"blur":42,"color":[0,0,0,.66]}])
	var stage:=Rect2(card.size*Vector2(.14,.13),card.size*Vector2(.72,.53));picture_origin=stage.position+stage.size*Vector2(.22,.08)
	if not model.clue:picture.configure(_image("itemRevealImage"),stage.size*Vector2(.56,.84))
	var clue_size:=Vector2.ONE*stage.size.x*.38;clue_origin=stage.position+(stage.size-clue_size)/2
	clue_view.size=Vector2i((clue_size*2).ceil());clue.size=clue_view.size;clue.position=Vector2.ZERO;clue_view.render_target_update_mode=SubViewport.UPDATE_ONCE
	if model.clue:clue_image.configure(clue_view.get_texture(),clue_size);clue_image.bind_live_source(clue_view);clue_image.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	# CSS percentage padding is relative to the containing card width, including
	# vertical padding. Keep the original dialogue content inside its artwork.
	dialogue_origin=card.size*Vector2(.159,.722)+Vector2(0,width*.01)
	dialogue.position=dialogue_origin;dialogue.size=Vector2(width*.58,card.size.y*.186-width*.02);kicker.add_theme_font_size_override("font_size",maxi(7,int(width*.0105)));name_label.add_theme_font_size_override("font_size",maxi(11,int(width*.0225)));line.add_theme_font_size_override("normal_font_size",maxi(7,int(width*.0138)))
	hint.position=Vector2(card.size.x*.7955,card.size.y*.918-card.size.x*.083)+Vector2.ONE*card.size.x*.083*.11;hint.size=Vector2.ONE*card.size.x*.083*.78
func _elapsed() -> float:return frozen_time if frozen_time>=0 else (Time.get_ticks_msec()-started)/1000.0
func _process(_delta: float) -> void:
	if model.is_empty() or not visible:return
	if hint.texture==null:hint.texture=cache.request("images/board/map_hud_ui/action_icons/action_notice_icon_treasure.webp")
	_animate(_elapsed())
func _progress(t: float,a: float,b: float,curve: Array) -> float:return Motion._ease(clampf((t-a)/(b-a),0,1),curve)
func _animate(seconds: float) -> void:
	modulate.a=RevealMotion.sample("item","itemRevealBackdrop",seconds,size).opacity
	var c: Dictionary=RevealMotion.sample("item","itemRevealCard",seconds,card.size);var transform: Transform2D=c.transform
	card.modulate.a=c.opacity;card.scale=transform.get_scale();card.rotation=transform.get_rotation();card.position=card_origin+card.size*.5+transform.origin-transform.basis_xform(card.size*.5)
	var p: Dictionary=RevealMotion.sample("item","itemRevealImage",seconds,picture.size)
	if not model.clue:picture.apply_filters(p.filters);picture.apply_motion(p,picture_origin)
	else:
		var q: Dictionary=RevealMotion.sample("item","itemRevealImage",seconds,clue_image.size)
		clue_image.apply_filters(q.filters);clue_image.apply_motion(q,clue_origin)
	backdrop.modulate.a=RevealMotion.sample("item","itemRevealVeil",seconds,size).opacity
	var d: Dictionary=RevealMotion.sample("item","itemRevealDialogue",seconds,dialogue.size);dialogue.modulate.a=d.opacity;dialogue.position=dialogue_origin+d.transform.origin
	hint.visible=model.awaiting
	if model.awaiting:
		var pulse:=fmod((Time.get_ticks_msec()-awaiting_tick)/1000.0,1.1);var h: Dictionary=RevealMotion.sample("item","evolutionContinuePulse",pulse,hint.size);hint.modulate.a=h.opacity;hint.position=Vector2(card.size.x*.7955,card.size.y*.918-card.size.x*.083)+Vector2.ONE*card.size.x*.083*.11+h.transform.origin

func test_press() -> bool:
	if not visible or not model.awaiting:return false
	clicked.emit();return true
func test_layout() -> bool:return visible and Rect2(Vector2.ZERO,size).encloses(Rect2(card_origin,card.size)) and Rect2(Vector2.ZERO,card.size).encloses(dialogue.get_rect())
