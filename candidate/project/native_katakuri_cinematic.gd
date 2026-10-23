extends "res://native_nika_video.gd"
## Original future-sight video, with a single persistent native media surface.
signal focus_changed(held: bool)
var shade:=ColorRect.new()
var kicker:=Label.new()
var title:=Label.new()
var event_id:=""
var generation:=0
var media_error:=""
var completed_ids: Array[String]=[]
var cancelled_ids: Array[String]=[]
func _ready() -> void:
	super._ready();z_index=510;clip_contents=true;mouse_filter=Control.MOUSE_FILTER_IGNORE
	player.material=ShaderMaterial.new();player.material.shader=preload("res://native_katakuri_video.gdshader")
	shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;shade.material=ShaderMaterial.new();shade.material.shader=preload("res://native_katakuri_shade.gdshader");add_child(shade)
	for label in [kicker,title]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",3);add_child(label)
	var serif:=SystemFont.new();serif.font_names=PackedStringArray(["Noto Serif TC","PMingLiU","serif"]);serif.font_weight=950;serif.fallbacks=[Fonts.base()]
	var title_font:=FontVariation.new();title_font.base_font=serif;title_font.spacing_glyph=5;title.add_theme_font_override("font",title_font)
	var kicker_font:=FontVariation.new();kicker_font.base_font=Fonts.weighted(900);kicker_font.spacing_glyph=5;kicker.add_theme_font_override("font",kicker_font)
	kicker.text="見聞色霸氣";kicker.add_theme_font_size_override("font_size",16);kicker.add_theme_color_override("font_color",Color("ff8ea8"));title.add_theme_font_size_override("font_size",42)
	media_event.connect(func(event):
		if event=="error":media_error="Original Katakuri MP4 could not be decoded"
	)
	resized.connect(_copy_layout);_copy_layout()
func _copy_layout() -> void:
	shade.size=size;shade.material.set_shader_parameter("viewport_size",size)
	var width:=minf(size.x*.88,920);var left:=(size.x-width)*.5
	title.position=Vector2(left,size.y-28-56);title.size=Vector2(width,56)
	kicker.position=Vector2(left,title.position.y-29);kicker.size=Vector2(width,24)
func play_event(event: Dictionary) -> String:
	if str(event.get("id","")).is_empty():return "Original Katakuri event identity required"
	cancel();generation+=1;var token:=generation;event_id=str(event.id);media_error=""
	var caption:=str(event.get("title","預知未來"));if caption.is_empty():caption="預知未來"
	title.text=caption;focus_changed.emit(true)
	start_video(JSON.stringify({"profile":"katakuri","src":event.get("videoUrl","videos/board/postgame_bosses/katakuri/future_sight_red_eyes.mp4"),"title":caption,"startTime":maxf(0,float(event.get("videoStartTime",0))),"volume":.78,"muted":muted_for_test}))
	backdrop.color=Color("020006");shade.visible=OS.get_name() not in ["Android","iOS"];kicker.visible=shade.visible;title.visible=shade.visible
	var duration_ms:=float(event.get("duration",4800));if duration_ms==0:duration_ms=4800
	var deadline:=Time.get_ticks_msec()+int(maxf(600,duration_ms))
	while Time.get_ticks_msec()<deadline and token==generation:
		if not media_error.is_empty():break
		await get_tree().process_frame
	if token!=generation:return ""
	var error:=media_error;if error.is_empty():completed_ids.append(event_id)
	cancel();return error
func cancel() -> void:
	generation+=1
	if event_id.is_empty():return
	if not completed_ids.has(event_id):cancelled_ids.append(event_id)
	event_id="";remove_video();focus_changed.emit(false)
func _exit_tree() -> void:
	cancel();super._exit_tree()
