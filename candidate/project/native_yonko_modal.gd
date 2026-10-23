extends Control
signal command_requested(key: String)
signal surface_ready
const Paint=preload("res://native_yonko_panel.gdshader")
const Filtered=preload("res://native_css_ordered_image.gd")
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var background: Control
var portrait: Control
var shade: ColorRect
var frame: ColorRect
var dock: ColorRect
var kicker:=Label.new()
var title:=Label.new()
var lead:=RichTextLabel.new()
var scroll:=ScrollContainer.new()
var content:=VBoxContainer.new()
var command:=Label.new()
var hint:=RichTextLabel.new()
var buttons: Array[Button]=[]
var rows: Array=[]
var epoch:=0
var busy:=false
func _paint(mode: int,parent: Node) -> ColorRect:
	var rect:=ColorRect.new();rect.mouse_filter=Control.MOUSE_FILTER_IGNORE;var effect:=ShaderMaterial.new();effect.shader=Paint;effect.set_shader_parameter("mode",mode);rect.material=effect;parent.add_child(rect);rect.resized.connect(func():effect.set_shader_parameter("extent",rect.size));return rect
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);t.default_font_size=13;theme=t
	background=Filtered.new();add_child(background);shade=_paint(0,self);frame=_paint(1,self);portrait=Filtered.new();add_child(portrait);dock=_paint(2,self)
	for label in [kicker,title,command]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	kicker.add_theme_color_override("font_color",Color("ffd681"));kicker.add_theme_font_size_override("font_size",12);title.add_theme_color_override("font_color",Color("fff4d5"));title.add_theme_font_size_override("font_size",25);command.add_theme_color_override("font_color",Color("fff2c4"));command.add_theme_font_size_override("font_size",13)
	for label in [lead,hint]:label.bbcode_enabled=false;label.add_theme_color_override("default_color",Color(1,.965,.875,.74));add_child(label)
	lead.add_theme_font_size_override("normal_font_size",12);hint.add_theme_font_size_override("normal_font_size",11)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_theme_constant_override("separation",8);scroll.add_child(content)
	for i in range(12):
		var row:=PanelContainer.new();var style:=StyleBoxFlat.new();style.bg_color=Color(1,1,1,.045);style.border_color=Color(1,.965,.875,.13);style.set_border_width_all(1);style.content_margin_left=8;style.content_margin_right=8;style.content_margin_top=8;style.content_margin_bottom=8;row.add_theme_stylebox_override("panel",style);content.add_child(row)
		var box:=HBoxContainer.new();box.add_theme_constant_override("separation",8);row.add_child(box);var badge:=Label.new();badge.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;badge.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;badge.custom_minimum_size=Vector2(28,28);badge.size_flags_vertical=Control.SIZE_SHRINK_BEGIN;badge.add_theme_color_override("font_color",Color("1a1011"));var circle:=StyleBoxFlat.new();circle.bg_color=Color("e9b864");circle.set_corner_radius_all(14);badge.add_theme_stylebox_override("normal",circle);box.add_child(badge)
		var text:=Label.new();text.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;text.size_flags_horizontal=Control.SIZE_EXPAND_FILL;text.add_theme_color_override("font_color",Color(1,.965,.875,.82));text.add_theme_font_size_override("font_size",13);box.add_child(text);rows.append({"root":row,"number":badge,"text":text})
	for i in range(2):
		var button:=Button.new();button.add_theme_color_override("font_color",Color("190d13" if i==0 else "fff4d5"));button.add_theme_font_size_override("font_size",14)
		for state in ["normal","hover","pressed","disabled"]:button.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		add_child(button);var art:=_paint(3 if i==0 else 4,button);art.show_behind_parent=true;button.set_meta("art",art);button.resized.connect(func():art.size=button.size);button.pressed.connect(func():if visible and not busy and not button.disabled:command_requested.emit(str(button.get_meta("key"))));buttons.append(button)
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("070913"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var ready:=true
		for path in [model.background,model.portrait]:
			if str(path).is_empty() or textures.has(path):continue
			var image: Texture2D=cache.request(path)
			if image:textures[path]=image
			elif cache.failed.has(path):push_error("Original Yonko image missing: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Original Yonko images timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	kicker.text=model.kicker;title.text=model.title;lead.text=model.lead;command.text=model.command;hint.text=model.hint
	assert(model.rules.size()<=rows.size(),"Original Yonko rule count exceeds persistent pool")
	for i in range(rows.size()):rows[i].root.visible=i<model.rules.size();if rows[i].root.visible:rows[i].number.text=model.rules[i].number;rows[i].text.text=model.rules[i].text
	for i in range(buttons.size()):buttons[i].text=model.buttons[i].label;buttons[i].disabled=model.buttons[i].disabled;buttons[i].set_meta("key",model.buttons[i].key);buttons[i].get_meta("art").material.set_shader_parameter("disabled",buttons[i].disabled)
	busy=false;_layout();scroll.scroll_vertical=0;show();surface_ready.emit()
func _layout() -> void:
	if busy or model.is_empty():return
	background.configure(textures[model.background],size);background.passes[0].effect.set_shader_parameter("source_cover",true);background.apply_filters([{"kind":"saturate","value":.92},{"kind":"contrast","value":1.02}]);background.position=size*-.0175;background.scale=Vector2.ONE*1.035
	shade.size=size;frame.position=Vector2(10,10);frame.size=Vector2(size.x-20,size.y-92);dock.position=Vector2(10,size.y-74);dock.size=Vector2(size.x-20,64)
	var copy_width:=size.x*.64-24;kicker.position=Vector2(24,19);kicker.size=Vector2(copy_width,18);title.position=Vector2(24,39);title.size=Vector2(copy_width,34);lead.position=Vector2(24,77);lead.size=Vector2(copy_width,36)
	scroll.position=Vector2(24,119);scroll.size=Vector2(copy_width,maxf(60,frame.size.y-122));content.custom_minimum_size.x=0
	portrait.visible=not str(model.portrait).is_empty()
	if portrait.visible:portrait.configure(textures[model.portrait],Vector2(size.x*.32,frame.size.y));portrait.position=Vector2(size.x*.66,17);portrait.apply_filters([{"kind":"drop-shadow","x":0,"y":26,"blur":22,"color":[0,0,0,.66]},{"kind":"drop-shadow","x":0,"y":0,"blur":22,"color":[1,214.0/255,129.0/255,.15]}])
	command.position=Vector2(22,size.y-70);command.size=Vector2(size.x-274,18);hint.position=Vector2(22,size.y-50);hint.size=Vector2(size.x-274,32)
	for i in range(buttons.size()):buttons[i].position=Vector2(size.x-242+i*114,size.y-61);buttons[i].size=Vector2(106,39)
func close_surface() -> void:epoch+=1;busy=false;hide();background.stop();portrait.stop()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:
	for b in buttons:
		if str(b.get_meta("key",""))==key:return test_ready() and not b.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for b in buttons:
		if str(b.get_meta("key",""))==key:var r:=b.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=true;var clear:=scroll.position.y+scroll.size.y<=dock.position.y
	clear=clear and hint.get_content_height()<=hint.size.y and command.get_minimum_size().y<=command.size.y
	for control in [scroll,lead,command,hint]+buttons:
		bounded=bounded and get_global_rect().encloses(control.get_global_rect())
	for row in rows:
		if row.root.visible and row.text.get_minimum_size().y>row.root.size.y-16:clear=false
	return JSON.stringify({"bounded":bounded,"readingClear":clear,"rules":model.rules.size()})
