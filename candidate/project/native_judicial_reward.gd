extends Control
## Persistent native projection of the original phone reward controller.
## Source JS owns gestures, chosen reward, permissions and completion.
signal control_requested(key: String)
signal pointer_event(kind: String, pointer_id: int, client_y: float, button: int)
signal frame_requested(now: float)
signal viewport_changed
signal visibility_lost
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var heading:=Label.new()
var defeated:=Label.new()
var next_enemy:=Label.new()
var shell:=Control.new()
var reel:=Control.new()
var pointer:=Panel.new()
var hint:=Label.new()
var arrow:=Label.new()
var icon:=TextureRect.new()
var kicker:=Label.new()
var reward:=Label.new()
var copy_scroll:=ScrollContainer.new()
var copy_box:=VBoxContainer.new()
var description:=Label.new()
var art:=TextureRect.new()
var caption:=Label.new()
var primary:=Button.new()
var skip:=Button.new()
var rows: Array[Dictionary]=[]
var image_targets: Array[Control]=[]
var captured_id: int=-999
var needs_frame:=false
var applies:=0
var frame_count:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;z_index=100;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=16;theme=t
	panel.scale=Vector2.ONE*.0625;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel);_image(panel,"mobile/art-ui/mobile-panel-v013.png")
	_label(heading,24,"ffe6a7");_label(defeated,16,"d7e6e6");defeated.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	_label(next_enemy,14,"b6d9d4");next_enemy.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	add_child(shell);shell.clip_contents=true;shell.mouse_filter=Control.MOUSE_FILTER_STOP;shell.focus_mode=Control.FOCUS_ALL
	shell.gui_input.connect(_shell_input);shell.add_child(reel);reel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var box:=StyleBoxFlat.new();box.bg_color=Color("0c2233");box.border_color=Color("ae8541");box.set_border_width_all(2);box.set_corner_radius_all(16)
	var background:=Panel.new();background.add_theme_stylebox_override("panel",box);background.mouse_filter=Control.MOUSE_FILTER_IGNORE;shell.add_child(background);shell.move_child(background,0);background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var slot:=StyleBoxFlat.new();slot.bg_color=Color(1,.81,.4,.1);slot.border_color=Color("edc573");slot.set_border_width_all(2);slot.set_corner_radius_all(8)
	pointer.add_theme_stylebox_override("panel",slot);pointer.mouse_filter=Control.MOUSE_FILTER_IGNORE;shell.add_child(pointer)
	_label(hint,14,"f4db9b");hint.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;_label(arrow,18,"f4db9b");arrow.text="↕"
	_setup_texture(icon);add_child(icon);_label(kicker,13,"d7e6e6");kicker.text="突破補給";_label(reward,22,"ffe6a7")
	add_child(copy_scroll);copy_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;copy_scroll.add_child(copy_box);copy_box.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	description.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;description.size_flags_horizontal=Control.SIZE_EXPAND_FILL;description.mouse_filter=Control.MOUSE_FILTER_IGNORE;description.add_theme_color_override("font_color",Color("edf2eb"));copy_box.add_child(description)
	_setup_texture(art);art.custom_minimum_size=Vector2(0,156);copy_box.add_child(art)
	caption.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;caption.add_theme_font_size_override("font_size",12);caption.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy_box.add_child(caption)
	for button in [skip,primary]:
		button.flat=true;button.add_theme_color_override("font_color",Color("fff0ba"));button.add_theme_font_size_override("font_size",16);add_child(button)
		var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*(8.0/112.0);frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,112)
		button.add_child(frame);button.move_child(frame,0);frame.show_behind_parent=true;_image(frame,"mobile/art-ui/mobile-row-v013.png")
	skip.pressed.connect(func():control_requested.emit("skip"));primary.pressed.connect(func():control_requested.emit("primary"))
	cache.asset_ready.connect(_asset_ready);resized.connect(func():_layout();viewport_changed.emit())
	hide();set_process(false)

func _label(label: Label,point_size: int,color: String) -> void:
	label.add_theme_font_size_override("font_size",point_size);label.add_theme_color_override("font_color",Color(color));label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.clip_text=true;add_child(label)
func _setup_texture(target: TextureRect) -> void:
	target.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;target.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;target.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _image(target: Control,path: String) -> void:
	if not image_targets.has(target):image_targets.append(target)
	if target.get_meta("wanted_asset","")==path:return
	target.set_meta("wanted_asset",path)
	if path.is_empty():target.set("texture",null);target.set_meta("loaded_asset","");return
	if not cache.records.has(path) and not cache.live_textures.has(path) and not cache.pending.has(path) and cache.pending.size()>=2:return
	var texture: Texture2D=cache.request(path)
	if texture!=null:target.set("texture",texture);target.set_meta("loaded_asset",path)
func _asset_ready(path: String,texture: Texture2D) -> void:
	for target in image_targets:
		if is_instance_valid(target) and target.get_meta("wanted_asset","")==path:target.set("texture",texture);target.set_meta("loaded_asset",path)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b2a"))
func apply_source_json(value: String) -> void:
	model=JSON.parse_string(value);applies+=1
	if not model.get("visible",false):close_surface();return
	heading.text=model.title;defeated.text=model.defeated;next_enemy.text=model.next;reward.text=model.label;description.text=model.description;caption.text=model.get("caption","")
	_image(icon,model.icon);_image(art,model.art);art.visible=not str(model.art).is_empty();caption.visible=not caption.text.is_empty()
	var entries: Array=model.rows
	while rows.size()<entries.size():
		var node:=Control.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;reel.add_child(node)
		var image:=TextureRect.new();_setup_texture(image);node.add_child(image)
		var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_size_override("font_size",22);label.clip_text=true;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;node.add_child(label)
		rows.append({"node":node,"icon":image,"label":label})
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.node.visible=i<entries.size()
		if i>=entries.size():continue
		var entry: Dictionary=entries[i];row.label.text=entry.label;row.label.add_theme_color_override("font_color",Color("ffe6a7") if entry.winning else Color("e2e8e9"));_image(row.icon,entry.icon)
	hint.text=str(model.hint).trim_prefix("↕ ");arrow.visible=model.phase=="idle"
	primary.text=model.primary.label;primary.disabled=model.primary.disabled;skip.text=model.skip.label;skip.disabled=model.skip.disabled
	for button in [primary,skip]:button.modulate.a=.5 if button.disabled else 1
	show();set_process(true);_layout();queue_redraw()
func _layout() -> void:
	if not is_node_ready():return
	panel.size=size/.0625
	var inner:=size-Vector2(60,52);var body_h:=maxf(1,inner.y-113);var left_w:=(inner.x-20)*.92/1.92;var right_x:=30+left_w+20;var right_w:=inner.x-left_w-20
	heading.position=Vector2(30,26);heading.size=Vector2(inner.x/2,30);defeated.position=Vector2(30+inner.x/2,26);defeated.size=Vector2(inner.x/2,30)
	shell.position=Vector2(30,61);shell.size=Vector2(left_w,maxf(1,body_h-29));reel.size=Vector2(shell.size.x,rows.size()*72)
	pointer.position=Vector2(10,(shell.size.y-72)/2);pointer.size=Vector2(shell.size.x-20,72)
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.node.position=Vector2(14,i*72);row.node.size=Vector2(shell.size.x-28,72);row.icon.position=Vector2(18,12);row.icon.size=Vector2(48,48);row.label.position=Vector2(80,0);row.label.size=Vector2(maxf(1,shell.size.x-126),72)
	hint.position=Vector2(30,61+body_h-24);hint.size=Vector2(left_w,24);arrow.position=Vector2(30+maxf(8,(left_w-170)/2),hint.position.y);arrow.size=Vector2(20,24)
	icon.position=Vector2(right_x,61);icon.size=Vector2(48,48);kicker.position=Vector2(right_x+58,61);kicker.size=Vector2(right_w-58,20);reward.position=Vector2(right_x+58,85);reward.size=Vector2(right_w-58,32)
	copy_scroll.position=Vector2(right_x,121);copy_scroll.size=Vector2(right_w,maxf(1,body_h-60))
	next_enemy.position=Vector2(30,size.y-99);next_enemy.size=Vector2(inner.x,22)
	primary.position=Vector2(size.x-178,size.y-72);primary.size=Vector2(148,46);skip.position=Vector2(size.x-338,size.y-72);skip.size=Vector2(148,46)
	for button in [primary,skip]:button.get_child(0).size=button.size/(8.0/112.0)
func set_reel_offset(value: float) -> void:reel.position.y=value
func reel_height() -> float:return shell.size.y
func capture_pointer(id: int) -> void:captured_id=id
func release_pointer(id: int) -> void:
	if captured_id==id:captured_id=-999
func request_frames(active: bool) -> void:needs_frame=active
func _shell_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:pointer_event.emit("pointerdown",event.index,event.position.y,0);accept_event()
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and event.pressed:pointer_event.emit("pointerdown",-1,event.position.y,0);accept_event()
func _input(event: InputEvent) -> void:
	if not visible or captured_id==-999:return
	# Both initial and captured positions are expressed in shell-local space.
	if event is InputEventScreenDrag and event.index==captured_id:pointer_event.emit("pointermove",captured_id,event.position.y-shell.global_position.y,0);get_viewport().set_input_as_handled()
	elif event is InputEventScreenTouch and event.index==captured_id and not event.pressed:pointer_event.emit("pointercancel" if event.canceled else "pointerup",captured_id,event.position.y-shell.global_position.y,0);get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and captured_id==-1:pointer_event.emit("pointermove",-1,event.position.y-shell.global_position.y,0);get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and not event.pressed and captured_id==-1:pointer_event.emit("pointerup",-1,event.position.y-shell.global_position.y,0);get_viewport().set_input_as_handled()
func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_PAUSED and visible:visibility_lost.emit()
func _process(_delta: float) -> void:
	for target in image_targets:
		var path: String=target.get_meta("wanted_asset","")
		if path.is_empty() or target.get_meta("loaded_asset","")==path:continue
		if not cache.pending.has(path) and cache.pending.size()>=2:continue
		var texture: Texture2D=cache.request(path)
		if texture!=null:target.set("texture",texture);target.set_meta("loaded_asset",path)
	if arrow.visible:arrow.position.y=hint.position.y-3*cos(TAU*fmod(Time.get_ticks_msec(),1400)/1400)
	if needs_frame:frame_count+=1;frame_requested.emit(float(Time.get_ticks_msec()))
func close_surface() -> void:captured_id=-999;needs_frame=false;hide();set_process(false)
func test_state_json() -> String:
	var bounds:=get_global_rect();var ready:=true
	for target in image_targets:
		if target.is_visible_in_tree() and target.get_meta("wanted_asset","")!=target.get_meta("loaded_asset",""):ready=false
	return JSON.stringify({"visible":visible,"ready":ready,"phase":model.get("phase",""),"rows":rows.size(),"rowIds":rows.map(func(row):return row.node.get_instance_id()),"applies":applies,"frameCount":frame_count,"offset":reel.position.y,"buttonsInside":bounds.encloses(primary.get_global_rect()) and bounds.encloses(skip.get_global_rect()),"copyInside":bounds.encloses(copy_scroll.get_global_rect()),"shellHeight":shell.size.y,"capture":captured_id})
