extends Control
## Original controller timing and images; rules/queue/fused stats stay in JS.
const Motion=preload("res://native_saga_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
var view: Control
var cache: Node
var timeline: Node
var epoch:=0
var starts:=0
var layouts:=0
var begun:=0
var frozen_ms:=-1
var installed:=false
var packet: Dictionary={}
var step_index:=-1
var shakes:=0
var scene_layer: Control
var visual: Control
var paints: Dictionary={}
var images: Dictionary={}
var labels: Dictionary={}
var visual_origin:=Vector2.ZERO
var heading_anchor:=Vector2.ZERO
var caption_anchor:=Vector2.ZERO
var status: Control
var cutin: Control
func _ready() -> void:
	z_index=315;mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;hide();set_process(false)
func _paint(name: String,kind: int,parent: Node,extent_padding:=0.0) -> Control:
	var container:=Control.new();container.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(container)
	var paint:=ColorRect.new();paint.mouse_filter=Control.MOUSE_FILTER_IGNORE;paint.material=ShaderMaterial.new();paint.material.shader=preload("res://native_saga_art.gdshader");paint.material.set_shader_parameter("kind",kind);paint.material.set_shader_parameter("padding",extent_padding);container.add_child(paint)
	paints[name]={"node":container,"paint":paint,"padding":extent_padding};return container
func _label(name: String,parent: Node,color: String,weight:=900) -> Label:
	var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",Fonts.weighted(weight));label.add_theme_color_override("font_color",Color(color));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",2);parent.add_child(label);labels[name]=label;return label
func _ensure() -> void:
	if scene_layer!=null:return
	cutin=preload("res://native_cinematic_cutin.gd").new();add_child(cutin)
	scene_layer=Control.new();scene_layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(scene_layer)
	_paint("layer",0,scene_layer);_paint("moon",1,scene_layer,180)
	visual=Control.new();visual.mouse_filter=Control.MOUSE_FILTER_IGNORE;scene_layer.add_child(visual)
	for name in ["before","final"]:
		var node:=Filtered.new();visual.add_child(node);node.passes[0].effect.set_shader_parameter("image_alignment",Vector2(.5,1));images[name]=node
	_paint("shock",2,visual,90)
	var sword:=Filtered.new();visual.add_child(sword);images.sword=sword
	var heading:=_paint("heading",3,scene_layer);_label("stage",heading,"ff8b8e",900);_label("title",heading,"fff1c4")
	var caption:=_paint("caption",4,scene_layer);_label("result",caption,"fff0b9");_label("effect",caption,"9affb6")
	# Source cut-in is under the fusion layer, while status-message is above it.
	status=preload("res://native_cinematic_status.gd").new();add_child(status)
	view.resized.connect(_resize)
func _box(name: String,extent: Vector2) -> void:
	var item: Dictionary=paints[name];item.node.size=extent;item.paint.position=Vector2.ONE*-float(item.padding);item.paint.size=extent+Vector2.ONE*float(item.padding)*2;item.paint.material.set_shader_parameter("extent",extent)
func _resize() -> void:
	if installed:_layout();_render(_elapsed())
func _layout() -> void:
	size=view.size;layouts+=1;scene_layer.size=size;_box("layer",size)
	status.layout(size)
	cutin.layout(size)
	var unit:=clampf(size.y/720.0,.6,1.0);var heading_height:=maxf(46,72*unit);var caption_height:=maxf(42,54*unit)
	heading_anchor=Vector2(size.x*.5,size.y*(.06 if size.y<=400 else .08))
	caption_anchor=Vector2(size.x*.5,size.y-size.y*(.05 if size.y<=400 else .07)-caption_height)
	_box("heading",Vector2(minf(760,size.x*.88),heading_height));_box("caption",Vector2(minf(720,size.x*.86),caption_height))
	var available:=maxf(60,caption_anchor.y-(heading_anchor.y+heading_height)-20)
	var authored:=Vector2(260,360) if size.x<=680 else Vector2(clampf(size.x*.35,310,520),clampf(size.y*.55,340,610))
	var factor:=minf(1,available/(authored.y*1.08));visual.size=authored*factor
	visual_origin=Vector2((size.x-visual.size.x)*.5,heading_anchor.y+heading_height+10+(available-visual.size.y)*.5);visual.position=visual_origin
	var moon_size:=minf(clampf(size.x*.37,300,560),available*1.3);_box("moon",Vector2.ONE*moon_size);_box("shock",Vector2.ONE*90*factor)
	for name in ["before","final"]:images[name].configure(cache.request(str(packet[name])),visual.size)
	var sword_extent:=Vector2(94,230) if size.x<=680 else Vector2(clampf(size.x*.14,115,220),clampf(size.y*.37,190,410))
	images.sword.configure(cache.request(str(packet.sword)),sword_extent*factor)
	var title_size:=maxi(15,int(clampf(size.x*.02,18,30)*unit));var small_size:=maxi(9,int(clampf(size.x*.0092,10,14)*unit))
	labels.stage.add_theme_font_size_override("font_size",small_size);labels.title.add_theme_font_size_override("font_size",title_size)
	labels.stage.position=Vector2(10,5);labels.stage.size=Vector2(paints.heading.node.size.x-20,small_size*1.3)
	labels.title.position=Vector2(10,small_size*1.3+8);labels.title.size=Vector2(paints.heading.node.size.x-20,heading_height-small_size*1.3-12)
	labels.result.add_theme_font_size_override("font_size",maxi(12,int(clampf(size.x*.015,14,22)*unit)));labels.effect.add_theme_font_size_override("font_size",maxi(10,int(clampf(size.x*.0108,11,16)*unit)))
	var w: float=paints.caption.node.size.x
	labels.result.position=Vector2(10,3);labels.result.size=Vector2(w-20,caption_height*.48);labels.effect.position=Vector2(10,caption_height*.48);labels.effect.size=Vector2(w-20,caption_height*.45)
func play_event(_event: Dictionary,original: Dictionary) -> String:
	_ensure();cancel();epoch+=1;var token:=epoch
	if not original.has("timeline"):return "Original Saga presentation packet required"
	var deadline:=Time.get_ticks_msec()+15000
	for name in ["before","final","sword"]:
		var path:=str(original[name])
		while cache.request(path)==null:
			if cache.failed.has(path) or Time.get_ticks_msec()>deadline:return "Original Saga art unavailable: "+path
			await get_tree().process_frame
			if token!=epoch:return ""
	packet=original;step_index=-1;shakes=0;starts+=1;installed=true;begun=Time.get_ticks_msec();_apply_step(0);_layout();_render(0);show();set_process(true)
	while token==epoch and _elapsed()<float(packet.endAt):await get_tree().process_frame
	if token!=epoch:return ""
	_apply_step(_elapsed());cancel();return ""
func _elapsed() -> float:return float(frozen_ms) if frozen_ms>=0 else float(Time.get_ticks_msec()-begun)
func _apply_step(ms: float) -> void:
	while step_index+1<packet.timeline.size() and float(packet.timeline[step_index+1].at)<=ms:
		step_index+=1;var step: Dictionary=packet.timeline[step_index]
		status.update_state(str(step.status),step.statusVisible)
		cutin.update_state(str(step.cutin),float(step.cutinAt))
		for key in ["stage","title","result","effect"]:
			var value:=str(step.heading if key=="stage" else step[key])
			if labels[key].text!=value:labels[key].text=value
		while shakes<int(step.shakes):shakes+=1;timeline.shake.play()
func _process(_delta: float) -> void:
	var elapsed:=_elapsed();_apply_step(elapsed);_render(elapsed)
func _move(node: Control,state: Dictionary,anchor: Vector2) -> void:
	var m: Transform2D=state.transform;var origin:=node.size*.5;node.position=anchor+origin+m.origin-m.basis_xform(origin);node.rotation=m.get_rotation();node.scale=m.get_scale();node.modulate.a=state.opacity
func _render(ms: float) -> void:
	var seconds:=ms/1000.0;scene_layer.modulate.a=Motion.sample("layer",seconds,size,size).opacity
	cutin.render_state(ms)
	_move(paints.moon.node,Motion.sample("moon",seconds,paints.moon.node.size,size),visual_origin+visual.size*.5)
	_move(paints.heading.node,Motion.sample("heading",seconds,paints.heading.node.size,size),heading_anchor)
	_move(paints.caption.node,Motion.sample("caption",seconds,paints.caption.node.size,size),caption_anchor)
	for name in ["before","final"]:
		var node: Control=images[name];var state:=Motion.sample(name,seconds,node.box,visual.size);node.apply_filters(state.filters);node.apply_motion(state,Vector2.ZERO)
	var sword_state:=Motion.sample("sword",seconds,images.sword.box,visual.size);images.sword.apply_filters(sword_state.filters);images.sword.apply_motion(sword_state,Vector2(sword_state.left,sword_state.top))
	_move(paints.shock.node,Motion.sample("shock",seconds,paints.shock.node.size,visual.size),visual.size*Vector2(.5,.47))
func cancel() -> void:
	epoch+=1;installed=false;frozen_ms=-1;hide();set_process(false)
	for node in images.values():node.stop()
func debug_json() -> String:
	var text: Dictionary={}
	for key in labels:text[key]=labels[key].text
	var extent:=visual.size if visual!=null else Vector2.ZERO
	return JSON.stringify({"installed":installed,"starts":starts,"layouts":layouts,"shakes":shakes,"step":step_index,"visible":visible,"text":text,"visual":[visual_origin.x,visual_origin.y,extent.x,extent.y],"heading":[heading_anchor.x,heading_anchor.y],"caption":[caption_anchor.x,caption_anchor.y],"assets":{"before":packet.get("before",""),"final":packet.get("final",""),"sword":packet.get("sword","")}})

