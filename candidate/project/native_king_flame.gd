extends Control
## Persistent presentation of the original King's flame state and hit guard.
const Motion=preload("res://native_king_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
const SOUNDS=["audio/board_game/sfx/magic01/magic01/fire4.mp3","audio/board_game/sfx/attack01/attack01/kungfu_wind2.mp3","audio/board_game/sfx/magic01/magic01/fire1.mp3"]
var view: Control
var audio: Node
var active:=false
var lit:=true
var knocked_out:=false
var begun:=0
var transition_at:=-1
var guard_at:=-1
var frozen_ms:=-1
var copy:=BackBufferCopy.new()
var aura:=ColorRect.new()
var plate:=Panel.new()
var plate_title:=Label.new()
var plate_detail:=Label.new()
var dot:=ColorRect.new()
var transition: Control
var guard: Control
var surfaces: Dictionary={}
var prior_extent:=Vector2.ZERO
var transitions:=0
var guards:=0
var sound_requests: Array=[]
var sound_epoch:=0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=5
	copy.copy_mode=BackBufferCopy.COPY_MODE_RECT;add_child(copy)
	aura.mouse_filter=Control.MOUSE_FILTER_IGNORE;aura.material=ShaderMaterial.new();aura.material.shader=preload("res://native_king_aura.gdshader");add_child(aura)
	plate.mouse_filter=Control.MOUSE_FILTER_IGNORE;plate.z_index=11;add_child(plate)
	for label in [plate_title,plate_detail]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_override("font",Fonts.weighted(900));plate.add_child(label)
	plate_title.add_theme_color_override("font_color",Color("ffe6a6"));plate_detail.add_theme_color_override("font_color",Color(0.945,.96,.96,.86));dot.mouse_filter=Control.MOUSE_FILTER_IGNORE;plate.add_child(dot)
	for key in ["transition","guard"]:
		var surface:=SubViewport.new();surface.disable_3d=true;surface.transparent_bg=true;surface.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(surface)
		var content:=Control.new();surface.add_child(content)
		var frame:=ColorRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.material=ShaderMaterial.new();frame.material.shader=preload("res://native_king_guard.gdshader");content.add_child(frame);frame.visible=key=="guard"
		var heading:=Label.new();var detail:=Label.new()
		for label in [heading,detail]:label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",Fonts.weighted(900));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",2);content.add_child(label)
		var display:=Filtered.new();display.z_index=14 if key=="transition" else 13;add_child(display);display.hide()
		surfaces[key]={"surface":surface,"content":content,"frame":frame,"heading":heading,"detail":detail,"display":display}
	transition=surfaces.transition.display;guard=surfaces.guard.display
	view.sheets.visibility_changed.connect(_sync_surface_visibility)
	hide();set_process(false)
func _sync_surface_visibility() -> void:
	# Full-screen party/item sheets cover the battlefield, including its effects.
	# Keep animation time/state intact so closing a sheet never restarts fire.
	visible=active and not knocked_out and not view.sheets.visible
func _now() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()
func sync(model: Dictionary) -> void:
	var mechanism: Dictionary=model.get("battle",{}).get("postgameBossMechanic",{}) if model.get("battle",{}).get("postgameBossMechanic") is Dictionary else {}
	var enabled: bool=mechanism.get("active",false) and mechanism.get("key","")=="postgame_king"
	if not enabled:stop();return
	var next_lit: bool=mechanism.get("state",{}).get("flameOn",true)!=false
	knocked_out=float(model.get("enemy",{}).get("currentHp",1))<=0
	if not active:
		active=true;lit=next_lit;begun=_now();_state_art()
		for path in SOUNDS:audio.warm(path)
	elif next_lit!=lit:
		lit=next_lit;begun=_now();transition_at=_now();transitions+=1;_state_art();_sound(SOUNDS[0 if lit else 1])
	_sync_surface_visibility();set_process(not knocked_out);_tick()
func _sound(path: String) -> void:
	sound_requests.append({"time":_now(),"path":path});var token:=sound_epoch;audio.warm(path);var deadline:=Time.get_ticks_msec()+3000
	while audio.pending.has(path) and Time.get_ticks_msec()<deadline:
		await get_tree().process_frame
		if token!=sound_epoch:return
	if token==sound_epoch and active:audio.play_effect(path,.12)
func hit(play_sound:=true) -> void:
	if not active or knocked_out:return
	guard_at=_now();guards+=1
	if play_sound:_sound(SOUNDS[2])
	_tick()
func stop() -> void:
	if not active:return
	sound_epoch+=1;active=false;transition_at=-1;guard_at=-1;hide();set_process(false);transition.hide();guard.hide();transition.stop();guard.stop()
	view.portraits.enemy.material.set_shader_parameter("king_flame_off",false)
func _state_art() -> void:
	plate_title.text="背火點燃" if lit else "背火熄滅";plate_detail.text="火焰防護" if lit else "輸出窗口"
	surfaces.transition.heading.text="背火燃起" if lit else "背火熄滅";surfaces.transition.detail.text="火焰防護展開" if lit else "高速型態・輸出窗口"
	surfaces.transition.heading.add_theme_color_override("font_color",Color("ffad35" if lit else "8ce7ff"));surfaces.transition.detail.add_theme_color_override("font_color",Color("fff4dc"));surfaces.guard.heading.text="火焰防護";surfaces.guard.detail.text=""
	aura.material.set_shader_parameter("lit",lit);view.portraits.enemy.material.set_shader_parameter("king_flame_off",not lit)
	var style:=StyleBoxFlat.new();style.bg_color=Color("451304" if lit else "06283b");style.border_color=Color("ffb443" if lit else "71dbfb");style.set_border_width_all(1);style.set_corner_radius_all(99);plate.add_theme_stylebox_override("panel",style)
	dot.color=Color("ffb52f" if lit else "8ee8ff");prior_extent=Vector2.ZERO
func _layout() -> void:
	if prior_extent.is_equal_approx(size):return
	prior_extent=size;aura.size=size;copy.rect=Rect2(Vector2.ZERO,size);aura.material.set_shader_parameter("extent",size)
	var strong_size:=clampf(view.size.x*.0082,8,12);var detail_size:=clampf(view.size.x*.0058,6,9);var padding:=clampf(view.size.x*.0045,4,7)
	plate.size=Vector2(minf(size.x*.88,248),strong_size+padding*2+2);plate.position=Vector2((size.x-plate.size.x)*.5,size.y*.955-plate.size.y)
	plate_title.add_theme_font_size_override("font_size",int(strong_size));plate_detail.add_theme_font_size_override("font_size",int(detail_size));plate_title.position=Vector2(16,padding);plate_title.size=Vector2(plate.size.x*.45,strong_size+2);plate_detail.position=Vector2(plate.size.x*.52,padding+1);plate_detail.size=Vector2(plate.size.x*.44,strong_size+2);dot.size=Vector2.ONE*clampf(view.size.x*.0058,6,9);dot.position=Vector2(7,(plate.size.y-dot.size.y)*.5);dot.pivot_offset=dot.size*.5;dot.rotation_degrees=45
	for key in surfaces:
		var item: Dictionary=surfaces[key];var box:=Vector2(size.x*.92,clampf(view.size.x*.02,17,31)*1.05+clampf(view.size.x*.0082,8,12)+7) if key=="transition" else size*.9
		item.surface.size=Vector2i(box.ceil());item.content.size=box;item.frame.size=box;item.frame.material.set_shader_parameter("extent",box)
		item.heading.add_theme_font_size_override("font_size",int(clampf(view.size.x*.02,17,31) if key=="transition" else clampf(view.size.x*.009,8,13)));item.detail.add_theme_font_size_override("font_size",int(clampf(view.size.x*.0082,8,12)))
		item.heading.position=Vector2(0,0 if key=="transition" else box.y*.46-10);item.heading.size=Vector2(box.x,box.y*.65 if key=="transition" else 20);item.detail.position=Vector2(0,box.y*.68);item.detail.size=Vector2(box.x,box.y*.32)
		item.surface.render_target_update_mode=SubViewport.UPDATE_ONCE;item.display.configure(item.surface.get_texture(),box);item.display.passes[0].effect.set_shader_parameter("source_premultiplied",true);item.display.filter_signature="";item.display.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
		item.display.bind_live_source(item.surface)
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if not active or knocked_out:return
	position=view.portraits.enemy.position;size=view.portraits.enemy.size;_layout()
	var seconds:=float(_now()-begun)/1000
	var fire:=Motion.sample("kingFlameAuraFlicker",seconds,size*Vector2(1.16,1.34));aura.material.set_shader_parameter("fire_offset",fire.transform.origin);aura.material.set_shader_parameter("fire_scale",fire.transform.get_scale());aura.material.set_shader_parameter("fire_opacity",fire.opacity)
	aura.material.set_shader_parameter("ember_positions",PackedVector2Array(Motion.sample("kingFlameEmbersRise",seconds,size).positions));aura.material.set_shader_parameter("ash_positions",PackedVector2Array(Motion.sample("kingAshDrift",seconds,size).positions));aura.material.set_shader_parameter("speed_offset",Motion.sample("kingSpeedLinesSweep",seconds,size*Vector2(2.2,1.56)).transform.origin.x)
	var ember:=Motion.sample("kingStateDotBurn",seconds,dot.size);dot.modulate.a=ember.opacity if lit else 1.0;dot.scale=ember.transform.get_scale() if lit else Vector2.ONE*.72
	for key in surfaces:
		var at:=transition_at if key=="transition" else guard_at;var item: Dictionary=surfaces[key];var playing:=at>=0 and _now()-at<(1320 if key=="transition" else 760)
		if playing and not item.display.visible:item.display.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;item.display.filter_signature=""
		item.display.visible=playing
		if not playing:item.display.stop();continue
		var name: String=("kingFlameTransitionIgnite" if lit else "kingFlameTransitionExtinguish") if key=="transition" else "kingFlameGuardPulse";var value:=Motion.sample(name,float(_now()-at)/1000,item.display.box,false)
		item.display.apply_motion(value,Vector2(size.x*.5,size.y*.48) if key=="transition" else size*.05);item.display.apply_filters(value.filters)
func test_guard_pixel_count() -> int:
	var texture: Texture2D=guard.display.texture
	if texture==null:return 0
	var pixels:=texture.get_image();var count:=0
	for y in range(0,pixels.get_height(),4):
		for x in range(0,pixels.get_width(),4):
			if pixels.get_pixel(x,y).a>.02:count+=1
	return count
func test_state_json() -> String:
	return JSON.stringify({"active":active,"lit":lit,"visible":visible,"title":plate_title.text,"detail":plate_detail.text,"transitions":transitions,"guards":guards,"sounds":sound_requests,"transitionVisible":transition.visible,"guardVisible":guard.visible,"auraId":aura.get_instance_id(),"transitionId":transition.get_instance_id(),"guardId":guard.get_instance_id()})
