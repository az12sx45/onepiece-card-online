extends Control
## Original floor/captain/event composition; native persistent controls.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
const CAGE="images/board/impel_down_ui/impel_down_captive_cage_overlay.webp"
const EVENT_FRAME="images/board/impel_down_ui/impel_down_dice_event_reveal_frame.webp"
const DUNGEON="images/board/impel_down_ui/impel_down_dungeon_panel_frame_v3.webp"
var cache: Node
var model: Dictionary={}
var busy:=false
var epoch:=0
var prepared: Dictionary={}
var background:=TextureRect.new()
var panel:=NinePatchRect.new()
var title:=Label.new()
var info:=Label.new()
var exit_button:=Button.new()
var team_button:=Button.new()
var captain:=TextureRect.new()
var cage:=TextureRect.new()
var event_frame:=TextureRect.new()
var event_art:=Control.new()
var event_image:=TextureRect.new()
var dice:=Label.new()
var event_title:=Label.new()
var event_text:=Label.new()
var command_title:=Label.new()
var command_text:=Label.new()
var scroll:=ScrollContainer.new()
var content:=VBoxContainer.new()
var detail_scroll:=ScrollContainer.new()
var detail:=VBoxContainer.new()
var footer:=HBoxContainer.new()
var action_pool: Array[Button]=[]
var rows: Array[Dictionary]=[]
var list_signature:=""
var details_signature:=""
var mode:="main"
var offsets: Dictionary={}
var reel: Control
var recruit_rail: Control
var active_floor:=""

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=13;theme=t
	_picture(background);background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;add_child(background)
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for p in [captain,cage,event_frame]:_picture(p);add_child(p)
	event_art.clip_contents=true;event_art.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(event_art)
	_picture(event_image);event_art.add_child(event_image)
	for label in [title,info,event_title,event_text,command_title,command_text,dice]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_color",Color("f2dfb2"));add_child(label)
	title.add_theme_font_size_override("font_size",18);dice.add_theme_font_size_override("font_size",38);dice.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;event_title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	for sc in [scroll,detail_scroll]:sc.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(sc)
	for box in [content,detail]:box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_theme_constant_override("separation",8)
	scroll.add_child(content);detail_scroll.add_child(detail)
	add_child(exit_button);exit_button.pressed.connect(func():_source(str(exit_button.get_meta("key",""))))
	add_child(team_button);team_button.set_meta("key","id:teamBtn");team_button.pressed.connect(func():_source("id:teamBtn"))
	footer.add_theme_constant_override("separation",8);add_child(footer)
	for i in range(3):
		var button:=Button.new();button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;footer.add_child(button);action_pool.append(button);button.pressed.connect(func():_source(str(button.get_meta("key",""))))
	reel=preload("res://native_impel_down_reel.gd").new();add_child(reel)
	recruit_rail=preload("res://native_impel_recruit_rail.gd").new();add_child(recruit_rail)
	resized.connect(_layout);hide()
func _picture(node: TextureRect) -> void:node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("07151f"))
func _rect(node: Control,x: float,y: float,w: float,h: float) -> void:node.position=Vector2(x,y);node.size=Vector2(maxf(1,w),maxf(1,h))
func _label(text: String,parent: Node,font_size:=13) -> Label:
	var label:=Label.new();label.text=text;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.add_theme_font_size_override("font_size",font_size);label.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(label);return label
func _button(data: Dictionary,parent: Node) -> Button:
	var button:=Button.new();button.text=str(data.label);button.disabled=data.disabled or not model.inputReady;button.custom_minimum_size.y=40;button.set_meta("key",data.key);button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;parent.add_child(button);button.pressed.connect(func():_source(str(button.get_meta("key",""))));return button
func _frame_button(button: Button,index:=1) -> void:
	if button.has_meta("original_frame"):return
	button.set_meta("original_frame",true);button.flat=true
	var art:=NinePatchRect.new();art.texture=prepared.get(DUNGEON);art.region_rect=Rect2(810+145*index,772,134,107);art.scale=Vector2.ONE*.5;art.mouse_filter=Control.MOUSE_FILTER_IGNORE;art.show_behind_parent=true
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:art.set_patch_margin(side,18)
	button.add_child(art);art.size=button.size/.5;button.resized.connect(func():art.size=button.size/.5)
func _source(key: String) -> void:
	if busy or not visible or not model.get("inputReady",false) or key.is_empty():return
	command_requested.emit(key)
func _request(path: String) -> Texture2D:
	if prepared.has(path):return prepared[path]
	if cache.pending.size()>=2:return null
	var texture: Texture2D=cache.request(path)
	if texture:prepared[path]=texture
	return texture
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:return
	model=next;epoch+=1;_prepare(epoch)
func _prepare(token: int) -> void:
	var next_mode: String="team" if model.team.open else "recruit" if model.recruits.open and model.event.spin==null else "main"
	var paths: Array=[PANEL,ROW,DUNGEON,model.background,model.captain.image,CAGE,EVENT_FRAME]
	if next_mode=="recruit":
		for row in model.recruits.cards:paths.append(row.image);paths.append(row.frame)
		paths.append(model.recruits.detail.image)
	else:
		for image in model.event.images:paths.append(image.path)
	var missing:=false
	for path in paths:
		if not str(path).is_empty() and not prepared.has(path):missing=true
	busy=missing
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var complete:=true
		for path in paths:
			if not str(path).is_empty() and _request(path)==null:complete=false
		if complete:break
		if Time.get_ticks_msec()>deadline:push_error("Original Impel Down assets unavailable");return
		await get_tree().process_frame
	if token!=epoch:return
	if mode!=next_mode:offsets[mode]=scroll.scroll_vertical;mode=next_mode;list_signature="";details_signature=""
	busy=false;_apply();show();surface_ready.emit()
func _apply() -> void:
	background.texture=prepared.get(model.background);panel.texture=prepared.get(PANEL);captain.texture=prepared.get(model.captain.image);cage.texture=prepared.get(CAGE);event_frame.texture=prepared.get(EVENT_FRAME)
	_frame_button(exit_button,3);_frame_button(team_button,1)
	title.text=model.title if mode=="main" else "隱藏囚犯招募" if mode=="recruit" else "推進城組隊"
	info.text=model.squad+" · "+model.phase+"　貝里 "+model.coins if mode=="main" else model.recruits.pool+"　貝里 "+model.recruits.wallet if mode=="recruit" else "同樓層邀請，對方同意後才會成隊"
	var close: Dictionary=model.team.close if mode=="team" else model.exit
	exit_button.text=close.label;exit_button.disabled=close.disabled or not model.inputReady;exit_button.set_meta("key",close.key)
	team_button.text=model.teamButton.label;team_button.disabled=model.teamButton.disabled or not model.inputReady
	dice.text=model.dice.value;event_title.text=model.event.title;event_text.text=model.event.text;command_title.text=model.command.title;command_text.text=model.command.text
	var actions: Array=model.recruits.actions if mode=="recruit" else model.command.actions if mode=="main" else []
	for i in range(action_pool.size()):
		var b: Button=action_pool[i];b.visible=i<actions.size()
		_frame_button(b,i)
		if b.visible:b.text=actions[i].label;b.disabled=actions[i].disabled or not model.inputReady;b.set_meta("key",actions[i].key)
	var descriptions: Array=model.recruits.cards if mode=="recruit" else model.team.sections if mode=="team" else model.floors
	var signature:=mode+JSON.stringify(descriptions)+str(model.inputReady)
	if signature!=list_signature:
		list_signature=signature;var old_offset:=scroll.scroll_vertical
		var active_target: Control=null
		for child in content.get_children():content.remove_child(child);child.queue_free()
		rows.clear()
		for row in descriptions:
			var box:=VBoxContainer.new();box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_child(box)
			if mode=="main":
				var name:=_label(str(row.title),box,12);name.add_theme_color_override("font_color",Color("ffe29a") if row.active else Color("d1dadd"));_label(str(row.rank)+" · "+str(row.occupants),box,11)
				if row.active and active_floor!=str(row.level):active_floor=str(row.level);active_target=box
			elif mode=="team":
				_label(row.title,box,16)
				for p in row.paragraphs:_label(p,box)
				for member in row.members:
					_label(member.name+"　"+member.note,box)
					for action in member.actions:_button(action,box)
			else:
				var button:=_button({"key":row.action.key,"label":row.name+"　"+row.level+"　"+row.odds,"disabled":row.action.disabled},box);button.add_theme_color_override("font_color",Color("ffe39b") if row.selected else Color("ecedf0"))
				var h:=HBoxContainer.new();box.add_child(h);var picture:=TextureRect.new();_picture(picture);picture.texture=prepared.get(row.image);picture.custom_minimum_size=Vector2(76,82);h.add_child(picture);var copy:=VBoxContainer.new();copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;h.add_child(copy);_label(row.meta,copy);_label(row.passive,copy,12);_label(row.boost,copy,12)
			rows.append({"root":box})
		if active_target!=null:scroll.ensure_control_visible.call_deferred(active_target)
		else:scroll.set_deferred("scroll_vertical",int(offsets.get(mode,old_offset)))
	var ds:=JSON.stringify(model.recruits.detail)
	if mode=="recruit" and ds!=details_signature:
		details_signature=ds
		for child in detail.get_children():detail.remove_child(child);child.queue_free()
		var r: Dictionary=model.recruits.detail;var portrait:=TextureRect.new();_picture(portrait);portrait.texture=prepared.get(r.image);portrait.custom_minimum_size.y=100;detail.add_child(portrait);_label(r.name,detail,17);_label(r.meta,detail);_label("抽中率 "+r.odds+"　加權 "+r.boost,detail);_label("加權費 "+r.boostCost+"　抽選費 "+r.fee,detail)
	var first_image:=""
	if model.event.spin==null:
		for image in model.event.images:
			if not str(image.classes).contains("frame"):first_image=image.path;break
	event_image.texture=prepared.get(first_image)
	reel.apply(model.event.spin if model.event.spin==null or model.event.spin.kind=="event" else null,model.event.key,prepared)
	recruit_rail.apply(model.event.spin,model.event.key,prepared)
	_layout();_layout.call_deferred()
func _layout() -> void:
	if model.is_empty():return
	var w:=size.x;var h:=size.y
	var recruiting: bool=model.event.spin!=null and model.event.spin.kind=="recruit"
	var main:=mode=="main" and not recruiting;var recruit:=mode=="recruit";var top:=62.0;var bottom:=h-90.0
	_rect(background,0,0,w,h);panel.size=size/.125
	for node in [title,info,exit_button,scroll]:node.visible=not recruiting
	_rect(title,22,8,w-240,25);_rect(info,22,34,w-170,24);_rect(exit_button,w-110,10,90,40);_rect(team_button,w-218,10,100,40)
	team_button.visible=main
	for p in [captain,cage,event_frame,event_art,event_image,dice,event_title,event_text,command_title,command_text]:p.visible=main
	cage.visible=main and str(model.captain.classes).split(" ").has("locked")
	dice.visible=main and str(model.dice.classes).split(" ").has("roll") or main and str(model.dice.classes).split(" ").has("revealed")
	detail_scroll.visible=recruit;footer.visible=mode!="team" and not recruiting
	_rect(scroll,22,top,w*.23 if main else w*.53 if recruit else w-44,bottom-top if main else h-top-65)
	_rect(detail_scroll,w*.59,top,w*.37,h-top-65)
	_rect(captain,w*.27,top,w*.25,bottom-top);_rect(cage,w*.255,top-4,w*.28,bottom-top+8)
	# Anchor all children to the actual square artwork, not its wide allocation.
	# Percentages follow .event-reveal-title / .event-art in board_impel_down.html.
	var edge:=minf(w*.43,bottom-top)
	var origin:=Vector2(w*.53+(w*.43-edge)/2,top+(bottom-top-edge)/2)
	_rect(event_frame,origin.x,origin.y,edge,edge)
	_rect(event_art,origin.x+edge*.187,origin.y+edge*.222,edge*.627,edge*.558)
	_rect(event_image,-event_art.size.x*.035,-event_art.size.y*.035,event_art.size.x*1.07,event_art.size.y*1.07)
	_rect(event_title,origin.x+edge*.207,origin.y+edge*.061,edge*.585,edge*.124)
	event_title.autowrap_mode=TextServer.AUTOWRAP_OFF;event_title.clip_text=true
	event_title.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	event_title.add_theme_font_size_override("font_size",clampi(int(edge*.055),11,15))
	# Preserve the source artwork's caption slot. The larger command copy
	# below remains readable on low-height phones and carries the full text.
	_rect(event_text,origin.x+edge*.225,origin.y+edge*.841,edge*.552,edge*.102)
	event_text.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	event_text.clip_text=true
	event_text.max_lines_visible=2
	event_text.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	event_text.add_theme_font_size_override("font_size",clampi(int(edge*.028),5,9))
	event_text.add_theme_color_override("font_color",Color("dce7e4"))
	_rect(dice,origin.x+edge*.275,origin.y+edge*.275,edge*.45,edge*.45)
	command_title.add_theme_font_size_override("font_size",13);command_text.add_theme_font_size_override("font_size",11)
	_rect(command_title,22,h-83,w*.37,26);_rect(command_text,22,h-55,w*.37,40)
	_rect(footer,w*.42 if main else 22,h-60,w*.55 if main else w-44,44)
	reel.visible=main and model.event.spin!=null
	_rect(reel,event_art.position.x,event_art.position.y,event_art.size.x,event_art.size.y)
	if recruiting:
		var rail_width:=minf(w*.96,h*.96*1672.0/941.0)
		var rail_height:=rail_width*941.0/1672.0
		_rect(recruit_rail,(w-rail_width)/2,(h-rail_height)/2,rail_width,rail_height)
func close_surface() -> void:
	epoch+=1;busy=false;model={};list_signature="";details_signature="";active_floor="";reel.reset();recruit_rail.apply(null,"",{});hide();prepared.clear()
func test_button(key: String) -> Button:
	var stack: Array=[self]
	while not stack.is_empty():
		var node: Node=stack.pop_back()
		if node is Button and node.is_visible_in_tree() and str(node.get_meta("key",""))==key:return node
		stack.append_array(node.get_children())
	return null
func test_reveal_button(key: String) -> bool:
	var button:=test_button(key)
	if button==null:return false
	if scroll.is_ancestor_of(button):scroll.ensure_control_visible(button)
	return true
func test_button_rect_json(key: String) -> String:
	var button:=test_button(key)
	if button==null or button.disabled:return "null"
	var box:=button.get_global_rect()
	if scroll.is_ancestor_of(button):box=box.intersection(scroll.get_global_rect())
	return JSON.stringify([box.position.x,box.position.y,box.size.x,box.size.y])
func test_layout_ok() -> bool:
	if busy or not visible:return false
	if recruit_rail.visible:return Rect2(Vector2.ZERO,size).encloses(recruit_rail.get_rect()) and recruit_rail.layout_ok()
	for control in [scroll,detail_scroll,footer,title,exit_button]:
		if control.visible and not Rect2(Vector2.ZERO,size).encloses(control.get_rect()):return false
	if mode=="main":
		if not is_equal_approx(event_frame.size.x,event_frame.size.y):return false
		for control in [event_art,event_title,event_text,dice,reel]:
			if not event_frame.get_rect().encloses(control.get_rect()):return false
		if event_title.get_rect().intersects(event_art.get_rect()):return false
		if event_text.get_rect().intersects(event_art.get_rect()):return false
		if not event_art.clip_contents:return false
	return true
func test_layout_json() -> String:
	var values: Dictionary={"size":[size.x,size.y],"mode":mode,"busy":busy}
	for entry in [["scroll",scroll],["detail",detail_scroll],["footer",footer],["title",title],["exit",exit_button]]:
		var box: Rect2=entry[1].get_rect();values[entry[0]]={"rect":[box.position.x,box.position.y,box.size.x,box.size.y],"visible":entry[1].visible}
	return JSON.stringify(values)
