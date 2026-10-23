extends Control
## Native surface for original tavern controller. Component comparisons do not
## establish complete visual acceptance or a playable release.
const HostMotion=preload("res://native_tavern_host_motion.gd")
signal command_requested(key: String)
signal vfx_frame(delta: float,width: float,height: float)
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var labels: Dictionary={}
var buttons: Dictionary={}
var portrait:=TextureRect.new()
var host_art:=TextureRect.new()
var door_angle:=0.0
var portrait_alpha:=0.0
var portrait_brightness:=0.0
var portrait_scale:=0.85
var host_alpha:=0.0
var host_shift:=0.0
var host_motion_name:="tavern-host-steady"
var host_motion_started:=-1
var light_alpha:=0.0
var tween: Tween
var last_stage:=""
var fx:=preload("res://native_tavern_vfx.gd").new()
var portal_paint:=preload("res://native_tavern_portal.gd").new()
var fx_active:=false

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;clip_contents=true
	var native_theme:=Theme.new();native_theme.default_font=preload("res://native_fonts.gd").weighted(800);theme=native_theme
	add_child(fx);add_child(portal_paint);portal_paint.z_index=3;portrait.z_index=2;host_art.z_index=4
	for item in [host_art,portrait]:
		item.texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;item.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;item.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;item.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(item)
	var shader:=Shader.new();shader.code="shader_type canvas_item; uniform sampler2D portrait_mask : filter_linear_mipmap, repeat_disable; uniform bool use_mask=false; uniform float brightness=1.0; varying vec4 vertex_tint; void vertex(){vertex_tint=COLOR;} void fragment(){vec4 col=texture(TEXTURE,UV); if(use_mask) col.a*=texture(portrait_mask,UV).a; COLOR=vec4(col.rgb*brightness,col.a)*vertex_tint;}"
	var material_value:=ShaderMaterial.new();material_value.shader=shader;portrait.material=material_value
	for key in ["speaker","role","line","decision","rank","name"]:
		var label:=Label.new();label.z_index=5;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",2);label.add_theme_constant_override("shadow_outline_size",3);labels[key]=label;add_child(label)
	for key in ["tavern-reveal-skip","primary","secondary"]:
		var button:=Button.new();button.z_index=6;button.add_theme_font_size_override("font_size",14 if key=="tavern-reveal-skip" else 16)
		var style:=StyleBoxFlat.new();style.bg_color=Color("c6e4ca") if key=="primary" else Color("292630");style.border_color=Color("e5f5e8") if key=="primary" else Color("ffffff70");style.set_border_width_all(1);style.set_corner_radius_all(4)
		button.add_theme_stylebox_override("normal",style);button.add_theme_color_override("font_color",Color("17261e") if key=="primary" else Color.WHITE)
		button.pressed.connect(func():command_requested.emit(key));buttons[key]=button;add_child(button)
	cache.asset_ready.connect(_asset_ready);resized.connect(_layout);hide()

func image_info_json(path: String) -> String:
	if cache.failed.has(path):return JSON.stringify({"error":"Native reveal image failed: "+path})
	var texture: Texture2D=cache.request(path)
	if texture==null:return JSON.stringify({"ready":false})
	textures[path]=texture
	return JSON.stringify({"ready":true,"width":texture.get_width(),"height":texture.get_height()})
func alpha_sample_json(path: String) -> String:
	var texture: Texture2D=textures.get(path)
	assert(texture!=null,"Original portrait decode must precede alpha check")
	var sample: Image=texture.get_image();sample.resize(32,32,Image.INTERPOLATE_BILINEAR);sample.convert(Image.FORMAT_RGBA8)
	return JSON.stringify(Array(sample.get_data()))
func _asset_ready(path: String,texture: Texture2D) -> void:
	if not visible:return
	if path in [model.get("background",""),model.get("portrait",""),model.get("mask",""),model.get("hostImage",""),"images/board/tavern_recruit/cinematic_v1/doors.webp"]:
		textures[path]=texture;_layout();queue_redraw()
func apply_json(value: String) -> void:
	model=JSON.parse_string(value)
	for path in [model.background,model.portrait,model.mask,model.hostImage,"images/board/tavern_recruit/cinematic_v1/doors.webp"]:
		if not str(path).is_empty():image_info_json(path)
	for key in labels:labels[key].text=str(model.get(key,""))
	labels.speaker.add_theme_color_override("font_color",Color(str(model.colors.get("--tavern-host-color","#ffffff"))))
	labels.rank.add_theme_color_override("font_color",Color(str(model.colors.get("--tavern-reveal-color","#ffffff"))))
	for item in model.buttons:buttons[item.key].text=item.label;buttons[item.key].visible=item.visible;buttons[item.key].disabled=item.disabled
	var stage: String=model.stage
	var motion_name:=HostMotion.motion_name(str(model.get("motion","")))
	if model.get("ready","")!="1":host_motion_started=-1
	elif host_motion_started<0 or motion_name!=host_motion_name:host_motion_started=Time.get_ticks_msec()
	host_motion_name=motion_name
	if stage!=last_stage or (model.get("ready","")=="1" and host_alpha==0 and stage in ["invitation","accept","decline"]):
		if tween!=null:tween.kill()
		tween=create_tween().set_parallel(true)
		var angle:=19.0 if stage=="crack" else 40.0 if stage=="glow" else 105.0 if stage in ["silhouette","reveal","choice"] else 0.0
		tween.tween_property(self,"door_angle",angle,0.95).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		tween.tween_property(self,"portrait_alpha",1.0 if stage in ["silhouette","reveal","choice"] else 0.0,0.75)
		tween.tween_property(self,"portrait_brightness",1.0 if stage in ["reveal","choice"] else 0.0,0.9)
		tween.tween_property(self,"portrait_scale",1.07 if stage=="reveal" else 1.0 if stage=="choice" else 0.95 if stage=="silhouette" else 0.85,1.4)
		tween.tween_property(self,"host_alpha",1.0 if stage in ["invitation","accept","decline"] and model.get("ready","")=="1" else 0.0,0.4)
		tween.tween_property(self,"host_shift",0.0 if stage in ["invitation","accept","decline"] else -0.06,0.6)
		tween.tween_property(self,"light_alpha",0.94 if stage=="crack" else 0.85 if stage=="glow" else 0.9 if stage=="silhouette" else 0.32 if stage=="reveal" else 0.25 if stage=="choice" else 0.0,1.2)
		last_stage=stage
	show();_layout();queue_redraw()
func _process(_delta: float) -> void:
	if not visible:return
	if fx_active:
		var extent:=_scene_rect().size;vfx_frame.emit(_delta,roundf(extent.x),roundf(extent.y))
	if tween==null or not tween.is_running():
		if host_motion_started>=0 and Time.get_ticks_msec()-host_motion_started<=int(HostMotion.duration()*1000)+50:_layout_host()
		return
	_layout();queue_redraw();portal_paint.queue_redraw()
func _scene_rect() -> Rect2:
	var width:=maxf(size.x,size.y*1.5);var extent:=Vector2(width,width/1.5);return Rect2((size-extent)*0.5,extent)
func _portal_rect() -> Rect2:
	var scene:=_scene_rect();return Rect2(scene.position+scene.size*Vector2(0.345,0.09),scene.size*Vector2(0.311,0.637))
func _draw() -> void:
	if model.is_empty():return
	draw_rect(Rect2(Vector2.ZERO,size),Color("100e12"))
	var scene:=_scene_rect()
	if textures.has(model.background):draw_texture_rect(textures[model.background],scene,false,Color(0.68,0.68,0.68))
func draw_portal(canvas: Node2D) -> void:
	if model.is_empty():return
	var portal:=_portal_rect()
	if not str(model.portrait).is_empty():
		if str(model.get("vfxReady",""))!="1":
			var color:=Color(str(model.colors.get("--tavern-reveal-light","#ffffff")));color.a=light_alpha;canvas.draw_rect(portal,color)
		var doors: Texture2D=textures.get("images/board/tavern_recruit/cinematic_v1/doors.webp")
		if doors!=null and door_angle<90.0:
			for side in [0,1]:
				var width:=portal.size.x/2.0;var angle:=deg_to_rad(door_angle);var depth:=width*sin(angle);var magnification:=1200.0/(1200.0-depth)
				var hinge:=portal.position+Vector2(width*2 if side==1 else 0,portal.size.y/2)
				var direction:=-1.0 if side==1 else 1.0;var tip:=hinge+Vector2(direction*width*cos(angle)*magnification,0)
				var points:=PackedVector2Array([hinge+Vector2(0,-portal.size.y/2),tip+Vector2(0,-portal.size.y*magnification/2),tip+Vector2(0,portal.size.y*magnification/2),hinge+Vector2(0,portal.size.y/2)])
				var left:=(0.128 if side==0 else 1.128)/2.26;var right:=left+1.0/2.26
				var uv:=PackedVector2Array([Vector2(left,0.063/1.14),Vector2(right,0.063/1.14),Vector2(right,1.063/1.14),Vector2(left,1.063/1.14)])
				if side==1:uv=PackedVector2Array([uv[1],uv[0],uv[3],uv[2]])
				canvas.draw_polygon(points,PackedColorArray([Color.WHITE]),uv,doors)
func _layout_host() -> void:
	var short: bool=size.y<=500;var chopper: bool=model.get("host","")=="chopper"
	var frame_height:=size.y*(0.66 if chopper else 0.88 if short else 0.86)
	var frame_bottom:=size.y*(0.08 if chopper else 0.06 if short else 0.05)
	var frame_size:=Vector2(size.x*0.46,frame_height);var frame_origin:=Vector2(size.x*0.05,size.y-frame_bottom-frame_height)
	host_art.texture=textures.get(model.hostImage);host_art.size=frame_size
	var image_y:=0.0
	if host_art.texture!=null:
		var extent:=host_art.texture.get_size();var scale_value:=minf(host_art.size.x/extent.x,host_art.size.y/extent.y);var height:=extent.y*scale_value
		image_y=host_art.size.y-height;host_art.size.y=height
	var elapsed:=maxf(0.0,float(Time.get_ticks_msec()-host_motion_started)/1000.0) if host_motion_started>=0 else 0.0
	var motion:=HostMotion.sample(host_motion_name,elapsed);var matrix: Transform2D=motion.transform
	host_art.pivot_offset=frame_size*Vector2(0.5,0.85)-Vector2(0,image_y)
	host_art.position=frame_origin+Vector2(frame_size.x*host_shift,image_y)+matrix.origin
	host_art.rotation=matrix.get_rotation();host_art.scale=matrix.get_scale();host_art.modulate.a=host_alpha*float(motion.opacity)
func _layout() -> void:
	if model.is_empty():return
	fx.position=_scene_rect().position;portal_paint.queue_redraw()
	var short: bool=size.y<=500;var stage: String=model.stage;var portal:=_portal_rect()
	_layout_host()
	portrait.texture=textures.get(model.portrait);portrait.modulate.a=portrait_alpha;portrait.material.set_shader_parameter("brightness",portrait_brightness)
	portrait.material.set_shader_parameter("use_mask",textures.has(model.mask));if textures.has(model.mask):portrait.material.set_shader_parameter("portrait_mask",textures[model.mask])
	if stage=="choice":portrait.position=Vector2(size.x*0.08,46 if short else 66);portrait.size=Vector2(size.x*0.84,size.y-46-16-8-112 if short else size.y-66-28-16-150)
	else:
		portrait.size=Vector2(minf(portal.size.x*1.5,size.x*0.88),size.y*0.64 if short else portal.size.y*1.05)*portrait_scale
		portrait.position=Vector2(portal.get_center().x-portrait.size.x/2,portal.end.y-portrait.size.y-(portal.size.y*0.1 if short else 0))
	var speech:=Vector2(size.x*0.52,size.y*(0.27 if short else 0.34));var width:=size.x*(0.42 if short else 0.41)
	var top:=0.0
	for key in ["speaker","role","line","decision"]:
		var label: Label=labels[key];var font_size:=15 if key=="speaker" and short else 20 if key=="speaker" else 23 if key=="line" and short else 30 if key=="line" else 14
		label.add_theme_font_size_override("font_size",font_size);label.position=speech+Vector2(0,top);label.size=Vector2(width,0);label.modulate.a=host_alpha
		top+=label.get_minimum_size().y+(10 if key=="role" else 16 if key=="line" else 7)
	var caption_y:=size.y-16-112 if stage=="choice" else size.y*(0.97 if short else 0.94)-64
	for key in ["rank","name"]:
		var label: Label=labels[key];label.visible=model.caption;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.position=Vector2(size.x*0.08,caption_y);label.size=Vector2(size.x*0.84,26 if key=="rank" else 34);label.add_theme_font_size_override("font_size",18 if key=="rank" and short else 22 if key=="rank" else 26 if short else 36);caption_y+=26 if key=="rank" else 34
	buttons["tavern-reveal-skip"].position=Vector2(size.x-156,12 if short else 22);buttons["tavern-reveal-skip"].size=Vector2(140,44)
	buttons.primary.position=Vector2(size.x/2-135,size.y-60);buttons.primary.size=Vector2(130,44);buttons.secondary.position=Vector2(size.x/2+5,size.y-60);buttons.secondary.size=Vector2(130,44)
func close_surface() -> void:
	if tween!=null:tween.kill()
	hide();model={};textures.clear();portrait.texture=null;host_art.texture=null;last_stage="";host_alpha=0;portrait_alpha=0;portrait_brightness=0;door_angle=0;light_alpha=0
	host_motion_started=-1;host_shift=0;host_art.rotation=0;host_art.scale=Vector2.ONE
func test_press(key: String) -> bool:
	if not visible or not buttons.has(key) or not buttons[key].visible or buttons[key].disabled:return false
	buttons[key].pressed.emit();return true
func current_stage() -> String:return str(model.get("stage",""))
func fx_dimensions_json() -> String:var extent:=_scene_rect().size;return JSON.stringify([roundf(extent.x),roundf(extent.y)])
func set_fx_active(value: bool) -> void:
	fx_active=value
	if not value:fx.reset()
func apply_fx_frame(value: String) -> void:fx.apply_frame_json(value)
func fx_stats_json() -> String:return fx.stats_json()
