extends Control
## Persistent original floating-island targets. Game state remains authoritative.
const Motion=preload("res://native_shiki_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const MARGIN:=48.0
var view: Control
var entries: Dictionary={}
var latest: Dictionary={}
var last_serial:=0
var completed_event:=""
var began:=0
var frozen_ms:=-1
var breaking: Dictionary={}
var slot_order: Array=[]

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=50;began=Time.get_ticks_msec();hide();set_process(false)
	view.cache.asset_ready.connect(func(path,_texture):
		for entry in entries.values():
			if entry.output.visible and entry.image.get_meta("wanted_asset","")==path:
				entry.viewport.render_target_update_mode=SubViewport.UPDATE_ONCE
				for pass_value in entry.output.passes:pass_value.view.render_target_update_mode=SubViewport.UPDATE_ONCE
	)
	visibility_changed.connect(func():
		set_process(is_visible_in_tree() and not slot_order.is_empty())
		if not is_visible_in_tree():
			for entry in entries.values():entry.output.stop();entry.viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED
	)

func _entry(id: String) -> Dictionary:
	if entries.has(id):return entries[id]
	var viewport:=SubViewport.new();viewport.disable_3d=true;viewport.transparent_bg=true;viewport.size=Vector2i(1,1);viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(viewport)
	var content:=Control.new();content.theme=view.theme;viewport.add_child(content)
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;content.add_child(image)
	var info:=PanelContainer.new();content.add_child(info)
	var style:=StyleBoxFlat.new();style.bg_color=Color(0.02,.09,.14,.95);style.border_color=Color(.99,.88,.59,.86)
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:style.set_border_width(side,1)
	for corner in [CORNER_TOP_LEFT,CORNER_TOP_RIGHT,CORNER_BOTTOM_LEFT,CORNER_BOTTOM_RIGHT]:style.set_corner_radius(corner,7)
	style.content_margin_left=3;style.content_margin_right=3;style.content_margin_top=2;style.content_margin_bottom=2;info.add_theme_stylebox_override("panel",style)
	var copy:=VBoxContainer.new();copy.add_theme_constant_override("separation",2);info.add_child(copy)
	var title:=Label.new();title.add_theme_font_size_override("font_size",8);title.add_theme_color_override("font_color",Color("ffe29a"));title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;title.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;copy.add_child(title)
	var hp:=ProgressBar.new();hp.show_percentage=false;hp.custom_minimum_size.y=5
	var fill:=StyleBoxFlat.new();fill.bg_color=Color("8af3df");hp.add_theme_stylebox_override("fill",fill);copy.add_child(hp)
	var effect:=Label.new();effect.add_theme_font_size_override("font_size",7);effect.add_theme_color_override("font_color",Color("d8f4f2"));effect.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;effect.max_lines_visible=2;copy.add_child(effect)
	var output:=Filtered.new();add_child(output)
	var button:=Button.new();button.flat=true;button.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND
	for state in ["normal","hover","pressed","disabled","focus"]:button.add_theme_stylebox_override(state,StyleBoxEmpty.new())
	add_child(button);button.pressed.connect(func():view.boss_panel.selected_target="shiki_island_"+id;view.boss_panel._update_targets())
	var entry:={"viewport":viewport,"content":content,"image":image,"info":info,"title":title,"hp":hp,"effect":effect,"output":output,"button":button,"data":{},"extent":Vector2.ZERO,"index":0}
	entries[id]=entry;return entry

func sync(model: Dictionary) -> void:
	latest=model
	var mechanic: Dictionary=model.get("battle",{}).get("postgameBossMechanic",{}) if model.get("battle",{}).get("postgameBossMechanic") is Dictionary else {}
	if not mechanic.get("active",false) or mechanic.get("key","")!="postgame_shiki":clear();return
	if not breaking.is_empty():return
	var state: Dictionary=mechanic.get("state",{})
	var event: Dictionary=model.battle.visualEvent if model.battle.get("visualEvent") is Dictionary else {}
	var last: Dictionary=state.lastEvent if state.get("lastEvent") is Dictionary else {}
	var serial:=int(state.get("eventSerial",0))
	var new_break: bool=last.get("type","")=="break" and serial>last_serial
	var pending: bool=new_break and event.get("type","")=="attack" and event.get("shikiIslandDestroyed",false) and event.get("shikiIslandId","")==last.get("islandId","")
	var islands: Array=state.get("islands",[])
	if event.get("type","")=="attack" and str(event.get("id",""))!=completed_event and event.get("shikiIslandVisualIslands") is Array and not event.shikiIslandVisualIslands.is_empty():islands=event.shikiIslandVisualIslands
	slot_order=[]
	for island in islands:
		if island.get("destroyed",false) and not (new_break and island.id==last.get("islandId","")):continue
		var entry:=_entry(str(island.id));entry.data=island;entry.index=slot_order.size();slot_order.append(str(island.id));entry.output.show();entry.button.show();entry.button.disabled=false
		view._image(entry.image,str(island.get("image","")))
		if not str(island.get("brokenImage","")).is_empty():view.cache.request(str(island.brokenImage))
		view._text(entry.title,str(island.get("name","漂浮島"))+" %d/%d" %[island.get("currentHp",0),island.get("maxHp",1)])
		view._text(entry.effect,"攻擊命中後即將崩落" if pending and island.id==last.get("islandId","") else str(island.get("effect","")))
		entry.hp.max_value=maxf(1,float(island.get("maxHp",1)));entry.hp.value=float(island.get("currentHp",0))
		entry.button.tooltip_text="選為攻擊目標："+str(island.get("name","漂浮島"))+"；"+str(island.get("effect",""))
	for id in entries:
		if not slot_order.has(id):_hide_entry(entries[id])
	visible=not slot_order.is_empty();set_process(visible)
	if new_break and not pending:
		last_serial=serial
		_break(str(last.get("islandId","")),{})
	elif not pending and serial>last_serial:last_serial=serial
	_tick()

func warm() -> bool:
	var ready:=true
	for id in slot_order:
		for key in ["image","brokenImage"]:
			var path: String=str(entries[id].data.get(key,""))
			if not path.is_empty() and view.cache.request(path)==null:ready=false
	return ready

func impact_anchor(id: String) -> Vector2:
	if not entries.has(id) or not entries[id].output.visible:return position+size*.5
	var button: Button=entries[id].button
	return position+button.position+button.size*.5

func break_at_impact(event: Dictionary,id: String) -> void:
	if not event.get("shikiIslandDestroyed",false) or id.is_empty() or not entries.has(id) or breaking.has(id):return
	var overrides: Dictionary={}
	for entry in event.get("shikiIslandBreaks",[]):
		if str(entry.get("islandId",""))==id:overrides=entry;break
	last_serial=maxi(last_serial,int(latest.battle.postgameBossMechanic.state.get("eventSerial",0)))
	_break(id,overrides)

func _break(id: String,override: Dictionary) -> void:
	if not entries.has(id) or breaking.has(id):return
	var entry: Dictionary=entries[id]
	breaking[id]=frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-began
	entry.button.disabled=true;entry.output.z_index=10
	view._image(entry.image,str(override.get("brokenImage",entry.data.get("brokenImage",entry.data.get("image","")))))
	view._text(entry.title,str(override.get("islandName",entry.data.get("name","漂浮島")))+"・崩落")
	view._text(entry.effect,"完全墜出戰場・效果解除")
	entry.image.position=Vector2.ONE*MARGIN;entry.image.rotation=0;entry.image.scale=Vector2.ONE
	entry.viewport.render_target_update_mode=SubViewport.UPDATE_ONCE
	entry.output.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
	show();set_process(true)

func finish_attack(id: String) -> void:completed_event=id;sync(latest)
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if not visible:return
	var card: Control=view.portraits.enemy
	var compact:=view.size.x<=620
	position=card.position+card.size*Vector2(-.47 if compact else -.44,.02 if compact else .03)
	size=card.size*Vector2(.5 if compact else .47,.96 if compact else .94)
	var gap:=size.y*(.02 if compact else .025)
	var extent:=Vector2(size.x,(size.y-gap*2)/3.0)
	# Original grid images retain their square intrinsic box and overflow the
	# short row. Preserve that overflow instead of clipping them behind labels.
	var image_extent:=Vector2.ONE*extent.x
	var capture_extent:=(extent+Vector2.ONE*MARGIN*2).ceil()
	var now:=frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()-began
	var finished: Array=[]
	for id in slot_order:
		var entry: Dictionary=entries[id]
		if not entry.output.visible:continue
		var index: int=entry.index
		var anchor:=Vector2(0,index*(extent.y+gap))
		var is_breaking:=breaking.has(id)
		if not is_breaking:anchor.x+=[.04,-.02,.03][index%3]*extent.x
		if entry.extent!=extent:
			entry.extent=extent;entry.viewport.size=Vector2i(capture_extent);entry.content.size=capture_extent;entry.image.size=image_extent
			entry.info.position=Vector2(extent.x*.06+MARGIN,0);entry.info.size=Vector2(extent.x*.9,0)
			entry.output.configure(entry.viewport.get_texture(),capture_extent)
			entry.output.bind_live_source(entry.viewport)
			entry.output.passes[0].effect.set_shader_parameter("source_premultiplied",true)
		entry.info.position.y=MARGIN+extent.y*.99-entry.info.size.y
		entry.button.position=anchor;entry.button.size=extent
		if is_breaking:
			var elapsed:=float(now-int(breaking[id]))/1000.0
			if elapsed>=1.62:finished.append(id);_hide_entry(entry);continue
			var sample:=Motion.sample("shikiIslandBreak",elapsed,extent,view.size.y)
			entry.output.apply_motion(sample,anchor-Vector2.ONE*MARGIN,(Vector2.ONE*MARGIN+extent*Vector2(.58,.5))/capture_extent);entry.output.apply_filters(sample.filters)
		else:
			var elapsed:=fmod(float(now)/1000.0+index*.72,3.8)
			var sample:=Motion.sample("shikiIslandHover",elapsed,image_extent,view.size.y)
			var movement: Transform2D=sample.transform;var center:=image_extent*.5
			entry.image.position=Vector2.ONE*MARGIN+center+movement.origin-movement.basis_xform(center);entry.image.rotation=movement.get_rotation()
			entry.output.position=anchor-Vector2.ONE*MARGIN;entry.output.rotation=0;entry.output.scale=Vector2.ONE;entry.output.modulate.a=1
			var selected: bool=view.boss_panel.selected_target=="shiki_island_"+id
			entry.output.z_index=6 if selected else 0
			var filters: Array=[{"kind":"drop-shadow","x":0.0,"y":10.0,"blur":11.0,"color":[0.0,0.0,0.0,.78]}]
			if selected:filters.push_front({"kind":"drop-shadow","x":0.0,"y":0.0,"blur":17.0,"color":[1.0,211.0/255,91.0/255,.98]})
			entry.output.apply_filters(filters)
			entry.viewport.render_target_update_mode=SubViewport.UPDATE_ONCE
			for pass_value in entry.output.passes:pass_value.view.render_target_update_mode=SubViewport.UPDATE_ONCE
	for id in finished:breaking.erase(id);slot_order.erase(id)
	if not finished.is_empty():
		for i in range(slot_order.size()):entries[slot_order[i]].index=i
	if not finished.is_empty() and breaking.is_empty():sync(latest)

func _hide_entry(entry: Dictionary) -> void:entry.output.hide();entry.output.stop();entry.button.hide();entry.viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED
func clear() -> void:
	hide();set_process(false);slot_order=[];breaking.clear();last_serial=0;completed_event=""
	for entry in entries.values():_hide_entry(entry)
