extends Control
signal geometry_changed(value: String)
const Motion=preload("res://native_bullet_motion.gd")
const Fonts=preload("res://native_fonts.gd")
var view: Control
var cache: Node
var timeline: Node
var layer: Control
var heading: Control
var heading_label: Label
var target: Control
var target_image: TextureRect
var target_halo: Control
var banner: Control
var banner_image: TextureRect
var banner_label: Label
var cards: Array=[]
var sockets: Array=[]
var flights: Array=[]
var flight_motion: Array=[]
var motion_compilations:=0
var packet: Dictionary={}
var installed:=false
var epoch:=0
var begun:=0
var frozen_ms:=-1
var starts:=0
var layouts:=0
var step_index:=-1
var shakes:=0
var banner_at:=-1.0
var banner_signature:=""
var heading_anchor:=Vector2.ZERO
var target_anchor:=Vector2.ZERO
var banner_anchor:=Vector2.ZERO
var target_extent:=Vector2.ZERO
var status: Control
var cutin: Control
func _ready() -> void:
	z_index=315;mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true;hide();set_process(false)
func _panel(kind: int,parent: Node,padding:=30.0) -> Control:
	var node:=Control.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(node)
	var paint:=ColorRect.new();paint.name="Paint";paint.mouse_filter=Control.MOUSE_FILTER_IGNORE;paint.material=ShaderMaterial.new();paint.material.shader=preload("res://native_bullet_art.gdshader");paint.material.set_shader_parameter("kind",kind);paint.material.set_shader_parameter("padding",padding);node.add_child(paint);node.set_meta("padding",padding);return node
func _box(node: Control,extent: Vector2) -> void:
	node.size=extent;var paint: ColorRect=node.get_node("Paint");var padding: float=node.get_meta("padding")
	paint.position=Vector2.ONE*-padding;paint.size=extent+Vector2.ONE*padding*2;paint.material.set_shader_parameter("extent",extent)
func _image(parent: Node,cover:=false,radius:=0.0) -> TextureRect:
	var node:=TextureRect.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.material=ShaderMaterial.new();node.material.shader=preload("res://native_bullet_image.gdshader");node.material.set_shader_parameter("cover",cover);node.material.set_shader_parameter("radius",radius);parent.add_child(node);return node
func _image_box(node: TextureRect,extent: Vector2) -> void:
	node.size=extent;node.material.set_shader_parameter("extent",extent)
func _label(parent: Node,color: String,center:=false) -> Label:
	var node:=Label.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;node.add_theme_font_override("font",Fonts.weighted(900));node.add_theme_color_override("font_color",Color(color));node.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	if center:node.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(node);return node
func _ensure() -> void:
	if layer!=null:return
	cutin=preload("res://native_cinematic_cutin.gd").new();add_child(cutin)
	layer=_panel(0,self,0);heading=_panel(1,layer);heading.z_index=4;heading_label=_label(heading,"fff0bd",true)
	target=Control.new();target.mouse_filter=Control.MOUSE_FILTER_IGNORE;target.z_index=3;layer.add_child(target);target_halo=_panel(7,target,90);target_image=_image(target,true);target_image.material.set_shader_parameter("radius",999.0)
	for i in range(6):
		var card:=_panel(2,layer);card.z_index=2;var portrait:=_image(card,true,7);portrait.material.set_shader_parameter("alignment",Vector2(.5,.18))
		var name_label:=_label(card,"ffe1a0");var item_label:=_label(card,"86d3d6");name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;item_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
		var item:=_panel(4,card,15);var item_image:=_image(item);cards.append({"node":card,"portrait":portrait,"name":name_label,"item_name":item_label,"item":item,"image":item_image,"origin":Vector2.ZERO})
		var socket:=_panel(3,target,14);var socket_image:=_image(socket,true);sockets.append({"node":socket,"image":socket_image,"filled":-1.0,"origin":Vector2.ZERO})
		var flight:=_panel(5,layer);flight.z_index=12;var flight_image:=_image(flight);flight.hide();flights.append({"node":flight,"image":flight_image})
	banner=_panel(6,layer);banner.z_index=6;banner_image=_image(banner);banner_label=_label(banner,"eefbfa",true);banner_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	status=preload("res://native_cinematic_status.gd").new();add_child(status)
	view.resized.connect(_resize)
func _layout() -> void:
	size=view.size;layouts+=1;_box(layer,size)
	status.layout(size)
	cutin.layout(size)
	var short:=size.y<=520;var heading_height:=36.0 if short else 54.0
	heading_anchor=Vector2(size.x*.5,size.y*(.07 if short else .17));_box(heading,Vector2(size.x*(.86 if short else .72),heading_height));heading_label.position=Vector2(12,0);heading_label.size=heading.size-Vector2(24,0);heading_label.add_theme_font_size_override("font_size",15 if short else int(clampf(size.x*.02,17,29)))
	var banner_height:=maxf(52,size.y*.095);banner_anchor=Vector2(size.x*.5,size.y*.96-banner_height);_box(banner,Vector2(size.x*.86,banner_height));_image_box(banner_image,Vector2.ONE*(32 if short else 40));banner_image.position=Vector2(12,(banner_height-banner_image.size.y)*.5)
	banner_label.position=Vector2(52 if short else 64,4);banner_label.size=Vector2(banner.size.x-banner_label.position.x-12,banner_height-8);banner_label.add_theme_font_size_override("font_size",10 if short else int(clampf(size.x*.011,11,16)))
	var rail_origin:=Vector2(size.x*(.035 if short else .045),size.y*(.30 if short else .34));var rail_width:=size.x*(.52 if short else .48);var gap:=6.0 if short else 10.0
	var card_extent:=Vector2((rail_width-gap*2)/3.0,minf(clampf(size.y*.1,72,108),(banner_anchor.y-rail_origin.y-12-gap)/2.0));var copy_x:=card_extent.x*.42+7;var copy_width:=maxf(8,card_extent.x-copy_x-5)
	var item_side:=minf(28 if short else clampf(size.x*.03,28,44),card_extent.y-35)
	for i in range(6):
		var card: Dictionary=cards[i];card.origin=rail_origin+Vector2((i%3)*(card_extent.x+gap),(i/3)*(card_extent.y+gap));_box(card.node,card_extent)
		card.portrait.position=Vector2(4,4);_image_box(card.portrait,Vector2(card_extent.x*.42-4,card_extent.y-8))
		card.name.position=Vector2(copy_x,3);card.name.size=Vector2(copy_width,14);card.name.add_theme_font_size_override("font_size",9 if short else int(clampf(size.x*.009,9,13)))
		card.item_name.position=Vector2(copy_x,17);card.item_name.size=Vector2(copy_width,12);card.item_name.add_theme_font_size_override("font_size",8 if short else int(clampf(size.x*.0072,8,11)))
		card.item.position=Vector2(copy_x,card_extent.y-item_side-4);_box(card.item,Vector2.ONE*item_side);_image_box(card.image,card.item.size)
		_box(flights[i].node,Vector2.ONE*clampf(size.x*.042,34,66));_image_box(flights[i].image,flights[i].node.size)
	target_extent=Vector2.ONE*minf(clampf(size.x*.15,132,224),banner_anchor.y-heading_anchor.y-heading_height-24);target.size=target_extent;_image_box(target_image,target_extent);target_image.material.set_shader_parameter("radius",target_extent.x*.5)
	_box(target_halo,target_extent)
	target_anchor=Vector2(size.x*(.78 if short else .73),size.y*(.48 if short else .43))
	var positions: Array=[Vector2(.5,.21),Vector2(.5,.43),Vector2(.24,.51),Vector2(.76,.51),Vector2(.37,.74),Vector2(.63,.74)]
	for i in range(6):
		var socket: Dictionary=sockets[i];_box(socket.node,target_extent*.9*.18);socket.origin=target_extent*.05+target_extent*.9*positions[i]-socket.node.size*.5;socket.node.position=socket.origin;_image_box(socket.image,socket.node.size-Vector2(4,4));socket.image.position=Vector2(2,2);socket.image.material.set_shader_parameter("radius",socket.image.size.x*.5)
func _matrix(state: Dictionary,extent: Vector2,anchor: Vector2) -> Transform2D:
	var m: Transform2D=state.transform;var origin:=extent*.5;m.origin=anchor+origin+m.origin-m.basis_xform(origin);return m
func _rect(value: Rect2) -> Dictionary:return {"left":value.position.x,"top":value.position.y,"width":value.size.x,"height":value.size.y}
func geometry_json() -> String:
	_ensure();_layout();var sources: Array=[];var targets: Array=[]
	var target_matrix:=_matrix(Motion.sample("target",.98,target_extent),target_extent,target_anchor)
	for i in range(6):
		var card: Dictionary=cards[i];var transform:=_matrix(Motion.sample("card",.98-i*.09,card.node.size),card.node.size,card.origin)
		sources.append(_rect(transform*Rect2(card.item.position,card.item.size)));targets.append(_rect(target_matrix*Rect2(sockets[i].origin,sockets[i].node.size)))
	return JSON.stringify({"stage":_rect(Rect2(Vector2.ZERO,size)),"sources":sources,"targets":targets})
func _resize() -> void:
	if installed:geometry_changed.emit(geometry_json())
func replace_packet_json(value: String) -> void:
	if not installed:return
	packet=JSON.parse_string(value);_compile_flights();_render(_elapsed())
func _compile_flights() -> void:
	flight_motion.clear();motion_compilations+=1
	for flight in packet.flights:flight_motion.append(Motion.compile_flight(flight))
func _assets(original: Dictionary) -> Array[String]:
	var result: Array[String]=[str(original.icon)]
	for card in original.cards:
		for key in ["portrait","item"]:
			if card[key] and not result.has(card[key]):result.append(card[key])
	return result
func play_event(_event: Dictionary,original: Dictionary) -> String:
	_ensure();cancel();epoch+=1;var token:=epoch
	if not original.has("timeline"):return "Original Bullet packet required"
	var deadline:=Time.get_ticks_msec()+15000
	for path in _assets(original):
		while cache.request(path)==null:
			if cache.failed.has(path) or Time.get_ticks_msec()>deadline:return "Original Bullet art unavailable: "+path
			await get_tree().process_frame
			if token!=epoch:return ""
	packet=original;_compile_flights();step_index=-1;shakes=0;banner_at=-1;banner_signature="";starts+=1;begun=Time.get_ticks_msec();_layout()
	heading_label.text=str(packet.title);target_image.texture=cache.request(str(packet.icon))
	for i in range(6):
		var card: Dictionary=cards[i];var data: Dictionary=packet.cards[i];card.name.text=data.name;card.item_name.text=data.itemName;card.portrait.texture=cache.request(data.portrait) if data.portrait else null;card.image.texture=cache.request(data.item) if data.item else null;card.item.visible=not str(data.item).is_empty();card.portrait.material.set_shader_parameter("grayscale",data.empty);card.node.get_node("Paint").material.set_shader_parameter("grayscale",data.empty)
		sockets[i].filled=-1.0;sockets[i].image.texture=card.image.texture
		for pair in [[card.name,Color("ffe1a0")],[card.item_name,Color("86d3d6")]]:
			var color: Color=pair[1];var gray:=color.r*.2126+color.g*.7152+color.b*.0722
			pair[0].add_theme_color_override("font_color",Color(gray,gray,gray) if data.empty else color)
	for i in range(6):flights[i].image.texture=cache.request(packet.flights[i].image) if i<packet.flights.size() else null
	installed=true
	# A resize can occur while worker threads decode the first images.
	# Reproject source-controller trajectories before showing the first frame.
	if Vector2(packet.viewport[0],packet.viewport[1])!=size:geometry_changed.emit(geometry_json())
	_apply_step(0);_render(0);show();set_process(true)
	while token==epoch and _elapsed()<float(packet.endAt):await get_tree().process_frame
	if token!=epoch:return ""
	_apply_step(_elapsed());cancel();return ""
func _elapsed() -> float:return float(frozen_ms) if frozen_ms>=0 else float(Time.get_ticks_msec()-begun)
func _apply_step(ms: float) -> void:
	while step_index+1<packet.timeline.size() and float(packet.timeline[step_index+1].at)<=ms:
		step_index+=1;var step: Dictionary=packet.timeline[step_index]
		status.update_state(str(step.status),step.statusVisible)
		cutin.update_state(str(step.cutin),float(step.cutinAt))
		for i in range(6):
			if step.filled[i] and sockets[i].filled<0:sockets[i].filled=float(step.at)
		for source in step.sourceOpacity:cards[int(source.index)].item.modulate.a=float(source.opacity)
		var effect: Dictionary=step.effect;var signature:=str(effect.html)+":"+str(effect.at)
		if effect.visible and signature!=banner_signature:
			banner_signature=signature;banner_at=float(step.at);banner_label.text=str(effect.text);banner_image.texture=cache.request(str(effect.get("image","")));banner.get_node("Paint").material.set_shader_parameter("kyubi",effect.kyubi)
		while shakes<int(step.shakes):shakes+=1;timeline.shake.play()
func _move(node: Control,state: Dictionary,anchor: Vector2) -> void:
	var m:=_matrix(state,node.size,anchor);node.position=m.origin;node.rotation=m.get_rotation();node.scale=m.get_scale();node.modulate.a=state.opacity
func _render(ms: float) -> void:
	var seconds:=ms/1000.0;layer.modulate.a=Motion.sample("layer",seconds,size).opacity
	cutin.render_state(ms)
	_move(heading,Motion.sample("title",seconds,heading.size),heading_anchor);_move(target,Motion.sample("target",seconds,target_extent),target_anchor)
	for i in range(6):
		var state:=Motion.sample("card",seconds-i*.09,cards[i].node.size)
		if packet.cards[i].empty:state.opacity=.35
		_move(cards[i].node,state,cards[i].origin)
		var socket: Dictionary=sockets[i];socket.image.visible=socket.filled>=0
		if socket.filled>=0:_move(socket.image,Motion.sample("socket",(ms-socket.filled)/1000.0,socket.image.size),Vector2(2,2))
		var flight: Dictionary=flights[i];flight.node.hide()
		if i<packet.flights.size():
			var data: Dictionary=packet.flights[i]
			if ms>=float(data.at) and ms<float(data.removedAt):
				flight.node.show();_move(flight.node,Motion.sample_flight(flight_motion[i],ms,flight.node.size),Vector2(data.left,data.top))
	banner.visible=banner_at>=0
	if banner_at>=0:_move(banner,Motion.sample("banner",(ms-banner_at)/1000.0,banner.size),banner_anchor)
func _process(_delta: float) -> void:
	var elapsed:=_elapsed();_apply_step(elapsed);_render(elapsed)
func cancel() -> void:
	epoch+=1;installed=false;frozen_ms=-1;hide();set_process(false)
func debug_json() -> String:
	var boxes: Array=[]
	for card in cards:boxes.append([card.origin.x,card.origin.y,card.node.size.x,card.node.size.y])
	return JSON.stringify({"installed":installed,"starts":starts,"layouts":layouts,"shakes":shakes,"step":step_index,"visible":visible,"cards":packet.get("cards",[]),"cardBoxes":boxes,"captionTop":banner_anchor.y,"banner":banner_label.text if banner_label!=null else "","filled":sockets.map(func(item):return item.filled),"flights":packet.get("flights",[])})
