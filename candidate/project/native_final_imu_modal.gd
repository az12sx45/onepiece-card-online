extends Control
signal command_requested(key: String)
signal surface_ready
const Motion=preload("res://native_final_imu_motion.gd")
const ImageLayer=preload("res://native_final_imu_image.gd")
const Overlay=preload("res://native_final_imu_overlay.gdshader")
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var layers: Dictionary={}
var pressure: ColorRect
var vignette: ColorRect
var panel:=Control.new()
var panel_art: ColorRect
var name_art: ColorRect
var speaker:=Label.new()
var dialogue:=RichTextLabel.new()
var hint:=RichTextLabel.new()
var buttons: Array[Button]=[]
var busy:=false
var epoch:=0
var started:=0
var forced_time:=-1.0
func _overlay(mode: int,parent: Node) -> ColorRect:
	var rect:=ColorRect.new();rect.mouse_filter=Control.MOUSE_FILTER_IGNORE;var material:=ShaderMaterial.new();material.shader=Overlay;material.set_shader_parameter("mode",mode);rect.material=material;parent.add_child(rect);return rect
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(700);t.default_font_size=14;theme=t
	for key in ["day","dark","portal","shadow","figure"]:
		if key=="portal":
			var copy:=BackBufferCopy.new();copy.copy_mode=BackBufferCopy.COPY_MODE_VIEWPORT;add_child(copy);pressure=_overlay(0,self)
			var portal_copy:=BackBufferCopy.new();portal_copy.copy_mode=BackBufferCopy.COPY_MODE_VIEWPORT;add_child(portal_copy)
		var layer:=ImageLayer.new();layer.fit="cover" if key in ["day","dark"] else "fill" if key=="shadow" else "contain";layer.screen_blend=key=="portal";add_child(layer);layers[key]=layer
	vignette=_overlay(1,self);add_child(panel);panel_art=_overlay(2,panel);name_art=_overlay(3,panel)
	speaker.add_theme_color_override("font_color",Color("fff7ef"));speaker.add_theme_font_size_override("font_size",17);speaker.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.add_child(speaker)
	for label in [dialogue,hint]:label.bbcode_enabled=false;label.add_theme_color_override("default_color",Color("fff6e8"));panel.add_child(label)
	hint.add_theme_color_override("default_color",Color(1,.965,.91,.62));hint.add_theme_font_size_override("normal_font_size",11)
	for i in range(2):
		var b:=Button.new();b.add_theme_color_override("font_color",Color("fff8ed"));b.add_theme_font_size_override("font_size",14);panel.add_child(b)
		for state in ["normal","hover","pressed","disabled"]:
			b.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		var frame:=_overlay(4 if i==0 else 5,b);frame.show_behind_parent=true;b.resized.connect(func():frame.size=b.size;frame.material.set_shader_parameter("extent",b.size))
		b.pressed.connect(func():if not busy and panel.modulate.a>.99:command_requested.emit(str(b.get_meta("key"))));buttons.append(b)
	resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("020203"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var ready:=true
		for path in model.images.values():
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Final-imu image failed: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Final-imu image timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	speaker.text=model.speaker;dialogue.text="\n".join(model.lines);dialogue.scroll_to_line(0);hint.text=model.hint
	for i in range(buttons.size()):
		buttons[i].visible=i<model.buttons.size()
		if buttons[i].visible:buttons[i].text=model.buttons[i].label;buttons[i].set_meta("key",model.buttons[i].key);buttons[i].disabled=model.buttons[i].disabled
	started=Time.get_ticks_msec();forced_time=-1;busy=false;_layout();show();set_process(true);_process(0);surface_ready.emit()
func _layout() -> void:
	if model.is_empty() or busy:return
	for key in ["day","dark"]:layers[key].configure(textures[model.images[key]],size)
	var portal_width:=minf(1080,size.x*.84);layers.portal.configure(textures[model.images.portal],Vector2(portal_width,portal_width*textures[model.images.portal].get_height()/textures[model.images.portal].get_width()))
	layers.shadow.configure(textures[model.images.shadow],Vector2(minf(650,size.x*.54),minf(size.y*.78,730)))
	layers.figure.configure(textures[model.images.figure],Vector2(minf(440,size.x*.36),minf(size.y*.66,680)))
	vignette.size=size;vignette.material.set_shader_parameter("extent",size)
	# Preserve the scene while giving long source dialogue its own scroll area;
	# source choices remain reachable at the fixed bottom, including 640x320.
	panel.size=Vector2(size.x*.96,clampf(size.y*.42,150,205));panel.position=Vector2(size.x*.02,size.y-panel.size.y-6);panel_art.size=panel.size;panel_art.material.set_shader_parameter("extent",panel.size)
	name_art.position=Vector2(10,5);name_art.size=Vector2(108,26);speaker.position=Vector2(20,5);speaker.size=Vector2(90,26)
	dialogue.position=Vector2(14,36);dialogue.size=Vector2(panel.size.x-28,panel.size.y-85);dialogue.add_theme_font_size_override("normal_font_size",14 if size.y<400 else 16)
	hint.position=Vector2(14,panel.size.y-42);hint.size=Vector2(maxf(100,panel.size.x-270),36)
	var shown: Array=buttons.filter(func(b):return b.visible)
	for i in range(shown.size()):shown[i].position=Vector2(panel.size.x-14-(shown.size()-i)*116,panel.size.y-43);shown[i].size=Vector2(108,35)
	_process(0)
func elapsed() -> float:return forced_time if forced_time>=0 else float(Time.get_ticks_msec()-started)/1000
func _process(_delta: float) -> void:
	if busy or model.is_empty():return
	var time:=elapsed()
	for key in layers:
		var layer=layers[key];var motion:=Motion.compose(key,time,layer.box);var anchor:=Vector2.ZERO
		if key=="portal":anchor=Vector2(size.x*.5,size.y*-.01)
		elif key=="shadow":anchor=Vector2(size.x*.5,size.y*.135)
		elif key=="figure":anchor=Vector2(size.x*.5,size.y*.18)
		layer.visible=float(motion.opacity)>.00001
		if not layer.visible:continue
		var filters: Array=motion.filters.duplicate(true)
		if key=="figure":filters=[{"kind":"brightness","value":1.08},{"kind":"contrast","value":1.16}]+filters
		layer.apply_filters(filters);layer.project(motion,anchor)
	var weather:=Motion.compose("pressure",time,size*1.24);var s: float=weather.matrix[0];pressure.size=size*1.24*s;pressure.position=(size-pressure.size)*.5;pressure.material.set_shader_parameter("extent",pressure.size);pressure.material.set_shader_parameter("alpha",weather.opacity)
	var speech:=Motion.compose("dialogue",time,panel.size);panel.modulate.a=speech.opacity;panel.position.y=size.y-panel.size.y-6+float(speech.matrix[13])
	for button in buttons:button.mouse_filter=Control.MOUSE_FILTER_STOP if panel.modulate.a>.99 else Control.MOUSE_FILTER_IGNORE
func close_surface() -> void:
	epoch+=1;busy=false;hide();set_process(false)
	for layer in layers.values():layer.stop()
func test_ready() -> bool:return visible and not busy and panel.modulate.a>.99
func test_set_time(seconds: float) -> void:forced_time=seconds;_process(0)
func test_reveal_button(key: String) -> bool:
	for b in buttons:
		if b.visible and str(b.get_meta("key",""))==key:return test_ready() and not b.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for b in buttons:
		if b.visible and str(b.get_meta("key",""))==key:
			var r:=b.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=get_global_rect().encloses(panel.get_global_rect());var clear:=true
	for b in buttons:
		if b.visible:bounded=bounded and panel.get_global_rect().encloses(b.get_global_rect());clear=clear and dialogue.position.y+dialogue.size.y<=b.position.y and hint.position.x+hint.size.x<=b.position.x
	return JSON.stringify({"bounded":bounded,"readingClear":clear,"paragraphs":model.lines.size(),"scrollable":dialogue.scroll_active,"elapsed":elapsed()})
