extends Control
## Display-only projection of the original boss markup and target list.
## Selection is local presentation state; only a confirmed move sends targetId.
var battle_view: Control
var model: Dictionary = {}
var selected_target := "boss"
var signature := ""
var rebuilds := 0
var frame := NinePatchRect.new()
var heading := Label.new()
var back := Button.new()
var scroll := ScrollContainer.new()
var content := VBoxContainer.new()
var target_buttons: Dictionary = {}
var details: Label
var target_footer := VBoxContainer.new()
var target_row := HBoxContainer.new()

func _ready() -> void:
	hide()
	z_index = 220
	mouse_filter = Control.MOUSE_FILTER_STOP
	var matte := ColorRect.new()
	matte.color = Color("071b2a")
	matte.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(matte)
	matte.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.scale = Vector2.ONE * 0.18
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: frame.set_patch_margin(side,96)
	add_child(frame)
	add_child(heading)
	heading.add_theme_color_override("font_color",Color("ffe8bc"))
	heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	back.text = "返回"
	add_child(back)
	battle_view._button_art(back)
	back.pressed.connect(hide)
	add_child(scroll)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.add_child(content)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation",10)
	add_child(target_footer)
	target_footer.add_theme_constant_override("separation",4)
	target_footer.add_child(target_row)
	target_row.add_theme_constant_override("separation",6)
	details = _label(target_footer,"",12)
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	frame.size = size / 0.18
	heading.position = Vector2(24,12)
	heading.size = Vector2(maxf(20,size.x-154),36)
	heading.add_theme_font_size_override("font_size",18 if size.y <= 432 else 28)
	back.position = Vector2(size.x-112,10)
	back.size = Vector2(88,38)
	scroll.position = Vector2(24,58)
	var footer_height := 88.0 if target_buttons.size() > 1 else 0.0
	scroll.size = Vector2(maxf(20,size.x-48),maxf(20,size.y-78-footer_height))
	target_footer.visible = footer_height > 0
	target_footer.position = Vector2(24,size.y-20-footer_height)
	target_footer.size = Vector2(maxf(20,size.x-48),footer_height)
	details.custom_minimum_size.y = 28
	details.max_lines_visible = 2

func sync(packet: Variant) -> void:
	model = packet if packet is Dictionary else {}
	if model.is_empty():
		selected_target = "boss"
		hide()
		return
	var valid := false
	for target in model.targets:
		if str(target.id) == selected_target: valid = true
	if not valid: selected_target = "boss"
	if visible: _render()

func open() -> void:
	if model.is_empty(): return
	_render()
	show()
	move_to_front()

func move_payload(move_id: String) -> Dictionary:
	var result := {"moveId":move_id}
	if not model.is_empty(): result.targetId = selected_target
	return result

func _render() -> void:
	var next := JSON.stringify(model)
	if next == signature:
		_update_targets()
		return
	signature = next
	rebuilds += 1
	var old_scroll := scroll.scroll_vertical
	for child in content.get_children(): content.remove_child(child);child.queue_free()
	for child in target_row.get_children(): target_row.remove_child(child);child.queue_free()
	target_buttons.clear()
	heading.text = str(model.title)
	battle_view._image(frame,str(model.frame))
	var intro := HBoxContainer.new()
	intro.add_theme_constant_override("separation",12)
	content.add_child(intro)
	if not str(model.icon).is_empty(): _image(intro,str(model.icon),Vector2(72,72))
	var copy := VBoxContainer.new()
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	intro.add_child(copy)
	_label(copy,str(model.rule),16)
	_label(copy,str(model.counter),14).add_theme_color_override("font_color",Color("9cded6"))
	_node(content,model.state)
	if model.targets.size() > 1:
		for target in model.targets:
			var button := Button.new()
			button.name = "Target_"+str(target.id)
			button.text = str(target.label)
			button.tooltip_text = str(target.get("description",""))
			button.custom_minimum_size.y = 48
			button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			button.add_theme_font_size_override("font_size",13 if size.y <= 432 else 18)
			button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			button.toggle_mode = true
			target_row.add_child(button)
			battle_view._button_art(button)
			button.get_theme_stylebox("normal").content_margin_left=6
			button.get_theme_stylebox("normal").content_margin_right=6
			button.pressed.connect(func():selected_target=str(target.id);_update_targets())
			target_buttons[str(target.id)] = button
	_update_targets()
	_layout()
	scroll.set_deferred("scroll_vertical",old_scroll)

func _update_targets() -> void:
	for id in target_buttons:
		var button: Button = target_buttons[id]
		button.set_pressed_no_signal(id == selected_target)
		button.add_theme_color_override("font_color",Color("fff4bb") if id == selected_target else Color("b8d2da"))
		if id == selected_target and is_instance_valid(details): details.text=button.tooltip_text

func _label(parent: Node, value: String, font_size: int = 15) -> Label:
	var label := Label.new()
	label.text = value
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_font_size_override("font_size",font_size)
	label.add_theme_color_override("font_color",Color("e4eceb"))
	parent.add_child(label)
	return label

func _image(parent: Node, path: String, minimum: Vector2) -> TextureRect:
	var image := TextureRect.new()
	image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	image.custom_minimum_size = minimum
	image.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(image)
	battle_view._image(image,path)
	return image

func _node(parent: Node, value: Variant) -> void:
	if value is String:
		if not value.strip_edges().is_empty(): _label(parent,value.strip_edges())
		return
	var node: Dictionary = value
	var attrs: Dictionary = node.get("attrs",{})
	var classes := str(attrs.get("class","")).split(" ")
	var tag := str(node.get("tag",""))
	if tag == "img":
		_image(parent,str(attrs.get("src","")),Vector2(96,86))
		return
	if tag == "br": return
	if classes.has("shiki-island-mini-hp"):
		var bar := ProgressBar.new()
		bar.custom_minimum_size = Vector2(80,6)
		bar.show_percentage = false
		for child in node.children:
			if child is Dictionary: bar.value=float(str(child.attrs.get("style","")).get_slice(":",1).trim_suffix("%"))
		parent.add_child(bar)
		return
	var leaf := true
	for child in node.get("children",[]):
		if child is Dictionary: leaf = false
	if leaf:
		var text := _plain(node)
		if text.is_empty() and not classes.has("postgame-mechanic-pip"): return
		var label := _label(parent,text,17 if tag == "strong" else 13 if tag == "small" else 15)
		label.tooltip_text = str(attrs.get("title",""))
		if classes.has("postgame-mechanic-pip"):
			label.text = text if not text.is_empty() else "●"
			label.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
			label.custom_minimum_size.x = 22
			label.add_theme_color_override("font_color",Color("ffca72") if classes.has("active") else Color("4d646b"))
		return
	var box: Container
	if classes.has("postgame-mechanic-pips") or classes.has("postgame-mechanic-crew") or classes.has("postgame-mechanic-mini-crew"):
		box = HFlowContainer.new()
	elif classes.has("shiki-island-list") or classes.has("zephyr-end-point-operation") or classes.has("tesoro-control-crew") or classes.has("bullet-slot-grid"):
		box = GridContainer.new()
		box.columns = 3 if size.x >= 900 else 2
	else: box = VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation",6)
	box.add_theme_constant_override("h_separation",10)
	box.add_theme_constant_override("v_separation",8)
	parent.add_child(box)
	for child in node.get("children",[]): _node(box,child)
	if tag == "button" and attrs.has("data-bullet-slot"):
		# Touch exposes the same slot summary that desktop shows in a popover.
		_label(box,str(attrs.get("data-item-summary","")),13)
		_label(box,str(attrs.get("data-item-status","")),13)

func _plain(node: Variant) -> String:
	if node is String: return node
	var out := ""
	for child in node.get("children",[]): out += _plain(child)
	return out.strip_edges()
