extends Control
## Original recruit artwork and controls, full-screen landscape layout. No
## random choices or draft state live here; every command returns to source JS.
signal command_requested(key: String)
signal surface_ready
const ROOT="images/board/draft_recruitment/"
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ACTION="mobile/art-ui/mobile-row-v013.png"
const Css=preload("res://native_evolution_motion.gd")
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var epoch:=0
var background:=TextureRect.new()
var detail_frame:=NinePatchRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var crew_label:=Label.new()
var order:=RichTextLabel.new()
var crew_pictures: Array[TextureRect]=[]
var wheel:=Control.new()
var disc:=TextureRect.new()
var pointer:=TextureRect.new()
var tier_labels: Array[Label]=[]
var wheel_result:=Label.new()
var scroll:=ScrollContainer.new()
var cards:=GridContainer.new()
var rows: Dictionary={}
var card_signature:=""
var controls: Dictionary={}
var portrait:=TextureRect.new()
var traits:=Label.new()
var stats:=Label.new()
var details:=RichTextLabel.new()
var stamp:=TextureRect.new()
var stamp_text:=Label.new()
var wheel_from:=0.0
var wheel_to:=0.0
var wheel_duration:=0.0
var wheel_began:=0
var wheel_curve: Array=[0,0,1,1]
var detail_visible:=false
var title_frame:=NinePatchRect.new()
var crew_frame:=NinePatchRect.new()
var order_frame:=NinePatchRect.new()
var order_grid:=GridContainer.new()
var order_signature:=""
var order_open:=false
var crew_numbers: Array[Label]=[]
var crew_borders: Array[TextureRect]=[]
var order_hint:=Label.new()

func picture(node: TextureRect) -> void:
	node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;hide()
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=14;theme=t
	picture(background);background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;add_child(background)
	for frame in [title_frame,crew_frame,order_frame]:
		frame.scale=Vector2.ONE*.125;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,224)
		add_child(frame)
	add_child(order_grid);order_grid.add_theme_constant_override("h_separation",3);order_grid.add_theme_constant_override("v_separation",3)
	for label in [title,subtitle,crew_label,wheel_result,traits,stats,stamp_text]:
		label.add_theme_color_override("font_color",Color("fff3cf"));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_offset_x",1);label.add_theme_constant_override("shadow_offset_y",1);label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;add_child(label)
	title.add_theme_font_size_override("font_size",21);title.clip_text=true;subtitle.clip_text=true;crew_label.clip_text=true;wheel_result.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	order.bbcode_enabled=false;order.scroll_active=true;order.add_theme_color_override("default_color",Color("fff3cf"));add_child(order)
	for i in range(3):
		var frame:=TextureRect.new();picture(frame);add_child(frame);crew_borders.append(frame)
		var p:=TextureRect.new();picture(p);add_child(p);crew_pictures.append(p)
		var label:=Label.new();label.text=str(i+1);label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label);crew_numbers.append(label)
	add_child(wheel);picture(disc);wheel.add_child(disc);picture(pointer);wheel.add_child(pointer)
	for i in range(6):var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_color",Color("fff3cf"));disc.add_child(label);tier_labels.append(label)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);cards.size_flags_horizontal=Control.SIZE_EXPAND_FILL;cards.add_theme_constant_override("h_separation",8);cards.add_theme_constant_override("v_separation",8);scroll.add_child(cards)
	detail_frame.scale=Vector2.ONE*.125;detail_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:detail_frame.set_patch_margin(side,224)
	add_child(detail_frame);picture(portrait);add_child(portrait);details.bbcode_enabled=false;details.scroll_active=true;details.add_theme_color_override("default_color",Color("fff3cf"));add_child(details);picture(stamp);add_child(stamp)
	for label in [title,subtitle,traits,stats,stamp_text]:move_child(label,-1)
	order_hint.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;order_hint.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;order_hint.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(order_hint)
	resized.connect(_layout)

func _button(key: String) -> Button:
	if controls.has(key):return controls[key]
	var button:=Button.new();button.flat=true;button.clip_text=true;button.add_theme_font_size_override("font_size",16);button.set_meta("key",key);add_child(button)
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360);frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	button.add_child(frame);button.set_meta("frame",frame);button.resized.connect(func():frame.size=button.size/.0625)
	button.pressed.connect(func():
		if visible and not button.disabled:
			if key=="draft-order-toggle":order_open=not order_open;_layout()
			else:command_requested.emit(key)
	);controls[key]=button;return button

func apply_json(json: String) -> void:
	epoch+=1;_prepare(JSON.parse_string(json),epoch)

func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=[ROOT+"draft_harbor_recruitment_bg.webp",ROOT+"draft_destiny_wheel.webp",ROOT+"draft_destiny_pointer.webp",ROOT+"draft_character_card_frame.webp",ROOT+"draft_boarding_stamp.webp",PANEL,ACTION]
	for row in value.cards+value.crew+value.players:if not str(row.get("image","")).is_empty():paths.append(row.image)
	for row in value.cards:paths.append(row.roleImage)
	if value.detail:paths.append(value.detail.image)
	var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Original draft image failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Draft images timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	prepared=loaded;model=value;detail_visible=value.detail!=null
	for frame in [title_frame,crew_frame,order_frame]:frame.texture=loaded[PANEL]
	background.texture=loaded[ROOT+"draft_harbor_recruitment_bg.webp"];disc.texture=loaded[ROOT+"draft_destiny_wheel.webp"];pointer.texture=loaded[ROOT+"draft_destiny_pointer.webp"];detail_frame.texture=loaded[PANEL];stamp.texture=loaded[ROOT+"draft_boarding_stamp.webp"]
	title.text=value.detail.name if detail_visible else value.title;subtitle.text=value.detail.traits if detail_visible else value.subtitle;crew_label.text=value.crewHeading
	var order_text:="";var count: int=value.players.size()
	for round_index in range(3):
		order_text+="第 %d 輪 %s\n"%[round_index+1,"→" if round_index%2==0 else "←"]
		for i in range(count):var cell: Dictionary=value.cells[round_index*count+i];order_text+="%s %s · %s\n"%[cell.number,value.players[i].name,cell.text]
		order_text+="\n"
	if order.text!=order_text:order.text=order_text
	var grid_signature:=JSON.stringify([value.players,value.cells])
	if order_signature!=grid_signature:
		order_signature=grid_signature
		for child in order_grid.get_children():order_grid.remove_child(child);child.queue_free()
		order_grid.columns=count+1
		_order_cell("順位",false,true)
		for player in value.players:_order_cell(player.name,false,true)
		for round_index in range(3):
			_order_cell("第 %d 輪 %s"%[round_index+1,"→" if round_index%2==0 else "←"],false,true)
			for i in range(count):var cell: Dictionary=value.cells[round_index*count+i];_order_cell(cell.number+"  "+cell.text,cell.current,false)
	for i in range(3):crew_pictures[i].texture=loaded.get(value.crew[i].image);crew_pictures[i].tooltip_text=value.crew[i].name;crew_borders[i].texture=loaded[ROOT+"draft_character_card_frame.webp"]
	order_hint.text=value.orderHint
	for button in controls.values():button.hide()
	for entry in value.controls:
		if entry.key in ["confirmDraftOrderBtn","recruitRollBtn","setupLoadGameBtn","draftDetailCloseBtn","draftConfirmPickBtn"]:
			var button:=_button(str(entry.key));button.text=entry.label;button.disabled=entry.disabled;button.get_meta("frame").texture=loaded[ACTION];button.visible=not entry.hidden and (entry.key.begins_with("draft") if detail_visible else entry.key in value.actions)
	var toggle:=_button("draft-order-toggle");toggle.get_meta("frame").texture=loaded[ACTION];toggle.visible=not detail_visible and value.mode!="draft-mode-order"
	wheel_result.text=value.wheelResult
	if value.has("tiers"):for i in range(6):tier_labels[i].text=value.tiers[i]
	var signature:=JSON.stringify(value.cards)
	if signature!=card_signature:
		card_signature=signature
		for child in cards.get_children():cards.remove_child(child);child.queue_free()
		rows.clear()
		for entry in value.cards:
			var button:=Button.new();button.flat=true;button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;button.set_meta("key",entry.key);cards.add_child(button);button.pressed.connect(func():command_requested.emit(str(button.get_meta("key"))))
			var art:=TextureRect.new();picture(art);art.texture=loaded[entry.image];art.z_index=1;button.add_child(art)
			var frame:=TextureRect.new();picture(frame);frame.texture=loaded[ROOT+"draft_character_card_frame.webp"];button.add_child(frame)
			var text:=Label.new();text.z_index=2;text.mouse_filter=Control.MOUSE_FILTER_IGNORE;text.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;text.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;text.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;text.clip_text=true;text.text=entry.name;text.add_theme_font_size_override("font_size",10);button.add_child(text);button.tooltip_text=entry.name+"\n"+entry.passive
			var grade:=Label.new();grade.z_index=3;grade.text=entry.grade;grade.mouse_filter=Control.MOUSE_FILTER_IGNORE;grade.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;grade.add_theme_font_size_override("font_size",14);grade.add_theme_color_override("font_color",Color("ffe1a1"));grade.add_theme_color_override("font_shadow_color",Color.BLACK);grade.add_theme_constant_override("shadow_outline_size",4);button.add_child(grade)
			var role:=TextureRect.new();picture(role);role.z_index=3;role.texture=loaded[entry.roleImage];button.add_child(role)
			var meta:=Label.new();meta.z_index=2;meta.mouse_filter=Control.MOUSE_FILTER_IGNORE;meta.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;meta.clip_text=true;meta.text=entry.meta;meta.add_theme_font_size_override("font_size",10);button.add_child(meta)
			rows[entry.key]={"button":button,"art":art,"frame":frame,"text":text,"meta":meta,"grade":grade,"role":role}
	if detail_visible:
		portrait.texture=loaded[value.detail.image];stats.text="  ".join(PackedStringArray(value.detail.stats.map(func(s):return str(s.label)+" "+str(s.value))))
		var prose: String=value.detail.passive+"\n"+value.detail.effect+"\n\n查看招式\n"+value.detail.moves
		if details.text!=prose:details.text=prose;details.scroll_to_line(0)
	stamp.visible=detail_visible and value.stamp;stamp_text.visible=stamp.visible;stamp_text.text="正式登船"
	_layout();show();surface_ready.emit()

func _order_cell(text: String,current: bool,header: bool) -> void:
	var label:=Label.new();label.text=text;label.clip_text=true;label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL;label.add_theme_font_size_override("font_size",11);label.add_theme_color_override("font_color",Color("ffe6a6") if header else Color("2c2416"))
	if not header:
		var box:=StyleBoxFlat.new();box.bg_color=Color("fff3bc") if current else Color(.83,.79,.65,.80);box.set_corner_radius_all(5);box.set_content_margin_all(3);label.add_theme_stylebox_override("normal",box)
	order_grid.add_child(label)

func _layout() -> void:
	background.size=size;detail_frame.size=size/.125
	if model.is_empty():return
	var compact:=size.y<500;var top:=64.0;var footer:=size.y-54.0
	title_frame.position=Vector2(10,3);title_frame.size=Vector2(size.x-20,54)/.125;title_frame.visible=not detail_visible;crew_frame.visible=not detail_visible
	title.position=Vector2(18,8);title.size=Vector2(size.x-36,27);subtitle.position=Vector2(18,36);subtitle.size=Vector2(size.x-36,22)
	for node in [order,crew_label,wheel,scroll]:node.visible=not detail_visible
	for node in [detail_frame,portrait,stats,details]:node.visible=detail_visible
	for p in crew_pictures:p.visible=not detail_visible
	for i in range(3):crew_numbers[i].visible=not detail_visible and crew_pictures[i].texture==null
	for frame in crew_borders:frame.visible=not detail_visible
	order_hint.visible=not detail_visible and model.mode=="draft-mode-order"
	order.hide();order_frame.visible=false;order_grid.visible=false
	traits.hide()
	if detail_visible:
		portrait.position=Vector2(28,top);portrait.size=Vector2(size.x*.31,footer-top-10)
		stats.position=Vector2(size.x*.36,top);stats.size=Vector2(size.x*.60,30);stats.add_theme_font_size_override("font_size",14 if compact else 20)
		details.position=Vector2(size.x*.36,top+38);details.size=Vector2(size.x*.59,footer-top-45)
		_set_button("draftDetailCloseBtn",Rect2(24,footer,90,40));_set_button("draftConfirmPickBtn",Rect2(size.x*.36,footer,size.x*.60,40))
		stamp.position=Vector2(size.x*.44,size.y*.24);stamp.size=Vector2(size.x*.35,size.y*.45);stamp_text.position=stamp.position;stamp_text.size=stamp.size;stamp_text.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;stamp_text.add_theme_font_size_override("font_size",25)
	else:
		var pick: bool=model.mode=="draft-mode-pick";var spinning: bool=model.mode=="draft-mode-wheel"
		wheel.visible=spinning;scroll.visible=pick
		order.position=Vector2(24,top+8);order.size=Vector2(size.x*(.28 if spinning else .53)-32,footer-top-8)
		crew_frame.position=Vector2(size.x*.70,top+44);crew_frame.size=Vector2(size.x*.28,footer-top-54)/.125
		crew_label.position=Vector2(size.x*.71,top+49);crew_label.size=Vector2(size.x*.26,30);crew_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		for i in range(3):
			crew_pictures[i].position=Vector2(size.x*.72+i*size.x*.085,top+83);crew_pictures[i].size=Vector2(size.x*.079,footer-top-102);crew_numbers[i].position=crew_pictures[i].position;crew_numbers[i].size=crew_pictures[i].size
			crew_borders[i].position=crew_pictures[i].position;crew_borders[i].size=crew_pictures[i].size
		if pick:
			scroll.position=Vector2(16,top);scroll.size=Vector2(size.x*.67,footer-top-8);cards.columns=3 if size.x<1000 else 5
			var width: float=(scroll.size.x-20-(cards.columns-1)*8)/cards.columns;var height:=maxf(158,minf(scroll.size.y-4,width/.727))
			for row in rows.values():
				row.button.custom_minimum_size=Vector2(width,height);row.frame.size=Vector2(width,height)
				var natural: Vector2=row.frame.texture.get_size();var actual: Vector2=natural*minf(width/natural.x,height/natural.y);var origin: Vector2=(Vector2(width,height)-actual)*.5
				row.art.position=origin+actual*Vector2(.11,.085);row.art.size=actual*Vector2(.78,.59);row.text.position=origin+actual*Vector2(.10,.67);row.text.size=actual*Vector2(.80,.15);row.meta.position=origin+actual*Vector2(.10,.83);row.meta.size=actual*Vector2(.80,.12)
				row.grade.position=origin+actual*Vector2(.08,.07);row.grade.size=actual*Vector2(.24,.14);row.role.position=origin+actual*Vector2(.70,.08);row.role.size=Vector2.ONE*actual.x*.20
				var meta_font: Font=row.meta.get_theme_font("font");var meta_size:=10
				while meta_size>8 and meta_font.get_string_size(row.meta.text,HORIZONTAL_ALIGNMENT_LEFT,-1,meta_size).x>row.meta.size.x:meta_size-=1
				row.meta.add_theme_font_size_override("font_size",meta_size)
		var diameter:=minf(size.y-132,size.x*.36);wheel.position=Vector2(20,top);wheel.size=Vector2.ONE*diameter;disc.size=wheel.size;disc.pivot_offset=disc.size*.5;pointer.position=Vector2(diameter*.42,-diameter*.055);pointer.size=Vector2(diameter*.16,diameter*.24)
		for i in range(6):var angle:=deg_to_rad(-90+i*60);var label: Label=tier_labels[i];label.size=Vector2(30,30);label.position=disc.size*.5+Vector2(cos(angle),sin(angle))*diameter*.31-label.size*.5;label.add_theme_font_size_override("font_size",17 if compact else 26)
		wheel_result.visible=spinning;wheel_result.position=Vector2(diameter+30,top+50);wheel_result.size=Vector2(maxf(100,size.x*.67-diameter-35),100)
		_set_button("confirmDraftOrderBtn",Rect2(16,footer,size.x*.76,40));_set_button("recruitRollBtn",Rect2(16,footer,size.x*.76,40));_set_button("setupLoadGameBtn",Rect2(size.x*.80,footer,size.x*.18,40));_set_button("draft-order-toggle",Rect2(size.x*.70,top,size.x*.28,38));controls["draft-order-toggle"].text="收起選角順序 −" if order_open else "查看選角順序 +"
		order_frame.visible=model.mode=="draft-mode-order" or order_open;order_grid.visible=order_frame.visible
		if order_frame.visible:
			var board_height:=minf(footer-top-12,size.y*.40) if model.mode=="draft-mode-order" else footer-top-12
			order_frame.position=Vector2(16,top);order_frame.size=Vector2(size.x*.66,board_height)/.125;order_grid.position=order_frame.position+Vector2(12,12);order_grid.size=Vector2(size.x*.66-24,board_height-24)
			for index in range(order_grid.get_child_count()):order_grid.get_child(index).custom_minimum_size=Vector2(68 if index%order_grid.columns==0 else (order_grid.size.x-68-3*(order_grid.columns-1))/(order_grid.columns-1),(order_grid.size.y-9)/4)
			order_hint.position=Vector2(22,top+board_height+8);order_hint.size=Vector2(size.x*.65-20,footer-top-board_height-12)
			order_frame.z_index=4;order_grid.z_index=5
	if detail_visible:wheel_result.hide()

func _set_button(key: String,rect: Rect2) -> void:
	if controls.has(key):controls[key].position=rect.position;controls[key].size=rect.size

func wheel_motion_json(value: String) -> void:
	var motion: Dictionary=JSON.parse_string(value);wheel_from=disc.rotation_degrees;wheel_to=motion.angle;wheel_duration=motion.duration;wheel_curve=motion.curve;wheel_began=Time.get_ticks_msec()
	if wheel_duration<=0:disc.rotation_degrees=wheel_to

func _process(_delta: float) -> void:
	if wheel_duration>0:
		var progress:=clampf(float(Time.get_ticks_msec()-wheel_began)/wheel_duration,0,1);disc.rotation_degrees=lerpf(wheel_from,wheel_to,Css._ease(progress,wheel_curve))
		if progress>=1:wheel_duration=0

func close_surface() -> void:epoch+=1;hide();wheel_duration=0
func test_press(key: String) -> bool:
	if not visible:return false
	if rows.has(key):rows[key].button.pressed.emit();return true
	if not controls.has(key) or not controls[key].visible or controls[key].disabled:return false
	controls[key].pressed.emit();return true
func test_state_json() -> String:return JSON.stringify({"kind":model.get("mode",""),"detail":detail_visible,"cards":rows.size(),"wheelAngle":disc.rotation_degrees,"wheelMoving":wheel_duration>0,"title":title.text,"visible":visible})
func test_layout() -> bool:
	var viewport:=Rect2(Vector2.ZERO,size)
	for button in controls.values():
		if button.visible and (not viewport.encloses(Rect2(button.position,button.size)) or button.size.y<38):return false
	if detail_visible:return details.position.y+details.size.y<controls.draftConfirmPickBtn.position.y and viewport.encloses(Rect2(portrait.position,portrait.size))
	return not scroll.visible or scroll.position.y+scroll.size.y<size.y-54
func test_identity_json() -> String:return JSON.stringify({"rows":rows.values().map(func(row):return row.button.get_instance_id()),"disc":disc.get_instance_id(),"portrait":portrait.get_instance_id()})
func test_repeat() -> void:apply_json(JSON.stringify(model))
