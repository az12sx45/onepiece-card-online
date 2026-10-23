extends Control
signal source_input(uid: String,type: String,transfer: String)
const SourceButton=preload("res://native_boss_prompt_button.gd")
var battle_view: Control
var panel:=Control.new()
var frame:=NinePatchRect.new()
var heading:=Label.new()
var message:=Label.new()
var scroll:=ScrollContainer.new()
var body:=VBoxContainer.new()
var footer:=HBoxContainer.new()
var summary:=Label.new()
var controls: Dictionary={}
var labels: Dictionary={}
var cards: Dictionary={}
var packet: Dictionary={}
var structure:=""
var builds:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=240;hide()
	panel.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(panel)
	var matte:=ColorRect.new();matte.color=Color("071b2a");matte.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.add_child(matte);matte.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.15
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,128)
	panel.add_child(frame)
	panel.add_child(heading);heading.add_theme_color_override("font_color",Color("ffe8bc"));heading.add_theme_font_size_override("font_size",18)
	heading.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	panel.add_child(message);message.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;message.add_theme_font_size_override("font_size",12)
	panel.add_child(scroll);scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;scroll.add_child(body);body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",8)
	panel.add_child(footer);footer.add_theme_constant_override("separation",10);summary.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;summary.max_lines_visible=2;summary.size_flags_horizontal=Control.SIZE_EXPAND_FILL;summary.add_theme_font_size_override("font_size",13);footer.add_child(summary)
	resized.connect(_layout)

func _write(label: Label,text: String) -> void:
	if label.text!=text:label.text=text
func _label(parent: Node,key: String,text: String,font_size:=14) -> Label:
	var label:=Label.new();label.text=text;label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("e7eee9"));label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;parent.add_child(label);labels[key]=label;return label
func _button(parent: Node,key: String,minimum:=Vector2(0,40)) -> Button:
	var button:=SourceButton.new();button.custom_minimum_size=minimum;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;parent.add_child(button)
	battle_view._button_art(button)
	var style: StyleBox=button.get_theme_stylebox("normal")
	style.content_margin_left=6;style.content_margin_right=6;style.content_margin_top=4;style.content_margin_bottom=4
	button.add_theme_font_size_override("font_size",14);button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	button.source_event.connect(func(uid,type,transfer):source_input.emit(uid,type,transfer))
	controls[key]=button;return button
func _bind(key: String,value: Dictionary,label: String="") -> void:
	var button: Button=controls[key];button.source_uid=str(value.uid);button.source_data=value.get("dataset",{});button.disabled=value.get("disabled",false);button.text=label;button.tooltip_text=str(value.get("label",label))
	button.modulate=Color("fff0b1") if value.get("classes",[]).has("picked") else Color.WHITE

func apply_source_json(json: String) -> void:
	packet=JSON.parse_string(json)
	if not packet.get("visible",false):hide();return
	var next:=str(packet.type)
	if packet.type=="oars_lottery":
		for group in packet.groups:
			for option in group.options:next+="|"+str(option.id)
	elif packet.type=="tot_team_setup":
		for item in packet.roster:next+="|"+str(item.key)
	elif packet.type=="judicial_switch":
		for item in packet.choices:next+="|"+str(item.key)
	if next!=structure:
		structure=next;_build()
	_write(heading,str(packet.title));_write(message,str(packet.message));battle_view._image(frame,str(packet.frame))
	match str(packet.type):
		"judicial_switch":
			for choice in packet.choices:_bind(str(choice.key),choice,str(choice.name)+"\n"+str(choice.detail))
		"katakuri_future_sight":
			_write(labels.notice,str(packet.heading)+"\n"+str(packet.explanation))
			for key in ["move","defend"]:controls[key].hide()
			for choice in packet.choices:
				var key: String=str(choice.dataset.katakuriChoice);controls[key].show();_bind(key,choice,str(choice.name)+"\n"+str(choice.description))
		"oars_lottery":
			for group in packet.groups:
				for option in group.options:
					var key: String=str(option.id);_write(labels[key+":name"],str(option.label)+"  "+str(option.payout));_write(labels[key+":description"],str(option.description));_write(labels[key+":count"],str(option.count));_bind(key+":minus",option.minus,"−");_bind(key+":plus",option.plus,"＋")
			_write(summary,str(packet.summary));_bind("confirm",packet.confirm,str(packet.confirm.label))
		"oars_purification":
			_bind("purify",packet.action);_update_card("purify",packet.action)
		"tot_team_setup":
			for lane in packet.lanes:
				for slot in lane.slots:_bind(str(slot.key),slot);_update_card(str(slot.key),slot)
			for member in packet.roster:_bind(str(member.key),member);_update_card(str(member.key),member)
			_bind("confirm",packet.confirm,str(packet.confirm.label))
	_layout();show()

func _build() -> void:
	builds+=1
	for child in body.get_children():body.remove_child(child);child.queue_free()
	for child in footer.get_children():
		if child!=summary:footer.remove_child(child);child.queue_free()
	controls.clear();labels.clear();cards.clear();summary.text="";scroll.scroll_vertical=0
	match str(packet.type):
		"judicial_switch":
			for choice in packet.choices:_button(body,str(choice.key),Vector2(0,88))
		"katakuri_future_sight":
			var row:=HBoxContainer.new();row.add_theme_constant_override("separation",8);body.add_child(row)
			_label(row,"notice","",12)
			_button(row,"move",Vector2(0,68));_button(row,"defend",Vector2(0,68))
		"oars_lottery":
			for group in packet.groups:
				_label(body,"group:"+str(group.name),str(group.name),16)
				var grid:=GridContainer.new();grid.columns=3;grid.add_theme_constant_override("h_separation",10);grid.add_theme_constant_override("v_separation",8);body.add_child(grid)
				for option in group.options:
					var key: String=str(option.id);var box:=VBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;grid.add_child(box)
					_label(box,key+":name","",14);_label(box,key+":description","",12)
					var stepper:=HBoxContainer.new();box.add_child(stepper);_button(stepper,key+":minus",Vector2(36,36));_label(stepper,key+":count","",14).horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;_button(stepper,key+":plus",Vector2(36,36))
			_button(footer,"confirm",Vector2(140,40))
		"oars_purification":
			_card(body,"purify",Vector2(0,160))
		"tot_team_setup":
			var lanes:=HBoxContainer.new();lanes.add_theme_constant_override("separation",12);body.add_child(lanes)
			for lane in packet.lanes:
				var column:=VBoxContainer.new();column.size_flags_horizontal=Control.SIZE_EXPAND_FILL;lanes.add_child(column);_label(column,"lane:"+str(lane.label),str(lane.label)+"　"+str(lane.subtitle),13)
				var row:=HBoxContainer.new();row.add_theme_constant_override("separation",4);column.add_child(row)
				for slot in lane.slots:_card(row,str(slot.key),Vector2(0,88))
			var roster:=HBoxContainer.new();roster.add_theme_constant_override("separation",6);body.add_child(roster)
			for member in packet.roster:_card(roster,str(member.key),Vector2(0,64))
			_button(footer,"confirm",Vector2(180,40))

func _card(parent: Node,key: String,minimum: Vector2) -> void:
	var button:=_button(parent,key,minimum)
	var art:=TextureRect.new();art.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;art.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;art.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(art)
	var name_label:=Label.new();name_label.add_theme_font_size_override("font_size",12);name_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;name_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(name_label)
	var detail:=Label.new();detail.add_theme_font_size_override("font_size",10);detail.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;detail.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;detail.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(detail)
	var order:=Label.new();order.add_theme_font_size_override("font_size",10);order.mouse_filter=Control.MOUSE_FILTER_IGNORE;order.add_theme_color_override("font_color",Color("ffe29a"));button.add_child(order)
	cards[key]={"image":art,"name":name_label,"detail":detail,"order":order}
	button.resized.connect(func():
		var top:=4.0 if order.text.is_empty() else 18.0
		art.position=Vector2(4,top);art.size=Vector2(button.size.x-8,maxf(12,button.size.y-34-top));name_label.position=Vector2(4,button.size.y-31);name_label.size=Vector2(button.size.x-8,16);detail.position=Vector2(4,button.size.y-16);detail.size=Vector2(button.size.x-8,14);order.position=Vector2(6,3);order.size=Vector2(button.size.x-12,14)
	)
func _update_card(key: String,data: Dictionary) -> void:
	var card: Dictionary=cards[key]
	card.image.visible=not str(data.get("image","")).is_empty()
	if card.image.visible:battle_view._image(card.image,str(data.image))
	_write(card.name,str(data.get("name","")) if not str(data.get("name","")).is_empty() else str(data.get("empty","")))
	_write(card.detail,str(data.get("detail",data.get("description",""))))
	_write(card.order,str(data.get("order","")))
	controls[key].resized.emit()

func _layout() -> void:
	if packet.is_empty() or not packet.get("visible",false):return
	var compact: bool=packet.get("type","")=="katakuri_future_sight"
	panel.position=Vector2(8,size.y-96) if compact else Vector2.ZERO
	panel.size=Vector2(size.x-16,88) if compact else size
	frame.size=panel.size/.15
	heading.visible=not compact;message.visible=not compact;footer.visible=not compact and packet.type not in ["oars_purification","judicial_switch"]
	heading.position=Vector2(20,10);heading.size=Vector2(size.x-40,26)
	message.position=Vector2(20,36);message.size=Vector2(size.x-40,32)
	if compact:
		scroll.position=Vector2(10,8);scroll.size=panel.size-Vector2(20,16)
	else:
		scroll.position=Vector2(20,70);scroll.size=Vector2(size.x-40,size.y-130 if footer.visible else size.y-90)
	footer.position=Vector2(20,size.y-52);footer.size=Vector2(size.x-40,40)
	if packet.type=="tot_team_setup":
		for key in cards:controls[key].custom_minimum_size.y=(64 if size.y<=340 else 80) if str(key).begins_with("crew:") else (88 if size.y<=340 else 108)

func test_content_json() -> String:
	var result:={"cards":{},"labels":{},"summary":summary.text}
	for key in cards:result.cards[key]={"name":cards[key].name.text,"detail":cards[key].detail.text,"order":cards[key].order.text}
	for key in labels:result.labels[key]=labels[key].text
	return JSON.stringify(result)

func test_reveal_uid(uid: String) -> bool:
	for button in controls.values():
		if button.source_uid==uid:
			if scroll.is_ancestor_of(button):scroll.ensure_control_visible(button)
			return not button.disabled
	return false
func test_input_uid(uid: String) -> bool:
	for button in controls.values():
		if button.source_uid!=uid:continue
		if button.disabled:return false
		var center: Vector2=button.get_global_rect().get_center()
		assert(Rect2(Vector2.ZERO,size).has_point(center),"Source prompt button outside viewport")
		if scroll.is_ancestor_of(button):assert(scroll.get_global_rect().has_point(center),"Source prompt button remains clipped")
		for pressed_value in [true,false]:
			var event:=InputEventMouseButton.new();event.position=center;event.global_position=center;event.button_index=MOUSE_BUTTON_LEFT;event.pressed=pressed_value;get_viewport().push_input(event,true)
		return true
	return false
func test_bounds_json() -> String:
	var errors: Array=[]
	if scroll.size.x<0 or scroll.size.y<0:errors.append("negative scroll size")
	if body.size.x>scroll.size.x+1:errors.append("horizontal overflow")
	if footer.visible and not Rect2(Vector2.ZERO,size+Vector2.ONE).encloses(footer.get_global_rect()):errors.append("footer outside viewport")
	return JSON.stringify({"errors":errors,"builds":builds,"bodyWidth":body.size.x,"scrollWidth":scroll.size.x,"footerRect":str(footer.get_global_rect()),"viewport":str(size)})
func test_capture(path: String) -> void:
	_capture_after_draw(path)
func _capture_after_draw(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
func test_drag_uids(source_uid: String,target_uid: String) -> void:
	_drag_after_layout(source_uid,target_uid)
func _drag_after_layout(source_uid: String,target_uid: String) -> void:
	var source: Button
	var target: Button
	for button in controls.values():
		if button.source_uid==source_uid:source=button
		if button.source_uid==target_uid:target=button
	assert(source!=null and target!=null,"Original drag controls absent")
	var start:=source.get_global_rect().get_center();var finish:=target.get_global_rect().get_center()
	var press:=InputEventMouseButton.new();press.position=start;press.global_position=start;press.button_index=MOUSE_BUTTON_LEFT;press.pressed=true;get_viewport().push_input(press,true)
	await get_tree().process_frame
	var motion:=InputEventMouseMotion.new();motion.position=start+Vector2(18,0);motion.global_position=motion.position;motion.relative=Vector2(18,0);motion.button_mask=MOUSE_BUTTON_MASK_LEFT;get_viewport().push_input(motion,true)
	await get_tree().process_frame
	motion=InputEventMouseMotion.new();motion.position=finish;motion.global_position=finish;motion.relative=finish-start-Vector2(18,0);motion.button_mask=MOUSE_BUTTON_MASK_LEFT;get_viewport().push_input(motion,true)
	await get_tree().process_frame
	var release:=InputEventMouseButton.new();release.position=finish;release.global_position=finish;release.button_index=MOUSE_BUTTON_LEFT;release.pressed=false;get_viewport().push_input(release,true)
