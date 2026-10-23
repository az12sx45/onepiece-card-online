extends Control
## Original six-power glyphs, CSS layers and timing, on the live battle stage.
signal shake_requested
const Motion=preload("res://native_lucci_six_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
var view: Control
var cache: Node
var epoch:=0
var starts:=0
var completions:=0
var shakes:=0
var layouts:=0
var begun:=0
var frozen_ms:=-1
var event_id:=""
var packet: Dictionary={}
var has_image:=false
var shaken:=false
var parts: Dictionary={}
var glyph: Control
var fallback_source: SubViewport
var fallback_label: Label
var effect: Control
var effect_label: Label
var effect_paint: ColorRect
var installed:=false

func _ready() -> void:
	z_index=315;mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;hide();set_process(false)

func _ensure_nodes() -> void:
	if glyph!=null:return
	for key in ["ink","brush"]:
		var source:=SubViewport.new();source.disable_3d=true;source.transparent_bg=true;source.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(source)
		var paint:=ColorRect.new();paint.material=ShaderMaterial.new();paint.material.shader=preload("res://native_lucci_six_art.gdshader");source.add_child(paint)
		var image:=Filtered.new();add_child(image);image.passes[0].effect.set_shader_parameter("source_fill",true);image.passes[0].effect.set_shader_parameter("source_premultiplied",true)
		parts[key]={"source":source,"paint":paint,"image":image,"extent":Vector2.ONE}
	glyph=Filtered.new();add_child(glyph)
	fallback_source=SubViewport.new();fallback_source.disable_3d=true;fallback_source.transparent_bg=true;fallback_source.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(fallback_source)
	fallback_label=Label.new();fallback_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;fallback_label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;fallback_source.add_child(fallback_label)
	var font:=SystemFont.new();font.font_names=PackedStringArray(["DFKai-SB","BiauKai","標楷體","serif"]);font.font_weight=1000;font.fallbacks=[Fonts.base()];fallback_label.add_theme_font_override("font",font)
	fallback_label.add_theme_color_override("font_color",Color("080909"));fallback_label.add_theme_color_override("font_outline_color",Color(1,1,1,.9))
	effect=Control.new();effect.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(effect)
	effect_paint=ColorRect.new();effect_paint.mouse_filter=Control.MOUSE_FILTER_IGNORE;effect_paint.material=ShaderMaterial.new();effect_paint.material.shader=preload("res://native_lucci_six_art.gdshader");effect_paint.material.set_shader_parameter("kind",2);effect_paint.material.set_shader_parameter("padding",0.0);effect.add_child(effect_paint)
	effect_label=Label.new();effect_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;effect_label.add_theme_color_override("font_color",Color("f6f3e9"));effect_label.add_theme_color_override("font_shadow_color",Color.BLACK);effect_label.add_theme_constant_override("shadow_offset_y",3);effect.add_child(effect_label)
	view.resized.connect(_resized)

func _resized() -> void:
	if installed:_layout();_render(_elapsed())

func _layout() -> void:
	size=view.size;layouts+=1
	for key in parts:
		var p: Dictionary=parts[key]
		var extent:=Vector2(minf(size.x*(.76 if has_image else .74),980 if has_image else 1050),minf(size.y*(.76 if has_image else .66),680 if has_image else 590)) if key=="ink" else Vector2(minf(size.x*.88,1240),minf(size.y*.12,110))
		p.extent=extent;p.source.size=Vector2i(extent.ceil());p.paint.size=Vector2(p.source.size);p.paint.material.set_shader_parameter("extent",extent);p.paint.material.set_shader_parameter("padding",0.0);p.paint.material.set_shader_parameter("kind",0 if key=="ink" else 1);p.paint.material.set_shader_parameter("has_image",has_image);p.source.render_target_update_mode=SubViewport.UPDATE_ONCE
		p.image.configure(p.source.get_texture(),extent);p.image.bind_live_source(p.source);p.image.apply_filters([{"kind":"blur","value":5 if has_image else (4 if key=="ink" else 2)}]+([{"kind":"contrast","value":1.08 if has_image else 1.3}] if key=="ink" else []))
	if has_image:
		glyph.configure(cache.request(str(packet.image)),Vector2(minf(size.x*.62,760),minf(size.y*.66,610)))
		glyph.passes[0].effect.set_shader_parameter("source_premultiplied",false)
	else:
		var font_size:=int(clampf(size.x*.2,110,320));fallback_label.text=str(packet.name);fallback_label.add_theme_font_size_override("font_size",font_size);fallback_label.add_theme_constant_override("outline_size",int(clampf(size.x*.0022,2,4)))
		fallback_label.reset_size();fallback_source.size=Vector2i(fallback_label.get_minimum_size().ceil()+Vector2(32,48));fallback_label.position=Vector2(16,24);fallback_label.size=Vector2(fallback_source.size)-Vector2(32,48);fallback_source.render_target_update_mode=SubViewport.UPDATE_ONCE
		glyph.configure(fallback_source.get_texture(),Vector2(fallback_source.size));glyph.passes[0].effect.set_shader_parameter("source_premultiplied",true);glyph.bind_live_source(fallback_source)
	var font_size:=int(clampf(size.x*.024,20,40));var font:=FontVariation.new();font.base_font=Fonts.base();font.variation_opentype={2003265652:1000};font.spacing_glyph=int(round(font_size*.18));effect_label.add_theme_font_override("font",font);effect_label.add_theme_font_size_override("font_size",font_size);effect_label.text=str(packet.effect);effect_label.reset_size()
	var padding:=Vector2(font_size*1.25,font_size*.32+1);effect.size=effect_label.get_minimum_size()+padding*2;effect_label.position=padding;effect_label.size=effect_label.get_minimum_size();effect_paint.size=effect.size;effect_paint.material.set_shader_parameter("extent",effect.size)

func play_event(event: Dictionary,original: Dictionary) -> String:
	_ensure_nodes();cancel();epoch+=1;var token:=epoch
	if not original.has("loaded") or not original.has("fallback"):return "Original Lucci six-power presentation packet required"
	var image_path:=str(original.loaded.image);var deadline:=Time.get_ticks_msec()+15000
	while image_path!="" and cache.request(image_path)==null and not cache.failed.has(image_path) and Time.get_ticks_msec()<deadline:
		await get_tree().process_frame
		if token!=epoch:return ""
	has_image=image_path!="" and cache.request(image_path)!=null
	packet=original.loaded if has_image else original.fallback;event_id=str(event.get("id",""));installed=true;shaken=false;starts+=1;begun=Time.get_ticks_msec();_layout();_render(0);show();set_process(true)
	while token==epoch and _elapsed()<float(packet.endAt):await get_tree().process_frame
	if token!=epoch:return ""
	completions+=1;cancel();return ""

func _elapsed() -> float:return float(frozen_ms) if frozen_ms>=0 else float(Time.get_ticks_msec()-begun)
func _process(_delta: float) -> void:
	var elapsed:=_elapsed();_render(elapsed)
	if not shaken and elapsed>=520:shaken=true;shakes+=1;shake_requested.emit()

func _render(milliseconds: float) -> void:
	var seconds:=milliseconds/1000.0;modulate.a=Motion.sample("layer",seconds,size).opacity
	for key in parts:parts[key].image.apply_motion(Motion.sample(key,seconds,parts[key].extent),size*.5)
	var state:=Motion.sample("glyph",seconds,glyph.box);glyph.apply_filters(state.filters);glyph.apply_motion(state,Vector2(size.x*.5,size.y*.48))
	state=Motion.sample("effect",seconds,effect.size);var t: Transform2D=state.transform;var origin:=effect.size*.5;effect.position=Vector2(size.x*.5,size.y*.75)+origin+t.origin-t.basis_xform(origin);effect.modulate.a=state.opacity

func cancel() -> void:
	epoch+=1;installed=false;event_id="";frozen_ms=-1;set_process(false);hide()
	if glyph!=null:
		glyph.stop();fallback_source.render_target_update_mode=SubViewport.UPDATE_DISABLED
		for p in parts.values():p.image.stop();p.source.render_target_update_mode=SubViewport.UPDATE_DISABLED

func debug_json() -> String:
	return JSON.stringify({"event":event_id,"installed":installed,"hasImage":has_image,"name":packet.get("name",""),"effect":packet.get("effect",""),"starts":starts,"completions":completions,"shakes":shakes,"layouts":layouts,"visible":visible,"effectRect":[effect.position.x,effect.position.y,effect.size.x,effect.size.y] if effect!=null else []})
