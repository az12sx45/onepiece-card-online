extends Control
## Same five reading pages as board-pages-phone-v006.js. Rules stay in source JS.
signal command_requested(key: String)
signal surface_ready
const PANEL="mobile/art-ui/mobile-panel-v013.png"
const ROW="mobile/art-ui/mobile-row-v013.png"
var cache: Node
var model: Dictionary={}
var panel:=NinePatchRect.new()
var title:=Label.new()
var wallet:=Label.new()
var exit_button:=Button.new()
var back:=Button.new()
var nav:=HBoxContainer.new()
var tabs: Dictionary={}
var scroll:=ScrollContainer.new()
var content:=VBoxContainer.new()
var rows: Array[Dictionary]=[]
var action:=Button.new()
var action_label:=Label.new()
var detail_frame:=NinePatchRect.new()
var dock:=Control.new()
var ship:=TextureRect.new()
var ship_name:=Label.new()
var sockets: Array[Dictionary]=[]
var toast:=Label.new()
var page: String="upgrades"
var detail_mode:=false
var selection: String=""
var offsets: Dictionary={}
var epoch:=0
var assets_prepared:=false
var row_texture: Texture2D
var needs_view_refresh:=false
var pending_restore:=false
var busy:=false
var applied_epoch:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(550);t.default_font_size=14;theme=t
	panel.scale=Vector2.ONE*.125;panel.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:panel.set_patch_margin(side,224)
	add_child(panel)
	for label in [title,wallet]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(label)
	title.text="水之七島";title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;title.add_theme_font_size_override("font_size",20);title.add_theme_color_override("font_color",Color("ffe3a5"));wallet.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;wallet.add_theme_color_override("font_color",Color("ffe6b5"))
	exit_button.text="離開";exit_button.pressed.connect(func():_source("waterSevenExitBtn"));add_child(exit_button)
	back.text="返回列表";back.pressed.connect(func():_remember();detail_mode=false;selection="";pending_restore=true;_display());add_child(back)
	nav.add_theme_constant_override("separation",6);add_child(nav)
	for entry in [["upgrades","永久升級"],["gear","船隻裝備"],["slots","開孔"],["dock","船塢總覽"],["info","材料與效果"]]:
		var button:=Button.new();button.text=entry[1];button.size_flags_horizontal=Control.SIZE_EXPAND_FILL;button.set_meta("page",entry[0]);nav.add_child(button);tabs[entry[0]]=button;button.pressed.connect(func():_choose(str(button.get_meta("page"))))
	detail_frame.scale=Vector2.ONE*.0625;detail_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;detail_frame.region_rect=Rect2(0,204,2008,360)
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:detail_frame.set_patch_margin(side,160)
	add_child(detail_frame)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_theme_constant_override("separation",8);scroll.add_child(content)
	add_child(action);action.pressed.connect(func():_source(str(action.get_meta("key",""))))
	action_label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;action_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;action_label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;action_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;action.add_child(action_label)
	action_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);action_label.offset_left=12;action_label.offset_right=-12;action_label.offset_top=3;action_label.offset_bottom=-3
	add_child(dock);_picture(ship);dock.add_child(ship);ship_name.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;ship_name.mouse_filter=Control.MOUSE_FILTER_IGNORE;ship_name.add_theme_color_override("font_color",Color("ffe3a5"));dock.add_child(ship_name)
	for index in range(4):
		var button:=Button.new();dock.add_child(button);button.set_meta("slot",index);button.pressed.connect(func():_source(str(button.get_meta("key",""))))
		var icon:=TextureRect.new();_picture(icon);button.add_child(icon);sockets.append({"button":button,"image":icon})
	toast.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;toast.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;toast.mouse_filter=Control.MOUSE_FILTER_IGNORE;toast.add_theme_color_override("font_color",Color("ffe9b8"));add_child(toast)
	resized.connect(_layout);hide()
func _picture(node: TextureRect) -> void:node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("071b2a"))
func _key() -> String:return page+"|"+str(detail_mode)+"|"+selection
func _remember() -> void:offsets[_key()]=scroll.scroll_vertical
func _choose(next: String) -> void:
	if not assets_prepared or busy:return
	_remember();page=next;detail_mode=false;selection="";needs_view_refresh=true;pending_restore=true
	if next in ["upgrades","gear","slots"]:_source("tab:"+next)
	elif next=="dock":_source("tab:gear")
	else:_display()
func _source(key: String) -> void:
	if not assets_prepared or busy or not model.get("inputReady",false) or key.is_empty():return
	if key.begins_with("selectUpgrade:") or key.begins_with("selectGear:"):
		_remember();detail_mode=true;selection=key;page="upgrades" if key.begins_with("selectUpgrade:") else "gear";needs_view_refresh=true;pending_restore=true
	elif key.begins_with("openSlot:"):_remember();page="slots";detail_mode=false;selection="";needs_view_refresh=true;pending_restore=true
	elif key.begins_with("tabJump:"):_remember();page=key.get_slice(":",1);detail_mode=false;selection="";needs_view_refresh=true;pending_restore=true
	command_requested.emit(key)
func _frame(control: Button) -> void:
	control.flat=true
	var frame:=NinePatchRect.new();frame.texture=row_texture;frame.region_rect=Rect2(0,204,2008,360);frame.scale=Vector2.ONE*.0625;frame.show_behind_parent=true;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:frame.set_patch_margin(side,160)
	control.add_child(frame);control.resized.connect(func():frame.size=control.size/.0625);frame.size=control.size/.0625
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not needs_view_refresh:surface_ready.emit();return
	if visible and not pending_restore:_remember()
	if not model.is_empty() and next.tab!=model.tab and page in ["upgrades","gear","slots"] and page!=next.tab:page=next.tab;detail_mode=false;selection=""
	model=next;_display()
func _display() -> void:
	if model.is_empty():return
	epoch+=1;busy=true;_prepare(epoch)
func _request(path: String) -> Texture2D:
	if path.is_empty():return null
	var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
	if not cache.records.has(path) and not live and cache.pending.size()>=2:return null
	return cache.request(path)
func _descriptions() -> Array:
	var result: Array=[]
	if detail_mode:
		result.append({"name":model.detail.heading,"status":model.detail.level,"image":model.detail.image})
		for line in model.detail.paragraphs:result.append({"description":line})
		for entry in model.detail.effects:result.append({"leading":entry.level,"description":entry.copy,"status":entry.status})
		for line in model.detail.otherLines:result.append({"description":line})
		for line in model.detail.meta:result.append({"name":"","description":line})
	elif page=="upgrades":
		for entry in model.upgrades:result.append({"key":entry.key,"name":entry.name,"description":entry.tag,"status":entry.level,"image":entry.image})
	elif page in ["gear","slots"]:
		for entry in model.list:
			var value: Dictionary={"key":entry.get("key",""),"name":entry.name,"description":entry.description if not entry.description.is_empty() else entry.text,"status":entry.status,"image":entry.image}
			if not entry.actions.is_empty():value.key=entry.actions[0].key;value.disabled=entry.actions[0].disabled;value.status=entry.actions[0].label
			result.append(value)
	elif page=="info":
		result.append({"image":model.foreman.image,"name":model.foreman.role+" · "+model.foreman.title,"description":model.foreman.description})
		result.append({"name":"目前全隊效果","description":model.bonusCount})
		for line in model.bonuses:result.append({"name":"","description":line})
		for material in model.materialPairs:result.append({"name":material.name,"description":material.value})
	return result
func _prepare(token: int) -> void:
	var descriptions: Array=_descriptions();var paths: Array=[PANEL,ROW];var loaded: Dictionary={}
	for entry in descriptions:if not entry.get("image","").is_empty():paths.append(entry.image)
	if page=="dock":
		paths.append(model.shipImage)
		for slot in model.sockets:if not slot.image.is_empty():paths.append(slot.image)
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch:
		var all_ready:=true
		for path in paths:
			if loaded.has(path):continue
			var image: Texture2D=_request(path)
			if image:loaded[path]=image
			else:all_ready=false
			if cache.failed.has(path):push_error("Water Seven source asset failed: "+str(path));return
		if all_ready:break
		if Time.get_ticks_msec()>deadline:push_error("Water Seven source assets timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	panel.texture=loaded[PANEL];row_texture=loaded[ROW];detail_frame.texture=row_texture;detail_frame.visible=detail_mode
	content.add_theme_constant_override("separation",2 if detail_mode else 8)
	if not assets_prepared:
		for button in [exit_button,back,action]+tabs.values():_frame(button)
		for socket in sockets:_frame(socket.button)
	assets_prepared=true;title.visible=not detail_mode;back.visible=detail_mode;wallet.text="持有金錢　"+model.berries+"\n船隻孔位　"+model.slots
	for key in tabs:tabs[key].modulate=Color("fff2b7") if key==page else Color("d4c5a5")
	while rows.size()<descriptions.size():_new_row()
	for index in range(rows.size()):
		var row: Dictionary=rows[index];row.root.visible=index<descriptions.size()
		if index>=descriptions.size():row.image.texture=null;continue
		var entry: Dictionary=descriptions[index];row.root.set_meta("key",entry.get("key",""));row.root.disabled=entry.get("disabled",false) or not model.get("inputReady",false)
		row.root.get_child(0).visible=not detail_mode
		row.root.set_meta("padding",Vector2(14,1) if detail_mode else Vector2(14,10))
		row.root.set_meta("minimum",22 if detail_mode else 72)
		row.image.custom_minimum_size=Vector2(92,112) if page=="info" and index==0 else Vector2(52,52)
		row.leading.text=entry.get("leading","");row.leading.visible=not row.leading.text.is_empty()
		row.image.texture=loaded.get(entry.get("image",""));row.image.visible=row.image.texture!=null;row.name.text=entry.get("name","");row.name.visible=not row.name.text.is_empty();row.description.text=entry.get("description","");row.description.visible=not row.description.text.is_empty();row.status.text=entry.get("status","");row.status.visible=not row.status.text.is_empty()
	var primary: Dictionary=model.detail.actions[0] if not model.detail.actions.is_empty() else {}
	action.visible=(detail_mode or page=="slots") and not primary.is_empty()
	if not primary.is_empty():action_label.text=primary.label;action.disabled=primary.disabled or not model.get("inputReady",false);action.set_meta("key",primary.key)
	dock.visible=page=="dock";scroll.visible=not dock.visible
	if dock.visible:
		ship.texture=loaded.get(model.shipImage);ship_name.text="卡雷拉一號船塢　·　"+model.shipName
		for index in range(sockets.size()):
			var slot: Dictionary=model.sockets[index];sockets[index].button.set_meta("key",slot.key);sockets[index].button.tooltip_text=slot.label;sockets[index].image.texture=loaded.get(slot.image);sockets[index].button.text="鎖" if slot.key.begins_with("openSlot:") else "○" if slot.image.is_empty() else ""
	toast.text=model.toast;toast.visible=not toast.text.is_empty();_layout();show()
	# Containers need their wrapped text layout before restoring the reader's
	# offset. Publishing readiness earlier lets a refresh clamp it to a short list.
	for pass_index in range(3):
		await get_tree().process_frame
		if token!=epoch:return
		_fit_rows()
	scroll.scroll_vertical=int(offsets.get(_key(),0));pending_restore=false;needs_view_refresh=false;busy=false;applied_epoch=token;surface_ready.emit()
func _new_row() -> void:
	var root:=Button.new();root.custom_minimum_size.y=72;root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;root.pressed.connect(func():_source(str(root.get_meta("key",""))));content.add_child(root);_frame(root)
	var box:=HBoxContainer.new();box.mouse_filter=Control.MOUSE_FILTER_IGNORE;box.add_theme_constant_override("separation",12);root.add_child(box)
	var image:=TextureRect.new();_picture(image);image.custom_minimum_size=Vector2(52,52);box.add_child(image)
	var leading:=Label.new();leading.custom_minimum_size.x=36;leading.mouse_filter=Control.MOUSE_FILTER_IGNORE;leading.add_theme_color_override("font_color",Color("ffe3a4"));box.add_child(leading)
	var copy:=VBoxContainer.new();copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_child(copy)
	var name_label:=Label.new();name_label.add_theme_font_size_override("font_size",17);name_label.add_theme_color_override("font_color",Color("ffe3a4"));copy.add_child(name_label)
	var description:=Label.new();copy.add_child(description)
	for label in [name_label,description]:label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var status:=Label.new();status.custom_minimum_size.x=76;status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;status.add_theme_color_override("font_color",Color("8be5d7"));status.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;status.mouse_filter=Control.MOUSE_FILTER_IGNORE;box.add_child(status)
	root.resized.connect(func():var padding: Vector2=root.get_meta("padding",Vector2(14,10));box.position=padding;box.size=root.size-padding*2);rows.append({"root":root,"box":box,"name":name_label,"description":description,"status":status,"image":image,"leading":leading})
func _fit_rows() -> void:
	for row in rows:
		if row.root.visible:
			var padding: Vector2=row.root.get_meta("padding",Vector2(14,10));row.box.position=padding;row.box.size=row.root.size-padding*2
			row.root.custom_minimum_size.y=maxf(float(row.root.get_meta("minimum",72)),row.box.get_combined_minimum_size().y+padding.y*2)
func _layout() -> void:
	panel.size=size/.125;title.position=Vector2(16,12);title.size=Vector2(size.x-260,48);wallet.position=Vector2(size.x-248,12);wallet.size=Vector2(176,48);exit_button.position=Vector2(size.x-60,12);exit_button.size=Vector2(48,48);back.position=Vector2(12,12);back.size=Vector2(112,48)
	nav.position=Vector2(12,size.y-60);nav.size=Vector2(size.x-24,48)
	var height: float=size.y-132;var primary_height: float=52 if action.visible else 0
	scroll.position=Vector2(14,66);scroll.size=Vector2(size.x-28,height-primary_height);action.position=Vector2(14,size.y-66-primary_height);action.size=Vector2(size.x-28,46)
	detail_frame.position=scroll.position;detail_frame.size=scroll.size/.0625
	dock.position=Vector2(14,66);dock.size=Vector2(size.x-28,height);ship_name.position=Vector2.ZERO;ship_name.size=Vector2(dock.size.x,28);ship.position=Vector2(0,30);ship.size=Vector2(dock.size.x-122,height-30)
	for index in range(sockets.size()):var button: Button=sockets[index].button;button.position=Vector2(dock.size.x-108+(index%2)*56,40+int(index/2)*maxf(54,(height-50)/2));button.size=Vector2(48,48);sockets[index].image.position=Vector2(4,4);sockets[index].image.size=Vector2(40,40)
	toast.position=Vector2(28,size.y-108);toast.size=Vector2(size.x-56,40);queue_redraw();call_deferred("_fit_rows")
func close_surface() -> void:epoch+=1;hide()
func test_ready() -> bool:return visible and not busy and applied_epoch==epoch
func test_scroll_end() -> int:scroll.scroll_vertical=int(content.size.y);return scroll.scroll_vertical
func test_scroll_position() -> int:return scroll.scroll_vertical
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [title,wallet,exit_button,back,nav,scroll,action,dock]:
		if node.visible and not bounds.encloses(Rect2(node.position,node.size)):return false
	if scroll.visible:
		if action.visible and not Rect2(Vector2.ZERO,action.size).encloses(Rect2(action_label.position,action_label.size)):return false
		if content.size.x>scroll.size.x+1:return false
		for row in rows:
			var padding: Vector2=row.root.get_meta("padding",Vector2(14,10))
			if row.root.visible and (row.box.size.x>row.root.size.x or row.box.get_combined_minimum_size().y>row.root.size.y-padding.y*2+1):return false
	return true
func geometry_json(id: String) -> String:
	var rect:=Rect2()
	if visible and page=="dock" and id in ["shipStage","shipFocusLayer"]:rect=Rect2(dock.position+ship.position,ship.size)
	return JSON.stringify({"left":rect.position.x,"top":rect.position.y,"width":rect.size.x,"height":rect.size.y})
func test_press(key: String) -> bool:
	if key.begins_with("phone:"):
		var target: String=key.get_slice(":",1)
		if target=="back":back.pressed.emit();return true
		if tabs.has(target):tabs[target].pressed.emit();return true
	if key=="waterSevenExitBtn":exit_button.pressed.emit();return true
	if action.visible and action.get_meta("key","")==key and not action.disabled:action.pressed.emit();return true
	for row in rows:
		if row.root.visible and row.root.get_meta("key","")==key and not row.root.disabled:row.root.pressed.emit();return true
	for socket in sockets:
		if dock.visible and socket.button.get_meta("key","")==key:socket.button.pressed.emit();return true
	return false
