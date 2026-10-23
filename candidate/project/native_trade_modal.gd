extends Control
## Original silver trade frame, bilateral offers and green confirmations.
## Inputs dispatch source handlers; native controls never exchange inventory.
signal command_requested(key: String)
signal surface_ready
const Icon=preload("res://native_item_icon.gd")
const FrameShader=preload("res://native_trade_frame.gdshader")
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var busy:=false
var epoch:=0
var heading: Label
var subtitle:=RichTextLabel.new()
var cancel: Button
var panels: Array=[]
var picker_scroll:=ScrollContainer.new()
var picker_content:=Control.new()
var pool: Array=[]
var description:=RichTextLabel.new()
var detail_icon: Control
var footer: Array[Button]=[]
var controls: Dictionary={}
var title_bar: ColorRect

func _style(background: String,border: String) -> StyleBoxFlat:
	var s:=StyleBoxFlat.new();s.bg_color=Color(background);s.border_color=Color(border);s.set_border_width_all(2);s.set_corner_radius_all(5);s.content_margin_left=6;s.content_margin_right=6;return s
func _button(parent: Node,green:=false) -> Button:
	var b:=Button.new();parent.add_child(b);b.add_theme_color_override("font_color",Color("ffffff" if green else "32434d"));b.add_theme_color_override("font_disabled_color",Color("647079"))
	for state in ["normal","hover","pressed","disabled"]:b.add_theme_stylebox_override(state,StyleBoxEmpty.new())
	var frame:=ColorRect.new();frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;frame.show_behind_parent=true;var material:=ShaderMaterial.new();material.shader=FrameShader;frame.material=material;b.add_child(frame);b.set_meta("frame",frame);b.set_meta("green",green)
	b.resized.connect(func():frame.size=b.size;material.set_shader_parameter("extent",b.size));b.mouse_entered.connect(func():_paint_button(b));b.mouse_exited.connect(func():_paint_button(b));b.button_down.connect(func():_paint_button(b));b.button_up.connect(func():_paint_button(b))
	b.pressed.connect(func():if visible and not busy and not b.disabled:command_requested.emit(str(b.get_meta("key",""))));_paint_button(b);return b
func _paint_button(button: Button) -> void:
	var frame: ColorRect=button.get_meta("frame");var material: ShaderMaterial=frame.material;var green: bool=button.get_meta("green",false);var grid: bool=button.get_meta("grid",false)
	var colors: Array=["d7e988","7fc729","56a50f","8aa743"] if green else ["ffffff","f4f7fa","e7eef2","b9c6cd"] if grid else ["fcfcfc","c8d1d6","9eabb2","9ca8ad"]
	if button.is_hovered() and not button.disabled:colors=["fffbe6","fff0b4","ffe9a7","d79824"]
	if button.is_pressed() and not button.disabled:colors=["c8d1d6","b8c5cc","9eabb2","73858e"]
	for i in range(4):material.set_shader_parameter(["top_color","mid_color","bottom_color","border_color"][i],Color(colors[i]))
	material.set_shader_parameter("mid_stop",.55 if green else .58);material.set_shader_parameter("disabled",button.disabled);material.set_shader_parameter("grid",grid)
func _label(parent: Node,font_size:=12) -> Label:
	var n:=Label.new();n.mouse_filter=Control.MOUSE_FILTER_IGNORE;n.add_theme_font_size_override("font_size",font_size);n.add_theme_color_override("font_color",Color("263942"));parent.add_child(n);return n
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;clip_contents=true
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(600);t.default_font_size=13;theme=t
	title_bar=ColorRect.new();title_bar.mouse_filter=Control.MOUSE_FILTER_IGNORE;title_bar.color=Color("23333f");add_child(title_bar)
	heading=_label(self,18);heading.add_theme_color_override("font_color",Color("e9f0d8"));heading.clip_text=true;cancel=_button(self)
	subtitle.bbcode_enabled=false;subtitle.add_theme_font_size_override("normal_font_size",12);subtitle.add_theme_color_override("default_color",Color("263942"));add_child(subtitle)
	for side in range(2):
		var root:=Control.new();add_child(root);var avatar:=TextureRect.new();avatar.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;avatar.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;avatar.mouse_filter=Control.MOUSE_FILTER_IGNORE;root.add_child(avatar)
		var name_label:=_label(root,14);name_label.clip_text=true;var status:=_label(root,11);status.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		var scroll:=ScrollContainer.new();scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;root.add_child(scroll);var content:=Control.new();scroll.add_child(content);var slots: Array=[]
		for i in range(16):
			var b:=_button(content);b.set_meta("grid",true);_paint_button(b);var icon:=Icon.new();b.add_child(icon);var count:=_label(b,11);count.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;slots.append({"button":b,"icon":icon,"count":count})
		var coin_label:=_label(root,12);var coins:=LineEdit.new();coins.virtual_keyboard_type=LineEdit.KEYBOARD_TYPE_NUMBER;coins.add_theme_color_override("font_color",Color("21333c"));coins.add_theme_stylebox_override("normal",_style("ffffff","95a6ae"));root.add_child(coins)
		coins.text_submitted.connect(func(_text):_commit(coins));coins.focus_exited.connect(func():_commit(coins))
		var total:=_label(root,11);total.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;var confirm:=_button(root,true)
		panels.append({"root":root,"avatar":avatar,"name":name_label,"status":status,"scroll":scroll,"content":content,"slots":slots,"coinLabel":coin_label,"coins":coins,"total":total,"confirm":confirm})
	picker_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(picker_scroll);picker_scroll.add_child(picker_content);picker_scroll.get_v_scroll_bar().value_changed.connect(func(_v):_rows();set_process(true))
	for i in range(9):
		var b:=_button(picker_content);var icon:=Icon.new();b.add_child(icon);var name_label:=_label(b,14);var info:=_label(b,12);info.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;name_label.clip_text=true;pool.append({"button":b,"icon":icon,"name":name_label,"info":info})
	detail_icon=Icon.new();add_child(detail_icon);description.bbcode_enabled=false;description.add_theme_color_override("default_color",Color("263942"));description.add_theme_font_size_override("normal_font_size",14);add_child(description)
	for i in range(3):footer.append(_button(self))
	resized.connect(_layout);hide();set_process(false)
func _commit(input: LineEdit) -> void:
	if not visible or busy or not input.editable or input.text==str(input.get_meta("source_value","")):return
	var value:=input.text;input.set_meta("source_value",value);input.release_focus();command_requested.emit("trade-value:"+JSON.stringify({"key":input.get_meta("key"),"value":value}))
func _draw() -> void:
	draw_style_box(_style("d2dde3","1a2530"),Rect2(Vector2.ZERO,size))
	if model.get("page","")=="main":
		for panel in panels:draw_style_box(_style("edf3f6","73858e"),Rect2(panel.root.position-Vector2(4,3),panel.root.size+Vector2(8,6)))
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	if next.page!=model.get("page",""):picker_scroll.scroll_vertical=0
	epoch+=1;busy=true;model=next;controls.clear()
	for c in model.controls:controls[c.key]=c
	_prepare(epoch)
func _paths(icon: Dictionary) -> Array:
	var result: Array=[]
	for key in ["image","portrait","fallback"]:
		var path:=str(icon.get(key,""));if not path.is_empty():result.append(path)
	return result
func _needed() -> Array:
	var result: Array=[]
	if model.page=="main":
		for panel in model.panels:
			if not str(panel.avatar).is_empty():result.append(panel.avatar)
			for slot in panel.slots:result.append_array(_paths(slot.icon))
	elif model.page=="detail":result.append_array(_paths(model.icon))
	elif model.page=="picker":
		var first:=maxi(0,int(picker_scroll.scroll_vertical/72))
		for i in range(first,mini(model.entries.size(),first+pool.size())):result.append_array(_paths(model.entries[i].icon))
	return result
func _load_visible() -> bool:
	var ready:=true
	for path in _needed():
		if textures.has(path):continue
		var texture: Texture2D=cache.request(path)
		if texture:textures[path]=texture
		elif cache.failed.has(path):push_error("Original trade image failed: "+str(path));return false
		else:ready=false
	return ready
func _prepare(token: int) -> void:
	var deadline:=Time.get_ticks_msec()+20000
	while token==epoch and not _load_visible():
		if Time.get_ticks_msec()>deadline:push_error("Original trade assets timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	heading.text=str(model.title)+( " · "+str(model.location) if model.page=="main" else "")
	subtitle.text="\n".join(model.log) if model.page=="main" else str(model.get("subtitle",""))+("\n"+str(model.description) if model.page=="prompt" and not str(model.description).is_empty() else "")
	for i in range(panels.size()):
		var panel: Dictionary=panels[i];panel.root.visible=model.page=="main" and i<model.panels.size()
		if not panel.root.visible:continue
		var data: Dictionary=model.panels[i];panel.avatar.texture=textures.get(data.avatar);panel.name.text=data.name;panel.status.text=str(data.status).replace("\n"," · ")
		for j in range(panel.slots.size()):
			var slot: Dictionary=panel.slots[j];slot.button.visible=j<data.slots.size()
			if not slot.button.visible:continue
			var entry: Dictionary=data.slots[j];_bind(slot.button,entry.key);slot.button.text=controls[entry.key].label if str(entry.icon.image).is_empty() else "";slot.button.tooltip_text=entry.title;slot.icon.present(entry.icon,textures);slot.count.text=entry.count
		panel.coinLabel.text=data.coins.label;panel.coins.set_meta("key",data.coins.key);panel.coins.set_meta("source_value",data.coins.value);panel.coins.text=data.coins.value;panel.coins.editable=not data.coins.disabled;panel.total.text=data.value
		panel.confirm.visible=not data.confirm.is_empty();if panel.confirm.visible:_bind(panel.confirm,data.confirm[0])
	cancel.visible=model.page in ["main","picker","detail"]
	if cancel.visible:_bind(cancel,model.actions[0])
	picker_scroll.visible=model.page in ["picker","prompt"];detail_icon.visible=model.page=="detail";description.visible=model.page=="detail"
	if description.visible:detail_icon.present(model.icon,textures);description.text=str(model.description)+"\n\n"+str(model.price)
	var footer_keys: Array=model.actions.slice(1) if model.page=="detail" else []
	for i in range(footer.size()):footer[i].visible=i<footer_keys.size();if footer[i].visible:_bind(footer[i],footer_keys[i])
	_layout();busy=false;show();surface_ready.emit()
func _bind(button: Button,key: String) -> void:
	var c: Dictionary=controls[key];button.set_meta("key",key);button.text=c.label;button.disabled=c.disabled;_paint_button(button)
func _process(_delta: float) -> void:
	if not visible or busy:set_process(false);return
	var ready:=_load_visible();_rows();if ready:set_process(false)
func _rows() -> void:
	if model.is_empty() or not picker_scroll.visible:return
	var entries: Array=model.entries if model.page=="picker" else model.actions.map(func(k):return {"key":k,"name":controls[k].label,"description":"","icon":{}})
	picker_content.custom_minimum_size=Vector2(maxf(0,picker_scroll.size.x-16),entries.size()*72)
	var first:=maxi(0,int(picker_scroll.scroll_vertical/72))
	for i in range(pool.size()):
		var row: Dictionary=pool[i];var index:=first+i;row.button.visible=index<entries.size()
		if not row.button.visible:continue
		var entry: Dictionary=entries[index];_bind(row.button,entry.key);row.button.text="";row.button.position=Vector2(0,index*72);row.button.size=Vector2(picker_content.custom_minimum_size.x,68);row.icon.position=Vector2(8,8);row.icon.size=Vector2(52,52);row.icon.present(entry.icon,textures);row.name.position=Vector2(70,7);row.name.size=Vector2(row.button.size.x-82,22);row.name.text=entry.name;row.info.position=Vector2(70,30);row.info.size=Vector2(row.button.size.x-82,34);row.info.text=entry.description
func _layout() -> void:
	picker_content.custom_minimum_size.x=0
	title_bar.position=Vector2(5,5);title_bar.size=Vector2(size.x-10,29);heading.position=Vector2(16,7);heading.size=Vector2(size.x-130,25);cancel.position=Vector2(size.x-108,8);cancel.size=Vector2(92,36);subtitle.position=Vector2(16,38);subtitle.size=Vector2(size.x-32,36)
	for i in range(panels.size()):
		var p: Dictionary=panels[i];p.content.custom_minimum_size.x=0;var width: float=(size.x-40)/2;var height: float=size.y-88;p.root.position=Vector2(14+i*(width+12),78);p.root.size=Vector2(width,height);p.avatar.position=Vector2.ZERO;p.avatar.size=Vector2(36,40);p.name.position=Vector2(42,0);p.name.size=Vector2(width-44,18);p.status.position=Vector2(42,18);p.status.size=Vector2(width-44,25)
		var coins_y:=height-90;p.scroll.position=Vector2(0,44);p.scroll.size=Vector2(width,maxf(44,coins_y-48));var slot_width: float=(width-26)/4
		for j in range(p.slots.size()):
			var s: Dictionary=p.slots[j];s.button.position=Vector2((j%4)*(slot_width+4),floorf(float(j)/4)*48);s.button.size=Vector2(slot_width,44);s.icon.position=Vector2(3,2);s.icon.size=Vector2(slot_width-6,40);s.count.position=Vector2(3,27);s.count.size=Vector2(slot_width-6,15)
		var count: int=model.panels[i].slots.size() if model.get("page","")=="main" and i<model.panels.size() else 0;p.content.custom_minimum_size=Vector2(width-14,ceili(float(count)/4)*48);p.coinLabel.position=Vector2(0,coins_y);p.coinLabel.size=Vector2(64,30);p.coins.position=Vector2(66,coins_y);p.coins.size=Vector2(width-66,30);p.total.position=Vector2(0,coins_y+33);p.total.size=Vector2(width,18);p.confirm.position=Vector2(0,height-36);p.confirm.size=Vector2(width,36)
	picker_scroll.position=Vector2(16,78);picker_scroll.size=Vector2(size.x-32,maxf(60,size.y-94));_rows()
	detail_icon.position=Vector2(24,84);detail_icon.size=Vector2(size.x*.24,size.y-150);description.position=Vector2(size.x*.3,80);description.size=Vector2(size.x*.7-24,size.y-146)
	var shown: Array=footer.filter(func(b):return b.visible)
	for i in range(shown.size()):var width: float=(size.x-40-(shown.size()-1)*8)/shown.size();shown[i].position=Vector2(20+i*(width+8),size.y-52);shown[i].size=Vector2(width,38)
	queue_redraw()
func close_surface() -> void:epoch+=1;busy=false;hide();set_process(false)
func test_ready() -> bool:
	if not visible or busy:return false
	for path in _needed():
		if not textures.has(path):return false
	return true
func test_identity_json() -> String:
	var ids: Array=[get_instance_id(),heading.get_instance_id(),description.get_instance_id(),picker_content.get_instance_id()]
	for p in panels:
		ids.append(p.root.get_instance_id());ids.append(p.coins.get_instance_id())
		for slot in p.slots:ids.append(slot.button.get_instance_id());ids.append(slot.icon.get_instance_id())
	for row in pool:ids.append(row.button.get_instance_id());ids.append(row.icon.get_instance_id())
	return JSON.stringify(ids)
func _find_button(key: String) -> Button:
	var buttons: Array=[cancel];buttons.append_array(footer)
	for p in panels:
		buttons.append(p.confirm)
		for slot in p.slots:buttons.append(slot.button)
	for row in pool:buttons.append(row.button)
	for button in buttons:
		if button.is_visible_in_tree() and str(button.get_meta("key",""))==key:return button
	return null
func test_reveal_button(key: String) -> bool:
	if not visible or busy:return false
	if model.page in ["picker","prompt"]:
		var keys: Array=model.entries.map(func(e):return e.key) if model.page=="picker" else model.actions
		var i:=keys.find(key)
		if i>=0:picker_scroll.scroll_vertical=i*72;_rows();set_process(true)
	var button:=_find_button(key)
	if button==null or button.disabled:return false
	for p in panels:
		if button.get_parent()==p.content:p.scroll.ensure_control_visible(button)
	return true
func test_button_rect_json(key: String) -> String:
	var button:=_find_button(key)
	if button==null:return "null"
	var r:=button.get_global_rect()
	if not get_global_rect().encloses(r):
		print(JSON.stringify({"tradeControlOutside":key,"button":str(r),"surface":str(get_global_rect()),"picker":str(picker_scroll.get_global_rect())}));return "null"
	return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
func test_enter_coins(key: String,value: String) -> bool:
	for p in panels:
		if p.root.visible and p.coins.editable and str(p.coins.get_meta("key",""))==key:p.coins.grab_focus();p.coins.text=value;p.coins.text_submitted.emit(value);return true
	return false
func test_layout_json() -> String:
	var bounded:=true;var read_clear:=true;var viewport:=Rect2(Vector2.ZERO,size)
	if model.page=="main":
		for p in panels:
			if not p.root.visible:continue
			for n in [p.scroll,p.coins,p.total,p.confirm]:
				if n.visible and not viewport.encloses(Rect2(p.root.position+n.position,n.size)):bounded=false
			if p.scroll.position.y+p.scroll.size.y>p.coins.position.y or p.total.position.y+p.total.size.y>p.confirm.position.y:read_clear=false
			if p.status.position.y+p.status.get_minimum_size().y>p.scroll.position.y:read_clear=false
	elif model.page in ["picker","prompt"]:bounded=viewport.encloses(Rect2(picker_scroll.position,picker_scroll.size))
	else:
		bounded=viewport.encloses(Rect2(description.position,description.size))
		for b in footer:
			if b.visible and (not viewport.encloses(Rect2(b.position,b.size)) or description.position.y+description.size.y>b.position.y):read_clear=false
	return JSON.stringify({"bounded":bounded,"readingClear":read_clear,"pool":pool.size(),"page":model.page})
