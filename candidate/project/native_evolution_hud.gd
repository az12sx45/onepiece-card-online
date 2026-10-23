extends Control
signal clicked
const Motion=preload("res://native_evolution_motion.gd")
const FilterImage=preload("res://native_css_filtered_image.gd")
const Fonts=preload("res://native_fonts.gd")
var cache: Node
var model: Dictionary={}
var card: Control
var backdrop: ColorRect
var aura: ColorRect
var frame: Control
var material_image: Control
var before: Control
var after: Control
var window_view: SubViewport
var window_display: TextureRect
var dialogue: Panel
var dialogue_fill: ColorRect
var line: RichTextLabel
var hint: Label
var rule: ColorRect
var start_tick:=0
var awaiting_tick:=0
var frozen_time:=-1.0
var portrait_size:=Vector2.ONE
var material_size:=Vector2.ONE
var stage_size:=Vector2.ONE
var config_count:=0
var configured_signature:=""
# Hold only this HUD's decoded textures while the other layers finish loading.
var decoded_images: Dictionary={}
var requested_images: Dictionary={}
var failed_image: Texture2D
var last_motion_time:=-1.0
var performance_intervals: Array[float]=[]
var performance_start:=0
var performance_last:=0

func _ready() -> void:
	hide();mouse_filter=Control.MOUSE_FILTER_STOP
	cache.asset_ready.connect(_asset_ready)
	cache.asset_failed.connect(_asset_failed)
	gui_input.connect(func(event):
		if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and event.pressed:clicked.emit();accept_event()
		elif event is InputEventScreenTouch and event.pressed:clicked.emit();accept_event())
	resized.connect(func():if visible:_layout();_animate(_elapsed()))

func request_decode(path: String) -> void:
	requested_images[path]=true
	var texture: Texture2D=cache.request(path)
	if texture!=null:decoded_images[path]=texture
	elif cache.failed.has(path) and not decoded_images.has(path):decoded_images[path]=_failed_texture()
func asset_is_ready(path: String) -> bool:
	request_decode(path)
	return decoded_images.has(path) and not cache.failed.has(path)
func _failed_texture() -> Texture2D:
	# Retain the original text/continue control if an optional picture fails.
	# The asset cache still records failure; this is not a successful decode.
	if failed_image==null:
		var image:=Image.create(1,1,false,Image.FORMAT_RGBA8);image.fill(Color.TRANSPARENT)
		failed_image=ImageTexture.create_from_image(image)
	return failed_image
func _asset_failed(path: String,_error: int) -> void:
	if requested_images.has(path):_asset_ready(path,_failed_texture())
func _asset_ready(path: String,texture: Texture2D) -> void:
	if not requested_images.has(path):return
	decoded_images[path]=texture
	if bool(model.get("show",false)) and card!=null and _layout():
		show();_animate(_elapsed())
func asset_has_failed(path: String) -> bool:return cache.failed.has(path)

func _quad(shader_code: String,parent: Node) -> ColorRect:
	shader_code=shader_code.replace("shader_type canvas_item;","shader_type canvas_item;varying vec4 source_tint;void vertex(){source_tint=COLOR;}")
	shader_code=shader_code.substr(0,shader_code.length()-1)+"COLOR*=source_tint;}"
	var quad:=ColorRect.new();quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;var shader:=Shader.new();shader.code=shader_code;var effect:=ShaderMaterial.new();effect.shader=shader;quad.material=effect;parent.add_child(quad);return quad

func _create() -> void:
	backdrop=_quad("shader_type canvas_item;uniform vec4 glow;uniform vec2 extent;void fragment(){float d=length((UV-vec2(.5,.42))*extent);float radius=length(vec2(.5,.58)*extent);float g=clamp(1.0-d/(radius*.42),0.0,1.0)*glow.a;float a=UV.y<.45?mix(.72,.46,UV.y/.45):mix(.46,.76,(UV.y-.45)/.55);float alpha=g+a*(1.0-g);COLOR=vec4(glow.rgb*g/max(.00001,alpha),alpha);}",self)
	card=Control.new();card.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(card)
	aura=_quad("shader_type canvas_item;uniform vec4 glow;void fragment(){float d=length(UV-vec2(.5));float a=pow(clamp(1.0-d/.55,0.0,1.0),2.0)*glow.a;COLOR=vec4(glow.rgb,a);}",card)
	window_view=SubViewport.new();window_view.disable_3d=true;window_view.transparent_bg=true;window_view.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(window_view)
	before=FilterImage.new();window_view.add_child(before);after=FilterImage.new();window_view.add_child(after)
	window_display=TextureRect.new();window_display.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;window_display.mouse_filter=Control.MOUSE_FILTER_IGNORE;window_display.texture=window_view.get_texture();card.add_child(window_display)
	var clip_shader:=Shader.new();clip_shader.code="shader_type canvas_item;uniform vec2 extent;void fragment(){vec2 p=UV*extent;vec2 lo=extent*vec2(.068,.085);vec2 hi=extent*vec2(.932,.905);vec2 q=abs(p-(hi+lo)*.5)-(hi-lo)*.5+vec2(4.0);float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-4.0;COLOR=texture(TEXTURE,UV)*clamp(.5-d,0.0,1.0);}"
	var clip_effect:=ShaderMaterial.new();clip_effect.shader=clip_shader;window_display.material=clip_effect
	frame=FilterImage.new();card.add_child(frame);material_image=FilterImage.new();card.add_child(material_image)
	dialogue=Panel.new();dialogue.mouse_filter=Control.MOUSE_FILTER_IGNORE;card.add_child(dialogue)
	var style:=StyleBoxFlat.new();style.bg_color=Color.TRANSPARENT;style.border_color=Color(1,.937,.745,.86);style.set_border_width_all(3);style.set_corner_radius_all(8);dialogue.add_theme_stylebox_override("panel",style)
	dialogue_fill=_quad("shader_type canvas_item;uniform vec2 extent;void fragment(){vec2 p=UV*extent;vec2 q=abs(p-extent*.5)-extent*.5+vec2(8.0);float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-8.0;vec4 c=mix(vec4(18.0/255.0,24.0/255.0,34.0/255.0,.65),vec4(4.0/255.0,7.0/255.0,12.0/255.0,.78),UV.y);COLOR=vec4(c.rgb,c.a*clamp(.5-d,0.0,1.0));}",dialogue);dialogue_fill.show_behind_parent=true
	line=RichTextLabel.new();line.mouse_filter=Control.MOUSE_FILTER_PASS;line.add_theme_font_override("normal_font",Fonts.weighted(900));line.add_theme_font_size_override("normal_font_size",18);line.add_theme_color_override("default_color",Color(1,.973,.882,.96));line.add_theme_constant_override("line_separation",3);dialogue.add_child(line)
	hint=Label.new();hint.mouse_filter=Control.MOUSE_FILTER_IGNORE;hint.text="點擊繼續";hint.add_theme_font_override("font",Fonts.weighted(900));hint.add_theme_font_size_override("font_size",13);hint.add_theme_color_override("font_color",Color(1,.906,.651,.9));hint.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;hint.vertical_alignment=VERTICAL_ALIGNMENT_BOTTOM;dialogue.add_child(hint)
	rule=_quad("shader_type canvas_item;uniform vec4 glow;void fragment(){COLOR=vec4(glow.rgb,glow.a*(1.0-abs(UV.x-.5)*2.0));}",card)

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value);var was_visible:=visible;var was_requested: bool=model.get("show",false)
	model=next
	if not bool(model.show):
		hide()
		if was_visible or was_requested:decoded_images.clear();requested_images.clear()
		if card!=null:
			for layer in [before,after,frame,material_image]:layer.stop()
			window_view.render_target_update_mode=SubViewport.UPDATE_DISABLED
		return
	if card==null:_create()
	if not was_visible:start_tick=Time.get_ticks_msec();awaiting_tick=0;configured_signature=""
	if bool(model.awaiting) and awaiting_tick==0:awaiting_tick=Time.get_ticks_msec()
	line.text=str(model.text)
	if _layout():show();_animate(_elapsed())

func _image(key: String) -> Texture2D:
	var path:=str(model.images[key].src).split("?")[0]
	if path.is_empty():return null
	request_decode(path)
	return decoded_images.get(path)

func _layout() -> bool:
	# Do not publish half a layer set or dereference a loading texture.
	for key in ["CharacterBefore","CharacterAfter","CharacterFrame","Material"]:
		if _image(key)==null:return false
	last_motion_time=-1.0
	backdrop.position=-size*.12;backdrop.size=size*1.24
	backdrop.material.set_shader_parameter("extent",backdrop.size)
	card.size=size-Vector2(16,16);card.pivot_offset=card.size*.5
	stage_size=card.size-Vector2(16,96);portrait_size=Vector2((size.y-112)*.75,size.y-112)
	var material_texture: Texture2D=_image("Material");var natural:=material_texture.get_size();var ratio:=minf(1,minf(stage_size.x*.25/natural.x,stage_size.y*.35/natural.y));material_size=natural*ratio
	var signature:=JSON.stringify([model.type,model.images,portrait_size.x,portrait_size.y,material_size.x,material_size.y])
	if signature!=configured_signature:
		configured_signature=signature;config_count+=1
		before.configure(_image("CharacterBefore"),portrait_size);after.configure(_image("CharacterAfter"),portrait_size);frame.configure(_image("CharacterFrame"),portrait_size);material_image.configure(material_texture,material_size)
	window_view.size=Vector2i(portrait_size.ceil());window_display.size=portrait_size;window_display.position=Vector2(8,8)+(stage_size-portrait_size)*.5;window_display.material.set_shader_parameter("extent",portrait_size)
	aura.size=Vector2(minf(620,size.x*.76),minf(430,size.y*.55));aura.pivot_offset=aura.size*.5
	dialogue.position=Vector2(8,card.size.y-80);dialogue.size=Vector2(stage_size.x,72)
	dialogue_fill.size=dialogue.size;dialogue_fill.material.set_shader_parameter("extent",dialogue.size)
	line.position=Vector2(15,9);line.size=Vector2(stage_size.x-158,54)
	hint.position=Vector2(stage_size.x-135,18);hint.size=Vector2(120,48)
	rule.size=Vector2(minf(560,size.x*.7),3);rule.pivot_offset=rule.size*.5
	var glows: Dictionary={"flag":Color(1,237.0/255,190.0/255,.48),"paper":Color(105.0/255,204.0/255,1,.34),"prime":Color(1,211.0/255,112.0/255,.44),"enma":Color(147.0/255,72.0/255,1,.56)}
	var glow: Color=glows[model.type];backdrop.material.set_shader_parameter("glow",glow);aura.material.set_shader_parameter("glow",glow);rule.material.set_shader_parameter("glow",glow)

	return true

func _elapsed() -> float:return frozen_time if frozen_time>=0 else float(Time.get_ticks_msec()-start_tick)/1000.0
func _process(_delta: float) -> void:if visible:_animate(_elapsed())

func _animate(time: float) -> void:
	var type:=str(model.type)
	hint.visible=bool(model.awaiting)
	if hint.visible:
		var pulse_time:=maxf(0,frozen_time-8.2) if frozen_time>=0 else float(Time.get_ticks_msec()-awaiting_tick)/1000.0
		var pulse:=Motion.sample(type,"evolutionContinuePulse",fposmod(pulse_time,1.1),hint.size);hint.modulate.a=pulse.opacity;hint.position.y=18+pulse.transform.origin.y
	time=minf(time,8.2)
	if time==last_motion_time:return
	last_motion_time=time
	modulate.a=Motion.sample(type,"evolutionHudFade",time,size).opacity;backdrop.modulate.a=Motion.sample(type,"evolutionBackdrop",time,backdrop.size).opacity
	var entry:=Motion.sample(type,"evolutionCardIn",time,card.size);var transform: Transform2D=entry.transform;card.position=Vector2(8,8)+transform.origin;card.scale=transform.get_scale();card.modulate.a=entry.opacity
	for pair in [[before,"evolutionCharacterBefore"],[after,"evolutionCharacterAfter"],[frame,"evolutionCharacterFrame"],[material_image,"evolutionFlagMaterial" if type=="flag" else "evolutionPaperMaterial" if type=="paper" else "evolutionPrimeMaterial"]]:
		var layer: Control=pair[0];var sample:=Motion.sample(type,pair[1],time,layer.box);layer.apply_filters(sample.filters)
		var anchor:=portrait_size*.5 if layer==before or layer==after else Vector2(8,8)+stage_size*.5 if layer==frame else Vector2(8,8)+Vector2(stage_size.x*.5+portrait_size.x*.45,stage_size.y*.72)
		layer.apply_motion(sample,anchor)
	var aura_motion:=Motion.sample(type,"evolutionAura",time,aura.size);var aura_transform: Transform2D=aura_motion.transform;aura.position=Vector2(8,8)+stage_size*.5+aura_transform.origin;aura.scale=aura_transform.get_scale();aura.modulate.a=aura_motion.opacity
	var rule_motion:=Motion.sample(type,"evolutionRule",time,rule.size);var rule_transform: Transform2D=rule_motion.transform;rule.position=Vector2(card.size.x*.5,card.size.y-79)+rule_transform.origin;rule.scale=rule_transform.get_scale();rule.modulate.a=rule_motion.opacity
	window_view.render_target_update_mode=SubViewport.UPDATE_ONCE

func test_click() -> bool:
	if not visible:return false
	clicked.emit();return true
func test_identity_json() -> String:return JSON.stringify([config_count,frame.get_instance_id(),before.get_instance_id(),after.get_instance_id(),material_image.get_instance_id(),window_view.get_instance_id()])
func test_layout() -> bool:return dialogue.get_rect().end.y<=card.size.y and line.size.x>0 and portrait_size.y<=stage_size.y and hint.position.x>=line.position.x+line.size.x
func test_geometry_json() -> String:
	var result: Dictionary={}
	for pair in [[".evolution-card",card],[".evolution-character-window",window_display],[".evolution-character-frame",frame],[".evolution-material-img",material_image],[".evolution-dialogue",dialogue],[".evolution-sub",line],[".evolution-continue",hint]]:
		var node: Control=pair[1];var rect: Rect2=node.get_global_transform()*Rect2(Vector2.ZERO,node.size);result[pair[0]]=[rect.position.x,rect.position.y,rect.size.x,rect.size.y]
	var stage: Rect2=card.get_global_transform()*Rect2(Vector2(8,8),stage_size);result[".evolution-material-stage"]=[stage.position.x,stage.position.y,stage.size.x,stage.size.y]
	return JSON.stringify(result)
func test_begin_performance() -> void:
	performance_intervals.clear();performance_start=Time.get_ticks_usec();performance_last=performance_start
	RenderingServer.frame_post_draw.connect(_record_frame)
func _record_frame() -> void:
	var now:=Time.get_ticks_usec()
	if now-performance_start>150000:performance_intervals.append(float(now-performance_last)/1000.0)
	performance_last=now
func test_end_performance_json() -> String:
	RenderingServer.frame_post_draw.disconnect(_record_frame);performance_intervals.sort()
	return JSON.stringify({"frames":performance_intervals.size(),"durationMs":float(Time.get_ticks_usec()-performance_start)/1000.0,"intervalP95Ms":performance_intervals[int(performance_intervals.size()*.95)],"intervalMaximumMs":performance_intervals[-1],"physicalAndroidVerified":false})
