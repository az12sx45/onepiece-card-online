extends Control
## Source opening keyframes, native cached text and original role illustrations.
const Motion=preload("res://native_opening_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var flash:=ColorRect.new()
var text_view:=SubViewport.new()
var text_label:=Label.new()
var title_image: Control
var role_image: Control
var sky_image: Control
var sky_last_time:=-1.0
var sky_serial:=-1
var source_foreground: TextureRect
var model: Dictionary={}
var began:=0
var serial:=-1
var role_began:=0
var role_path:=""
var title_size:=Vector2.ZERO
var title_signature:=""
var last_title_time:=-1.0
var frozen_time:=-1.0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	sky_image=Filtered.new();sky_image.z_index=1;add_child(sky_image)
	role_image=Filtered.new();role_image.z_index=3;add_child(role_image)
	text_view.disable_3d=true;text_view.transparent_bg=true;text_view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(text_view)
	text_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;text_label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;text_label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(900));text_label.add_theme_color_override("font_color",Color("fff1bb"));text_label.add_theme_color_override("font_shadow_color",Color(0,0,0,.8));text_label.add_theme_constant_override("shadow_offset_y",5);text_label.add_theme_constant_override("shadow_outline_size",3);text_view.add_child(text_label)
	title_image=Filtered.new();title_image.z_index=9;add_child(title_image)
	flash.color=Color("fff9e8");flash.mouse_filter=Control.MOUSE_FILTER_IGNORE;flash.z_index=10;add_child(flash);hide()

func configure(value: Dictionary,foreground: TextureRect,background: TextureRect) -> void:
	model=value;source_foreground=foreground
	if not model.get("opening",false):hide();title_image.stop();role_image.stop();sky_image.stop();return
	show();flash.size=size
	if background.texture!=null:
		sky_image.configure(background.texture,size);sky_image.passes[0].effect.set_shader_parameter("source_cover",true)
		if sky_serial!=int(model.sceneSerial):sky_serial=int(model.sceneSerial);sky_last_time=-1
	if serial!=int(model.effectSerial):serial=int(model.effectSerial);began=Time.get_ticks_msec();last_title_time=-1
	var next_size:=Vector2(roundf(size.x*.88),roundf(clampf(size.x*.066,34,92)*1.5))
	var signature:=str(model.titleCard)+str(next_size)
	if title_signature!=signature:
		title_signature=signature;title_size=next_size;text_view.size=Vector2i(title_size);text_label.size=title_size;text_label.text=model.titleCard;text_label.add_theme_font_size_override("font_size",int(clampf(size.x*.066,34,92)));text_view.render_target_update_mode=SubViewport.UPDATE_ONCE
		title_image.configure(text_view.get_texture(),title_size);title_image.passes[0].effect.set_shader_parameter("source_premultiplied",true);title_image.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;last_title_time=-1
		title_image.bind_live_source(text_view)
	var role: bool=str(model.sceneClass).contains("scene-opening-role-") and foreground.texture!=null
	role_image.visible=role
	if role:
		foreground.hide();role_image.configure(foreground.texture,foreground.size);role_image.apply_filters([{"kind":"drop-shadow","x":0,"y":26,"blur":38,"color":[0,0,0,.6]},{"kind":"drop-shadow","x":0,"y":0,"blur":24,"color":[1,213.0/255,116.0/255,.2]}])
		if role_path!=str(model.foreground):role_path=model.foreground;role_began=Time.get_ticks_msec()
	else:role_image.stop()
	_tick()

func _tick() -> void:
	if not is_visible_in_tree():return
	var sky_time:=clampf(float(Time.get_ticks_msec()-int(model.sceneStarted))/1000.0,0,.52)
	sky_image.visible=int(model.sceneSerial)>0 and sky_time<.52
	if sky_image.visible and sky_time!=sky_last_time:
		sky_last_time=sky_time;var sky_motion:=Motion.sample("finalEndingSceneSoftCut",sky_time,size);sky_image.apply_motion(sky_motion,Vector2.ZERO);sky_image.apply_filters(sky_motion.filters)
	elif not sky_image.visible:sky_image.stop()
	var elapsed:=frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-began)/1000.0
	flash.modulate.a=Motion.sample("openingStoryExecutionFlash",elapsed,size).opacity if model.openingEffect=="execution-flash" else 0.0
	title_image.visible=model.titleVisible and not str(model.titleCard).is_empty()
	if title_image.visible:
		var time:=clampf(elapsed-.28,0,2.6)
		if time!=last_title_time:
			last_title_time=time;var motion:=Motion.sample("openingStoryTitleIn",time,title_size);title_image.apply_motion(motion,Vector2(size.x*.5,size.y*.34));title_image.apply_filters(motion.filters)
	if role_image.visible:role_image.apply_motion(Motion.sample("openingStoryRoleFloat",frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-role_began)/1000.0,source_foreground.size,true),source_foreground.position)

func _process(_delta: float) -> void:_tick()
