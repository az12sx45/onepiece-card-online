extends Control
## Original temporary board action notice; below full-screen native pages.
var cache: Node
var frame:=TextureRect.new()
var icon:=TextureRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var epoch:=0
var remote_event_id:=""

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	var font:=preload("res://native_fonts.gd").base()
	for picture in [frame,icon]:
		picture.mouse_filter=Control.MOUSE_FILTER_IGNORE;picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
		picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;add_child(picture)
	for label in [title,subtitle]:
		label.add_theme_font_override("font",font);label.mouse_filter=Control.MOUSE_FILTER_IGNORE
		label.clip_text=true;label.add_theme_color_override("font_color",Color("fff1c7"));add_child(label)
	title.add_theme_font_size_override("font_size",14);subtitle.add_theme_font_size_override("font_size",12)
	resized.connect(_layout);hide()

func apply_json(value: String) -> void:
	var packet: Dictionary=JSON.parse_string(value)
	remote_event_id=str(packet.get("eventId",""));epoch+=1;_load_notice(packet,epoch)

func cancel_remote(target: String="") -> void:
	if not target.is_empty() and target!=remote_event_id:return
	epoch+=1;remote_event_id="";hide()

func _load_notice(value: Dictionary,token: int) -> void:
	var frame_path: String="images/board/battle_command_ui/battle_command_notice_frame.webp"
	var textures: Dictionary={}
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		for path in [frame_path,value.icon]:
			if cache.failed.has(path):push_error("Native notice image failed: "+str(path));return
			if not textures.has(path):
				var texture: Texture2D=cache.request(path)
				if texture!=null:textures[path]=texture
		if textures.size()==2:break
		if Time.get_ticks_msec()>deadline:push_error("Native notice loading timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	frame.texture=textures[frame_path];icon.texture=textures[value.icon]
	title.text=value.title;subtitle.text=value.subtitle;_layout();show()
	await get_tree().create_timer(float(value.duration)/1000.0).timeout
	if token==epoch:hide();remote_event_id=""

func _layout() -> void:
	var width:=minf(620,size.x-32)
	frame.size=Vector2(width,width*232.0/1472.0);frame.position=Vector2((size.x-width)/2.0,86)
	icon.position=frame.position+frame.size*Vector2(0.0435,0.17);icon.size=frame.size*Vector2(0.101,0.66)
	title.position=frame.position+frame.size*Vector2(0.154,0.21);title.size=Vector2(width*0.775,22)
	subtitle.position=title.position+Vector2(0,25);subtitle.size=Vector2(width*0.775,22)
