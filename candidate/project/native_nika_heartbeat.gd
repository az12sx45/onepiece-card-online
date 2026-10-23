extends Control
## Owns presentation only; the original rule/controller owns awakening state.
const Motion=preload("res://native_nika_motion.gd")
const Portrait=preload("res://native_portrait_card.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const RingShader=preload("res://native_nika_ring.gdshader")
const MARGIN:=160.0
var view: Control
var capture:=SubViewport.new()
var portrait: TextureRect
var filtered: Control
var rings: Array[ColorRect]=[]
var active:=false
var started:=-1
var pulses:=0
var frozen_time:=-1.0
var card_size:=Vector2.ZERO
var source_texture: Texture2D
var extent:=Vector2.ONE
var source_hidden:=false
var painted_time:=-2.0
var painted_position:=Vector2.INF
var frame_times: Array[float]=[]
var frame_clock:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;hide()
	capture.disable_3d=true;capture.transparent_bg=true;capture.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(capture)
	for i in range(2):_ring()
	portrait=Portrait.new();capture.add_child(portrait)
	_ring()
	filtered=Filtered.new();add_child(filtered)

func _ring() -> void:
	var quad:=ColorRect.new();quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;var material_value:=ShaderMaterial.new();material_value.shader=RingShader;quad.material=material_value;capture.add_child(quad);rings.append(quad)

func sync(model: Dictionary) -> void:
	var battle: Dictionary=model.get("battle",{})
	var pending: bool=battle.get("luffyGearFifthAwakeningPending",false) or battle.get("keepPlayerPortraitOnKnockout",false)
	if pending:
		if not active:active=true;show();view.set_pose("player","dizzy")
		_refresh()
	elif active:
		active=false;started=-1;hide();capture.render_target_update_mode=SubViewport.UPDATE_DISABLED;filtered.stop()
		view.portraits.player.show();view.portraits.player.modulate.a=1.0;source_hidden=false;view.set_pose("player","")

func pulse() -> void:
	if not active:sync(view.model)
	assert(active,"Nika heartbeat without original awakening state")
	started=Time.get_ticks_msec();frame_clock=Time.get_ticks_usec();painted_time=-2.0;pulses+=1;_refresh()

func _refresh() -> void:
	if not active:return
	var source: TextureRect=view.portraits.player
	if source.texture==null:return
	var changed:=card_size!=source.size or source_texture!=source.texture
	if changed:
		card_size=source.size;source_texture=source.texture;extent=(card_size+Vector2.ONE*MARGIN*2).ceil();capture.size=Vector2i(extent)
		portrait.position=Vector2.ONE*MARGIN;portrait.size=card_size;portrait.texture=source_texture
		for ring in rings:ring.size=extent;ring.material.set_shader_parameter("surface_size",extent)
		filtered.configure(capture.get_texture(),extent);filtered.passes[0].effect.set_shader_parameter("source_premultiplied",true)
		filtered.bind_live_source(capture)
		capture.render_target_update_mode=SubViewport.UPDATE_ONCE;filtered.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
	# Keep the original portrait until the first capture has actually rendered.
	if not source_hidden:_hide_source_after_draw()
	var elapsed: float=frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-started)/1000.0 if started>=0 else 1.0
	if elapsed>=.92:elapsed=1.0
	if changed or elapsed!=painted_time or source.position!=painted_position:
		painted_time=elapsed;painted_position=source.position;_draw_time(elapsed)

func _hide_source_after_draw() -> void:
	await RenderingServer.frame_post_draw
	if active and not source_hidden:view.portraits.player.hide();source_hidden=true

func _ring_paint(index: int,ring_extent: Vector2,width: float,color: Color,shadows: Array,movement: Dictionary) -> void:
	var quad: ColorRect=rings[index];var material_value: ShaderMaterial=quad.material
	var transform_value: Transform2D=movement.transform
	material_value.set_shader_parameter("ring_size",ring_extent*transform_value.get_scale());material_value.set_shader_parameter("ellipse",index==2);material_value.set_shader_parameter("border_width",width);material_value.set_shader_parameter("border_color",color)
	material_value.set_shader_parameter("motion_blur",float(movement.filters[0].value) if not movement.filters.is_empty() else 0.0)
	var geometry:=PackedVector4Array();var colors:=PackedVector4Array()
	for shadow in shadows:geometry.append(Vector4(shadow.x,shadow.y,shadow.blur,1 if shadow.inset else 0));colors.append(Vector4(shadow.color[0],shadow.color[1],shadow.color[2],shadow.color[3]))
	material_value.set_shader_parameter("shadow_count",shadows.size())
	while geometry.size()<3:geometry.append(Vector4.ZERO);colors.append(Vector4.ZERO)
	material_value.set_shader_parameter("shadow_geometry",geometry);material_value.set_shader_parameter("shadow_colors",colors);quad.modulate.a=float(movement.opacity)

func _draw_time(time: float) -> void:
	var beating:=started>=0 and time<.92
	var card:=Motion.sample("nikaAwakeningCardHeartbeat",time if beating else .86,card_size)
	filtered.apply_motion(card,view.portraits.player.position-Vector2.ONE*MARGIN);filtered.apply_filters(card.filters)
	var inner:=Motion.sample("nikaAwakeningPortraitHeartbeat",time if beating else .86,card_size)
	_ring_paint(2,card_size*Vector2(.98,.89),2,Color(1,1,1,.35),inner.boxShadow,inner)
	for i in range(2):
		var ring_motion:=Motion.sample("nikaAwakeningFrameShockwave",maxf(0,time-(.084 if i==1 else 0)),card_size)
		if not beating:ring_motion.opacity=0.0
		var shadow: Array=[{"x":0,"y":0,"blur":26 if i==1 else 32,"inset":false,"color":[1,1,1,.36 if i==1 else .52]},{"x":0,"y":0,"blur":92 if i==1 else 76,"inset":false,"color":[139.0/255 if i==1 else 177.0/255,223.0/255 if i==1 else 235.0/255,1,.26 if i==1 else .34]}]
		if i==0:shadow.append({"x":0,"y":0,"blur":32,"inset":true,"color":[1,1,1,.18]})
		_ring_paint(i,card_size*(Vector2(1.48,1.32) if i==1 else Vector2(1.18,1.12)),2 if i==1 else 3,Color(186.0/255,232.0/255,1,.5) if i==1 else Color(1,1,1,.78),shadow,ring_motion)
	# Capture and the raw texture pass update together; filter pools persist.
	capture.render_target_update_mode=SubViewport.UPDATE_ONCE;filtered.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE

func _process(_delta: float) -> void:
	if active:
		if started>=0 and Time.get_ticks_msec()-started<920 and frozen_time<0:
			var now:=Time.get_ticks_usec();frame_times.append(float(now-frame_clock)/1000.0);frame_clock=now
		_refresh()

func diagnostics_json() -> String:
	var sorted:=frame_times.duplicate();sorted.sort()
	return JSON.stringify({"active":active,"pulses":pulses,"sourceHidden":source_hidden,"capture":capture.get_instance_id(),"filterPasses":filtered.passes.size(),"configurations":filtered.configurations,"frozenTime":frozen_time,"frameSamples":sorted.size(),"p95Ms":sorted[int(sorted.size()*.95)] if not sorted.is_empty() else 0,"maxMs":sorted[-1] if not sorted.is_empty() else 0,"desktopOnly":true})
