extends Control
## Shared original cinematic layers. Text/portraits remain persistent siblings.
const Motion=preload("res://native_cinematic_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Overlay=preload("res://native_cinematic_overlay.gdshader")
var model: Dictionary={}
var style: Dictionary={}
var sky_source:=SubViewport.new()
var sky_texture:=TextureRect.new()
var sky_gradient: ColorRect
var base_gradient: ColorRect
var sea: ColorRect
var vignette: ColorRect
var letterbox: ColorRect
var sky: Control
var foreground: Control
var accent: Control
var source_foreground: TextureRect
var source_accent: TextureRect
var source_signature:=""
var scene_serial:=-1
var switching:=false
var began:=0
var frozen_time:=-1.0
func _overlay(mode: int,parent: Node) -> ColorRect:
	var quad:=ColorRect.new();quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;var effect:=ShaderMaterial.new();effect.shader=Overlay;effect.set_shader_parameter("mode",mode);quad.material=effect;parent.add_child(quad);return quad
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	base_gradient=_overlay(0,self);sky_source.disable_3d=true;sky_source.transparent_bg=true;sky_source.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(sky_source)
	sky_texture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;sky_texture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;sky_source.add_child(sky_texture);sky_gradient=_overlay(0,sky_source)
	sky=Filtered.new();add_child(sky);sea=_overlay(2,self);vignette=_overlay(1,self);foreground=Filtered.new();add_child(foreground);accent=Filtered.new();add_child(accent);letterbox=_overlay(3,self);hide();set_process(false)
func configure(value: Dictionary,background: TextureRect,front: TextureRect,detail: TextureRect) -> void:
	if value.get("opening",false):stop();return
	model=value;style=Motion.scene(str(model.sceneClass));source_foreground=front;source_accent=detail
	var signature:=str(model.background)+str(size)+str(style.tone)
	if signature!=source_signature:
		began=Time.get_ticks_msec();source_signature=signature;sky_source.size=Vector2i(size);sky_texture.texture=background.texture;sky_texture.size=size;sky_gradient.size=size;sky_gradient.material.set_shader_parameter("history",style.tone=="history");sky_source.render_target_update_mode=SubViewport.UPDATE_ONCE
		sky.configure(sky_source.get_texture(),size);sky.passes[0].effect.set_shader_parameter("source_premultiplied",true);sky.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
		sky.bind_live_source(sky_source)
	var next_switch:=str(model.sceneClass).contains("scene-switching")
	if scene_serial!=int(model.sceneSerial) or switching!=next_switch:scene_serial=int(model.sceneSerial);switching=next_switch;began=Time.get_ticks_msec()
	for pair in [[foreground,front],[accent,detail]]:
		pair[0].visible=pair[1].texture!=null
		if pair[0].visible:pair[0].configure(pair[1].texture,pair[1].size);pair[1].hide()
	for overlay in [base_gradient,vignette,letterbox]:overlay.size=size;overlay.material.set_shader_parameter("extent",size)
	sea.position=Vector2(-size.x*.1,size.y*.7);sea.size=Vector2(size.x*1.2,size.y*.3);show();set_process(true);_tick()
func _motion(name: String,extent: Vector2,time: float,loop:=false,alternate:=false) -> Dictionary:
	var id: String=style.motions[name];var duration: float=Motion.data.catalog[id].duration
	if loop:
		var iteration:=int(floorf(time/duration));time=fposmod(time,duration)
		if alternate and iteration%2==1:time=duration-time
	return Motion.sample(id,time,extent)
func _tick() -> void:
	if not is_visible_in_tree():return
	var time:=frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-began)/1000
	var sky_motion:=_motion("finalEndingSceneSoftCut" if switching else "finalEndingSkyDrift",size,time,not switching,not switching)
	sky.apply_motion(sky_motion,Vector2.ZERO);sky.apply_filters(sky_motion.filters if switching else style.skyFilter)
	for pair in [[foreground,source_foreground,"finalEndingForegroundSoftCut","finalEndingAssetFloat","foregroundFilter",model.foregroundOpacity],[accent,source_accent,"finalEndingAccentSoftCut","finalEndingAccentPulse","accentFilter",model.accentOpacity]]:
		if not pair[0].visible:continue
		var motion:=_motion(pair[2] if switching else pair[3],pair[1].size,time,not switching);motion.opacity*=float(pair[5]);pair[0].apply_motion(motion,pair[1].position)
		pair[0].apply_filters(motion.filters if switching or pair[3]=="finalEndingAccentPulse" else style[pair[4]])
func _process(_delta: float) -> void:_tick()
func stop() -> void:
	hide();set_process(false);sky.stop();foreground.stop();accent.stop();sky_source.render_target_update_mode=SubViewport.UPDATE_DISABLED;scene_serial=-1
