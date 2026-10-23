extends Control
signal shake_requested
const Motion=preload("res://native_kyubi_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Fonts=preload("res://native_fonts.gd")
var view: Control
var cache: Node
var item: Control
var elements: Dictionary={}
var words: Dictionary={}
var packet: Dictionary={}
var event_id:=""
var epoch:=0
var begun:=0
var frozen_ms:=-1
var cycle_index:=0
var settled:=false
var visual_cleared:=false
var pulse_at:=0
var starts:=0
var acknowledgements:=0
var attributes: Array=[]
var shakes: Array=[]
var statuses: Array=[]
var item_name:=""
var visual_duration:=3400
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=160
	for key in ["burst","label","cutin","status"]:
		var node:=ColorRect.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.material=ShaderMaterial.new();node.material.shader=preload("res://native_kyubi_art.gdshader");node.material.set_shader_parameter("kind",{"burst":0,"label":1,"cutin":2,"status":3}[key]);add_child(node);elements[key]=node
		if key!="burst":
			var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",Fonts.weighted(950 if key!="status" else 400));label.add_theme_color_override("font_color",Color("301406" if key=="cutin" else "fff6cc"));node.add_child(label);words[key]=label
	item=Filtered.new();add_child(item);move_child(item,1)
	item.z_index=6;elements.burst.z_index=6;elements.label.z_index=6;elements.status.z_index=115
	view.resized.connect(func():size=view.size;_layout());size=view.size;hide();set_process(false)
func _elapsed() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-begun
func play_event(event: Dictionary,display_packet: Dictionary) -> String:
	cancel();epoch+=1;var token:=epoch;packet=display_packet;event_id=str(event.get("id",""));if packet.is_empty():return "Original Kyubi attribute display packet required"
	var path:=str(event.get("itemImage","images/board/items/devon_kyubi_mask.webp"));if path.is_empty():path="images/board/items/devon_kyubi_mask.webp"
	var deadline:=Time.get_ticks_msec()+15000;var texture: Texture2D=cache.request(path)
	while texture==null and token==epoch:
		if cache.failed.has(path):cancel();return "Original Kyubi image failed: "+path
		if Time.get_ticks_msec()>deadline:cancel();return "Original Kyubi image timed out"
		await get_tree().process_frame;texture=cache.request(path)
	if token!=epoch:return ""
	item_name=str(event.get("itemName","九尾幻面"));if item_name.is_empty():item_name="九尾幻面"
	for key in ["label","cutin"]:words[key].text=item_name+"發動"
	var requested:=int(event.get("duration",3300));if requested==0:requested=3300
	visual_duration=maxi(3400,requested);begun=Time.get_ticks_msec();cycle_index=0;settled=false;visual_cleared=false;attributes.clear();shakes.clear();statuses.clear();starts+=1
	item.configure(texture,Vector2.ONE*clampf(size.x*.09,86,136));_layout();_attribute(str(packet.from),0);_status(item_name+"讓屬性開始幻化。",0);_shake(0);show();set_process(true);_tick()
	# Original rule wait ends at duration; the visible effect has its own 3400ms
	# minimum lifetime. The core's following 120ms wait is left untouched.
	while token==epoch and _elapsed()<maxi(0,requested):await get_tree().process_frame
	if token==epoch:acknowledgements+=1
	return ""
func _layout() -> void:
	if item==null:return
	var unit:=_art_scale()
	if item.source_image!=null:item.configure(item.source_image,Vector2.ONE*clampf(size.x*.09,86,136)*unit)
	elements.burst.size=Vector2.ONE*210*unit
	var label_font:=maxi(12,int(clampf(size.x*.02,18,26)*unit));words.label.add_theme_font_size_override("font_size",label_font)
	elements.label.size=Vector2(maxf(220*unit,words.label.get_theme_font("font").get_string_size(words.label.text,HORIZONTAL_ALIGNMENT_LEFT,-1,label_font).x+36*unit),maxf(46*unit,label_font*1.3+20*unit))
	var cutin_font:=maxi(16,int(25.2*unit));words.cutin.add_theme_font_size_override("font_size",cutin_font);elements.cutin.size=Vector2(minf(760,size.x*.88)*unit,maxf(65*unit,cutin_font*1.3+32*unit))
	var status_font:=maxi(11,int(11.2*unit));words.status.add_theme_font_size_override("font_size",status_font);elements.status.size=Vector2(minf(size.x*.9,maxf(180*unit,words.status.get_theme_font("font").get_string_size(words.status.text,HORIZONTAL_ALIGNMENT_LEFT,-1,status_font).x+36*unit)),maxf(41*unit,status_font*1.3+18*unit))
	for key in elements:elements[key].material.set_shader_parameter("extent",elements[key].size)
	for key in words:words[key].size=elements[key].size
	elements.status.position=Vector2((size.x-elements.status.size.x)*.5,18*unit)
func _art_scale() -> float:return maxf(.4,view.portraits.player.size.x/330.0)
func _sample(key: String,ms: int,extent: Vector2,start: Vector2,target: Vector2) -> Dictionary:
	var unit:=_art_scale();var state:=Motion.sample(key,float(ms)/1000.0-float(Motion.data.catalog[key].delay),extent/unit,size/unit,start/unit,target/unit)
	state.transform.origin*=unit;state.left*=unit;state.top*=unit
	for op in state.filters:
		if op.kind=="drop-shadow":op.x*=unit;op.y*=unit;op.blur*=unit
		elif op.kind=="blur":op.value*=unit
	return state
func _attribute(value: String,at: int) -> void:
	view.set_attribute_override(packet.displays[value]);pulse_at=at;attributes.append({"at":at,"value":value})
func _status(value: String,at: int) -> void:
	words.status.text=value;statuses.append({"at":at,"value":value});_layout()
func _shake(at: int) -> void:shakes.append(at);shake_requested.emit()
func _move(node: Control,state: Dictionary,anchor: Vector2) -> void:
	var m: Transform2D=state.transform;var origin:=node.size*.5;node.position=anchor+origin+m.origin-m.basis_xform(origin);node.rotation=m.get_rotation();node.scale=m.get_scale();node.modulate.a=state.opacity
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if packet.is_empty():return
	var ms:=_elapsed();var start:=Vector2(roundf(size.x*.52),roundf(size.y*.43));var portrait: Control=view.portraits.player;var target:=Vector2(roundf(portrait.position.x+portrait.size.x*.5),roundf(portrait.position.y+portrait.size.y*.48))
	while not settled and 1180+cycle_index*150<=mini(ms,3179):
		_attribute(str(packet.cycle[cycle_index%packet.cycle.size()]),1180+cycle_index*150);cycle_index+=1
	if ms>=3180 and not settled:_attribute(str(packet.target),3180);_status(item_name+"：屬性幻化為 "+str(packet.target)+"。",3180);_shake(3180);settled=true
	if ms<visual_duration:
		var fly:=_sample("item",ms,item.size,start,target);item.apply_filters(fly.filters);item.apply_motion(fly,Vector2(fly.left,fly.top));item.show()
		for key in ["burst","label","cutin"]:
			var state:=_sample(key,ms,elements[key].size,start,target)
			_move(elements[key],state,target if key=="burst" else Vector2(size.x*.5,size.y*(.28 if key=="label" else .18)));elements[key].show()
		view.hud.player.attribute.pulse(Motion.sample("pulse",float(ms-pulse_at)/1000.0,view.hud.player.attribute.size,size))
	elif not visual_cleared:
		visual_cleared=true;event_id="";item.hide();item.stop()
		for key in ["burst","label","cutin"]:elements[key].hide()
		view.clear_attribute_override()
	elements.status.visible=not statuses.is_empty() and ms<int(statuses[-1].at)+2300
	if ms>=maxi(visual_duration,5480):hide();set_process(false);event_id=""
func cancel() -> void:
	epoch+=1;event_id="";packet={};hide();set_process(false)
	if item!=null:item.stop()
	if view!=null and not view.hud.is_empty():view.clear_attribute_override()
func test_state_json() -> String:
	return JSON.stringify({"visible":visible,"visualVisible":visible and not visual_cleared,"eventId":event_id,"starts":starts,"acknowledgements":acknowledgements,"attributes":attributes,"shakes":shakes,"statuses":statuses,"attribute":view.hud.player.attribute.text,"matchup":view.matchup.text,"nodeId":item.get_instance_id(),"hudId":view.hud.player.panel.get_instance_id(),"attributeId":view.hud.player.attribute.get_instance_id(),"elapsed":_elapsed()})
func test_pixel_digest() -> String:
	var hash:=HashingContext.new();hash.start(HashingContext.HASH_SHA256);hash.update(get_viewport().get_texture().get_image().get_data());return hash.finish().hex_encode()
