extends Control
## Original research pages, native scrolling, fixed navigation and service actions.
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var panel:=Control.new()
var frame:=TextureRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var notice:=Label.new()
var nav:=VBoxContainer.new()
var tabs:=HBoxContainer.new()
var footer:=HBoxContainer.new()
var scroll:=ScrollContainer.new()
var body:=VBoxContainer.new()
var controls: Dictionary={}
var buttons: Dictionary={}
var epoch:=0
var busy:=false
var loads:=0
var cultivating_tick:=-1
var cultivation_vessel: Control
func _ready() -> void:
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);t.default_font_size=12;theme=t
	panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(panel);_prepare_image(frame);panel.add_child(frame)
	for container in [nav,tabs,footer]:panel.add_child(container);container.add_theme_constant_override("separation",6)
	for label in [title,subtitle,notice]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_color",Color("fff0bf"));panel.add_child(label)
	subtitle.add_theme_font_size_override("font_size",8);subtitle.add_theme_color_override("font_color",Color("72ddcb"));title.add_theme_font_size_override("font_size",17);notice.add_theme_font_size_override("font_size",9);notice.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_SHOW_NEVER;panel.add_child(scroll);body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",8);scroll.add_child(body)
	resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("06151f"))
func _prepare_image(image: TextureRect) -> void:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _paths(value: Variant,result: Array) -> void:
	if value is String:
		if value.begins_with("images/") and not result.has(value):result.append(value)
	elif value is Array:
		for entry in value:_paths(entry,result)
	elif value is Dictionary:
		for key in value:
			if key!="fallback":_paths(value[key],result)
func _fallbacks(value: Variant,result: Dictionary) -> void:
	if value is Dictionary:
		if value.has("image") and value.has("fallback") and not str(value.fallback).is_empty():result[value.image]=value.fallback
		for entry in value.values():_fallbacks(entry,result)
	elif value is Array:
		for entry in value:_fallbacks(entry,result)
func apply_json(value: String) -> void:epoch+=1;busy=true;_load(JSON.parse_string(value),epoch)
func _load(next: Dictionary,token: int) -> void:
	var paths: Array=[];_paths(next,paths);var fallbacks: Dictionary={};_fallbacks(next,fallbacks);var images: Dictionary={};var deadline:=Time.get_ticks_msec()+18000
	while images.size()<paths.size() and token==epoch:
		for path in paths:
			if images.has(path):continue
			var source: String=path
			if cache.failed.has(source):
				if not fallbacks.has(source) or cache.failed.has(fallbacks[source]):push_error("Research source image and fallback failed "+path);return
				source=fallbacks[source]
			if cache.pending.size()>=2 and not cache.records.has(source) and not cache.live_textures.has(source):continue
			var texture: Texture2D=cache.request(source)
			if texture!=null:images[path]=texture
		if Time.get_ticks_msec()>deadline:push_error("Research source images timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	loads+=1;model=next;prepared=images;controls.clear();buttons.clear();cultivation_vessel=null;cultivating_tick=-1
	for control in model.controls:controls[control.key]=control
	for container in [nav,tabs,footer,body]:
		for child in container.get_children():container.remove_child(child);child.queue_free()
	frame.texture=prepared[model.frame];title.text=model.title;subtitle.text=model.subtitle;notice.text=model.notice
	for key in model.nav:_button(nav,key,46).size_flags_vertical=Control.SIZE_EXPAND_FILL
	for key in model.subnav:_button(tabs,key,30)
	for key in model.footer:_button(footer,key,32)
	_layout();_build_page();_layout();scroll.scroll_vertical=0;busy=false;show();set_process(false);surface_ready.emit()
func _label(parent: Node,text: String,font_size:=12) -> Label:
	var label:=Label.new();label.text=text;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("fff1cc"));parent.add_child(label);return label
func _image(parent: Node,path: String,minimum: Vector2) -> TextureRect:
	var image:=TextureRect.new();_prepare_image(image);image.texture=prepared.get(path);image.custom_minimum_size=minimum;parent.add_child(image);return image
func _column(parent: Node) -> VBoxContainer:
	var box:=VBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_theme_constant_override("separation",5);parent.add_child(box);return box
func _row(parent: Node) -> HBoxContainer:
	var box:=HBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_theme_constant_override("separation",8);parent.add_child(box);return box
func _button(parent: Node,key: String,height:=32) -> Button:
	assert(controls.has(key),"Original research control absent");var data: Dictionary=controls[key];var button:=Button.new();button.text=data.label;button.disabled=data.disabled;button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;button.custom_minimum_size.y=height;button.add_theme_font_size_override("font_size",11);button.add_theme_color_override("font_color",Color("ffefb4"))
	var path: String=data.image
	if path.is_empty():button.flat=true
	else:
		var style:=StyleBoxTexture.new();style.texture=prepared[path]
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:style.set_texture_margin(side,12);style.set_content_margin(side,6)
		button.add_theme_stylebox_override("normal",style);button.add_theme_stylebox_override("hover",style);button.add_theme_stylebox_override("pressed",style);button.add_theme_stylebox_override("disabled",style)
	button.set_meta("key",key);parent.add_child(button);buttons[key]=button;button.pressed.connect(func():if not busy:command_requested.emit(key));return button
func _actions(parent: Node,keys: Array) -> void:
	if keys.is_empty():return
	var row:=_row(parent)
	for key in keys:_button(row,key)
func _profile_card(parent: Node,entry: Dictionary,side:=146.0) -> Control:
	var card:=Control.new();card.custom_minimum_size=Vector2.ONE*side;parent.add_child(card);var border:=_image(card,entry.frame,Vector2.ZERO);border.size=Vector2.ONE*side
	if entry.get("empty",false):
		var empty:=_label(card,"空席",12);empty.position=Vector2(0,side*.45);empty.size=Vector2(side,24);empty.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;return card
	var texture: Texture2D=prepared.get(entry.image)
	if texture!=null:
		var portrait:=ColorRect.new();portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;portrait.position=Vector2(.29,.10)*side;portrait.size=Vector2.ONE*.42*side;var effect:=ShaderMaterial.new();effect.shader=preload("res://native_research_circle.gdshader");effect.set_shader_parameter("portrait",texture);effect.set_shader_parameter("image_size",texture.get_size());effect.set_shader_parameter("box_size",portrait.size);portrait.material=effect;card.add_child(portrait)
	var name_label:=_label(card,entry.name,11);name_label.position=Vector2(.18,.55)*side;name_label.size=Vector2(.64,.12)*side;name_label.autowrap_mode=TextServer.AUTOWRAP_OFF;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;name_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	var level:=_label(card,entry.level,9);level.position=Vector2(.18,.67)*side;level.size=Vector2(.64,.22)*side;level.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;level.add_theme_color_override("font_color",Color("93d9cd"))
	return card
func _crew(parent: Node,entries: Array) -> void:
	for entry in entries:
		var row:=_row(parent);_profile_card(row,entry)
		if entry.empty:continue
		var copy:=_column(row);_label(copy,entry.name,14);_label(copy,entry.role,11)
		for key in entry.actions:_button(copy,key,32)
func _build_page() -> void:
	var page: Dictionary=model.page
	if page.type=="medical":
		var row:=_row(body);_image(row,page.image,Vector2(105,80));var copy:=_column(row)
		for line in page.copy:_label(copy,line,12)
		_crew(body,page.crew)
	elif page.type=="supply":
		for line in page.summary:_label(body,line,12)
		for entry in page.entries:
			var card:=Control.new();body.add_child(card);card.size_flags_horizontal=Control.SIZE_EXPAND_FILL
			var border:=_image(card,entry.frame,Vector2.ZERO);var icon:=_image(card,entry.image,Vector2.ZERO);var copy:=_column(card)
			for i in range(entry.copy.size()):_label(copy,entry.copy[i],13 if i==0 else 11)
			var action: Button=_button(card,entry.actions[0],32)
			var arrange:=func():
				card.custom_minimum_size.y=card.size.x*.75;border.size=card.size;icon.position=card.size*Vector2(.04,.08);icon.size=card.size*Vector2(.43,.64);copy.position=card.size*Vector2(.5,.12);copy.size=card.size*Vector2(.42,.59);action.position=card.size*Vector2(.21,.81);action.size=card.size*Vector2(.58,.12)
			card.resized.connect(arrange);arrange.call()
	elif page.type=="roster":
		for line in page.heading:_label(body,line,12)
		_actions(body,page.tools);_crew(body,page.crew)
		if page.crew.is_empty():_label(body,page.empty,12)
		_label(body,page.pageText,10);_actions(body,page.pagination)
	elif page.type=="detail":
		var row:=_row(body);_profile_card(row,page,146)
		var copy:=_column(row);_label(copy,page.name,15);_label(copy,page.level,12)
		for line in page.summary:_label(copy,line,11)
		for stat in page.stats:_label(copy,"  ".join(stat),12)
		_actions(body,page.actions)
		if page.breakthrough!=null:
			for line in page.breakthrough.heading:_label(body,line,12)
			for requirement in page.breakthrough.requirements:_label(body,"  ".join(requirement.text),12)
			if not page.breakthrough.image.is_empty():_image(body,page.breakthrough.image,Vector2(72,72))
			_label(body,page.breakthrough.confirmation,11);_actions(body,page.breakthrough.actions)
		_label(body,page.compareText,11);_actions(body,page.compare)
	elif page.type=="cultivation":
		var row:=_row(body);cultivation_vessel=preload("res://native_research_vessel.gd").new();row.add_child(cultivation_vessel);cultivation_vessel.configure(page,prepared)
		var copy:=_column(row)
		for line in page.copy:_label(copy,line,11)
		if page.factor!=null:
			var card:=Control.new();body.add_child(card);card.size_flags_horizontal=Control.SIZE_EXPAND_FILL;var border:=_image(card,page.factor.frame,Vector2.ZERO);var picture:=_image(card,page.factor.image,Vector2.ZERO);var factor_copy:=_column(card)
			for i in range(page.factor.copy.size()):_label(factor_copy,page.factor.copy[i],13 if i==0 else 11)
			var arrange:=func():
				card.custom_minimum_size.y=card.size.x*9/16; border.size=card.size;picture.position=card.size*Vector2(.085,.2);picture.size=card.size*Vector2(.3,.56);factor_copy.position=card.size*Vector2(.42,.155);factor_copy.size=card.size*Vector2(.505,.615)
			card.resized.connect(arrange);arrange.call()
		if not page.empty.is_empty():_label(body,page.empty,12)
		_label(body,page.position,11)
		if page.result!=null:_crew(body,page.result.crew)
		_actions(body,page.actions)
	else:push_error("Unbound original research page "+str(page.type))
func _layout() -> void:
	var width:=minf(size.x,size.y*1672/941);panel.size=Vector2(width,width*941/1672);panel.position=(size-panel.size)/2;frame.size=panel.size
	subtitle.position=panel.size*Vector2(.27,.065);subtitle.size=panel.size*Vector2(.65,.04);title.position=panel.size*Vector2(.27,.105);title.size=panel.size*Vector2(.65,.08)
	nav.position=panel.size*Vector2(.035,.245);nav.size=panel.size*Vector2(.202,.55)
	tabs.position=panel.size*Vector2(.29,.21);tabs.size=panel.size*Vector2(.64,.09);tabs.visible=not model.get("subnav",[]).is_empty()
	var top:=.31 if tabs.visible else .24;scroll.position=panel.size*Vector2(.29,top);scroll.size=panel.size*Vector2(.64,.80-top);body.custom_minimum_size.x=maxf(1,scroll.size.x-14)
	notice.position=panel.size*Vector2(.16,.855);notice.size=panel.size*Vector2(.42,.085);footer.position=panel.size*Vector2(.59,.865);footer.size=panel.size*Vector2(.35,.09)
	queue_redraw()
func update_controls_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value);model=next;notice.text=model.notice
	for control in model.controls:
		controls[control.key]=control
		if buttons.has(control.key):buttons[control.key].disabled=control.disabled
	if model.cultivating and cultivating_tick<0:
		cultivating_tick=Time.get_ticks_msec()
		if cultivation_vessel!=null:cultivation_vessel.start()
func close_surface() -> void:epoch+=1;busy=false;hide();set_process(false)
func test_ready() -> bool:return visible and not busy
func test_press(key: String) -> bool:
	if not test_ready() or not buttons.has(key):return false
	var button: Button=buttons[key]
	if button.disabled or not button.is_visible_in_tree():return false
	if body.is_ancestor_of(button):scroll.ensure_control_visible(button)
	button.pressed.emit();return true
func test_layout() -> bool:
	if not test_ready() or not Rect2(Vector2.ZERO,size).grow(.1).encloses(panel.get_rect()):return false
	for container in [scroll,footer,nav,tabs]:
		if container.visible and not Rect2(Vector2.ZERO,panel.size).grow(.1).encloses(container.get_rect()):return false
	if body.size.x>scroll.size.x+1:return false
	for button in buttons.values():
		var rect: Rect2=button.get_global_rect();var owner_rect: Rect2=scroll.get_global_rect() if body.is_ancestor_of(button) else panel.get_global_rect()
		if rect.position.x<owner_rect.position.x-.1 or rect.end.x>owner_rect.end.x+.1:return false
	return true
func test_scroll_to(key: String) -> void:
	if buttons.has(key) and body.is_ancestor_of(buttons[key]):scroll.ensure_control_visible(buttons[key])
func test_visible_action(key: String) -> bool:
	if not buttons.has(key):return false
	var button: Button=buttons[key];var bounds: Rect2=scroll.get_global_rect() if body.is_ancestor_of(button) else panel.get_global_rect()
	return bounds.grow(1).encloses(button.get_global_rect())
func test_structure() -> String:
	var ids: Array=[]
	for button in buttons.values():ids.append(button.get_instance_id())
	return JSON.stringify({"loads":loads,"buttons":ids,"body":body.get_child_count()})

func test_geometry() -> String:return JSON.stringify({"size":str(size),"panel":str(panel.get_rect()),"scroll":str(scroll.get_rect()),"footer":str(footer.get_rect()),"busy":busy,"visible":visible})
