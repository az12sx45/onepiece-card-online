extends Control
## Original phase-two quote. Skip hides presentation, not the rule-side wait.
signal skipped
const Ease=preload("res://native_evolution_motion.gd")
const Motion=preload("res://native_kyubi_motion.gd")
var view: Control
var shade:=ColorRect.new()
var quote:=Control.new()
var frame:=NinePatchRect.new()
var speaker: Label
var line:=RichTextLabel.new()
var skip:=Button.new()
var cutin:=ColorRect.new()
var title: Label
var epoch:=0
var started:=0
var duration:=3000.0
var active:=false
var quote_skipped:=false
var starts:=0
var event_id:=""
var frozen_ms:=-1.0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=300
	shade.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var shade_material:=ShaderMaterial.new();shade_material.shader=preload("res://native_phase_dialogue.gdshader");shade.material=shade_material;add_child(shade)
	quote.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(quote)
	frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.2
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,100)
	quote.add_child(frame);view._image(frame,"images/board/battle_hud_dialogue_ui/battle_dialogue_enemy_frame.webp")
	speaker=view._label(quote,14);speaker.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;speaker.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;speaker.add_theme_color_override("font_color",Color("fff3c0"))
	line.mouse_filter=Control.MOUSE_FILTER_PASS;line.add_theme_color_override("default_color",Color("fff8df"));quote.add_child(line)
	skip.text="跳過";skip.add_theme_color_override("font_color",Color("fff4c8"));skip.add_theme_font_size_override("font_size",14)
	var style:=StyleBoxFlat.new();style.bg_color=Color(7.0/255,16.0/255,31.0/255,.76);style.border_color=Color(1,232.0/255,188.0/255,.82);style.set_border_width_all(1);style.set_corner_radius_all(19);skip.add_theme_stylebox_override("normal",style)
	skip.pressed.connect(_skip);add_child(skip)
	cutin.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var material:=ShaderMaterial.new();material.shader=preload("res://native_kyubi_art.gdshader");material.set_shader_parameter("kind",2);cutin.material=material;add_child(cutin)
	title=view._label(cutin,18);title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;title.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;title.add_theme_color_override("font_color",Color("512615"))
	view.resized.connect(_layout);_layout();hide();set_process(false)

func _layout() -> void:
	size=view.size;shade.size=size;shade.material.set_shader_parameter("extent",size)
	quote.size=Vector2(size.x*.966,size.y*.258);quote.position=Vector2(size.x*.017,size.y*.72)
	frame.size=quote.size/.2
	var compact:=size.y<=432
	speaker.position=Vector2(quote.size.x*.06,2);speaker.size=Vector2(quote.size.x*.24,22 if compact else 34);speaker.add_theme_font_size_override("font_size",14 if compact else 22)
	line.position=Vector2(24,28 if compact else 44);line.size=quote.size-line.position-Vector2(24,8);line.add_theme_font_size_override("normal_font_size",19 if compact else 30)
	skip.position=Vector2(size.x-92,16);skip.size=Vector2(76,38)
	var scale_unit:=maxf(.4,view.portraits.player.size.x/330.0)
	cutin.size=Vector2(size.x*.52,65*scale_unit);cutin.material.set_shader_parameter("extent",cutin.size);title.size=cutin.size;title.add_theme_font_size_override("font_size",maxi(16,int(25.2*scale_unit)))

func play_event(event: Dictionary) -> String:
	cancel();epoch+=1;var token:=epoch
	var requested:=float(event.get("duration",3000));duration=maxf(1800,3000 if requested==0 else requested)
	event_id=str(event.get("id",""));speaker.text=str(event.get("speaker",""));line.text=str(event.get("line",""));title.text=str(event.get("title",""))
	if speaker.text.is_empty():speaker.text=str(view.model.get("enemy",{}).get("name","敵人"))
	if speaker.text.is_empty():speaker.text="敵人"
	if line.text.is_empty():line.text="接下來才是真正的戰鬥。"
	if title.text.is_empty():title.text="第二階段"
	line.scroll_to_line(0);quote_skipped=false;starts+=1;active=true;view.set_phase_dialogue_active(true);started=Time.get_ticks_msec();_layout();show();set_process(true);_tick()
	while active and token==epoch:await get_tree().process_frame
	return ""

func _skip() -> void:
	if not active or quote_skipped:return
	quote_skipped=true;shade.hide();quote.hide();skip.hide();view.set_phase_dialogue_active(false);skipped.emit()

func cancel() -> void:
	epoch+=1;active=false;event_id="";hide();set_process(false);modulate.a=1.0;view.set_phase_dialogue_active(false)

func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if not active:return
	var ms:=frozen_ms if frozen_ms>=0 else float(Time.get_ticks_msec()-started)
	if ms>=duration:cancel();return
	var fade:=Ease._ease(clampf(ms/160,0,1),[.25,.1,.25,1.0])
	if ms>=maxf(900,duration-360):fade=1-Ease._ease(clampf((ms-maxf(900,duration-360))/320,0,1),[.25,.1,.25,1.0])
	shade.visible=not quote_skipped;quote.visible=not quote_skipped;skip.visible=not quote_skipped
	shade.modulate.a=fade;skip.modulate.a=fade
	var box:=Ease._ease(clampf(ms/220,0,1),[.18,.92,.22,1.0])
	quote.modulate.a=fade*box;quote.position.y=size.y*.72+20*(1-box)
	cutin.visible=ms<1100
	if cutin.visible:
		var sample:=Motion.sample("cutin",ms/1000,cutin.size,size)
		cutin.modulate.a=sample.opacity;cutin.position=Vector2(size.x*.5,size.y*.18)+sample.transform.origin;cutin.scale=Vector2(sample.transform.x.x,sample.transform.y.y)

func test_state_json() -> String:
	return JSON.stringify({"id":event_id,"active":active,"quoteVisible":quote.visible and visible,"skipped":quote_skipped,"starts":starts,"speaker":speaker.text,"line":line.text,"frameReady":frame.texture!=null,"quoteInside":Rect2(Vector2.ZERO,size).encloses(Rect2(quote.position,quote.size)),"skipInside":Rect2(Vector2.ZERO,size).encloses(skip.get_rect()),"textFits":line.get_content_height()<=line.size.y,"nodeId":get_instance_id(),"frameId":frame.get_instance_id()})
