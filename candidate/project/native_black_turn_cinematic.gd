extends Node
## Original black-turn presentation packet over persistent native battle nodes.
## Gameplay authority stays in the original JS; completion gates its next turn.
const Motion=preload("res://native_black_turn_motion.gd")
const Paint=preload("res://native_black_turn_paint.gd")
const Projected=preload("res://native_projected_image.gd")
const CardSkin=preload("res://native_black_turn_card_skin.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var view: Control
var cache: Node
var layer: Control
var skin: Node
var cast: Control
var surfaces: Dictionary={}
var packet: Dictionary={}
var variables: Dictionary={}
var epoch:=0
var begun:=0
var event_id:=""
var frozen_ms:=-1
var cursor:=-1
var starts:=0
var completions:=0
var receiver_held:=false
var donor_source: SubViewport
var donor_image: TextureRect
var donor_clip: Control
var donor: Control
var enemy_surface: SubViewport
var enemy_card: TextureRect
var enemy_projection: Control
var original_enemy_visible:=true
var original_player_color:=Color.WHITE
var installed:=false
var status_panel: PanelContainer
var status_label: Label
var statuses: Array=[]

func _ready() -> void:
	set_process(false)

func _ensure_nodes() -> void:
	if layer!=null:return
	layer=Control.new();layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;layer.clip_contents=true;view.add_child(layer);view.move_child(layer,view.background.get_index()+1)
	for pair in [["dark",0],["start",1],["end",1],["tether",3]]:_add_paint(pair[0],pair[1],layer)
	skin=CardSkin.new();skin.cache=cache;add_child(skin);cast=Projected.new();layer.add_child(cast)
	donor_clip=Control.new();donor_clip.mouse_filter=Control.MOUSE_FILTER_IGNORE;donor_clip.clip_contents=true;view.portraits.player.add_child(donor_clip);view.portraits.player.move_child(donor_clip,0)
	donor=Filtered.new();donor_clip.add_child(donor);donor.passes[0].effect.set_shader_parameter("source_fill",true);donor.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	donor_source=_viewport();donor_image=TextureRect.new();donor_image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;donor_image.stretch_mode=view.portraits.player.stretch_mode;donor_image.material=view.portraits.player.material.duplicate();donor_source.add_child(donor_image)
	enemy_surface=_viewport();enemy_card=preload("res://native_portrait_card.gd").new();enemy_card.enemy=true;enemy_card.cache=cache;enemy_surface.add_child(enemy_card)
	enemy_projection=Projected.new();view.add_child(enemy_projection);view.move_child(enemy_projection,view.portraits.enemy.get_index())
	_add_paint("donor",2,view.portraits.player);_add_paint("receiver",2,enemy_card)
	status_panel=PanelContainer.new();status_panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;status_panel.z_index=115;view.add_child(status_panel)
	var style:=StyleBoxFlat.new();style.bg_color=Color(0,0,0,.58);style.border_color=Color(1,232.0/255,188.0/255,.3);style.set_border_width_all(1);style.set_corner_radius_all(99);style.content_margin_left=18;style.content_margin_right=18;style.content_margin_top=12;style.content_margin_bottom=12;status_panel.add_theme_stylebox_override("panel",style)
	status_label=Label.new();status_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;status_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;status_label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(400));status_label.add_theme_font_size_override("font_size",16);status_label.add_theme_color_override("font_color",Color("ffe8bc"));status_panel.add_child(status_label)
	view.resized.connect(_resize);cancel()

func _viewport() -> SubViewport:
	var target:=SubViewport.new();target.disable_3d=true;target.transparent_bg=true;target.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(target);return target

func _add_paint(key: String,kind: int,parent: Node) -> void:
	var paint:=Paint.new();add_child(paint);var image:=Projected.new();parent.add_child(image);surfaces[key]={"paint":paint,"image":image,"kind":kind,"anchor":Vector2.ZERO}

func _number(key: String) -> float:return str(variables.get("--black-turn-"+key,"0")).to_float()
func _point(key: String) -> Vector2:return Vector2(_number(key+"-x"),_number(key+"-y"))

func _configure_paint(key: String,extent: Vector2,anchor: Vector2,surface_size: Vector2) -> void:
	var part: Dictionary=surfaces[key];part.anchor=anchor;part.paint.configure(part.kind,extent,_point("start"),_point("end"));part.image.configure(part.paint.texture(),part.paint.paint_size(),surface_size,extent,part.paint.padding);part.image.filtered.bind_live_source(part.paint.surface);part.image.source_changed();part.image.show()

func _layout() -> void:
	layer.size=view.size
	_configure_paint("dark",view.size*1.16,-view.size*.08,view.size)
	for key in ["start","end"]:_configure_paint(key,Vector2.ONE*clampf(view.size.x*.14,132,210),_point(key),view.size)
	_configure_paint("tether",Vector2(_number("line-width"),clampf(view.size.x*.038,28,48)),_point("line"),view.size)
	skin.configure(Vector2(_number("card-w"),_number("card-h")),view.size.x);cast.configure(skin.texture(),skin.paint_size(),view.size,skin.extent,skin.padding);cast.filtered.bind_live_source(skin.surface);cast.show()
	var player: TextureRect=view.portraits.player;donor_source.size=Vector2i(player.size.ceil());donor_image.size=player.size;donor_image.texture=player.texture;donor_image.material.set_shader_parameter("card_size",player.size);donor_source.render_target_update_mode=SubViewport.UPDATE_ONCE
	donor.configure(donor_source.get_texture(),player.size);donor.bind_live_source(donor_source);donor_clip.size=player.size;donor_clip.show()
	var enemy: TextureRect=view.portraits.enemy;enemy_surface.size=Vector2i((enemy.size+Vector2.ONE*512).ceil());enemy_card.position=Vector2.ONE*256;enemy_card.size=enemy.size;enemy_card.set_asset_texture(enemy.texture);enemy_card.sync_demon(view.model.get("enemy",{}).get("_nativeDemon",{}),str(view.pose_overrides.get("enemy","normal")));enemy_surface.render_target_update_mode=SubViewport.UPDATE_ONCE
	enemy_projection.configure(enemy_surface.get_texture(),Vector2(enemy_surface.size),view.size,enemy.size,256);enemy_projection.filtered.bind_live_source(enemy_surface);enemy_projection.source_changed();enemy_projection.show()
	for pair in [["donor",player],["receiver",enemy_card]]:
		var extent: Vector2=pair[1].size-Vector2.ONE*20
		_configure_paint(pair[0],extent*.88,Vector2.ONE*10+extent*.06,pair[1].size)
		# Receiver texture includes this overlay. Its parent viewport must
		# finish after the procedural/filter chain, before enemy projection.
		if pair[0]=="receiver":surfaces.receiver.image.filtered.bind_live_source(surfaces.receiver.paint.surface)
	status_panel.reset_size()

func play_event(event: Dictionary,display_packet: Dictionary) -> String:
	_ensure_nodes()
	cancel();epoch+=1;var token:=epoch;packet=display_packet;event_id=str(event.get("id",""))
	if packet.is_empty() or not packet.has("timeline") or packet.timeline.is_empty():event_id="";return "Original black-turn presentation packet required"
	variables=packet.variables;cursor=-1;statuses.clear();_layout()
	# Keep the old battle visible while all original images decode.
	layer.hide();donor_clip.hide();enemy_projection.hide();surfaces.donor.image.hide();surfaces.receiver.image.hide()
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var loaded: bool=skin.ready_art
		for path in packet.images:
			if cache.failed.has(path):cancel();return "Original black-turn image failed: "+str(path)
			if cache.request(path)==null:loaded=false
		if loaded:break
		if Time.get_ticks_msec()>deadline:cancel();return "Original black-turn images timed out"
		await get_tree().process_frame
	if token!=epoch:return ""
	original_enemy_visible=view.portraits.enemy.visible;original_player_color=view.portraits.player.self_modulate;installed=true;receiver_held=true
	view.portraits.enemy.hide();view.portraits.player.self_modulate.a=0;donor_clip.show();enemy_projection.show();surfaces.donor.image.show();surfaces.receiver.image.show();layer.show()
	begun=Time.get_ticks_msec();starts+=1;set_process(true);_render(0)
	while token==epoch and _elapsed()<int(packet.endAt):await get_tree().process_frame
	if token!=epoch:return ""
	_render(int(packet.endAt));completions+=1
	# Source duration+120 clears cast and donor, but enemy yield stays held
	# until a new non-black-turn event or closing the battle clears it.
	layer.hide();donor_clip.hide();surfaces.donor.image.hide();view.portraits.player.self_modulate=original_player_color
	skin.stop();cast.stop();donor.stop();donor_source.render_target_update_mode=SubViewport.UPDATE_DISABLED
	for key in ["dark","start","end","tether"]:surfaces[key].image.stop();surfaces[key].paint.stop()
	event_id="";return ""

func _elapsed() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-begun
func _process(_delta: float) -> void:
	if not event_id.is_empty():_render(_elapsed())
	elif receiver_held:
		status_panel.visible=not statuses.is_empty() and _elapsed()<int(statuses[-1].at)+2300
		if not status_panel.visible:set_process(false)

func _sample(key: String,ms: int,extent: Vector2) -> Dictionary:
	var seconds: float=float(ms)/1000.0
	if key not in ["donor","receiver"]:seconds=float(ms)/float(packet.duration)*float(Motion.data.catalog[key].duration)
	return Motion.sample(key,seconds-float(Motion.data.catalog[key].delay),extent,variables)

func _paint_motion(key: String,ms: int) -> void:
	var part: Dictionary=surfaces[key];var state:=_sample(key,ms,part.paint.extent)
	if key in ["dark","donor","receiver"]:state.filters=[{"kind":"blur","value":1.0}]
	if key=="tether":state.origin_ratio=Vector2(0,.5);state.filters=[{"kind":"blur","value":1.0},{"kind":"drop-shadow","x":0.0,"y":0.0,"blur":18.0,"color":[133.0/255,62.0/255,1.0,.62]}]
	state.screen_blend=key in ["start","end","donor","receiver"]
	part.image.apply_state(state,part.anchor,view.size*.5,1100 if key in ["start","end","tether"] else 0)

func _render(ms: int) -> void:
	while cursor+1<packet.timeline.size() and int(packet.timeline[cursor+1].at)<=ms:
		cursor+=1
		var step: Dictionary=packet.timeline[cursor]
		if statuses.is_empty() or str(statuses[-1].text)!=str(step.status):
			statuses.append({"text":step.status,"at":step.statusAt});status_label.text=str(step.status);status_panel.reset_size();status_panel.position=Vector2((view.size.x-status_panel.size.x)*.5,18)
	var current: Dictionary=packet.timeline[maxi(cursor,0)]
	layer.z_index=130 if "black-turn-front" in current.stage else 0
	status_panel.visible=ms<int(current.statusAt)+2300
	for key in ["dark","start","end","tether","donor","receiver"]:_paint_motion(key,ms)
	var state:=_sample("card",ms,skin.extent)
	# The source card's will-change:filter establishes a flattened group.
	# Preserve that real browser result, not an idealized 3D back-face swap.
	var demon: float=Motion.Ease._ease(clampf((float(ms)-float(packet.duration)*.8)/260.0,0,1),[.25,.1,.25,1]) if "demonized" in current.cast else -1.0
	if skin.set_state(cache.request(current.castImage),demon,true):cast.source_changed()
	cast.apply_state(state,Vector2.ZERO,view.size*.5)
	var enemy_state:=_sample("yield",ms,view.portraits.enemy.size)
	enemy_surface.render_target_update_mode=SubViewport.UPDATE_ONCE;enemy_projection.source_changed();enemy_projection.apply_state(enemy_state,view.portraits.enemy.position,view.size*.5,0)
	var player_state:=_sample("pull",ms,view.portraits.player.size);var transform: Transform3D=player_state.transform
	player_state.transform=Transform2D(Vector2(transform.basis.x.x,transform.basis.x.y),Vector2(transform.basis.y.x,transform.basis.y.y),Vector2(transform.origin.x,transform.origin.y))
	donor.apply_filters(player_state.filters);donor.apply_motion(player_state,Vector2.ZERO)

func cancel() -> void:
	epoch+=1;event_id="";frozen_ms=-1;set_process(false);receiver_held=false
	if installed:view.portraits.enemy.visible=original_enemy_visible;view.portraits.player.self_modulate=original_player_color;installed=false
	if layer!=null:layer.hide()
	if donor_clip!=null:donor_clip.hide();donor.stop()
	if skin!=null:skin.stop();cast.stop()
	if enemy_projection!=null:enemy_projection.stop()
	for part in surfaces.values():part.image.stop();part.paint.stop()
	for surface in [donor_source,enemy_surface]:
		if surface!=null:surface.render_target_update_mode=SubViewport.UPDATE_DISABLED
	if status_panel!=null:status_panel.hide()

func _resize() -> void:
	# A size change needs fresh original geometry; do not retain coordinates
	# belonging to a different viewport. Android is locked to landscape.
	if installed:cancel()

func debug_state() -> Dictionary:
	return {"event":event_id,"starts":starts,"completions":completions,"receiverHeld":receiver_held,"cursor":cursor,"statuses":statuses,"skinPaints":skin.paints if skin!=null else 0,"layerZ":layer.z_index if layer!=null else 0,"installed":installed}

func debug_json() -> String:return JSON.stringify(debug_state())
