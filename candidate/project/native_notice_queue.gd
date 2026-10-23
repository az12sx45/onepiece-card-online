extends Control
## Original mission-complete notification content and ordered 5200 ms display.
signal entry_finished
var cache: Node
var queue: Array[Dictionary] = []
var next_ticket := 0
var finished_ticket := 0
var running := false
var heading: Label
var detail: Label
var frame := NinePatchRect.new()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.scale = Vector2.ONE*0.25
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]: frame.set_patch_margin(side,80)
	add_child(frame)
	var path := "images/board/battle_command_ui/battle_command_notice_frame.webp"
	frame.texture = cache.request(path)
	cache.asset_ready.connect(func(asset,texture):
		if asset == path: frame.texture=texture
	)
	var kicker := _label(12,Vector2(20,7),Vector2(480,20))
	kicker.text = "任務完成"
	heading = _label(18,Vector2(20,27),Vector2(480,28))
	detail = _label(12,Vector2(20,58),Vector2(480,22))
	detail.text = "點自己的船 → 任務，領取已完成的獎勵。"
	hide()

func _label(font_size: int, at: Vector2, bounds: Vector2) -> Label:
	var label := Label.new()
	label.position = at
	label.size = bounds
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size",font_size)
	label.add_theme_color_override("font_color",Color("fff7cf"))
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)
	return label

func play(event: Dictionary) -> void:
	next_ticket += 1
	var ticket := next_ticket
	queue.append({"ticket":ticket,"event":event})
	if not running: _drain()
	while finished_ticket < ticket: await entry_finished

func _drain() -> void:
	running = true
	while not queue.is_empty():
		var entry: Dictionary = queue.pop_front()
		var event: Dictionary = entry.event
		var width := minf(520,get_parent_control().size.x-32)
		position = Vector2((get_parent_control().size.x-width)/2,18)
		size = Vector2(width,88)
		frame.size = size/0.25
		for label in get_children():
			if label is Label: label.size.x=width-40
		heading.text = ("主線" if event.get("isMain",false) else "委託")+"完成："+str(event.get("mission",{}).get("title","未知任務"))
		show()
		await get_tree().create_timer(float(event.get("duration",5200))/1000).timeout
		hide()
		finished_ticket = entry.ticket
		entry_finished.emit()
	running = false
