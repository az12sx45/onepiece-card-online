extends Control
## Original recruit machine artwork and authored text; result stays source-owned.
const FRAME="images/board/impel_down_ui/impel_down_prisoner_draw_roulette_panel_frame_v3.webp"
var frame:=TextureRect.new()
var heading:=Label.new()
var status:=Label.new()
var odds:=HBoxContainer.new()
var result:=HBoxContainer.new()
var portrait:=TextureRect.new()
var reel: Control
var data: Dictionary={}
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	reel=preload("res://native_impel_down_reel.gd").new();add_child(reel)
	for picture in [frame,portrait]:
		picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;picture.mouse_filter=Control.MOUSE_FILTER_IGNORE
		picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;add_child(picture)
	for label in [heading,status]:
		label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.clip_text=true;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
		label.add_theme_color_override("font_color",Color("f5e6bd"));label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	add_child(odds);odds.add_theme_constant_override("separation",5);odds.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(result);result.add_theme_constant_override("separation",4);result.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for i in range(3):
		var label:=Label.new();label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.clip_text=true;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
		label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;result.add_child(label)
	resized.connect(_layout);hide()
func apply(value: Variant,key: String,assets: Dictionary) -> void:
	if value==null or value.kind!="recruit":
		data={};reel.reset();hide();return
	data=value;frame.texture=assets.get(FRAME);portrait.texture=assets.get(data.result.image)
	heading.text="　".join(PackedStringArray(data.title));status.text=data.status
	for i in range(3):result.get_child(i).text=data.result.parts[i] if i<data.result.parts.size() else ""
	while odds.get_child_count()<data.odds.size():
		var label:=Label.new();label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.clip_text=true;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;odds.add_child(label)
	for i in range(odds.get_child_count()):
		var label: Label=odds.get_child(i);label.visible=i<data.odds.size()
		if label.visible:label.text=data.odds[i]
	reel.apply(value,key,assets);reel.show();show();_layout()
func _box(node: Control,ratio: Rect2) -> void:
	node.position=size*ratio.position;node.size=size*ratio.size
func _layout() -> void:
	if data.is_empty():return
	for label in [heading,status]:label.add_theme_font_size_override("font_size",clampi(int(size.y*.039),10,16))
	for label in odds.get_children():label.add_theme_font_size_override("font_size",clampi(int(size.y*.036),9,13))
	for label in result.get_children():label.add_theme_font_size_override("font_size",clampi(int(size.y*.036),9,13))
	_box(frame,Rect2(0,0,1,1))
	_box(heading,Rect2(.27,.06,.46,.125));_box(status,Rect2(.29,.216,.42,.055))
	_box(reel,Rect2(.1848,.3411,.6268,.2498))
	_box(odds,Rect2(.1235,.6545,.7455,.114))
	_box(portrait,Rect2(.2473,.8142,.085,.1284));_box(result,Rect2(.345,.8025,.39,.151))
	portrait.visible=data.settled;result.visible=data.settled
	reel.recruit_frame_width=size.x;reel._process(0)
func layout_ok() -> bool:
	if data.is_empty():return false
	for node in [frame,heading,status,reel,odds,portrait,result]:
		if not Rect2(Vector2.ZERO,size).encloses(node.get_rect()):return false
	return frame.texture!=null and reel.clip_contents and reel.visible and not reel.data.is_empty()
