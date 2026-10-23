extends Control
signal preview_requested
var battle_view: Control
var actions: Control
var background:=TextureRect.new()
var divider:=ColorRect.new()
var forward:=Button.new()
var back:=Button.new()
var actors: Dictionary={}
var packet: Dictionary={}
var text_writes:=0
var icon_builds:=0
var frame_builds:=0
var cinematic: Control
var status_detail: Control

func _ready() -> void:
	# The visual stage must not intercept inputs intended for the original
	# command columns. Its explicit preview/status controls still receive input.
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=210;hide()
	background.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;background.mouse_filter=Control.MOUSE_FILTER_IGNORE;background.material=ShaderMaterial.new();background.material.shader=preload("res://native_tot_background.gdshader");add_child(background)
	divider.color=Color("ffe79b");divider.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(divider)
	status_detail=load("res://native_status_detail.gd").new();add_child(status_detail)
	for world in ["real","song","boss"]:_actor(world)
	cinematic=preload("res://native_tot_cinematic.gd").new();cinematic.stage=self;add_child(cinematic)
	for button in [forward,back]:
		add_child(button);battle_view._button_art(button);button.add_theme_font_size_override("font_size",12);button.pressed.connect(func():preview_requested.emit())
	forward.text="↑ 查看 Boss";back.text="↓ 返回我方"
	resized.connect(_layout)
	battle_view.cache.asset_ready.connect(func(_path,_texture):_refresh_visibility())

func _label(parent: Node,font_size: int) -> Label:
	var label:=Label.new();label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("fff8db"));label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;parent.add_child(label);return label
func _actor(world: String) -> void:
	var card:=Control.new();card.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(card)
	var portrait:=TextureRect.new();portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;card.add_child(portrait)
	var rings:=preload("res://native_tot_actor_rings.gd").new();rings.world="boss" if world=="boss" else "player";card.add_child(rings);card.move_child(rings,0)
	var layers:=Control.new();layers.mouse_filter=Control.MOUSE_FILTER_IGNORE;card.add_child(layers)
	var panel:=Control.new();panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.z_index=20;add_child(panel)
	var frame:=NinePatchRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.15
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,80)
	panel.add_child(frame);battle_view._image(frame,"images/board/battle_hud_dialogue_ui/battle_hud_"+("enemy" if world=="boss" else "player")+"_frame.webp")
	var title:=_label(panel,12);var badge:=_label(panel,11);badge.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	var detail:=_label(panel,11)
	var scroll:=ScrollContainer.new();scroll.vertical_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_SHOW_NEVER;panel.add_child(scroll)
	var content:=HBoxContainer.new();scroll.add_child(content);var carry:=_label(content,11)
	var status=load("res://native_status_row.gd").new();status.battle_view=battle_view;content.add_child(status);status.detail_requested.connect(func(value,anchor):status_detail.show_for(value,anchor,size))
	var hp:=ProgressBar.new();hp.show_percentage=false;hp.mouse_filter=Control.MOUSE_FILTER_IGNORE;panel.add_child(hp)
	var fill:=StyleBoxFlat.new();fill.bg_color=Color("ed6861") if world=="boss" else Color("43d78b");var track:=StyleBoxFlat.new();track.bg_color=Color("08131e");hp.add_theme_stylebox_override("fill",fill);hp.add_theme_stylebox_override("background",track)
	actors[world]={"card":card,"portrait":portrait,"ringLayer":rings,"layers":layers,"layerData":[],"panel":panel,"frame":frame,"title":title,"badge":badge,"detail":detail,"hp":hp,"scroll":scroll,"content":content,"carry":carry,"status":status,"effectKey":"","frameKey":""}
	var renderer:=preload("res://native_tot_actor.gd").new();renderer.stage=self;renderer.actor=actors[world];renderer.world=world;actors[world].renderer=renderer;card.add_child(renderer)

func _write(label: Label,value: String) -> void:
	if label.text!=value:label.text=value;text_writes+=1
func apply_source_json(json: String) -> void:
	packet=JSON.parse_string(json)
	if not packet.get("visible",false):hide();cinematic.apply(packet);return
	battle_view._image(background,str(packet.background))
	for world in packet.actors:
		var value: Dictionary=packet.actors[world];var actor: Dictionary=actors[world]
		var source_key: String="totMusica"+str(world).capitalize()+"Frame"
		actor.renderer.apply_classes(packet.get("cinematic",{}).get("nodes",{}).get(source_key,{}).get("classes",[]))
		_write(actor.title,str(value.get("name","船員")));_write(actor.badge,"" if world=="boss" else "Lv.%d %s" %[int(value.get("level",1)),str(value.get("attribute","無"))]);_write(actor.detail,"HP %d / %d" %[int(value.get("currentHp",0)),int(value.get("maxHp",1))])
		actor.hp.max_value=maxf(1,float(value.get("maxHp",1)));actor.hp.value=maxf(0,float(value.get("currentHp",0)));battle_view._image(actor.portrait,str(value.portrait))
		var carry: Dictionary=value.get("carryItem",{}) if value.get("carryItem")!=null else {}
		_write(actor.carry,"" if world=="boss" else str(value.get("carryLabel","")));actor.carry.tooltip_text=str(carry.get("summary",""))
		actor.status.apply_source(value.get("statusIcons",[]))
		var key: String=""
		var frame_data: Dictionary=value.get("frame",{}) if value.get("frame")!=null else {};key=JSON.stringify(frame_data)
		if actor.frameKey!=key:
			actor.frameKey=key;frame_builds+=1
			for child in actor.layers.get_children():actor.layers.remove_child(child);child.queue_free()
			actor.layerData=[]
			for layer in frame_data.get("layers",{}).values():
				var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;image.modulate.a=float(layer.get("opacity",1));image.flip_h=layer.get("flipX",false);image.flip_v=layer.get("flipY",false);image.z_index=int(layer.get("z",1));image.material=actor.renderer.frame_material;actor.layers.add_child(image);battle_view._image(image,str(layer.asset));actor.layerData.append({"image":image,"data":layer})
			actor.portrait.self_modulate.a=1.0
			actor.ringLayer.visible=frame_data.get("showBaseFrame",true)
	var ally_visible: bool=not packet.preview and not packet.setup and not packet.result
	for world in ["real","song"]:actors[world].card.visible=ally_visible;actors[world].panel.visible=ally_visible
	var boss_visible: bool=(packet.preview or packet.enemy or packet.result or "boss-revealed" in packet.classes) and not packet.defeated
	actors.boss.card.visible=boss_visible;actors.boss.panel.visible=boss_visible
	forward.visible=packet.selection and not packet.preview;back.visible=packet.preview
	forward.tooltip_text=str(packet.toggleLabel);divider.visible=not packet.preview
	background.material.set_shader_parameter("camera",1.0 if packet.preview or packet.enemy or packet.result else 0.0)
	_layout();cinematic.apply(packet);_refresh_visibility();sync_controls_visibility()

func assets_ready() -> bool:
	if not packet.get("visible",false):return true
	if background.texture==null:return false
	for actor in actors.values():
		if actor.card.visible and actor.portrait.texture==null:return false
		if actor.panel.visible and actor.frame.texture==null:return false
		if actor.panel.visible and not actor.status.assets_ready():return false
		if actor.card.visible:
			for layer in actor.layerData:
				if layer.image.texture==null:return false
	return true
func _refresh_visibility() -> void:
	if packet.get("visible",false) and assets_ready():
		for actor in actors.values():actor.renderer.update_geometry()
		show();sync_controls_visibility()

func sync_controls_visibility() -> void:
	if not visible:return
	if packet.get("controlsHidden",false) or "tot-musica-resolving" in packet.get("stageClasses",[]):actions.hide()
	elif actions.packet.get("visible",false):actions.show()

func _layout() -> void:
	background.size=size;background.material.set_shader_parameter("viewport_size",size)
	divider.position=Vector2(size.x*.5-1.5,0);divider.size=Vector2(3,size.y)
	var source_scale:=minf(1.0,minf(size.x/1024.0,size.y/576.0))
	for world in actors:
		var actor: Dictionary=actors[world];var boss: bool=world=="boss";var right: bool=world=="song"
		var extent:=Vector2(minf(size.x*.24,430),minf(size.y*.45,455))*source_scale
		var resolving: bool="player-resolving" in packet.get("classes",[]) or packet.get("enemy",false)
		if resolving and not boss:extent=Vector2(minf(size.x*.20,300),minf(size.y*.40,320))*source_scale
		if boss:extent=Vector2.ONE*minf(size.y*.70,minf(size.x*.42,640))
		actor.card.position=Vector2((size.x-extent.x)*.5 if boss else size.x*.945-extent.x if right else size.x*.055,size.y*(.31 if resolving and not boss else .14));actor.card.size=extent;actor.renderer.update_geometry()
		actor.card.rotation=0;actor.card.scale=Vector2.ONE;actor.card.modulate.a=1;actor.baseCard=actor.card.position
		actor.portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED if boss else TextureRect.STRETCH_KEEP_ASPECT_COVERED
		for layer in actor.layerData:
			var data: Dictionary=layer.data;var image: TextureRect=layer.image
			image.size=extent*Vector2(float(data.get("w",100)),float(data.get("h",100)))*.01;image.position=extent*Vector2(float(data.get("x",50)),float(data.get("y",50)))*.01-image.size*.5;image.pivot_offset=image.size*.5;image.rotation_degrees=float(data.get("rotate",0))
		var width:=size.x*(.40 if boss else .45)
		actor.panel.position=Vector2((size.x-width)*.5 if boss else size.x*.985-width if right else size.x*.015,size.y*.015);actor.panel.size=Vector2(width,48 if size.y<=520 else 70);actor.frame.size=actor.panel.size/.15
		actor.panel.rotation=0;actor.panel.scale=Vector2.ONE;actor.panel.modulate.a=1;actor.basePanel=actor.panel.position
		actor.title.position=Vector2(12,3);actor.title.size=Vector2(width-110,18);actor.badge.position=Vector2(width-96,3);actor.badge.size=Vector2(84,18)
		actor.detail.position=Vector2(12,23);actor.detail.size=Vector2(100,17);actor.scroll.position=Vector2(112,22);actor.scroll.size=Vector2(maxf(20,width-126),20)
		actor.hp.position=Vector2(12,actor.panel.size.y-6);actor.hp.size=Vector2(width-24,3)
	forward.position=Vector2(size.x*.5-49,size.y*.18-16);forward.size=Vector2(98,32);back.position=Vector2(size.x*.5-53,size.y-42);back.size=Vector2(106,32)

func test_state_json() -> String:
	var result:={"actors":{},"icons":icon_builds,"frames":frame_builds,"texts":text_writes,"visible":visible,"preview":packet.get("preview",false)}
	for world in actors:
		var a: Dictionary=actors[world];result.actors[world]={"carry":a.carry.text,"name":a.title.text,"hp":a.detail.text,"portrait":a.portrait.get_meta("wanted_asset",""),"visible":a.card.visible}
	return JSON.stringify(result)
func test_actor_motion_json() -> String:
	var result: Dictionary={}
	for world in actors:
		var a: Dictionary=actors[world]
		result[world]={"parent":a.renderer.last_parent,"image":a.renderer.last_image,"classes":a.renderer.classes,"cardId":a.card.get_instance_id(),"portraitId":a.portrait.get_instance_id(),"ringId":a.ringLayer.get_instance_id(),"frameMaterialId":a.renderer.frame_material.get_instance_id(),"imageMaterialId":a.renderer.image_material.get_instance_id(),"uniformWrites":a.renderer.uniform_writes}
	return JSON.stringify(result)
func test_toggle() -> void:
	var button: Button=back if back.visible else forward;assert(button.visible)
	var point:=button.get_global_rect().get_center()
	var motion:=InputEventMouseMotion.new();motion.position=point;motion.global_position=point;get_viewport().push_input(motion,true)
	for down in [true,false]:
		var event:=InputEventMouseButton.new();event.position=point;event.global_position=event.position;event.button_index=MOUSE_BUTTON_LEFT;event.pressed=down;get_viewport().push_input(event,true)
func test_capture(path: String) -> void:_capture(path)
func _capture(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
