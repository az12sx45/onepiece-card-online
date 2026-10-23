extends Control
## Three original phone reading pages, with original source modal controls.
## This component does not calculate selection, battle outcomes or rewards.
signal command_requested(uid: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
const BG="images/board/marineford/backgrounds/marineford_stage_bg.webp"
const GUARD="images/board/marineford/props/execution_guard_crossed_swords.png"
const GUARD_ANIMATION="images/board/marineford/props/execution_cut_video/marine_execution_raise_then_cut_snap_footlock_24fps.webp"
var cache: Node
var model: Dictionary={}
var prepared: Dictionary={}
var epoch:=0
var busy:=false
var page:="execution"
var previous_modal:=""
var controls: Dictionary={}
var used: Dictionary={}
var scroll:=ScrollContainer.new()
var body:=VBoxContainer.new()
var intro:=Label.new()
var slots:=HBoxContainer.new()
var grid:=GridContainer.new()
var rows: Array[Dictionary]=[]
var footer:=HBoxContainer.new()
var execution_layer:=Control.new()
var lottery: Control
var guard_stream: Node
var material_warmup: Node
var rescue_effects: Control
var guard_source:=""
var action_pool: Array[Button]=[]
var slot_pool: Array[Button]=[]
var offsets: Dictionary={}
var packets:=0
var text_writes:=0
var assets_ready:=false

func _ready() -> void:
	hide();clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP
	theme=Theme.new();theme.default_font=preload("res://native_fonts.gd").weighted(550);theme.default_font_size=14
	execution_layer.clip_contents=true;execution_layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(execution_layer)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_SHOW_NEVER;add_child(scroll)
	body.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_theme_constant_override("separation",8);scroll.add_child(body)
	intro.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;intro.mouse_filter=Control.MOUSE_FILTER_IGNORE;body.add_child(intro)
	slots.add_theme_constant_override("separation",6);body.add_child(slots)
	grid.columns=2;grid.add_theme_constant_override("h_separation",8);grid.add_theme_constant_override("v_separation",8);body.add_child(grid)
	footer.add_theme_constant_override("separation",8);add_child(footer)
	lottery=preload("res://native_marineford_lottery.gd").new();add_child(lottery);lottery.hide()
	guard_stream=preload("res://native_frame_stream.gd").new();add_child(guard_stream)
	material_warmup=preload("res://native_marineford_material_warmup.gd").new();add_child(material_warmup)
	rescue_effects=preload("res://native_marineford_rescue.gd").new();add_child(rescue_effects)
	guard_stream.frame_ready.connect(func(_index: int):
		if guard_source.begins_with(GUARD_ANIMATION) and controls.has("animated-guard"):controls["animated-guard"].texture=guard_stream.texture)
	resized.connect(_layout)

func _set_text(node: Label,value: String) -> void:
	if node.text!=value:node.text=value;text_writes+=1
func _place(node: Control,box: Rect2) -> void:node.position=box.position;node.size=box.size
func _node(key: String,kind: String) -> Control:
	used[key]=true
	if controls.has(key):controls[key].show();return controls[key]
	var n: Control
	if kind=="prisoner":n=preload("res://native_marineford_prisoner.gd").new()
	elif kind=="image":n=TextureRect.new();n.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;n.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	elif kind=="frame":
		n=NinePatchRect.new();n.scale=Vector2.ONE*.125
		for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:n.set_patch_margin(side,224)
	elif kind=="label":n=Label.new();n.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;n.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;n.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	else:n=_new_button()
	if not n is Button:n.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(n);controls[key]=n;return n
func _image(key: String,path: String,box: Rect2,cover:=false) -> TextureRect:
	var n: TextureRect=_node(key,"image");_place(n,box);n.texture=prepared.get(path.split("?")[0]);n.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED if cover else TextureRect.STRETCH_KEEP_ASPECT_CENTERED;return n
func _frame(key: String,box: Rect2) -> void:
	var n: NinePatchRect=_node(key,"frame");n.texture=prepared.get(PANEL);n.position=box.position;n.size=box.size/.125;n.draw_center=model.modal.open
func _label(key: String,text: String,box: Rect2,font_size:=14) -> void:
	var n: Label=_node(key,"label");_place(n,box);_set_text(n,text);n.add_theme_font_size_override("font_size",font_size);n.add_theme_color_override("font_color",Color("ffedbd"))
func _new_button() -> Button:
	var n:=Button.new();n.flat=true;n.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	var frame:=NinePatchRect.new();frame.name="Art";frame.show_behind_parent=true;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.scale=Vector2.ONE*.0625;frame.region_rect=Rect2(0,204,2008,360)
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	n.add_child(frame);n.resized.connect(func():frame.size=n.size/.0625)
	n.pressed.connect(func():
		var target: String=n.get_meta("uid","")
		if target.begins_with("page:"):
			offsets[page]=scroll.scroll_vertical;page=target.trim_prefix("page:");_layout();scroll.set_deferred("scroll_vertical",int(offsets.get(page,0)))
		elif not busy and model.get("inputReady",false) and not target.is_empty():command_requested.emit(target)
	)
	return n
func _bind_button(n: Button,data: Dictionary) -> void:
	n.set_meta("uid",str(data.get("uid","")));n.disabled=bool(data.get("disabled",false)) or busy or not model.get("inputReady",false)
	n.text=str(data.get("label",""));n.add_theme_color_override("font_color",Color("ffe9b7"));n.get_node("Art").texture=prepared.get(ROW)
func _button(key: String,data: Dictionary,box: Rect2) -> void:
	var n: Button=_node(key,"button");_place(n,box);_bind_button(n,data)

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible:return
	model=next;packets+=1;epoch+=1;busy=true;_prepare(epoch)
func _prepare(ticket: int) -> void:
	var paths: Array=[PANEL,ROW,BG,GUARD,str(model.execution.platform),str(model.hormone.image)]
	paths.append_array(model.get("cinematic",{}).get("guardHalves",[]))
	var requested_guard: String=str(model.execution.guard)
	if not requested_guard.is_empty() and not requested_guard.begins_with(GUARD_ANIMATION):paths.append(requested_guard.split("?")[0])
	if not str(model.execution.image).is_empty():paths.append(model.execution.image)
	if not str(model.enemy.image).is_empty():paths.append(model.enemy.image)
	for entry in model.crew+model.modal.cards:
		if not str(entry.image).is_empty():paths.append(entry.image)
	if not model.modal.lottery.is_empty():
		paths.append(lottery.FRAME)
		for reel in model.modal.lottery:
			for token in reel.tokens:
				if not str(token.image).is_empty():paths.append(token.image)
	var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+20000
	material_warmup.begin()
	if not guard_stream.enabled:
		var folder:="res://marineford-animation-assets"
		if not guard_stream.configure(folder,JSON.parse_string(FileAccess.get_file_as_string(folder.path_join("manifest.json")))):push_error("Marineford original animation unavailable");return
	while ticket==epoch:
		var complete: bool=guard_stream.current>=0 and material_warmup.complete
		if guard_stream.failure!=OK:push_error("Marineford guard decode failed");return
		for path in paths:
			if loaded.has(path):continue
			var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
			if not cache.records.has(path) and not live and cache.pending.size()>=2:complete=false;continue
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
			else:complete=false
			if cache.failed.has(path):push_error("Marineford source image failed: "+str(path));return
		if complete:break
		if Time.get_ticks_msec()>deadline:push_error("Marineford assets timed out");return
		await get_tree().process_frame
	if ticket!=epoch:return
	prepared=loaded;busy=false;assets_ready=true;show();_layout();surface_ready.emit()

func _layout() -> void:
	if model.is_empty() or not assets_ready:return
	used.clear()
	_image("background",BG,Rect2(Vector2.ZERO,size),true);move_child(controls.background,0)
	var modal: bool=model.modal.open
	if modal or page!="execution":rescue_effects.reset()
	if modal and guard_stream.running:guard_stream.stop();guard_source=""
	if not modal and not str(model.execution.guard).is_empty():page="execution"
	if not modal or model.modal.lottery.is_empty():lottery.reset()
	execution_layer.visible=not modal and page=="execution"
	_frame("panel",Rect2(Vector2.ZERO,size));move_child(controls.panel,1)
	var top:=50.0;var bottom:=52.0;var region:=Rect2(Vector2(20,top),Vector2(size.x-40,size.y-top-bottom))
	_label("title",str(model.modal.title if modal else model.title),Rect2(Vector2(20,6),Vector2(size.x-150 if modal else size.x*.45,38)),19)
	if modal:
		if not model.modal.close.is_empty():_button("close",model.modal.close[0],Rect2(Vector2(size.x-120,8),Vector2(98,34)))
		_modal(region)
	else:
		_label("remaining","剩餘回合　"+str(model.remaining),Rect2(Vector2(size.x*.49,8),Vector2(size.x*.26,32)),14)
		_button("rescue",model.rescue,Rect2(Vector2(size.x*.76,8),Vector2(size.x*.21,34)))
		for i in range(3):
			var key: String=["execution","crew","enemy"][i]
			_button("nav-"+key,{"uid":"page:"+key,"label":["處刑台","己方隊伍","敵方資訊"][i]},Rect2(Vector2(20+i*(size.x-32)/3,size.y-44),Vector2((size.x-48)/3,36)))
		_scroll_cards(model.crew if page=="crew" else [],region,false)
		footer.hide()
		if page=="execution":_execution(region)
		elif page=="enemy":_enemy(region)
		else:
			intro.visible=not str(model.crewEmpty).is_empty();_set_text(intro,str(model.crewEmpty))
		_button("hormone",{"uid":model.hormone.uid,"label":"","disabled":model.hormone.disabled},Rect2(Vector2(24,size.y-100),Vector2(44,44)))
		_image("hormone-image",model.hormone.image,Rect2(Vector2(28,size.y-96),Vector2(36,36)))
	for key in controls:if not used.has(key):controls[key].hide()
	call_deferred("_fit_rows")

func _execution(region: Rect2) -> void:
	scroll.hide()
	_place(execution_layer,region)
	# Exact relative sizes from the approved phone execution scene stylesheet.
	var unit:=minf((region.size.y-26)/100,(size.x-32)/280)
	var top: float=26+(region.size.y-26-unit*100)/2
	var floor_y: float=top+unit*84
	_image("platform",model.execution.platform,Rect2(Vector2(region.size.x*.5-unit*130,floor_y-unit*47.8),Vector2(unit*260,unit*195)))
	if not str(model.execution.image).is_empty():
		var prisoner: Control=_node("prisoner","prisoner");_place(prisoner,Rect2(Vector2(region.size.x*.5-unit*27,floor_y-unit*72),Vector2(unit*54,unit*72)))
		prisoner.apply(prepared.get(str(model.execution.image)),model.execution)
	var guard_box:=Rect2(Vector2(region.size.x*.5-unit*46,floor_y-unit*(72+12.7412)),Vector2.ONE*unit*92)
	var classes: PackedStringArray=str(model.execution.classes).split(" ")
	if classes.has("has-card") and not classes.has("rescued") and not classes.has("execution-playing"):_image("static-guard",GUARD,guard_box).modulate.a=.95
	var next_guard: String=str(model.execution.guard)
	if not next_guard.is_empty():
		guard_box.position.y-=unit*2.1
		if next_guard.begins_with(GUARD_ANIMATION):
			var n: TextureRect=_node("animated-guard","image");_place(n,guard_box);n.texture=guard_stream.texture
			if next_guard!=guard_source:
				guard_stream.seek_elapsed(0)
				if not guard_stream.start():push_error("Original guard first frame not ready")
		else:
			if guard_stream.running:guard_stream.stop()
			_image("animated-guard",next_guard,guard_box)
	elif not guard_source.is_empty():guard_stream.stop()
	guard_source=next_guard
	_label("timer",str(model.execution.timer),Rect2(Vector2(region.size.x*.5-180,0),Vector2(360,24)),13)
	for key in ["platform","prisoner","static-guard","animated-guard","timer"]:
		if controls.has(key) and controls[key].get_parent()!=execution_layer:controls[key].reparent(execution_layer,false)
	var rescue_guard_box:=guard_box
	if next_guard.is_empty():rescue_guard_box.position.y-=unit*2.1
	rescue_guard_box.position+=region.position
	var prisoner_box:=Rect2(region.position+Vector2(region.size.x*.5-unit*27,floor_y-unit*72),Vector2(unit*54,unit*72))
	rescue_effects.apply(model.get("cinematic",{}),prepared,size,rescue_guard_box,prisoner_box)
func _enemy(region: Rect2) -> void:
	scroll.hide()
	var portrait:=Rect2(region.position+Vector2(20,4),Vector2(region.size.x*.42,region.size.y-48))
	_image("enemy-image",model.enemy.image,portrait)
	_label("enemy-name",str(model.enemy.name),Rect2(Vector2(size.x*.5,region.position.y+12),Vector2(size.x*.43,30)),21)
	_label("enemy-description","\n".join(model.enemy.lines),Rect2(Vector2(size.x*.5,region.position.y+50),Vector2(size.x*.43,maxf(40,region.size.y-108))),15)
	if model.enemy.action!=null:_button("battle",{"uid":model.enemy.action.uid,"label":model.enemy.prompt,"disabled":model.enemy.action.disabled},Rect2(Vector2(size.x*.51,region.end.y-42),Vector2(size.x*.41,38)))

func _modal(region: Rect2) -> void:
	var signature: String=str(model.modal.title)+"|"+str(model.modal.classes)
	if signature!=previous_modal:scroll.scroll_vertical=0;previous_modal=signature
	_scroll_cards(model.modal.cards,region,true)
	if not model.modal.lottery.is_empty():
		scroll.hide();lottery.show();_place(lottery,region);lottery.apply(model.modal.lottery,prepared,size.x)
	_set_text(intro,"\n".join(model.modal.paragraphs));intro.visible=not intro.text.is_empty()
	while slot_pool.size()<model.modal.slots.size():
		var n:=_new_button();n.size_flags_horizontal=Control.SIZE_EXPAND_FILL;n.custom_minimum_size.y=34;slots.add_child(n);slot_pool.append(n)
	for i in range(slot_pool.size()):
		slot_pool[i].visible=i<model.modal.slots.size()
		if slot_pool[i].visible:_bind_button(slot_pool[i],model.modal.slots[i])
	slots.visible=not model.modal.slots.is_empty()
	while action_pool.size()<model.modal.footer.size():
		var n:=_new_button();n.size_flags_horizontal=Control.SIZE_EXPAND_FILL;footer.add_child(n);action_pool.append(n)
	for i in range(action_pool.size()):
		action_pool[i].visible=i<model.modal.footer.size()
		if action_pool[i].visible:_bind_button(action_pool[i],model.modal.footer[i])
	footer.visible=not model.modal.footer.is_empty();_place(footer,Rect2(Vector2(24,size.y-44),Vector2(size.x-48,36)))

func _scroll_cards(items: Array,region: Rect2,two_columns: bool) -> void:
	scroll.show();_place(scroll,region);grid.columns=2 if two_columns else 1
	intro.hide();slots.hide()
	while rows.size()<items.size():_new_row()
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.root.visible=i<items.size()
		if not row.root.visible:continue
		var data: Dictionary=items[i];var selectable: bool=data.get("selectable",false)
		_bind_button(row.root,data.actions[0] if selectable and not data.actions.is_empty() else {"uid":"","label":""})
		row.root.text="";row.root.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		row.image.texture=prepared.get(str(data.image));row.image.visible=not str(data.image).is_empty()
		_set_text(row.heading,str(data.title));var copy: String=str(data.text).trim_prefix(str(data.title)).strip_edges()
		for action in data.actions:if not selectable:copy=copy.replace(str(action.label),"").strip_edges()
		_set_text(row.copy,copy);row.actions.visible=not selectable and not data.actions.is_empty()
		while row.buttons.size()<data.actions.size():
			var button:=_new_button();button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;button.custom_minimum_size.y=34;row.actions.add_child(button);row.buttons.append(button)
		for j in range(row.buttons.size()):
			row.buttons[j].visible=not selectable and j<data.actions.size()
			if row.buttons[j].visible:_bind_button(row.buttons[j],data.actions[j])
		row.root.custom_minimum_size=Vector2((region.size.x-12-(8 if two_columns else 0))/grid.columns,100 if row.image.visible else 70)

func _new_row() -> void:
	var root:=_new_button();grid.add_child(root)
	var box:=HBoxContainer.new();box.mouse_filter=Control.MOUSE_FILTER_PASS;box.add_theme_constant_override("separation",10);root.add_child(box)
	var portrait:=TextureRect.new();portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;portrait.custom_minimum_size=Vector2(74,74);portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;box.add_child(portrait)
	var copy_box:=VBoxContainer.new();copy_box.size_flags_horizontal=Control.SIZE_EXPAND_FILL;copy_box.mouse_filter=Control.MOUSE_FILTER_PASS;box.add_child(copy_box)
	var heading:=Label.new();heading.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;heading.add_theme_font_size_override("font_size",15);heading.add_theme_color_override("font_color",Color("ffdf97"));heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy_box.add_child(heading)
	var copy:=Label.new();copy.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;copy.add_theme_font_size_override("font_size",12);copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy_box.add_child(copy)
	var actions:=HBoxContainer.new();actions.add_theme_constant_override("separation",6);copy_box.add_child(actions)
	rows.append({"root":root,"box":box,"image":portrait,"heading":heading,"copy":copy,"actions":actions,"buttons":[]})
func _fit_rows() -> void:
	for row in rows:
		if not row.root.visible:continue
		_place(row.box,Rect2(Vector2(12,10),row.root.size-Vector2(24,20)))
		row.root.custom_minimum_size.y=maxf(row.root.custom_minimum_size.y,row.box.get_combined_minimum_size().y+20)
func close_surface() -> void:
	epoch+=1;busy=false;lottery.reset();guard_stream.stop();guard_source=""
	rescue_effects.reset()
	if controls.has("prisoner"):controls.prisoner.reset()
	hide()
func diagnostics_json() -> String:return JSON.stringify({"visible":visible,"busy":busy,"page":page,"modal":model.get("modal",{}).get("open",false),"rows":rows.size(),"packets":packets,"textWrites":text_writes})
func test_choose_page(key: String) -> void:page=key;_layout()
func test_resize_window(width: int,height: int) -> void:get_window().size=Vector2i(width,height)
func test_layout() -> bool:
	if busy or not visible:return false
	if scroll.visible and scroll.position.y+scroll.size.y>size.y-48:return false
	if footer.visible and footer.position.y+footer.size.y>size.y:return false
	for row in rows:
		if row.root.is_visible_in_tree() and (row.root.size.x>size.x-40 or row.box.get_combined_minimum_size().y>row.root.size.y-19):return false
	return true
func test_button_uids_json() -> String:
	var values: Array=[]
	for node in controls.values():
		if node is Button and node.is_visible_in_tree():values.append(node.get_meta("uid",""))
	for node in action_pool+slot_pool:
		if node.is_visible_in_tree():values.append(node.get_meta("uid",""))
	for row in rows:
		if not row.root.is_visible_in_tree():continue
		values.append(row.root.get_meta("uid",""))
		for node in row.buttons:
			if node.is_visible_in_tree():values.append(node.get_meta("uid",""))
	return JSON.stringify(values)
func geometry_json(kind: String,index:=0) -> String:
	if kind=="marineford":return JSON.stringify({"left":0,"top":0,"width":size.x,"height":size.y})
	if kind in ["slot","slot-img"] and controls.has("prisoner"):
		var box: Rect2=controls.prisoner.get_global_rect()
		return JSON.stringify({"left":box.position.x,"top":box.position.y,"width":box.size.x,"height":box.size.y})
	var result: Dictionary=lottery.geometry(kind,index)
	if result.is_empty():push_error("Marineford geometry not ready: "+kind+" / "+str(index))
	return JSON.stringify(result)
func warm_images_json(value: String) -> bool:
	var complete:=true
	for path in JSON.parse_string(value):
		if prepared.has(path):continue
		if cache.pending.size()>=2:complete=false;continue
		var image: Texture2D=cache.request(path)
		if image:prepared[path]=image
		else:complete=false
	return complete
func test_button(uid: String) -> Button:
	var candidates: Array=controls.values()+action_pool+slot_pool
	for row in rows:candidates.append(row.root);candidates.append_array(row.buttons)
	for node in candidates:
		if node is Button and node.is_visible_in_tree() and str(node.get_meta("uid",""))==uid:return node
	return null
func test_reveal_button(uid: String) -> bool:
	var node:=test_button(uid)
	if node==null:return false
	if scroll.is_ancestor_of(node):scroll.ensure_control_visible(node)
	return true
func test_button_rect_json(uid: String) -> String:
	var node:=test_button(uid)
	if node==null or node.disabled:return "null"
	var box:=node.get_global_rect()
	if scroll.is_ancestor_of(node):box=box.intersection(scroll.get_global_rect())
	return JSON.stringify([box.position.x,box.position.y,box.size.x,box.size.y])
func test_lottery_json() -> String:
	var values: Array=[]
	for i in range(lottery.model.size()):
		var row: Dictionary=lottery.reels[i];var hit:=-1
		for j in range(row.lane.tokens.size()):
			if str(row.lane.tokens[j].classes).split(" ").has("hit"):hit=j
		values.append({"uid":row.signature,"offset":row.lane.offset,"target":row.target,"hit":hit,"width":row.lane.size.x,"tokenWidth":row.lane.token_width,"gap":6,"artSize":[row.frame.size.x,row.frame.size.y],"visible":lottery.is_visible_in_tree()})
	return JSON.stringify(values)
