extends Control
## Authored Sanji timing and artwork; source core owns eligibility and form state.
signal shake_requested
const Motion=preload("res://native_sanji_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
const DEFAULTS={"before":"images/board/battle/portraits/evolutions/sanji_evolution_2/normal.webp","final":"images/board/battle/portraits/evolutions/sanji_stealth_black/normal.webp","item":"images/board/items/postgame_boss_relics/judge_germa66_battle_suit.webp"}
var cache: Node
var elements: Dictionary={}
var anchors: Dictionary={}
var paths: Dictionary={}
var labels: Dictionary={}
var event_id:=""
var epoch:=0
var begun:=0
var frozen_ms:=-1
var fired: Array[int]=[]
var completions:=0
var starts:=0
var ready_art:=false
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;z_index=520
	for key in ["backdrop","ring","sweep"]:
		var node:=ColorRect.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.material=ShaderMaterial.new();node.material.shader=preload("res://native_sanji_backdrop.gdshader") if key=="backdrop" else preload("res://native_sanji_ring.gdshader")
		if key=="sweep":node.material.set_shader_parameter("sweep",true)
		add_child(node);elements[key]=node
	for key in ["before","final","item"]:
		var node:=Filtered.new();add_child(node);elements[key]=node
	for key in ["heading","caption"]:
		var node:=Control.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(node);elements[key]=node
	for key in ["kicker","title","name","effect"]:
		var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",Fonts.weighted(950));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_y",3)
		if key in ["kicker","title"]:elements.heading.add_child(label)
		else:elements.caption.add_child(label)
		labels[key]=label
	labels.kicker.text="GERMA 66"
	for key in labels:labels[key].add_theme_color_override("font_color",Color({"kicker":"67e9ff","title":"fff1c5","name":"ffdd82","effect":"7ff1ff"}[key]))
	resized.connect(_layout);hide();set_process(false)
func warm(event: Dictionary) -> void:
	var fields:={"before":"beforePortrait","final":"finalPortrait","item":"itemImage"}
	for key in fields:
		paths[key]=str(event.get(fields[key],DEFAULTS[key]));if paths[key].is_empty():paths[key]=DEFAULTS[key]
		cache.request(paths[key])
func play_event(event: Dictionary) -> String:
	cancel();epoch+=1;var token:=epoch;event_id=str(event.get("id",""));warm(event)
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var complete:=true
		for key in paths:
			if cache.failed.has(paths[key]):cancel();return "Sanji original image failed: "+str(paths[key])
			if cache.request(paths[key])==null:complete=false
		if complete:break
		if Time.get_ticks_msec()>deadline:cancel();return "Sanji original images timed out"
		await get_tree().process_frame
	if token!=epoch:return ""
	for pair in [["title","title","戰鬥服變身"],["name","finalName","隱形黑・Stealth Black"],["effect","effectText","光學迷彩啟動・戰鬥能力全面提升"]]:labels[pair[0]].text=str(event.get(pair[1],pair[2])) if not str(event.get(pair[1],"")).is_empty() else pair[2]
	begun=Time.get_ticks_msec();fired.clear();ready_art=true;_layout();starts+=1;show();set_process(true);_tick()
	var requested:=int(event.get("duration",5000));var duration:=maxi(4200,requested if requested!=0 else 5000)
	while token==epoch and _elapsed()<duration:await get_tree().process_frame
	if token==epoch:completions+=1;cancel()
	return ""
func _elapsed() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-begun
func _layout() -> void:
	if not ready_art:return
	var small:=size.x<=680 or size.y<=520;var visual:=Vector2(250 if small else clampf(size.x*.34,300,520),size.y*.76 if small else minf(size.y*.75,650));var center:=size*Vector2(.5,.51 if small else .53);var item_size:=72.0 if small else clampf(size.x*.1,88,150)
	elements.backdrop.size=size;elements.backdrop.material.set_shader_parameter("extent",size);anchors.backdrop=Vector2.ZERO
	for key in ["ring","sweep"]:
		var diameter:=clampf(size.x*.4,300,620);elements[key].size=Vector2.ONE*diameter;elements[key].material.set_shader_parameter("diameter",diameter);anchors[key]=size*Vector2(.5,.49)
	for key in ["before","final","item"]:
		var box: Vector2=Vector2.ONE*item_size if key=="item" else visual;elements[key].configure(cache.request(paths[key]),box)
		elements[key].passes[0].effect.set_shader_parameter("image_alignment",Vector2(.5,.5 if key=="item" else 1.0));elements[key].passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
		anchors[key]=center-visual*.5
	var width:=minf(760,size.x*.88);elements.heading.size=Vector2(width,64 if small else 92);anchors.heading=Vector2(size.x*.5,size.y*(.03 if small else .065))
	labels.kicker.position=Vector2(20,9);labels.kicker.size=Vector2(width-40,14 if small else 20);labels.kicker.add_theme_font_size_override("font_size",8 if small else int(clampf(size.x*.0095,10,14)))
	labels.title.position=Vector2(20,27 if small else 33);labels.title.size=Vector2(width-40,23 if small else 44);labels.title.add_theme_font_size_override("font_size",15 if small else int(clampf(size.x*.022,20,32)))
	var caption_width:=minf(720,size.x*.86);elements.caption.size=Vector2(caption_width,34 if small else 40);anchors.caption=Vector2(size.x*.5,size.y*(.97 if small else .945)-elements.caption.size.y)
	labels.name.position=Vector2.ZERO;labels.name.size=Vector2(caption_width if small else caption_width*.5-7,18 if small else 40);labels.name.add_theme_font_size_override("font_size",12 if small else int(clampf(size.x*.0165,16,24)))
	labels.effect.position=Vector2(0,20) if small else Vector2(caption_width*.5+7,0);labels.effect.size=Vector2(caption_width if small else caption_width*.5-7,14 if small else 40);labels.effect.add_theme_font_size_override("font_size",9 if small else int(clampf(size.x*.0108,11,16)))
	_tick()
func _move(node: Control,value: Dictionary,anchor: Vector2) -> void:
	var m: Transform2D=value.transform;var origin:=node.size*.5;node.position=anchor+origin+m.origin-m.basis_xform(origin);node.rotation=m.get_rotation();node.scale=m.get_scale();node.modulate.a=value.opacity
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if not ready_art:return
	var ms:=_elapsed();var small:=size.x<=680 or size.y<=520;var visual:=Vector2(250 if small else clampf(size.x*.34,300,520),size.y*.76 if small else minf(size.y*.75,650))
	for key in elements:
		var node: Control=elements[key];var motion: Dictionary=Motion.data.catalog[key];var sample:=Motion.sample(key,float(ms)/1000.0-motion.delay,node.size,visual);var anchor: Vector2=anchors[key]
		if key=="item":anchor+=Vector2(sample.left,sample.top)
		if key=="backdrop":modulate.a=sample.opacity;sample.opacity=1.0
		if key in ["before","final","item"]:node.apply_filters(sample.filters);node.apply_motion(sample,anchor)
		else:_move(node,sample,anchor)
	for at in [2050,2630]:
		if ms>=at and not fired.has(at):fired.append(at);shake_requested.emit()
func cancel() -> void:
	epoch+=1;event_id="";ready_art=false;hide();set_process(false)
	for key in ["before","final","item"]:
		if elements.has(key):elements[key].stop()
func test_state_json() -> String:
	return JSON.stringify({"visible":visible,"id":event_id,"starts":starts,"completions":completions,"shakes":fired,"elapsed":_elapsed(),"paths":paths,"imageIds":[elements.before.get_instance_id(),elements.final.get_instance_id(),elements.item.get_instance_id()],"texts":{"title":labels.title.text,"name":labels.name.text,"effect":labels.effect.text}})
func test_pixel_digest() -> String:
	var hash:=HashingContext.new();hash.start(HashingContext.HASH_SHA256);hash.update(get_viewport().get_texture().get_image().get_data());return hash.finish().hex_encode()
