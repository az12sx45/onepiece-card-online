extends Control
## Full-screen original story art, driven by the unchanged JS story controller.
signal advance_requested
signal asset_error(message: String)
const Fonts=preload("res://native_fonts.gd")
const Ease=preload("res://native_evolution_motion.gd")
var cache: Node
var picture:=TextureRect.new()
var shade:=ColorRect.new()
var flash:=ColorRect.new()
var background:=ColorRect.new()
var badge:=PanelContainer.new()
var badge_label:=Label.new()
var copy:=Control.new()
var labels: Dictionary={}
var bars: Array[Panel]=[]
var model: Dictionary={}
var last_json:=""
var layouts:=0
var updates:=0
var image_changes:=0
var requested_image:=""
var loaded_image:=""
var motions: Dictionary={}
var flash_started:=-1.0
var flash_revision:=-1
var scale_ratio:=1.0
var bar_motions: Array=[]

func _ready() -> void:
	z_index=520;mouse_filter=Control.MOUSE_FILTER_STOP;focus_mode=Control.FOCUS_ALL;clip_contents=true
	background.color=Color("02040a");background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background)
	picture.mouse_filter=Control.MOUSE_FILTER_IGNORE;picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;picture.material=ShaderMaterial.new();picture.material.shader=preload("res://native_zephyr_story.gdshader");picture.material.set_shader_parameter("kind",1);add_child(picture)
	shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;shade.material=ShaderMaterial.new();shade.material.shader=preload("res://native_zephyr_story.gdshader");add_child(shade)
	flash.color=Color("fff2ff");flash.mouse_filter=Control.MOUSE_FILTER_IGNORE;flash.modulate.a=0;add_child(flash)
	badge.mouse_filter=Control.MOUSE_FILTER_IGNORE;var style:=StyleBoxFlat.new();style.bg_color=Color(2.0/255,6.0/255,16.0/255,.78);style.border_color=Color(1,213.0/255,126.0/255,.68);style.set_border_width_all(1);style.set_corner_radius_all(99);style.shadow_color=Color(1,90.0/255,198.0/255,.22);style.shadow_size=12;badge.add_theme_stylebox_override("panel",style);add_child(badge)
	badge_label.text="炸藥岩引爆";badge_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;badge_label.add_theme_color_override("font_color",Color("ffe3a8"));badge.add_child(badge_label)
	copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(copy)
	for key in ["kicker","title","line","hint"]:
		var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.add_theme_color_override("font_color",Color({"kicker":"ffb6df","title":"fff7ed","line":"e9e6ee","hint":"eceef7"}[key]));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",3);copy.add_child(label);labels[key]=label
	labels.hint.modulate.a=.62
	for i in range(5):
		var bar:=Panel.new();bar.mouse_filter=Control.MOUSE_FILTER_IGNORE;var bar_style:=StyleBoxFlat.new();bar_style.set_corner_radius_all(99);bar.add_theme_stylebox_override("panel",bar_style);copy.add_child(bar);bars.append(bar)
	resized.connect(_layout);hide();set_process(false)

func preload_asset(path: String) -> void:cache.request(path)

func _font(label: Label,size_value: int,weight: int,spacing: float,serif:=false) -> void:
	var font:=FontVariation.new();font.base_font=Fonts.base();font.variation_opentype={2003265652:weight};font.spacing_glyph=int(round(spacing))
	if serif:
		var system_font:=SystemFont.new();system_font.font_names=PackedStringArray(["Noto Serif TC","PMingLiU","serif"]);system_font.font_weight=weight;system_font.fallbacks=[Fonts.base()];font.base_font=system_font
	label.add_theme_font_override("font",font);label.add_theme_font_size_override("font_size",size_value)

func _layout(animate_progress:=false) -> void:
	if not is_node_ready():return
	layouts+=1;background.size=size;picture.size=size;picture.pivot_offset=size*.5;shade.size=size;flash.size=size
	# Preserve the desktop full-frame composition, reducing only typography and
	# spacing on a short landscape screen so every line remains on screen.
	scale_ratio=clampf(size.y/720.0,.58,1.0)
	var sizes: Dictionary={"kicker":maxi(13,int(19*scale_ratio)),"title":maxi(30,int(58*scale_ratio)),"line":maxi(16,int(24*scale_ratio)),"hint":maxi(11,int(13*scale_ratio))}
	_font(badge_label,maxi(11,int(15*scale_ratio)),800,15*scale_ratio*.15)
	var style: StyleBoxFlat=badge.get_theme_stylebox("panel");style.content_margin_left=14*scale_ratio;style.content_margin_right=14*scale_ratio;style.content_margin_top=8*scale_ratio;style.content_margin_bottom=8*scale_ratio;badge.reset_size();badge.position=Vector2(22,20)*scale_ratio
	for key in labels:_font(labels[key],sizes[key],900 if key=="kicker" else 700 if key=="title" else 400,sizes[key]*{"kicker":.3,"title":.08,"line":.06,"hint":.1}[key],key=="title")
	var width:=minf(size.x*.88,1080);var y:=0.0
	for key in ["kicker","title","line"]:
		if key=="title":y+=6*scale_ratio
		if key=="line":y+=12*scale_ratio
		var label: Label=labels[key];var font: Font=label.get_theme_font("font");var measured:=font.get_multiline_string_size(label.text,HORIZONTAL_ALIGNMENT_CENTER,width,sizes[key]);var height:=maxf(measured.y,sizes[key]*(1.5 if key=="line" else 1.12 if key=="title" else 1.25))
		label.position=Vector2(0,y);label.size=Vector2(width,ceilf(height));y+=label.size.y
	y+=16*scale_ratio
	var total_width: float=(52+4*28+4*9)*scale_ratio;var left: float=(width-total_width)*.5
	bar_motions.clear()
	for i in range(bars.size()):
		var bar: Panel=bars[i];var active: bool=i==int(model.get("index",0));var bar_style: StyleBoxFlat=bar.get_theme_stylebox("panel")
		var before: Dictionary={"position":bar.position,"size":bar.size,"color":bar_style.bg_color,"shadow":bar_style.shadow_color}
		bar_style.bg_color=Color("ff71c2") if active else Color(1,1,1,.26);bar_style.shadow_color=Color(1,67.0/255,183.0/255,.8) if active else Color.TRANSPARENT;bar_style.shadow_size=7;bar.position=Vector2(left,y);bar.size=Vector2((52 if active else 28)*scale_ratio,3);left+=bar.size.x+9*scale_ratio
		if animate_progress:
			bar_motions.append({"bar":bar,"style":bar_style,"from":before,"to":{"position":bar.position,"size":bar.size,"color":bar_style.bg_color,"shadow":bar_style.shadow_color},"start":Time.get_ticks_msec()})
			bar.position=before.position;bar.size=before.size;bar_style.bg_color=before.color;bar_style.shadow_color=before.shadow
	y+=3+10*scale_ratio;var hint_height: float=labels.hint.get_theme_font("font").get_multiline_string_size(labels.hint.text,HORIZONTAL_ALIGNMENT_CENTER,width,sizes.hint).y;labels.hint.position=Vector2(0,y);labels.hint.size=Vector2(width,ceilf(hint_height));y+=labels.hint.size.y
	copy.size=Vector2(width,y);copy.position=Vector2((size.x-width)*.5,maxf(0,size.y-38*scale_ratio-y))

func _sample(key: String,now: float) -> float:
	if not motions.has(key):return picture.modulate.a if key=="opacity" else picture.scale.x
	var m: Dictionary=motions[key];var progress:=clampf((now-m.start)/maxf(1,m.duration),0,1);return lerpf(m.from,m.to,Ease._ease(progress,m.curve))

func _transition(key: String,target: float,duration: float,range_value: float,curve: Array) -> void:
	var now:=float(Time.get_ticks_msec());var current:=_sample(key,now)
	motions[key]={"from":current,"to":target,"start":now,"duration":duration*absf(target-current)/range_value,"curve":curve}

func apply_source_json(value: String) -> void:
	if value==last_json:return
	last_json=value;updates+=1;var next: Dictionary=JSON.parse_string(value)
	if not next.get("visible",false):model=next;close_surface();return
	var is_new: bool=next.get("eventId")!=model.get("eventId");var changing: bool=next.get("changing",false)
	if is_new:motions.clear();picture.modulate.a=1;picture.scale=Vector2.ONE;flash_started=-1;flash.modulate.a=0;flash_revision=-1
	if not is_new and changing!=bool(model.get("changing",false)):
		_transition("opacity",0 if changing else 1,420,1,[.25,.1,.25,1]);_transition("scale",1.028 if changing else 1,4800,.028,[0,0,.58,1])
	var layout_changed: bool=is_new or next.get("index")!=model.get("index") or next.get("hint")!=model.get("hint")
	var animate_progress: bool=not is_new and next.get("index")!=model.get("index")
	model=next
	for key in labels:labels[key].text=str(model.get(key,""))
	requested_image=str(model.get("image",""));_load_image()
	if int(model.get("flashRevision",0))!=flash_revision:
		flash_revision=int(model.get("flashRevision",0));if model.get("flash",false):flash_started=Time.get_ticks_msec()
	if layout_changed:_layout(animate_progress)
	show();set_process(true)

func _load_image() -> void:
	if requested_image==loaded_image or requested_image.is_empty():return
	if cache.failed.has(requested_image):var path:=requested_image;requested_image="";asset_error.emit("Original Zephyr story image failed: "+path);return
	var texture: Texture2D=cache.request(requested_image)
	if texture!=null:picture.texture=texture;loaded_image=requested_image;image_changes+=1

func _process(_delta: float) -> void:
	_load_image();var now:=float(Time.get_ticks_msec());var active:=requested_image!=loaded_image
	for key in motions.keys():
		var value:=_sample(key,now)
		if key=="opacity":picture.modulate.a=value
		else:picture.scale=Vector2.ONE*value
		if now>=motions[key].start+motions[key].duration:motions.erase(key)
		else:active=true
	for i in range(bar_motions.size()-1,-1,-1):
		var m: Dictionary=bar_motions[i];var progress:=clampf((now-m.start)/240.0,0,1);var eased:=Ease._ease(progress,[.25,.1,.25,1]);m.bar.position=m.from.position.lerp(m.to.position,eased);m.bar.size=m.from.size.lerp(m.to.size,eased);m.style.bg_color=m.from.color.lerp(m.to.color,eased);m.style.shadow_color=m.from.shadow.lerp(m.to.shadow,eased)
		if progress>=1:bar_motions.remove_at(i)
		else:active=true
	if flash_started>=0:
		var progress:=clampf((now-flash_started)/560.0,0,1);var frame:=Ease.segment([{"time":0.0,"value":.92},{"time":.28,"value":.42},{"time":1.0,"value":0.0}],progress,[0,0,.58,1]);flash.modulate.a=lerpf(frame[0],frame[1],frame[2]);active=true
		if progress>=1:flash_started=-1;flash.modulate.a=0
	set_process(active)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT and not event.pressed:advance_requested.emit();accept_event()
	elif event is InputEventScreenTouch and not event.pressed:advance_requested.emit();accept_event()

func _unhandled_key_input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.keycode in [KEY_RIGHT,KEY_SPACE,KEY_ENTER]:advance_requested.emit();get_viewport().set_input_as_handled()

func close_surface() -> void:
	motions.clear();bar_motions.clear();flash_started=-1;hide();set_process(false)

func debug_json() -> String:
	var boxes: Dictionary={};for key in labels:boxes[key]=[copy.position.x+labels[key].position.x,copy.position.y+labels[key].position.y,labels[key].size.x,labels[key].size.y]
	return JSON.stringify({"visible":visible,"index":model.get("index",0),"changing":model.get("changing",false),"finished":model.get("finished",false),"event":model.get("eventId",""),"loaded":loaded_image,"requested":requested_image,"updates":updates,"layouts":layouts,"imageChanges":image_changes,"boxes":boxes,"processing":is_processing()})
