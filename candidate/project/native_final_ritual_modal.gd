extends Control
signal command_requested(key: String)
signal surface_ready
const Filtered=preload("res://native_css_ordered_image.gd")
const Motion=preload("res://native_final_ritual_motion.gd")
const Overlay=preload("res://native_final_ritual_overlay.gdshader")
const TABLE="images/board/final_island/final_ritual_table.webp"
const ROBIN="images/board/final_island/robin_reading_cutout.webp"
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var table: Control
var portrait: Control
var slots: Array=[]
var overlay: ColorRect
var panel:=PanelContainer.new()
var panel_art: ColorRect
var badge: ColorRect
var name_label:=Label.new()
var dialogue:=RichTextLabel.new()
var skip:=Button.new()
var epoch:=0
var busy:=false
var started:=0.0
var placing_started:=-1.0
var complete_started:=-1.0
var reading_started:=-1.0
var line_started:=-1.0
var frozen_time:=-1.0
func _seconds() -> float:return Time.get_ticks_msec()/1000.0
func _shade(mode: int,parent: Node) -> ColorRect:
	var item:=ColorRect.new();item.mouse_filter=Control.MOUSE_FILTER_IGNORE;var material:=ShaderMaterial.new();material.shader=Overlay;material.set_shader_parameter("mode",mode);item.material=material;parent.add_child(item);return item
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);t.default_font_size=14;theme=t
	table=Filtered.new();add_child(table)
	for i in range(4):var item=Filtered.new();add_child(item);slots.append(item)
	overlay=_shade(0,self);portrait=Filtered.new();add_child(portrait)
	var border:=StyleBoxFlat.new();border.bg_color=Color(0,0,0,0);border.border_color=Color(1,.93,.72,.48);border.set_border_width_all(1);border.set_corner_radius_all(10);panel.add_theme_stylebox_override("panel",border);panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(panel);panel_art=_shade(1,panel);panel_art.show_behind_parent=true
	badge=_shade(2,self);name_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;name_label.add_theme_color_override("font_color",Color("121013"));name_label.add_theme_font_size_override("font_size",12);name_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(name_label)
	dialogue.bbcode_enabled=false;dialogue.scroll_active=true;dialogue.add_theme_font_size_override("normal_font_size",15);dialogue.add_theme_color_override("default_color",Color("fff8ec"));add_child(dialogue)
	skip.text="跳過";skip.add_theme_font_size_override("font_size",13);var style:=StyleBoxFlat.new();style.bg_color=Color(.027,.063,.122,.78);style.border_color=Color(1,.91,.74,.82);style.set_border_width_all(1);style.set_corner_radius_all(18);skip.add_theme_stylebox_override("normal",style);skip.add_theme_color_override("font_color",Color("fff4c8"));add_child(skip);skip.pressed.connect(func():if visible and not busy:command_requested.emit(model.skipKey))
	resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("130804" if model.get("ritual",false) else "030811"))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value);var now:=_seconds()
	if model.is_empty() or not visible and not busy:started=now;placing_started=-1;complete_started=-1;reading_started=-1;line_started=-1;model={}
	if next.placing and not model.get("placing",false):placing_started=now
	if next.complete and not model.get("complete",false):complete_started=now
	if next.reading and not model.get("reading",false):reading_started=now
	model=next
	if busy:return
	if visible:_set_copy();_layout();surface_ready.emit();return
	epoch+=1;busy=true;_prepare(epoch)
func _prepare(token: int) -> void:
	var paths=[TABLE,ROBIN]
	for slot in model.slots:paths.append(slot.image)
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var ready:=true
		for path in paths:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original ritual asset unavailable: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Original ritual asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	busy=false;_set_copy();_layout();show();set_process(true);surface_ready.emit()
func _set_copy() -> void:
	name_label.text=model.speaker if model.reading else "旁白";dialogue.text=model.line if model.reading else model.narrationLine
func shift_line() -> void:line_started=_seconds()
func _layout() -> void:
	if busy or model.is_empty():return
	queue_redraw();table.visible=model.ritual;table.configure(textures[TABLE],size);table.passes[0].effect.set_shader_parameter("source_cover",true);overlay.size=size
	var width:=clampf(size.x*.155,134,218);var height:=clampf(size.x*.204,166,286)
	# Preserve four original positions, reducing only paper size on low screens.
	var fit:=minf(1,(size.y-102)/286.0);width*=fit;height*=fit
	for i in range(4):slots[i].visible=i<model.slots.size();if slots[i].visible:slots[i].configure(textures[model.slots[i].image],Vector2(width,height))
	portrait.visible=model.reading;portrait.configure(textures[ROBIN],Vector2(minf(430,size.x*.42),size.y-36));portrait.position=Vector2(size.x*.55,36)
	panel.position=Vector2(18,size.y-108);panel.size=Vector2(size.x-36,96);panel_art.size=panel.size;badge.position=Vector2(size.x*.5-50,size.y-101);badge.size=Vector2(100,22);name_label.position=badge.position+Vector2(0,1);name_label.size=badge.size
	dialogue.position=Vector2(38,size.y-75);dialogue.size=Vector2(size.x-76,55);skip.position=Vector2(size.x-92,14);skip.size=Vector2(78,38);_tick()
func _tick() -> void:
	if busy or model.is_empty():return
	var now:=started+frozen_time if frozen_time>=0 else _seconds();var table_filters=[{"kind":"saturate","value":.88 if model.reading else 1.04 if model.placing else .95},{"kind":"brightness","value":.62 if model.reading else .96 if model.placing else .82}];table.apply_filters(table_filters)
	for i in range(model.slots.size()):
		var item: Control=slots[i];var t:=now-placing_started-float(model.slots[i].delay)/1000.0;item.visible=placing_started>=0 and t>=0
		if not item.visible:continue
		var motion:=Motion.sample("finalRitualPlace_"+str([-7,6,-5,5][i]),t,item.box);var point: Vector2=[Vector2(.30,.32),Vector2(.70,.32),Vector2(.70,.69),Vector2(.30,.69)][i];item.apply_motion(motion,point*size)
		var shadows: Array=Motion.sample("finalRitualCopyPulse",fmod(maxf(0,now-complete_started),2.6),item.box).filters if complete_started>=0 else [{"kind":"drop-shadow","x":0,"y":18,"blur":20,"color":[0,0,0,.32]}];item.apply_filters(shadows+motion.filters+table_filters)
	overlay.material.set_shader_parameter("reading",model.reading);overlay.material.set_shader_parameter("glow",Motion.sample("finalRitualTableGlow",fmod(maxf(0,now-complete_started),2.6),size).opacity if complete_started>=0 else 0.0);overlay.material.set_shader_parameter("breath",Motion.sample("finalRitualBreath",fmod(maxf(0,now-started),5.4),size).opacity)
	if model.reading:
		var t:=maxf(0,now-reading_started);var motion:=Motion.sample("finalRobinPortraitEnter",t,portrait.box);portrait.apply_motion(motion,Vector2(size.x*.55,36));portrait.apply_filters([{"kind":"drop-shadow","x":0,"y":24,"blur":34,"color":[0,0,0,.62]},{"kind":"drop-shadow","x":0,"y":0,"blur":34,"color":[.588,.522,1,.16]}])
	var panel_time:=now-(reading_started if model.reading else started)-.12;var enter:=Motion.sample("finalRobinDialogueEnter",maxf(0,panel_time),panel.size);var alpha: float=enter.opacity if panel_time>=0 else 0.0
	panel.modulate.a=alpha;badge.modulate.a=alpha;name_label.modulate.a=alpha;dialogue.modulate.a=alpha;var shift:=Motion.sample("finalRobinLineShift",maxf(0,now-line_started),dialogue.size) if line_started>=0 else {"opacity":1.0,"transform":Transform2D.IDENTITY};dialogue.modulate.a*=float(shift.opacity);dialogue.position.y=size.y-75+float(shift.transform.origin.y)
func _process(_delta: float) -> void:_tick()
func close_surface() -> void:
	epoch+=1;busy=false;hide();set_process(false);table.stop();portrait.stop()
	for slot in slots:slot.stop()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:return test_ready() and key==model.skipKey
func test_button_rect_json(key: String) -> String:
	if key!=model.skipKey:return "null"
	var r:=skip.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_layout_json() -> String:return JSON.stringify({"bounded":get_global_rect().encloses(dialogue.get_global_rect()) and get_global_rect().encloses(skip.get_global_rect()),"readingClear":dialogue.position.y+dialogue.size.y<=size.y-10})


