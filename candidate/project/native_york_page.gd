extends Control
signal command_requested(key: String)
signal drag_requested(card: int, target: int)
const ROOT="images/board/postgame_clue_puzzle_ui/"
const FRAME=ROOT+"york_clue_puzzle_main_frame.webp"
const BACKGROUND=ROOT+"york_clue_puzzle_background.webp"
const BUTTON=ROOT+"york_primary_button_frame.webp"
const Icon=preload("res://native_item_icon.gd")
var cache: Node
var model: Dictionary={}
var textures: Dictionary={}
var wanted: Array=[]
var epoch:=0
var assets_ready:=false
var background:=TextureRect.new()
var shade:=ColorRect.new()
var heading: Label
var status: Label
var hint: Label
var message: Label
var exit_button: Button
var back_button: Button
var reclaim_button: Button
var difficulty_root:=Control.new()
var puzzle_root:=Control.new()
var result_root:=Control.new()
var choices: Array=[]
var slots: Array=[]
var bank: Array=[]
var clue_buttons: Array=[]
var actions: Array=[]
var bank_scroll:=ScrollContainer.new()
var bank_content:=Control.new()
var clue_scroll:=ScrollContainer.new()
var clue_list:=VBoxContainer.new()
var clue_frame:=NinePatchRect.new()
var result_image: TextureRect
var result_copy: RichTextLabel
var result_title: Label
var result_button: Button
var result_art: TextureRect
var drag_card:=0
var drag_start:=Vector2.ZERO
var dragging:=false
var suppress_until:=0
func _label(parent: Node,font_size: int,color: Color=Color("fff0be")) -> Label:
	var label:=Label.new();label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",color);label.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(label);return label
func _image(parent: Node) -> TextureRect:
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(image);return image
func _button(parent: Node,key: String,text: String="",font_size: int=12) -> Button:
	var b:=Button.new();b.text=text;b.set_meta("key",key);b.add_theme_font_size_override("font_size",font_size);b.add_theme_color_override("font_color",Color("fff0be"));parent.add_child(b)
	var art:=TextureRect.new();art.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;art.stretch_mode=TextureRect.STRETCH_SCALE;art.set_meta("button_art",true);art.mouse_filter=Control.MOUSE_FILTER_IGNORE;art.show_behind_parent=true
	b.add_child(art);b.resized.connect(func():art.size=b.size);b.flat=true
	b.pressed.connect(func():if assets_ready and visible and Time.get_ticks_msec()>=suppress_until and not b.disabled:command_requested.emit(str(b.get_meta("key"))))
	return b
func _card(parent: Node,key: String) -> Dictionary:
	var button:=_button(parent,key);button.clip_contents=true
	var icon:=Icon.new();button.add_child(icon)
	var value:=_label(button,11);value.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	return {"button":button,"icon":icon,"label":value,"value":0}
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var theme_value:=Theme.new();theme_value.default_font=preload("res://native_fonts.gd").weighted(700);theme_value.default_font_size=12;theme=theme_value
	background.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background)
	shade.color=Color(.005,.02,.035,.88);shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(shade)
	heading=_label(self,17);heading.clip_text=true;status=_label(self,10,Color("b9d8df"));status.clip_text=true
	exit_button=_button(self,"id:exitButton","離開解碼");back_button=_button(self,"id:backButton","返回難度")
	for root in [difficulty_root,puzzle_root,result_root]:root.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(root)
	for i in range(3):
		var b:=_button(difficulty_root,"difficulty:"+["easy","normal","hard"][i]);var art:=_image(b);art.stretch_mode=TextureRect.STRETCH_SCALE;art.show_behind_parent=true;var name_text:=_label(b,21);name_text.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;var image:=_image(b);var copy:=RichTextLabel.new();copy.mouse_filter=Control.MOUSE_FILTER_IGNORE;copy.add_theme_font_size_override("normal_font_size",12);copy.add_theme_color_override("default_color",Color("e1f0ed"));b.add_child(copy);choices.append({"button":b,"art":art,"label":name_text,"image":image,"copy":copy})
	hint=_label(puzzle_root,11,Color("9eeaf0"));hint.clip_text=true
	for i in range(13):
		var slot:=_card(puzzle_root,"slot:"+str(i));var lock:=_button(puzzle_root,"lock:"+str(i),"鎖定",10);slot.lock=lock;slots.append(slot)
	bank_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_AUTO;bank_scroll.vertical_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;puzzle_root.add_child(bank_scroll);bank_scroll.add_child(bank_content)
	for i in range(13):bank.append(_card(bank_content,"bank:"+str(i+1)))
	clue_frame.scale=Vector2(.2,.2);clue_frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;clue_frame.region_rect=Rect2(40,70,1500,860)
	for side in [SIDE_LEFT,SIDE_RIGHT,SIDE_TOP,SIDE_BOTTOM]:clue_frame.set_patch_margin(side,100)
	puzzle_root.add_child(clue_frame);puzzle_root.add_child(clue_scroll);clue_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;clue_list.size_flags_horizontal=Control.SIZE_EXPAND_FILL;clue_list.add_theme_constant_override("separation",5);clue_scroll.add_child(clue_list)
	var guide:=Label.new();guide.text="右邊不一定相鄰；右邊2格為固定距離。\n點選牌，再點格子；亦可拖曳交換。";guide.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;guide.add_theme_font_size_override("font_size",11);guide.custom_minimum_size.y=40;clue_list.add_child(guide)
	for i in range(13):var b:=_button(clue_list,"clue:"+str(i+1),"",11);b.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;b.custom_minimum_size.y=48;b.alignment=HORIZONTAL_ALIGNMENT_LEFT;b.get_child(0).hide();clue_buttons.append(b)
	message=_label(puzzle_root,10,Color("ffe7a1"));message.clip_text=true
	for pair in [["shuffleButton","洗牌"],["unlockAllButton","解鎖全部"],["resetButton","重設"],["submitButton","確認座標"]]:actions.append(_button(puzzle_root,"id:"+pair[0],pair[1],11))
	reclaim_button=_button(puzzle_root,"return-bank","收回選牌",10)
	result_art=_image(result_root);result_art.stretch_mode=TextureRect.STRETCH_SCALE
	result_title=_label(result_root,20);result_title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	result_image=_image(result_root);result_copy=RichTextLabel.new();result_copy.add_theme_font_size_override("normal_font_size",14);result_root.add_child(result_copy);result_button=_button(result_root,"id:resultClose","返回主遊戲",14)
	resized.connect(_layout);hide();set_process(false)
func apply_json(json: String) -> void:
	var next=JSON.parse_string(json)
	if not next is Dictionary:return
	if next==model and visible:return
	model=next;epoch+=1;assets_ready=false;show();wanted=[BACKGROUND,FRAME,BUTTON]
	for d in model.difficulties:wanted.append(d.frame);wanted.append(d.image)
	for row in model.bank:wanted.append(row.image);wanted.append(row.portrait)
	for row in model.slots:if row.card!=null:wanted.append(row.card.image);wanted.append(row.card.portrait)
	if not str(model.result.image).is_empty():wanted.append(model.result.image)
	wanted.append(ROOT+"york_decoder_result_frame.webp");_load();set_process(not assets_ready)
func _process(_delta: float) -> void:_load()
func _load() -> void:
	var pending:=false
	for path in wanted:
		if textures.has(path):continue
		var image: Texture2D=cache.request(path)
		if image!=null:textures[path]=image
		elif not cache.failed.has(path):pending=true
	if pending:return
	assets_ready=true;set_process(false);_present();_layout()
func _decorate(parent: Node) -> void:
	for child in parent.get_children():
		if child is TextureRect and child.has_meta("button_art"):var atlas:=AtlasTexture.new();atlas.atlas=textures.get(BUTTON);atlas.region=Rect2(115,85,1940,540);child.texture=atlas;child.size=child.get_parent().size
		_decorate(child)
func _present_card(row: Dictionary,data,caption: String,selected: bool) -> void:
	row.value=0 if data==null else int(data.value);row.label.text=caption;row.button.modulate=Color("fff1a9") if selected else Color.WHITE
	row.icon.present({} if data==null else {"kind":"clue","image":data.image,"portrait":data.portrait,"rank":data.rank},textures)
func _present() -> void:
	background.texture=textures.get(BACKGROUND);clue_frame.texture=textures.get(ROOT+"york_difficulty_easy_frame.webp");_decorate(self)
	heading.text=model.title;status.text="解碼器："+model.tier+"　蛋頭島："+model.world
	difficulty_root.visible=model.mode=="difficulty";puzzle_root.visible=model.mode=="puzzle";result_root.visible=model.mode=="result";back_button.visible=puzzle_root.visible;exit_button.visible=not result_root.visible
	for i in range(3):
		var c: Dictionary=choices[i];var d: Dictionary=model.difficulties[i];c.button.disabled=d.disabled;c.art.texture=textures.get(d.frame);c.image.texture=textures.get(d.image);c.label.text=d.label;c.copy.text=d.name+"\n\n"+d.description+"\n\n"+d.meta+("\n此階已完成" if d.disabled else "\n點選開始")
	if puzzle_root.visible:
		hint.text=model.hint+"　"+model.attempts;message.text=model.message
		for i in range(13):
			var s: Dictionary=model.slots[i];_present_card(slots[i],s.card,str(i+1)+(":"+str(s.card.rank) if s.card!=null else " 空"),s.selected);slots[i].lock.text="解鎖" if s.locked else "鎖定";slots[i].lock.disabled=s.card==null or model.solved or model.pending;slots[i].button.disabled=model.solved or model.pending
		for i in range(13):
			var row: Dictionary=bank[i];row.button.visible=i<model.bank.size()
			if row.button.visible:var c: Dictionary=model.bank[i];row.button.set_meta("key","bank:"+str(c.value));row.button.disabled=model.solved or model.pending;_present_card(row,c,c.rank,c.selected)
		for c in model.clues:clue_buttons[int(c.value)-1].text=str(int(c.value))+". "+str(c.text);clue_buttons[int(c.value)-1].modulate=Color("fff1a9") if c.selected else Color.WHITE
		for b in actions:b.disabled=model.buttons[str(b.get_meta("key")).trim_prefix("id:")].disabled
		reclaim_button.disabled=model.solved or model.pending
	var r: Dictionary=model.result;result_title.text=r.title;result_art.texture=textures.get(ROOT+"york_difficulty_easy_frame.webp");result_image.texture=textures.get(r.image);result_copy.text=r.description+"\n\n"+r.tier+"\n"+r.world+"\n"+r.rate
func _layout_card(row: Dictionary,rect: Rect2) -> void:
	row.button.position=rect.position;row.button.size=rect.size;row.icon.size=Vector2(rect.size.y-14,rect.size.y-14);row.icon.position=Vector2((rect.size.x-row.icon.size.x)/2,0);row.label.position=Vector2(0,rect.size.y-16);row.label.size=Vector2(rect.size.x,16)
func _layout() -> void:
	if not is_node_ready():return
	background.size=size;shade.size=size;heading.position=Vector2(14,7);heading.size=Vector2(size.x-230,25);status.position=Vector2(14,32);status.size=Vector2(size.x-28,18);exit_button.position=Vector2(size.x-106,7);exit_button.size=Vector2(94,34);back_button.position=Vector2(size.x-208,7);back_button.size=Vector2(96,34)
	for root in [difficulty_root,puzzle_root,result_root]:root.size=size
	var w: float=(size.x-36)/3
	for i in range(3):
		var c: Dictionary=choices[i];c.button.position=Vector2(12+i*(w+6),57);c.button.size=Vector2(w-6,size.y-69);c.art.size=c.button.size;c.label.position=Vector2(12,13);c.label.size=Vector2(w-30,32);c.image.position=Vector2(w*.33,46);c.image.size=Vector2(w*.33,minf(75,(size.y-180)*.45));c.copy.position=Vector2(24,c.image.position.y+c.image.size.y+4);c.copy.size=Vector2(w-46,c.button.size.y-c.copy.position.y-22)
	var right: float=clampf(size.x*.30,185,300);var left: float=size.x-right-34;var slot_w: float=(left-6)/7;var slot_h: float=clampf((size.y-230)/2,48,72)
	hint.position=Vector2(12,53);hint.size=Vector2(left,20)
	for i in range(13):
		var rect:=Rect2(12+(i%7)*slot_w,76+int(i/7.0)*(slot_h+4),slot_w-4,slot_h-20);_layout_card(slots[i],rect);slots[i].lock.position=rect.position+Vector2(0,rect.size.y);slots[i].lock.size=Vector2(rect.size.x,20)
	var bank_y: float=76+2*(slot_h+4);bank_scroll.position=Vector2(12,bank_y);bank_scroll.size=Vector2(left,maxf(42,size.y-bank_y-61));bank_content.custom_minimum_size=Vector2(model.get("bank",[]).size()*50,bank_scroll.size.y-13);bank_content.size=bank_content.custom_minimum_size
	for i in range(13):_layout_card(bank[i],Rect2(i*50,0,47,maxf(30,bank_content.size.y)))
	clue_frame.position=Vector2(left+20,55);clue_frame.size=Vector2(right+2,size.y-67)/.2;clue_scroll.position=clue_frame.position+Vector2(18,22);clue_scroll.size=Vector2(right+2,size.y-67)-Vector2(36,50)
	message.position=Vector2(12,size.y-60);message.size=Vector2(left-86,18);reclaim_button.position=Vector2(left-72,size.y-64);reclaim_button.size=Vector2(84,25)
	var aw: float=(left-9)/4
	for i in range(4):actions[i].position=Vector2(12+i*(aw+3),size.y-38);actions[i].size=Vector2(aw,30)
	result_art.position=Vector2(10,50);result_art.size=Vector2(size.x-20,size.y-60);result_title.position=Vector2(20,60);result_title.size=Vector2(size.x-40,32);result_image.position=Vector2(32,99);result_image.size=Vector2(size.x*.25,size.y-160);result_copy.position=Vector2(size.x*.32,105);result_copy.size=Vector2(size.x*.62,size.y-165);result_button.position=Vector2(size.x*.3,size.y-47);result_button.size=Vector2(size.x*.4,35)
func _input(event: InputEvent) -> void:
	if not visible or not assets_ready or model.get("mode","")!="puzzle":return
	var point: Vector2;var down:=false;var up:=false;var motion:=false
	if event is InputEventScreenTouch:point=event.position;down=event.pressed;up=not event.pressed
	elif event is InputEventScreenDrag:point=event.position;motion=true
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:point=event.position;down=event.pressed;up=not event.pressed
	elif event is InputEventMouseMotion:point=event.position;motion=true
	else:return
	if down:
		drag_card=0;dragging=false;drag_start=point
		for row in slots+bank:
			if row.value>0 and row.button.is_visible_in_tree() and not row.button.disabled and row.button.get_global_rect().has_point(point) and (row in slots or bank_scroll.get_global_rect().has_point(point)):drag_card=row.value;break
	if motion and drag_card>0 and point.distance_to(drag_start)>12:dragging=true;suppress_until=Time.get_ticks_msec()+300
	if up and drag_card>0:
		if dragging:
			suppress_until=Time.get_ticks_msec()+300
			for i in range(13):if slots[i].button.get_global_rect().has_point(point):drag_requested.emit(drag_card,i);break
			if bank_scroll.get_global_rect().has_point(point):drag_requested.emit(drag_card,-1)
		drag_card=0;dragging=false
func close_surface() -> void:
	epoch+=1;assets_ready=false;model={};hide();set_process(false);drag_card=0;textures.clear()
func test_ready() -> bool:return visible and assets_ready
func test_rect_json(key: String) -> String:
	for b in _buttons(self):
		if str(b.get_meta("key",""))==key and b.is_visible_in_tree():var r: Rect2=b.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func _buttons(node: Node) -> Array:
	var result: Array=[]
	for child in node.get_children():
		if child is Button:result.append(child)
		result.append_array(_buttons(child))
	return result
func test_layout() -> bool:
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [heading,exit_button,back_button]:if node.is_visible_in_tree() and not bounds.encloses(node.get_rect()):return false
	if puzzle_root.visible:
		for row in slots:if not bounds.encloses(row.button.get_rect()) or not bounds.encloses(row.lock.get_rect()):return false
		for node in [bank_scroll,clue_scroll,reclaim_button]+actions:if not bounds.grow(1).encloses(node.get_rect()):print("YORK_LAYOUT ",node.name," ",node.get_rect()," ",bounds);return false
	return true
