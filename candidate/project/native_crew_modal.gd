extends Control
## Persistent full-screen roster/details; source handlers own every action.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="images/board/crew_ui/crew_member_row_frame.webp"
const ACTION="mobile/art-ui/mobile-row-v013.png"
const CAPTAIN="images/board/crew_ui/crew_captain_emblem.webp"
const INFO="images/board/crew_ui/crew_info_section_frame.webp"
const InfoPanel=preload("res://native_crew_info_panel.gd")
const AVATAR_SHADER="shader_type canvas_item;uniform vec2 crop=vec2(1.0);uniform bool down=false;varying vec4 vertex_tint;void vertex(){vertex_tint=COLOR;}void fragment(){vec2 pivot=vec2(.5,.18);vec2 uv=pivot+(UV-pivot)/1.45;vec4 col=texture(TEXTURE,(vec2(1.0)-crop)*pivot+uv*crop);if(down){float gray=dot(col.rgb,vec3(.2126,.7152,.0722));col.rgb=(mix(col.rgb,vec3(gray),.8)-.5)*.88+.5;}float edge=length(UV-.5);col.a*=1.0-smoothstep(.5-fwidth(edge),.5,edge);COLOR=col*vertex_tint;}"
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var epoch:=0
var background:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Array[Dictionary]=[]
var portrait:=TextureRect.new()
var form:=RichTextLabel.new()
var detail_scroll:=ScrollContainer.new()
var sections:=VBoxContainer.new()
var section_labels: Array[Dictionary]=[]
var actions: Array[Button]=[]

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(550);native_theme.default_font_size=13;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(side,224)
	add_child(background)
	for label in [title,subtitle]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.clip_text=true;add_child(label)
	title.add_theme_font_size_override("font_size",20);title.add_theme_color_override("font_color",Color("f5e5c5"));subtitle.add_theme_font_size_override("font_size",12)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",5);scroll.add_child(list)
	_prepare_picture(portrait);add_child(portrait);form.scroll_active=true;form.bbcode_enabled=false;form.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(form)
	detail_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(detail_scroll);sections.size_flags_horizontal=Control.SIZE_EXPAND_FILL;sections.add_theme_constant_override("separation",12);detail_scroll.add_child(sections)
	for i in range(2):
		var panel:=InfoPanel.new();panel.size_flags_horizontal=Control.SIZE_EXPAND_FILL;sections.add_child(panel)
		var box:=VBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;panel.add_child(box)
		var heading:=Label.new();heading.add_theme_font_size_override("font_size",16);heading.add_theme_color_override("font_color",Color("ead197"));box.add_child(heading)
		var body:=RichTextLabel.new();body.bbcode_enabled=false;body.fit_content=true;body.scroll_active=false;body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("line_separation",4);box.add_child(body);section_labels.append({"heading":heading,"body":body,"panel":panel})
	for i in range(7):
		var button:=Button.new();button.flat=true;button.add_theme_font_size_override("font_size",13);add_child(button)
		var frame:=NinePatchRect.new();frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*0.0625;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
		button.add_child(frame);button.set_meta("frame",frame);button.pressed.connect(func():_press(str(button.get_meta("key"))));actions.append(button)
	resized.connect(_layout);hide()
func _prepare_picture(picture: TextureRect) -> void:
	picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;picture.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _new_row() -> Dictionary:
	var root:=Button.new();root.flat=true;root.custom_minimum_size.y=96;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_child(root)
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*(96.0/505.0);frame.region_rect=Rect2(0,176,1774,505);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.set_patch_margin(SIDE_LEFT,470);frame.set_patch_margin(SIDE_RIGHT,230);frame.set_patch_margin(SIDE_TOP,100);frame.set_patch_margin(SIDE_BOTTOM,100);root.add_child(frame)
	var picture:=TextureRect.new();_prepare_picture(picture);picture.stretch_mode=TextureRect.STRETCH_SCALE
	var shader:=Shader.new();shader.code=AVATAR_SHADER;var avatar_material:=ShaderMaterial.new();avatar_material.shader=shader;picture.material=avatar_material;root.add_child(picture)
	var name_label:=Label.new();name_label.add_theme_font_size_override("font_size",16);name_label.clip_text=true;name_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(name_label)
	var meta:=Label.new();meta.add_theme_font_size_override("font_size",12);meta.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(meta)
	var emblem:=TextureRect.new();_prepare_picture(emblem);root.add_child(emblem)
	var meters: Array=[]
	for color in [Color("62d39b"),Color("65beeb")]:
		var bar:=ProgressBar.new();bar.show_percentage=false;bar.mouse_filter=Control.MOUSE_FILTER_IGNORE
		var fill:=StyleBoxFlat.new();fill.bg_color=color;var track:=StyleBoxFlat.new();track.bg_color=Color("0b1825")
		bar.add_theme_stylebox_override("fill",fill);bar.add_theme_stylebox_override("background",track);root.add_child(bar)
		var label:=Label.new();label.add_theme_font_size_override("font_size",11);label.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(label);meters.append({"bar":bar,"label":label})
	root.pressed.connect(func():_press(str(root.get_meta("key"))));root.resized.connect(_layout_rows)
	return {"root":root,"frame":frame,"picture":picture,"name":name_label,"meta":meta,"emblem":emblem,"meters":meters}
func _press(key: String) -> void:
	for button in actions:button.disabled=true
	for row in rows:row.root.disabled=true
	command_requested.emit(key)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))
func apply_json(value: String) -> void:epoch+=1;_prepare(JSON.parse_string(value),epoch)
func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[PANEL,ACTION,ROW,CAPTAIN,INFO]
	if value.kind=="crew-roster":
		for entry in value.entries:paths.append(entry.image)
	else:paths.append(value.image)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Crew asset failed "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Crew asset timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	var prior_kind: String=str(model.get("kind",""));model=value;prepared=available;background.texture=prepared[PANEL];title.text=model.title;subtitle.text=model.subtitle
	var roster: bool=model.kind=="crew-roster";scroll.visible=roster;detail_scroll.visible=not roster;portrait.visible=not roster;form.visible=not roster
	if roster:
		while rows.size()<model.entries.size():rows.append(_new_row())
		for i in range(rows.size()):
			var row: Dictionary=rows[i];row.root.visible=i<model.entries.size()
			if not row.root.visible:continue
			var entry: Dictionary=model.entries[i];row.root.disabled=false;row.root.set_meta("key",entry.key);row.frame.texture=prepared[ROW];row.picture.texture=prepared[entry.image];row.name.text=entry.name;row.name.tooltip_text=entry.name
			var image_size: Vector2=row.picture.texture.get_size();var crop:=Vector2(minf(1.0,image_size.y/image_size.x),minf(1.0,image_size.x/image_size.y))
			row.picture.material.set_shader_parameter("crop",crop);row.picture.material.set_shader_parameter("down",entry.down);row.root.modulate.a=0.64 if entry.down else 1.0
			row.meta.text=entry.level+" · "+entry.attribute+(" · 已瀕死" if entry.down else "");row.emblem.texture=prepared[CAPTAIN];row.emblem.visible=entry.active
			for pair in [[row.meters[0],entry.hp],[row.meters[1],entry.exp]]:pair[0].bar.value=pair[1].value;pair[0].label.text=pair[1].text
	else:
		portrait.texture=prepared[model.image];form.text=model.form
		for i in range(section_labels.size()):section_labels[i].heading.text=model.sections[i].title;section_labels[i].body.text=model.sections[i].text;section_labels[i].panel.set_artwork(prepared[INFO])
	for i in range(actions.size()):
		var button: Button=actions[i];button.visible=i<model.actions.size()
		if not button.visible:continue
		var action: Dictionary=model.actions[i];button.text=action.label;button.set_meta("key",action.key);button.disabled=action.disabled;button.get_meta("frame").texture=prepared[ACTION]
	if prior_kind!=model.kind:scroll.scroll_vertical=0;detail_scroll.scroll_vertical=0;form.scroll_to_line(0)
	_layout();show();surface_ready.emit()
func _layout() -> void:
	background.size=size/background.scale;title.position=Vector2(30,12);title.size=Vector2(size.x-60,26);subtitle.position=Vector2(30,39);subtitle.size=Vector2(size.x-60,20)
	var bottom:=size.y-64.0;scroll.position=Vector2(26,64);scroll.size=Vector2(size.x-52,bottom-68)
	var left_width:=size.x*0.27;portrait.position=Vector2(26,65);portrait.size=Vector2(left_width-32,maxf(65,(bottom-68)*0.64));form.position=Vector2(30,portrait.position.y+portrait.size.y+4);form.size=Vector2(left_width-36,maxf(40,bottom-form.position.y))
	detail_scroll.position=Vector2(left_width+12,66);detail_scroll.size=Vector2(size.x-left_width-42,bottom-70)
	var visible_actions: Array=actions.filter(func(button):return button.visible);var width: float=(size.x-52-6*maxi(0,visible_actions.size()-1))/maxi(1,visible_actions.size())
	for i in range(visible_actions.size()):var button: Button=visible_actions[i];button.position=Vector2(26+i*(width+6),size.y-57);button.size=Vector2(width,42);button.get_meta("frame").size=button.size/button.get_meta("frame").scale
	_layout_rows()
func _layout_rows() -> void:
	for row in rows:
		var width: float=row.root.size.x;row.frame.size=row.root.size/row.frame.scale;row.picture.position=Vector2(19,19.6);row.picture.size=Vector2.ONE*62.4
		row.name.position=Vector2(107,12);row.name.size=Vector2(width-164,22);row.meta.position=Vector2(108,35);row.meta.size=Vector2(width-162,18);row.emblem.position=Vector2(width-62,11);row.emblem.size=Vector2(38,38)
		for i in range(2):var meter: Dictionary=row.meters[i];meter.label.position=Vector2(108,54+i*17);meter.label.size=Vector2(136,16);meter.bar.position=Vector2(247,59+i*17);meter.bar.size=Vector2(maxf(20,width-295),7)
func close_surface() -> void:epoch+=1;hide();model={};prepared.clear();portrait.texture=null
func test_press(key: String) -> bool:
	if not visible:return false
	for button in actions:
		if button.visible and not button.disabled and str(button.get_meta("key"))==key:button.pressed.emit();return true
	for row in rows:
		if row.root.visible and not row.root.disabled and str(row.root.get_meta("key"))==key:row.root.pressed.emit();return true
	return false
func test_kind() -> String:return str(model.get("kind","")) if visible else ""
func test_layout() -> bool:
	if model.is_empty():return false
	for button in actions:
		if button.visible and (not Rect2(Vector2.ZERO,size).encloses(button.get_rect()) or button.size.y<40):return false
	var content: Control=scroll if model.kind=="crew-roster" else detail_scroll
	return content.position.y+content.size.y<=size.y-64 and content.size.y>90
func test_scroll_end() -> void:scroll.scroll_vertical=99999;detail_scroll.scroll_vertical=99999
func test_last_row_visible() -> bool:
	if model.kind!="crew-roster":return false
	return scroll.get_global_rect().encloses(rows[model.entries.size()-1].root.get_global_rect())
func test_identity_json() -> String:
	var ids: Array=[background.get_instance_id(),background.texture.get_instance_id(),scroll.scroll_vertical,detail_scroll.scroll_vertical]
	for row in rows:ids.append([row.root.get_instance_id(),row.picture.texture.get_instance_id() if row.picture.texture!=null else 0])
	return JSON.stringify(ids)
func test_detail_end_visible() -> bool:
	if model.kind!="crew-detail":return false
	var bottom: float=section_labels[-1].panel.get_global_rect().end.y;var area:=detail_scroll.get_global_rect()
	return bottom<=area.end.y+1 and bottom>=area.position.y
