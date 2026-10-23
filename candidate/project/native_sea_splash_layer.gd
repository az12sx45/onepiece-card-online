extends Control
const Ease=preload("res://native_evolution_motion.gd")
var model: Dictionary={}
var catalog: Dictionary
var started: int=-1
var closing: int=-1
var backdrop:=ColorRect.new()
var brush:=Control.new()
var name_line:=Label.new()
var attack_line:=Label.new()
var stroke:=ColorRect.new()
var baseline: Array[Vector2]=[]
func _ready() -> void:
	catalog=JSON.parse_string(FileAccess.get_file_as_string("res://sea-splash-motion.json")).catalog
	mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true
	backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE;backdrop.material=ShaderMaterial.new();backdrop.material.shader=preload("res://native_sea_splash_bg.gdshader");add_child(backdrop)
	brush.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(brush)
	for label in [name_line,attack_line]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(850));label.add_theme_color_override("font_color",Color.WHITE);brush.add_child(label)
	name_line.text=model.name;attack_line.text=model.attack
	stroke.mouse_filter=Control.MOUSE_FILTER_IGNORE;stroke.material=ShaderMaterial.new();stroke.material.shader=preload("res://native_sea_splash_stroke.gdshader");brush.add_child(stroke)
	resized.connect(_layout);_layout();modulate.a=0;set_process(false)
func _layout() -> void:
	if catalog.is_empty():return
	var factor:=preload("res://native_screen_metrics.gd").css_factor(get_viewport());var viewport:=size*factor
	backdrop.size=size;backdrop.material.set_shader_parameter("extent",viewport)
	var title:=clampf(viewport.x*.075,46,120)/factor;var attack:=clampf(viewport.x*.052,32,88)/factor
	name_line.add_theme_font_size_override("font_size",roundi(title));attack_line.add_theme_font_size_override("font_size",roundi(attack))
	var width:=maxf(name_line.get_minimum_size().x,attack_line.get_minimum_size().x)+96/factor
	var height: float=(title+attack)*1.05+20/factor+4/factor+68/factor
	brush.size=Vector2(width,height);brush.pivot_offset=brush.size*.5;brush.position=(size-brush.size)*.5;brush.rotation=deg_to_rad(-6);brush.scale=Vector2.ONE*.98
	name_line.position=Vector2(0,34/factor);name_line.size=Vector2(width,title*1.05)
	attack_line.position=Vector2(0,name_line.position.y+name_line.size.y+10/factor);attack_line.size=Vector2(width,attack*1.05)
	stroke.size=Vector2(minf(620,viewport.x*.72),4)/factor;stroke.position=Vector2((width-stroke.size.x)*.5,attack_line.position.y+attack_line.size.y+10/factor);stroke.modulate.a=.72
	baseline=[name_line.position,attack_line.position]
	for label in [name_line,attack_line]:label.pivot_offset=label.size*.5
func sample(key: String,time: float) -> Dictionary:
	var track: Dictionary=catalog[key];var at:=clampf((time-track.delay)/track.duration,0,1);var frames: Array=track.frames;var a: Dictionary=frames[0];var b: Dictionary=frames[-1]
	for i in range(frames.size()-1):
		if at<=float(frames[i+1].time):a=frames[i];b=frames[i+1];break
	var p:=Ease._ease(clampf((at-a.time)/maxf(.00001,b.time-a.time),0,1),track.easing);var value: Dictionary={}
	for key_name in ["opacity","x","scale","blur","contrast"]:value[key_name]=lerpf(a[key_name],b[key_name],p)
	return value
func start() -> void:started=Time.get_ticks_msec();set_process(true);_process(0)
func begin_close() -> void:closing=Time.get_ticks_msec()
func _process(_delta: float) -> void:
	if started<0:return
	var elapsed: float=(Time.get_ticks_msec()-started)/1000.0
	modulate.a=1.0-Ease._ease(clampf((Time.get_ticks_msec()-closing)/522.0,0,1),[.25,.1,.25,1]) if closing>=0 else Ease._ease(clampf(elapsed/.324,0,1),[.25,.1,.25,1])
	for i in range(2):
		var label: Label=[name_line,attack_line][i];var pose:=sample(["name","attack"][i],elapsed);label.position=baseline[i]+Vector2(pose.x/100*size.x,0);label.scale=Vector2.ONE*pose.scale;label.modulate.a=pose.opacity
	var ink:=sample("ink",elapsed);var slash_a:=sample("slashA",elapsed);var slash_b:=sample("slashB",elapsed)
	backdrop.material.set_shader_parameter("ink",Vector3(ink.opacity,ink.scale,ink.contrast));backdrop.material.set_shader_parameter("slash_a",Vector2(slash_a.opacity,slash_a.scale));backdrop.material.set_shader_parameter("slash_b",Vector2(slash_b.opacity,slash_b.scale))
