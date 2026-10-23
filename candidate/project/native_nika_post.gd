extends Control
const Motion=preload("res://native_nika_motion.gd")
const Css=preload("res://native_evolution_motion.gd")
const ImageLayer=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
var cache: Node
var model: Dictionary={}
var background: ColorRect
var light: ColorRect
var veil: ColorRect
var ring: ColorRect
var before: Control
var after: Control
var dialogue: Panel
var dialogue_fill: ColorRect
var labels: Array[Label]=[]
var fallback: Label
var began:=0
var fade_began:=0
var frozen_time:=-1.0
var art_rect:=Rect2()
var after_anchor:=Vector2.ZERO
var ring_anchor:=Vector2.ZERO
var generation:=0

func _quad(code: String) -> ColorRect:
	code=code.replace("shader_type canvas_item;","shader_type canvas_item;varying vec4 source_tint;void vertex(){source_tint=COLOR;}")
	code=code.substr(0,code.length()-1)+"COLOR*=source_tint;}"
	var quad:=ColorRect.new();quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;var shader:=Shader.new();shader.code=code;var effect:=ShaderMaterial.new();effect.shader=shader;quad.material=effect;add_child(quad);return quad

func _ready() -> void:
	hide();mouse_filter=Control.MOUSE_FILTER_STOP;z_index=1100;clip_contents=true
	background=_quad("shader_type canvas_item;uniform vec2 extent;void fragment(){float d=length((UV-.5)*extent)/length(extent*.5);vec4 a=vec4(1.,1.,1.,.18);vec4 b=vec4(15./255.,16./255.,24./255.,.94);vec4 c=d<.46?mix(a,b,d/.46):mix(b,vec4(0.,0.,0.,1.),clamp((d-.46)/.54,0.,1.));COLOR=c;}")
	light=_quad("shader_type canvas_item;uniform vec2 extent;void fragment(){vec2 p=(UV-vec2(.5,.48))*extent;float d=length(p)/length(extent*vec2(.5,.52));float r=d<.18?mix(.64,.16,d/.18):mix(.16,0.,clamp((d-.18)/.21,0.,1.));float a=fract((atan(p.x,-p.y)-.349066)/6.2831853+1.);vec4 c;if(a<.22)c=mix(vec4(1.,1.,1.,.16),vec4(1.,1.,1.,0.),a/.22);else if(a<.385)c=mix(vec4(1.,.906,.553,0.),vec4(1.,.906,.553,.18),(a-.22)/.165);else if(a<.55)c=mix(vec4(1.,.906,.553,.18),vec4(1.,.906,.553,0.),(a-.385)/.165);else if(a<.665)c=mix(vec4(1.,1.,1.,0.),vec4(1.,1.,1.,.24),(a-.55)/.115);else c=mix(vec4(1.,1.,1.,.24),vec4(1.,1.,1.,0.),clamp((a-.665)/.115,0.,1.));float alpha=r+c.a*(1.-r);COLOR=vec4((vec3(r)+c.rgb*c.a*(1.-r))/max(alpha,.00001),alpha);}")
	veil=_quad("shader_type canvas_item;void fragment(){float a=UV.y<.54?mix(.02,.34,UV.y/.54):mix(.34,.86,(UV.y-.54)/.46);COLOR=vec4(0.,0.,0.,a);}")
	before=ImageLayer.new();add_child(before)
	ring=_quad("shader_type canvas_item;uniform vec2 extent;void fragment(){float radius=min(extent.x,extent.y)*.5;float d=length((UV-.5)*extent)-radius*.8;float edge=1.-smoothstep(.8,1.8,abs(d));float outer=exp(-.5*d*d/(35.*35.))*(d>0.?.55:.32);float a=.42*edge+outer*(1.-.42*edge);COLOR=vec4(1.,1.,1.,a);}")
	after=ImageLayer.new();add_child(after)
	fallback=Label.new();fallback.text="五檔\n尼卡";fallback.add_theme_font_override("font",Fonts.weighted(900));fallback.add_theme_font_size_override("font_size",32);fallback.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;fallback.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	var fallback_style:=StyleBoxFlat.new();fallback_style.bg_color=Color(1,1,1,.16);fallback_style.border_color=Color(1,1,1,.58);fallback_style.set_border_width_all(3);fallback_style.set_corner_radius_all(999);fallback.add_theme_stylebox_override("normal",fallback_style);add_child(fallback);fallback.hide()
	dialogue=Panel.new();dialogue.mouse_filter=Control.MOUSE_FILTER_IGNORE;var style:=StyleBoxFlat.new();style.bg_color=Color.TRANSPARENT;style.border_color=Color(1,1,1,.34);style.set_border_width_all(1);style.set_corner_radius_all(18);dialogue.add_theme_stylebox_override("panel",style);add_child(dialogue)
	dialogue_fill=_quad("shader_type canvas_item;uniform vec2 extent;void fragment(){vec2 p=UV*extent;vec2 q=abs(p-extent*.5)-extent*.5+vec2(18.);float d=length(max(q,vec2(0.)))+min(max(q.x,q.y),0.)-18.;vec4 c=mix(vec4(6./255.,8./255.,16./255.,.9),vec4(0.,0.,0.,.76),UV.y);COLOR=vec4(c.rgb,c.a*clamp(.5-d,0.,1.));}");dialogue_fill.reparent(dialogue);dialogue_fill.show_behind_parent=true
	for i in range(3):
		var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_font_override("font",Fonts.weighted(850 if i==2 else 900));label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.add_theme_color_override("font_color",Color("ffeeb3") if i==0 else Color(1,1,1,.82) if i==2 else Color.WHITE);dialogue.add_child(label);labels.append(label)
	cache.asset_ready.connect(func(path,_texture):if visible and path in [str(model.before.src),str(model.after.src)]:_layout())
	cache.asset_failed.connect(func(path,_error):if visible and path in [str(model.before.src),str(model.after.src)]:_layout())
	resized.connect(func():if visible:_layout())

func show_post_json(value: String) -> void:
	model=JSON.parse_string(value);generation+=1;began=Time.get_ticks_msec();fade_began=0;modulate.a=1
	assert(model.lines.size()==3,"Original Nika dialogue lines required")
	for i in range(3):labels[i].text=str(model.lines[i])
	fallback.text=str(model.fallback)
	for key in ["before","after"]:
		if not str(model[key].src).is_empty():cache.request(str(model[key].src))
	show();_layout()

func _layout() -> void:
	background.size=size;background.material.set_shader_parameter("extent",size);veil.size=size
	light.position=-size*.12;light.size=size*1.24;light.material.set_shader_parameter("extent",light.size)
	var phone:=size.y<=500;var box:=Vector2(minf(1080,size.x*.94),minf(680,size.y*.88));var origin:=(size-box)*.5;var dialog_height:=104.0 if phone else maxf(164,44+20+(clampf(size.x*.019,16,22)+clampf(size.x*.027,21,34)+clampf(size.x*.021,18,26))*1.5);var gap:=12.0 if phone else 18.0
	art_rect=Rect2(origin,Vector2(box.x,maxf(1,box.y-dialog_height-gap)))
	dialogue.position=Vector2(origin.x,origin.y+box.y-dialog_height);dialogue.size=Vector2(box.x,dialog_height)
	dialogue_fill.size=dialogue.size;dialogue_fill.material.set_shader_parameter("extent",dialogue.size)
	var padding:=Vector2(16,10) if phone else Vector2(30,22);var cursor:=padding.y
	for i in range(3):
		var font_size: int=([16,18,16] if phone else [int(clampf(size.x*.019,16,22)),int(clampf(size.x*.027,21,34)),int(clampf(size.x*.021,18,26))])[i]
		labels[i].add_theme_font_size_override("font_size",font_size);labels[i].position=Vector2(padding.x,cursor);labels[i].size=Vector2(box.x-padding.x*2,font_size*1.5);cursor+=font_size*1.5+(4 if phone else 10)
	var before_texture: Texture2D=cache.request(str(model.before.src)) if not str(model.before.src).is_empty() else null
	var after_texture: Texture2D=cache.request(str(model.after.src)) if not str(model.after.src).is_empty() else null
	before.visible=before_texture!=null;after.visible=after_texture!=null
	if before_texture!=null:
		var width:=minf(size.x*.3,250);var dimensions:=Vector2(width,width/.72)
		if phone:dimensions*=minf(1,art_rect.size.y/dimensions.y)
		before.configure(before_texture,dimensions);before.position=art_rect.position+Vector2(art_rect.size.x*.08,art_rect.size.y*.95-dimensions.y);before.modulate.a=.32
		before.apply_filters([{"kind":"grayscale","value":1.0},{"kind":"brightness","value":.7},{"kind":"blur","value":.2}])
	if after_texture!=null:
		var dimensions:=Vector2(minf(size.x*.45,410),minf(size.y*.66,560))
		if phone:dimensions.y=minf(dimensions.y,art_rect.size.y)
		after.configure(after_texture,dimensions);after_anchor=art_rect.position+Vector2((art_rect.size.x-dimensions.x)*.5,art_rect.size.y-dimensions.y)
		after.apply_filters([{"kind":"drop-shadow","x":0.0,"y":0.0,"blur":34.0,"color":[1,1,1,.72]}])
	var fallback_diameter:=minf(size.x*.44,360);if phone:fallback_diameter=minf(fallback_diameter,art_rect.size.y)
	fallback.visible=str(model.after.src).is_empty() or cache.failed.has(str(model.after.src));fallback.size=Vector2.ONE*fallback_diameter;fallback.position=art_rect.position+Vector2((art_rect.size.x-fallback_diameter)*.5,art_rect.size.y-fallback_diameter);fallback.add_theme_font_size_override("font_size",int(clampf(size.x*.04,26,54)))
	var diameter:=minf(size.x*.52,520);if phone:diameter=minf(diameter,art_rect.size.y*1.05)
	ring.size=Vector2.ONE*diameter;ring.material.set_shader_parameter("extent",ring.size);ring_anchor=art_rect.position+Vector2(art_rect.size.x*.5,art_rect.size.y*.6)
	_animate(_elapsed())

func _elapsed() -> float:return frozen_time if frozen_time>=0 else (Time.get_ticks_msec()-began)/1000.0
func _animate(elapsed: float) -> void:
	light.modulate.a=Motion.sample("luffyGearFifthFlash",elapsed,light.size,true).opacity
	var pulse:=Motion.sample("luffyGearFifthHeartbeat",elapsed,ring.size,true);var movement: Transform2D=pulse.transform;ring.position=ring_anchor+ring.size*.5+movement.origin-movement.basis_xform(ring.size*.5);ring.scale=movement.get_scale();ring.modulate.a=pulse.opacity
	if after.visible:after.apply_motion(Motion.sample("luffyGearFifthFloat",elapsed,after.size,true),after_anchor)
	if fade_began>0:modulate.a=1.0-Css._ease(clampf((Time.get_ticks_msec()-fade_began)/550.0,0,1),[.25,.1,.25,1.0])
func _process(_delta: float) -> void:
	if visible:_animate(_elapsed())
func fade_out() -> void:fade_began=Time.get_ticks_msec()
func remove_post() -> void:hide();before.stop();after.stop()
func test_state_json() -> String:
	var rows: Array=[]
	for label in labels:rows.append({"text":label.text,"rect":[label.position.x,label.position.y,label.size.x,label.size.y],"visibleLines":label.get_visible_line_count(),"lines":label.get_line_count()})
	return JSON.stringify({"visible":visible,"surface":[size.x,size.y],"dialogue":[dialogue.position.x,dialogue.position.y,dialogue.size.x,dialogue.size.y],"rows":rows,"artReady":before.visible and after.visible,"fallbackVisible":fallback.visible,"generation":generation})
