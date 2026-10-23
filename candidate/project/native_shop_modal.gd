extends Control
## Original shop model/handlers, persistent list rows and fixed native actions.
signal command_requested(key: String)
signal surface_ready
const Fonts=preload("res://native_fonts.gd")
var cache: Node
var model: Dictionary={}
var background:=NinePatchRect.new()
var title:=Label.new()
var money:=Label.new()
var selected_image:=TextureRect.new()
var details:=RichTextLabel.new()
var list_scroll:=ScrollContainer.new()
var list:=VBoxContainer.new()
var rows: Dictionary={}
var buy: Button
var leave: Button
var minus: Button
var plus: Button
var confirm: Button
var cancel: Button
var quantity:=Label.new()
var total:=Label.new()
var maximum:=Label.new()
var targets: Array[Control]=[]
var prepared: Dictionary={}
var epoch:=0
var wanted_scroll:=0
var row_texture: Texture2D
var list_writes:=0
var text_writes:=0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	var native_theme:=Theme.new();native_theme.default_font=Fonts.weighted(550);native_theme.default_font_size=15;theme=native_theme
	background.scale=Vector2.ONE*0.125;background.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:background.set_patch_margin(margin,224)
	add_child(background);targets.append(background)
	for label in [title,money,quantity,total,maximum]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.clip_text=true;label.add_theme_color_override("font_color",Color("f5e5c5"));add_child(label)
	title.add_theme_font_size_override("font_size",21);title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	quantity.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;quantity.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;quantity.add_theme_font_size_override("font_size",25)
	_prepare_picture(selected_image);add_child(selected_image);targets.append(selected_image)
	details.bbcode_enabled=false;details.scroll_active=true;details.add_theme_color_override("default_color",Color("f5e5c5"));add_child(details)
	list_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(list_scroll)
	list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;list.add_theme_constant_override("separation",4);list_scroll.add_child(list)
	list_scroll.get_v_scroll_bar().value_changed.connect(func(_value):_update_visible_thumbnails())
	buy=_button("shopBuyBtn",self);leave=_button("leaveShopBtn",self)
	minus=_button("shopQtyMinus",self);plus=_button("shopQtyPlus",self)
	confirm=_button("shopQtyConfirm",self);cancel=_button("shopQtyCancel",self)
	cache.asset_ready.connect(_asset_ready);resized.connect(_layout);hide()

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("081925"))

func _prepare_picture(picture: TextureRect) -> void:
	picture.mouse_filter=Control.MOUSE_FILTER_IGNORE;picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;picture.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED

func _button(key: String,parent: Node) -> Button:
	var button:=Button.new();button.flat=true;button.set_meta("key",key);button.clip_text=true;parent.add_child(button)
	var frame:=NinePatchRect.new();frame.scale=Vector2.ONE*0.0625;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	# The original SVG crops the PNG with viewBox="0 204 2008 360".
	# Use that same region before nine-slicing, instead of stretching its padding.
	frame.region_rect=Rect2(0,204,2008,360)
	for margin in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(margin,160)
	button.add_child(frame);frame.show_behind_parent=true;button.set_meta("frame",frame)
	button.resized.connect(func():frame.size=button.size/0.0625)
	button.pressed.connect(func():_press(str(button.get_meta("key"))));return button

func _text(control: Control,value: String) -> void:
	if control.text!=value:control.text=value;text_writes+=1

func _image(control: Control,path: String) -> void:
	control.set_meta("wanted",path)
	if path.is_empty():control.texture=null;return
	if control.texture!=null and control.get_meta("loaded","")==path:return
	var texture: Texture2D=prepared.get(path)
	if texture==null:texture=cache.request(path)
	if texture!=null:control.texture=texture;control.set_meta("loaded",path)

func _asset_ready(path: String,texture: Texture2D) -> void:
	for control in targets:
		if not is_instance_valid(control) or control.get_meta("wanted","")!=path:continue
		if control.get_meta("thumbnail",false) and not _thumbnail_visible(control):continue
		if control.texture==null or control.get_meta("loaded","")!=path:control.texture=texture;control.set_meta("loaded",path)

func _thumbnail_visible(picture: Control) -> bool:
	return visible and model.get("kind","")=="shop" and list_scroll.get_global_rect().grow(56).intersects(picture.get_parent().get_global_rect())

func _update_visible_thumbnails() -> void:
	for row in rows.values():
		var picture: TextureRect=row.picture
		if _thumbnail_visible(picture):_image(picture,str(picture.get_meta("wanted","")))
		else:picture.texture=null;picture.remove_meta("loaded")

func apply_json(value: String) -> void:
	epoch+=1;wanted_scroll=list_scroll.scroll_vertical if model.get("kind","")=="shop" else 0
	_disable_actions();_prepare(JSON.parse_string(value),epoch)

func _prepare(value: Dictionary,token: int) -> void:
	var paths: Array=["mobile/art-ui/mobile-panel-v013.png","mobile/art-ui/mobile-row-v013.png"]
	var art: String=value.image if value.kind in ["shop-quantity","training-quantity","healing-quantity"] else value.selected.image
	if not art.is_empty():paths.append(art)
	var available: Dictionary={};var deadline:=Time.get_ticks_msec()+15000
	# Cache eviction must not recreate textures already retained by this page.
	for path in paths:
		if prepared.has(path):available[path]=prepared[path]
	while token==epoch:
		var ready:=true
		for path in paths:
			if available.has(path):continue
			if cache.failed.has(path):push_error("Native shop asset failed: "+str(path));return
			var texture: Texture2D=cache.request(path)
			if texture!=null:available[path]=texture
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Native shop assets timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	prepared=available;model=value;row_texture=prepared[paths[1]];_commit()

func _commit() -> void:
	_image(background,"mobile/art-ui/mobile-panel-v013.png")
	_text(title,model.title)
	var is_quantity: bool=model.kind in ["shop-quantity","training-quantity","healing-quantity"]
	list_scroll.visible=not is_quantity;money.visible=not is_quantity;buy.visible=not is_quantity;leave.visible=not is_quantity
	for control in [minus,plus,confirm,cancel,quantity,total,maximum]:control.visible=is_quantity
	if is_quantity:
		_image(selected_image,model.image);_text(details,model.name+"\n"+model.price)
		_text(quantity,model.quantity);_text(total,model.total);_text(maximum,model.maximum)
		for pair in [[minus,model.minus],[plus,model.plus],[confirm,model.actions[0]],[cancel,model.actions[1]]]:_configure_button(pair[0],pair[1])
	else:
		_text(money,model.money);_image(selected_image,model.selected.image)
		_text(details,model.selected.name+"\n\n"+model.selected.description+("\n\n"+"\n".join(model.selected.notices) if not model.selected.notices.is_empty() else ""))
		_configure_button(buy,model.buy);_configure_button(leave,model.leave)
		var keep: Dictionary={}
		for index in range(model.rows.size()):
			var item: Dictionary=model.rows[index];var key: String=item.key;keep[key]=true
			if not rows.has(key):
				var button:=_button(key,list);button.custom_minimum_size=Vector2(0,48);button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
				var picture:=TextureRect.new();_prepare_picture(picture);picture.set_meta("thumbnail",true);button.add_child(picture);targets.append(picture)
				var name_label:=Label.new();name_label.clip_text=true;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;name_label.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(name_label)
				var price:=Label.new();price.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;price.mouse_filter=Control.MOUSE_FILTER_IGNORE;price.clip_text=true;button.add_child(price)
				rows[key]={"button":button,"picture":picture,"name":name_label,"price":price}
				button.resized.connect(func():_layout_row(key));list_writes+=1
			var row: Dictionary=rows[key];list.move_child(row.button,index);row.button.disabled=item.get("disabled",false);row.button.tooltip_text=item.name
			row.button.get_meta("frame").texture=row_texture
			row.button.get_meta("frame").self_modulate=Color("ffe2a2") if item.selected else Color.WHITE
			_text(row.name,item.name);_text(row.price,item.price+(" 鎖" if item.locked else ""));row.picture.set_meta("wanted",item.image);_layout_row(key)
		for key in rows.keys():
			if keep.has(key):continue
			targets.erase(rows[key].picture);rows[key].button.queue_free();rows.erase(key)
	_layout();call_deferred("_layout");show();surface_ready.emit();call_deferred("set_list_scroll_top",wanted_scroll);call_deferred("_update_visible_thumbnails")

func _configure_button(button: Button,value: Dictionary) -> void:
	_text(button,value.label);button.disabled=value.disabled;button.get_meta("frame").texture=row_texture;button.set_meta("key",value.key)

func _layout_row(key: String) -> void:
	if not rows.has(key):return
	var row: Dictionary=rows[key];var width: float=row.button.size.x
	row.picture.position=Vector2(8,4);row.picture.size=Vector2(40,40)
	row.name.position=Vector2(54,4);row.name.size=Vector2(maxf(0,width-152),40);row.name.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
	row.price.position=Vector2(width-96,4);row.price.size=Vector2(88,40);row.price.vertical_alignment=VERTICAL_ALIGNMENT_CENTER

func _layout() -> void:
	queue_redraw();background.size=size/0.125
	title.position=Vector2(28,18);title.size=Vector2(size.x-56,32)
	if model.get("kind","") in ["shop-quantity","training-quantity","healing-quantity"]:
		selected_image.position=Vector2(32,76);selected_image.size=Vector2(size.x*0.3-24,size.y-156)
		var left:=size.x*0.34;var width:=size.x-left-36
		details.position=Vector2(left,76);details.size=Vector2(width,66)
		minus.position=Vector2(left,154);minus.size=Vector2(56,48)
		plus.position=Vector2(size.x-92,154);plus.size=Vector2(56,48)
		quantity.position=Vector2(left+66,154);quantity.size=Vector2(width-132,48)
		maximum.position=Vector2(left,218);maximum.size=Vector2(width*0.5,30)
		total.position=Vector2(left+width*0.5,218);total.size=Vector2(width*0.5,30);total.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
		for index in range(2):
			var button: Button=[confirm,cancel][index];button.position=Vector2(28+index*(size.x-48)/2.0,size.y-68);button.size=Vector2((size.x-68)/2.0,48)
	else:
		var side:=size.x*0.4
		money.position=Vector2(30,62);money.size=Vector2(side-44,28)
		selected_image.position=Vector2(30,102);selected_image.size=Vector2(48,48)
		details.position=Vector2(88,102);details.size=Vector2(side-100,size.y-242)
		buy.position=Vector2(30,size.y-126);buy.size=Vector2(side-44,48)
		list_scroll.position=Vector2(side+8,62);list_scroll.size=Vector2(size.x-side-38,size.y-140)
		leave.position=Vector2(28,size.y-68);leave.size=Vector2(size.x-56,48)
	for key in rows:_layout_row(key)
	_update_visible_thumbnails()

func _disable_actions() -> void:
	for button in [buy,leave,minus,plus,confirm,cancel]:button.disabled=true
	for row in rows.values():row.button.disabled=true

func _press(key: String) -> void:
	var increment: bool=model.get("kind","") in ["shop-quantity","training-quantity","healing-quantity"] and key in [model.minus.key,model.plus.key]
	if not increment:_disable_actions()
	command_requested.emit(key)

func update_text(key: String,value: String) -> void:
	if key==model.get("quantityKey","shopQtyValue"):_text(quantity,value);model.quantity=value
	elif key==model.get("totalKey","shopQtyTotal"):_text(total,value);model.total=value
	else:push_error("Native shop text field not bound: "+key)

func list_scroll_top() -> int:return list_scroll.scroll_vertical
func set_list_scroll_top(value: int) -> void:wanted_scroll=maxi(0,value);list_scroll.scroll_vertical=wanted_scroll
func capture_scroll_json() -> String:return JSON.stringify([{"key":"shop-list","top":list_scroll.scroll_vertical,"left":0},{"key":"shop-description","top":details.get_v_scroll_bar().value,"left":0}])
func restore_scroll_json(value: String) -> void:
	for entry in JSON.parse_string(value):
		if entry.key=="shop-list":set_list_scroll_top(int(entry.top))
		elif entry.key=="shop-description":details.get_v_scroll_bar().value=entry.top
func close_surface() -> void:epoch+=1;hide();_update_visible_thumbnails()
func current_kind() -> String:return str(model.get("kind",""))
func test_quantity_json() -> String:return JSON.stringify({"quantity":quantity.text,"total":total.text})
func test_layout() -> bool:
	var visible_buttons: Array=[minus,plus,confirm,cancel] if model.kind in ["shop-quantity","training-quantity","healing-quantity"] else [buy,leave]
	for button in visible_buttons:
		if not Rect2(Vector2.ZERO,size).encloses(button.get_rect()) or button.get_rect().intersects(selected_image.get_rect()) or button.get_rect().intersects(details.get_rect()):return false
	return true
func test_identity_json() -> String:
	var ids: Dictionary={}
	for key in rows:ids[key]=rows[key].button.get_instance_id()
	return JSON.stringify({"rows":ids,"writes":list_writes,"background":background.texture.get_instance_id() if background.texture else 0})
func test_loaded_thumbnails() -> int:
	var count:=0
	for row in rows.values():
		if row.picture.texture!=null:count+=1
	return count
func test_press(key: String) -> bool:
	if not visible:return false
	var buttons: Array=[buy,leave,minus,plus,confirm,cancel]
	for row in rows.values():buttons.append(row.button)
	for button in buttons:
		if button.visible and not button.disabled and button.get_meta("key","")==key:button.pressed.emit();return true
	return false
