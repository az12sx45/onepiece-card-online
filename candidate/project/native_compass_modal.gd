extends Control
signal command_requested(key: String)
signal surface_ready
const BACKGROUND="images/board/postgame_clue_puzzle_ui/york_clue_puzzle_background.webp"
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var epoch:=0
var busy:=false
var background:=TextureRect.new()
var shade:=ColorRect.new()
var heading:=Label.new()
var kicker:=Label.new()
var hint:=Label.new()
var stage:=Panel.new()
var counter:=Label.new()
var detail:=Panel.new()
var visual:=Panel.new()
var island:=TextureRect.new()
var portrait:=TextureRect.new()
var rank:=Label.new()
var copy:=RichTextLabel.new()
var relic:=TextureRect.new()
var cards: Array=[]
var arrows: Array=[]
var actions: Array=[]
var pointer:=-1
var pointer_start:=Vector2.ZERO
func _frame(color: Color,bg: Color) -> StyleBoxFlat:
	var style:=StyleBoxFlat.new();style.bg_color=bg;style.border_color=color;style.set_border_width_all(1);style.set_corner_radius_all(14);return style
func _image(image: TextureRect,parent: Node) -> void:
	image.mouse_filter=Control.MOUSE_FILTER_IGNORE;image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;parent.add_child(image)
func _button(parent: Node,font_size: int) -> Button:
	var b:=Button.new();b.add_theme_font_size_override("font_size",font_size);parent.add_child(b);b.pressed.connect(func():if visible and not busy and not b.disabled:command_requested.emit(str(b.get_meta("key"))));return b
func _ready() -> void:
	clip_contents=true;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;mouse_filter=Control.MOUSE_FILTER_STOP;var theme_value:=Theme.new();theme_value.default_font=preload("res://native_fonts.gd").weighted(700);theme_value.default_font_size=12;theme=theme_value
	_image(background,self);background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;shade.color=Color(0.004,.035,.065,.77);shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(shade)
	for label in [heading,kicker,hint]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	heading.add_theme_font_size_override("font_size",20);heading.add_theme_color_override("font_color",Color("ffe7a1"));kicker.add_theme_font_size_override("font_size",9);kicker.add_theme_color_override("font_color",Color("69e9ff"));hint.add_theme_font_size_override("font_size",10);hint.add_theme_color_override("font_color",Color("c8d8df"))
	stage.clip_contents=true;stage.mouse_filter=Control.MOUSE_FILTER_IGNORE;stage.add_theme_stylebox_override("panel",_frame(Color("285866"),Color(.01,.05,.08,.62)));add_child(stage)
	for i in range(13):var card=preload("res://native_compass_card.gd").new();stage.add_child(card);cards.append(card)
	for key in ["finalBossCoverFlowPrevious","finalBossCoverFlowNext"]:
		var b:=_button(stage,26);b.set_meta("key",key);b.z_index=40;b.add_theme_stylebox_override("normal",_frame(Color("66e0ff"),Color("041d28")));b.add_theme_color_override("font_color",Color("ffe7a1"));arrows.append(b)
	counter.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;counter.mouse_filter=Control.MOUSE_FILTER_IGNORE;counter.add_theme_font_size_override("font_size",12);counter.add_theme_color_override("font_color",Color("dff6ff"));counter.z_index=40;stage.add_child(counter)
	detail.add_theme_stylebox_override("panel",_frame(Color("d2a64e"),Color("061622")));add_child(detail);visual.add_theme_stylebox_override("panel",_frame(Color("6be2ff"),Color("02080d")));detail.add_child(visual);_image(island,visual);_image(portrait,visual);rank.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;rank.add_theme_font_size_override("font_size",18);rank.add_theme_color_override("font_color",Color("ffeaa6"));visual.add_child(rank)
	copy.bbcode_enabled=true;copy.scroll_active=true;copy.add_theme_font_size_override("normal_font_size",12);copy.add_theme_color_override("default_color",Color("d6e7ee"));detail.add_child(copy);_image(relic,detail)
	for i in range(2):
		var b:=_button(self,13);b.add_theme_stylebox_override("normal",_frame(Color("ffe7a1"),Color("ffc958") if i==1 else Color("96a3aa")));b.add_theme_color_override("font_color",Color("082d3d"));actions.append(b)
	resized.connect(_layout);hide()
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;pointer=-1;busy=true;model=next;_prepare(epoch)
func _prepare(token: int) -> void:
	var paths=[BACKGROUND,model.detail.island,model.detail.islandFallback,model.detail.portrait,model.detail.relicImage]
	for card in model.cards:paths.append_array([card.icon.image,card.icon.portrait,card.icon.fallback])
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var ready:=true
		for path in paths:
			if str(path).is_empty() or textures.has(path) or cache.failed.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Original compass assets timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	background.texture=textures.get(BACKGROUND);heading.text=model.title;kicker.text=model.kicker;hint.text=model.hint;counter.text=model.counter
	for i in range(model.cards.size()):cards[i].present(model.cards[i],textures)
	for i in range(arrows.size()):arrows[i].text=model.arrows[i].label;arrows[i].disabled=model.arrows[i].disabled
	for i in range(actions.size()):
		actions[i].visible=i<model.actions.size()
		if actions[i].visible:actions[i].text=model.actions[i].label;actions[i].disabled=model.actions[i].disabled;actions[i].set_meta("key",model.actions[i].key)
	var d: Dictionary=model.detail;visual.visible=not d.empty;island.texture=textures.get(d.island,textures.get(d.islandFallback));portrait.texture=textures.get(d.portrait);rank.text=d.rank;relic.hide()
	var lines: Array=["[color=#69e9ff]"+_safe(d.kicker)+"[/color]","[font_size=19][color=#ffe4a0]"+_safe(d.title)+"[/color][/font_size]",_safe(d.role)]
	for fact in d.facts:lines.append(_safe(fact))
	copy.clear();copy.append_text("\n".join(lines))
	if not d.empty:
		copy.append_text("\n\n")
		if textures.has(d.relicImage):copy.add_image(textures[d.relicImage],30,30)
		copy.append_text(" [color=#ffe294]"+_safe(d.relicName)+"[/color]\n"+_safe(d.relicEffect)+"\n\n[color=#ffe9ae]"+_safe(d.rule)+"[/color]")
	copy.scroll_to_line(0);busy=false;_layout();show();surface_ready.emit()
func _safe(value: String) -> String:return value.replace("[","[lb]")
func _layout() -> void:
	background.size=size;shade.size=size
	if model.is_empty() or busy:return
	kicker.position=Vector2(10,4);kicker.size=Vector2(size.x-20,14);heading.position=Vector2(10,18);heading.size=Vector2(size.x-20,28);hint.position=Vector2(10,47);hint.size=Vector2(size.x-20,16)
	var top:=69.0;var bottom:=size.y-54;stage.position=Vector2(8,top);stage.size=Vector2(size.x*.45-12,bottom-top);detail.position=Vector2(size.x*.45+4,top);detail.size=Vector2(size.x*.55-12,bottom-top)
	var card_width:=clampf(minf(stage.size.x*.37,stage.size.y*.56),82,164);var card_size:=Vector2(card_width,card_width+20);var gap:=clampf(stage.size.x*.19,48,118)
	for i in range(cards.size()):
		var c: Dictionary=model.cards[i];cards[i].size=card_size;cards[i].position=Vector2(stage.size.x*.5+float(c.offset)*gap,stage.size.y*.43)-card_size*.5;cards[i].visible=absf(c.offset)<=4
	for i in range(2):arrows[i].position=Vector2(7 if i==0 else stage.size.x-45,stage.size.y*.43-20);arrows[i].size=Vector2(38,40)
	counter.position=Vector2(8,stage.size.y-34);counter.size=Vector2(stage.size.x-16,28)
	visual.position=Vector2(8,8);visual.size=Vector2(detail.size.x*.30,detail.size.y-16);island.position=Vector2(3,visual.size.y*.50);island.size=Vector2(visual.size.x-6,visual.size.y*.48);portrait.position=Vector2.ZERO;portrait.size=Vector2(visual.size.x,visual.size.y*.72);rank.position=Vector2(visual.size.x-30,5);rank.size=Vector2(26,26)
	var x:=visual.size.x+16 if visual.visible else 12.0;copy.position=Vector2(x,8);copy.size=Vector2(detail.size.x-x-10,detail.size.y-16);relic.position=Vector2(visual.position.x+visual.size.x*.5-18,detail.size.y-48);relic.size=Vector2(36,36)
	var width:=minf(300,(size.x-28)/2);var start: float=(size.x-(width*model.actions.size()+8*(model.actions.size()-1)))/2
	for i in range(model.actions.size()):actions[i].position=Vector2(start+i*(width+8),size.y-45);actions[i].size=Vector2(width,38)
func _input(event: InputEvent) -> void:
	if not visible or busy:return
	if event is InputEventScreenTouch:
		var local: Vector2=event.position-global_position
		if event.pressed:
			pointer=-1
			for b in arrows:if b.get_global_rect().has_point(event.position):return
			if Rect2(stage.position,stage.size).has_point(local):pointer=event.index;pointer_start=local
		elif not event.pressed and event.index==pointer:
			pointer=-1;var distance:=local.x-pointer_start.x
			if absf(distance)>=28:command_requested.emit("compass-gesture:"+str(pointer_start.x)+","+str(local.x));get_viewport().set_input_as_handled()
			elif absf(distance)<10 and (local-pointer_start).length()<10:
				for b in arrows:if b.get_global_rect().has_point(event.position):return
				var indices=range(cards.size());indices.sort_custom(func(a,b):return model.cards[a].order>model.cards[b].order)
				for i in indices:
					if cards[i].visible and not model.cards[i].disabled and cards[i].get_global_rect().has_point(event.position):command_requested.emit(model.cards[i].key);get_viewport().set_input_as_handled();break
func close_surface() -> void:epoch+=1;busy=false;pointer=-1;hide()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:
	for b in arrows+actions:if b.visible and str(b.get_meta("key",""))==key:return test_ready() and not b.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for b in arrows+actions:
		if b.visible and str(b.get_meta("key",""))==key:var r: Rect2=b.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func test_stage_rect_json() -> String:var r:=stage.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,kicker,hint,stage,detail,copy]+actions:
		if node.visible:bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	return JSON.stringify({"bounded":bounded,"readingClear":detail.position.y+detail.size.y<actions[0].position.y,"cards":cards.size(),"scrollHeight":copy.get_content_height(),"availableHeight":copy.size.y})
