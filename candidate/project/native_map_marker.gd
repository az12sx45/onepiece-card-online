extends Control
var model: Dictionary={}
var label:=Label.new()
var started:=0.0
var color:=Color.WHITE
var pulse:=0.0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=42;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(900));label.add_theme_font_size_override("font_size",12);label.add_theme_color_override("font_color",Color.WHITE);add_child(label);started=Time.get_ticks_msec()/1000.0;set_process(false)
func present(value: Dictionary) -> void:
	if value==model:return
	model=value;color=Color(["ff5b5b","3b82f6","10b981","f59e0b"][int(model.colorIndex)]);label.text=str(model.playerName).left(1)+"・"+str(model.label);tooltip_text=str(model.playerName)+" 標記："+str(model.label)+("｜"+str(model.note) if model.note else "")
	var font: Font=label.get_theme_font("font");size=Vector2(minf(136,font.get_string_size(label.text,HORIZONTAL_ALIGNMENT_LEFT,-1,12).x+18),49);position=Vector2(model.x,model.y)-size*Vector2(.5,1.05);label.position=Vector2(8,30);label.size=Vector2(size.x-16,16);queue_redraw();set_process(true)
func _process(_delta: float) -> void:
	if not is_visible_in_tree():return
	pulse=preload("res://native_evolution_motion.gd")._ease(fmod(Time.get_ticks_msec()/1000.0-started,1.55)/1.55,[0,0,.58,1]);queue_redraw()
func _draw() -> void:
	if model.is_empty():return
	var pill:=StyleBoxFlat.new();pill.bg_color=Color(.055,.122,.176,.82);pill.border_color=Color(1,1,1,.72);pill.set_border_width_all(1);pill.set_corner_radius_all(10);draw_style_box(pill,Rect2(0,27,size.x,22))
	var pin:=StyleBoxFlat.new();pin.bg_color=color.lerp(Color.WHITE,.18);pin.border_color=Color(1,1,1,.92);pin.set_border_width_all(2);pin.set_corner_radius_all(12);pin.corner_radius_bottom_left=0;draw_set_transform(Vector2(size.x*.5,12),-PI/4);draw_style_box(pin,Rect2(-12,-12,24,24));draw_circle(Vector2(-3.6,-4.8),3.6,Color(1,1,1,.95));draw_set_transform(Vector2.ZERO)
	var radius:=16.0*lerpf(.5,1.35,pulse);var ring: Color=color.lerp(Color.WHITE,.32);ring.a=.82*(1-pulse);draw_arc(Vector2(size.x*.5,size.y-8),radius,0,TAU,48,ring,2,true)
