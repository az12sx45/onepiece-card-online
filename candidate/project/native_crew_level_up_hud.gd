extends Control
## Transient Board presentation only. Missing or late portraits never hold the queue.
signal cue_requested

const Fonts = preload("res://native_fonts.gd")
const PortraitClip = preload("res://portrait_round_clip.gdshader")
const CARD_SIZE := Vector2(354.0, 81.0)
const NOTICE_MSEC := 2400

var cache: Node
var mission_notice: Control
var _queue: Array[Dictionary] = []
var _active_portrait := ""
var _started := 0
var _top := 12.0
var _fit := 1.0
var _card := Panel.new()
var _portrait := TextureRect.new()
var _fallback := Label.new()
var _name := Label.new()
var _from := Label.new()
var _to := Label.new()
var _shine := TextureRect.new()

func _ready() -> void:
	mouse_filter = MOUSE_FILTER_IGNORE
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_card.mouse_filter = MOUSE_FILTER_IGNORE
	_card.clip_contents = true
	_card.size = CARD_SIZE
	_card.add_theme_stylebox_override("panel", _frame(Color("14292d"), Color("dfb865"), 13, 14))
	add_child(_card)

	var portrait_frame := Panel.new()
	portrait_frame.mouse_filter = MOUSE_FILTER_IGNORE
	portrait_frame.position = Vector2(12, 12)
	portrait_frame.size = Vector2(57, 57)
	portrait_frame.add_theme_stylebox_override("panel", _frame(Color("132f36"), Color("edc773"), 9))
	_card.add_child(portrait_frame)
	_portrait.mouse_filter = MOUSE_FILTER_IGNORE
	_portrait.position = Vector2.ONE
	_portrait.size = Vector2(55, 55)
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var clip := ShaderMaterial.new()
	clip.shader = PortraitClip
	clip.set_shader_parameter("card_size", _portrait.size)
	clip.set_shader_parameter("corner_radius", 8.0)
	_portrait.material = clip
	portrait_frame.add_child(_portrait)
	_label(_fallback, 27, 900, Color("ffdc8b"))
	_fallback.text = "↑"
	_fallback.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_fallback.size = portrait_frame.size
	portrait_frame.add_child(_fallback)

	var kicker := Label.new()
	_label(kicker, 12, 900, Color("ffdc84"))
	kicker.text = "✦ 角色升等"
	kicker.position = Vector2(80, 6)
	_card.add_child(kicker)
	_label(_name, 16, 850, Color("fff2d2"))
	_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_name.position = Vector2(80, 23)
	_name.size = Vector2(260, 23)
	_card.add_child(_name)

	var levels := HBoxContainer.new()
	levels.mouse_filter = MOUSE_FILTER_IGNORE
	levels.position = Vector2(80, 43)
	levels.size = Vector2(260, 32)
	levels.add_theme_constant_override("separation", 8)
	_card.add_child(levels)
	_label(_from, 14, 650, Color("e7e0ce"))
	_label(_to, 22, 900, Color("ffe090"))
	_from.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_to.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	levels.add_child(_from)
	levels.add_child(_to)

	var gradient := Gradient.new()
	gradient.offsets = PackedFloat32Array([0.0, 0.35, 0.52, 0.67, 1.0])
	gradient.colors = PackedColorArray([
		Color(1.0, 0.87, 0.54, 0.0), Color(1.0, 0.87, 0.54, 0.0),
		Color(1.0, 0.87, 0.54, 0.23), Color(1.0, 0.87, 0.54, 0.0),
		Color(1.0, 0.87, 0.54, 0.0),
	])
	var shine_texture := GradientTexture2D.new()
	shine_texture.gradient = gradient
	shine_texture.width = 128
	shine_texture.height = 64
	shine_texture.fill_from = Vector2(0.0, 0.25)
	shine_texture.fill_to = Vector2(1.0, 0.8)
	_shine.mouse_filter = MOUSE_FILTER_IGNORE
	_shine.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_shine.texture = shine_texture
	_shine.size = CARD_SIZE
	_card.add_child(_shine)

	if is_instance_valid(cache):
		cache.asset_ready.connect(_asset_ready)
	if is_instance_valid(mission_notice):
		mission_notice.visibility_changed.connect(_layout)
		mission_notice.resized.connect(_layout)
	resized.connect(_layout)
	clear()

func enqueue_json(value: String) -> void:
	var packet: Variant = JSON.parse_string(value)
	if not packet is Array:
		return
	var first := true
	for entry in packet:
		if not entry is Dictionary:
			continue
		var name_text := str(entry.get("name", "")).strip_edges()
		var before: Variant = entry.get("fromLevel")
		var after: Variant = entry.get("toLevel")
		if name_text.is_empty() or not _level_value(before) or not _level_value(after) or int(after) <= int(before):
			continue
		var path := str(entry.get("portrait", "")).strip_edges().get_slice("?", 0).get_slice("#", 0)
		if not path.begins_with("images/") or ":" in path or "\\" in path or ".." in path.split("/"):
			path = ""
		_queue.append({
			"name": name_text, "portrait": path,
			"from": int(before), "to": int(after),
			"cue": first and entry.get("playCue") == true,
		})
		first = false
	if not visible and not _queue.is_empty():
		_start_next()

func clear() -> void:
	_queue.clear()
	_reset_notice()

func _reset_notice() -> void:
	_active_portrait = ""
	_portrait.texture = null
	_fallback.show()
	_name.text = ""
	_from.text = ""
	_to.text = ""
	_started = 0
	_shine.hide()
	hide()
	set_process(false)

func _start_next() -> void:
	var notice: Dictionary = _queue.pop_front()
	_portrait.texture = null
	_fallback.show()
	_name.text = notice.name
	_from.text = "Lv. %d  →" % notice.from
	_to.text = "Lv. %d" % notice.to
	_active_portrait = notice.portrait
	_started = Time.get_ticks_msec()
	show()
	if not _active_portrait.is_empty() and is_instance_valid(cache):
		var texture: Texture2D = cache.request(_active_portrait)
		if texture != null:
			_asset_ready(_active_portrait, texture)
	_layout()
	set_process(true)
	if notice.cue:
		cue_requested.emit()

func _asset_ready(path: String, texture: Texture2D) -> void:
	if not visible or _active_portrait.is_empty() or path != _active_portrait or texture == null:
		return
	_portrait.texture = texture
	_fallback.hide()

func _process(_delta: float) -> void:
	var elapsed := Time.get_ticks_msec() - _started
	if elapsed >= NOTICE_MSEC:
		if _queue.is_empty():
			_reset_notice()
		else:
			_start_next()
		return
	_animate(float(elapsed))

func _layout() -> void:
	_top = 12.0
	if is_instance_valid(mission_notice) and mission_notice.is_visible_in_tree():
		var bottom := get_global_transform().affine_inverse() * mission_notice.get_global_rect().end
		_top = maxf(_top, bottom.y + 10.0)
	_fit = clampf(minf((size.x - 24.0) / CARD_SIZE.x, (size.y - _top - 12.0) / CARD_SIZE.y), 0.01, 1.0)
	_card.scale = Vector2.ONE * _fit
	if visible:
		_animate(float(Time.get_ticks_msec() - _started))

func _animate(elapsed: float) -> void:
	var arrival := 1.0 - pow(1.0 - clampf(elapsed / 250.0, 0.0, 1.0), 3.0)
	_card.position = Vector2((size.x - CARD_SIZE.x * _fit) * 0.5, _top - 6.0 * (1.0 - arrival) * _fit)
	_card.modulate.a = lerpf(0.3, 1.0, arrival)
	var shine_position := clampf(elapsed / 740.0, 0.0, 1.0)
	_shine.visible = shine_position < 1.0
	_shine.position.x = lerpf(-CARD_SIZE.x, CARD_SIZE.x, shine_position)

func _label(label: Label, font_size: int, weight: float, tint: Color) -> void:
	label.mouse_filter = MOUSE_FILTER_IGNORE
	label.add_theme_font_override("font", Fonts.weighted(weight))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", tint)

func _frame(fill: Color, border: Color, radius: int, shadow := 0) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	if shadow > 0:
		style.shadow_color = Color(0.0, 0.0, 0.0, 0.55)
		style.shadow_size = shadow
		style.shadow_offset = Vector2(0, 5)
	return style

func _level_value(value: Variant) -> bool:
	return (value is int or value is float) and float(value) >= 1.0 and float(value) <= 2147483647.0 and floorf(float(value)) == float(value)
