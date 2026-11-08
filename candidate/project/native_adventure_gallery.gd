extends Control
## One artwork is requested after selection. Locked art never reaches the cache.
signal sync_requested

const Fonts=preload("res://native_fonts.gd")
var cache: Node
var model: Dictionary={}
var groups: Dictionary={}
var selected_path:=""
var margin:=MarginContainer.new()
var body:=VBoxContainer.new()
var header:=HBoxContainer.new()
var title:=Label.new()
var close:=Button.new()
var filters:=HBoxContainer.new()
var category:=OptionButton.new()
var unlocked_only:=CheckBox.new()
var sync_button:=Button.new()
var progress:=Label.new()
var sync_state:=Label.new()
var columns:=BoxContainer.new()
var scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var detail:=VBoxContainer.new()
var caption:=Label.new()
var art:=TextureRect.new()
var status:=Label.new()

func _ready() -> void:
	var style:=Theme.new()
	style.default_font=Fonts.weighted(550)
	style.default_font_size=16
	theme=style
	mouse_filter=MOUSE_FILTER_STOP
	clip_contents=true
	add_child(margin)
	margin.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	for side in ["left","right"]:margin.add_theme_constant_override("margin_"+side,14)
	margin.add_child(body)
	body.add_child(header)
	header.add_child(title)
	title.text="冒險插畫圖鑑"
	title.add_theme_font_override("font",Fonts.weighted(800))
	title.add_theme_font_size_override("font_size",24)
	title.add_theme_color_override("font_color",Color("ffe4a9"))
	title.size_flags_horizontal=SIZE_EXPAND_FILL
	header.add_child(close)
	close.text="關閉"
	close.custom_minimum_size=Vector2(76,44)
	close.pressed.connect(close_surface)

	body.add_child(filters)
	filters.add_theme_constant_override("separation",10)
	filters.add_child(category)
	category.custom_minimum_size=Vector2(113,42)
	category.item_selected.connect(func(_index):_refresh_list())
	filters.add_child(unlocked_only)
	unlocked_only.text="只看已解鎖"
	unlocked_only.toggled.connect(func(_value):_refresh_list())
	filters.add_child(sync_button)
	sync_button.text="同步"
	sync_button.custom_minimum_size=Vector2(64,42)
	sync_button.pressed.connect(func():sync_requested.emit())

	body.add_child(columns)
	columns.add_theme_constant_override("separation",12)
	columns.size_flags_vertical=SIZE_EXPAND_FILL
	columns.add_child(scroll)
	scroll.size_flags_horizontal=SIZE_EXPAND_FILL
	scroll.size_flags_vertical=SIZE_EXPAND_FILL
	scroll.size_flags_stretch_ratio=0.75
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	scroll.follow_focus=true
	scroll.add_child(list)
	list.size_flags_horizontal=SIZE_EXPAND_FILL
	columns.add_child(detail)
	detail.size_flags_horizontal=SIZE_EXPAND_FILL
	detail.size_flags_vertical=SIZE_EXPAND_FILL
	detail.add_child(caption)
	caption.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	caption.add_theme_color_override("font_color",Color("ffe4a9"))
	detail.add_child(art)
	art.mouse_filter=MOUSE_FILTER_IGNORE
	art.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.size_flags_vertical=SIZE_EXPAND_FILL
	detail.add_child(status)
	status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	status.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	status.add_theme_font_size_override("font_size",14)
	status.add_theme_color_override("font_color",Color("b7c9d7"))
	var footer:=HBoxContainer.new()
	body.add_child(footer)
	footer.add_child(progress)
	progress.size_flags_horizontal=SIZE_EXPAND_FILL
	footer.add_child(sync_state)
	for label in [progress,sync_state]:
		label.add_theme_font_size_override("font_size",13)
		label.add_theme_color_override("font_color",Color("b7c9d7"))

	cache.asset_ready.connect(_art_ready)
	cache.asset_failed.connect(_art_failed)
	resized.connect(_layout)
	hide()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size),Color("071621"))

func _layout() -> void:
	columns.vertical=size.x<size.y
	var compact:=size.y<330.0
	for side in ["top","bottom"]:margin.add_theme_constant_override("margin_"+side,10 if compact else 14)
	body.add_theme_constant_override("separation",5 if compact else 8)
	queue_redraw()

func apply_json(value: String) -> void:
	model=JSON.parse_string(value)
	groups.clear()
	category.clear()
	category.add_item("全部分類")
	for group in model.groups:
		groups[group.id]=group.label
		category.add_item(group.label)
		category.set_item_metadata(category.item_count-1,group.id)
	category.select(0)
	unlocked_only.set_pressed_no_signal(false)
	_update_progress()
	show()
	_layout()
	_refresh_list()
	close.grab_focus()

func update_json(value: String) -> void:
	if not visible:return
	var next: Dictionary=JSON.parse_string(value)
	var entries_changed: bool=next.entries!=model.entries
	model=next
	_update_progress()
	if entries_changed:_refresh_list(true)

func _update_progress() -> void:
	progress.text="個人收藏  %d / %d" % [model.unlockedCount,model.entries.size()]
	sync_state.text={
		"saved":"已同步至帳號雲端",
		"pending":"已保存在本機，等待同步",
		"storage-error":"本機儲存暫不可用"
	}.get(model.get("syncStatus"),"本機收藏")

func _refresh_list(preserve_selection: bool=false) -> void:
	if not visible:return
	var previous_scroll:=scroll.scroll_vertical
	var selection_visible:=false
	_clear_list()
	var group: Variant=category.get_item_metadata(category.selected)
	var buttons:=ButtonGroup.new()
	for entry in model.entries:
		var unlocked: bool=not entry.image.is_empty()
		if (group!=null and entry.group!=group) or (unlocked_only.button_pressed and not unlocked):continue
		var row:=Button.new()
		row.text="%s  %d/3%s" % [entry.title,entry.variant,"" if unlocked else "  ·  尚未遇見"]
		row.clip_text=true
		row.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
		row.custom_minimum_size.y=42
		row.alignment=HORIZONTAL_ALIGNMENT_LEFT
		row.disabled=not unlocked
		if unlocked:
			row.toggle_mode=true
			row.button_group=buttons
			if preserve_selection and entry.image==selected_path:
				row.set_pressed_no_signal(true)
				selection_visible=true
			row.pressed.connect(_select_entry.bind(entry))
		list.add_child(row)
	scroll.scroll_vertical=previous_scroll if preserve_selection else 0
	if not selection_visible:
		_clear_art("這個分類尚未收藏插畫。" if list.get_child_count()==0 else "選擇已解鎖的插畫查看。")

func _select_entry(entry: Dictionary) -> void:
	if entry.image==selected_path:return
	_clear_art("載入插畫中…")
	caption.text="%s · %s · %d/3" % [groups[entry.group],entry.title,entry.variant]
	selected_path=entry.image
	var texture: Texture2D=cache.request(selected_path)
	if texture!=null:_art_ready(selected_path,texture)
	elif cache.failed.has(selected_path):_art_failed(selected_path,ERR_FILE_NOT_FOUND)

func _art_ready(path: String,texture: Texture2D) -> void:
	if visible and path==selected_path:
		art.texture=texture
		status.hide()

func _art_failed(path: String,_error: int) -> void:
	if visible and path==selected_path:
		status.text="暫時無法載入插畫。"

func _clear_art(message: String) -> void:
	selected_path=""
	art.texture=null
	caption.text=""
	status.text=message
	status.show()

func _clear_list() -> void:
	for row in list.get_children():
		list.remove_child(row)
		row.queue_free()

func close_surface() -> void:
	if not visible:return
	hide()
	_clear_art("")
	model.clear()
	_clear_list()

func _unhandled_key_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		close_surface()
		get_viewport().set_input_as_handled()
