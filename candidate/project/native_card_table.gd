extends Control
## Native controls and GPU tweens. Server decisions remain in server/engine.js.
signal command(json: String)
signal presentation_done(ticket: int)
const Fonts=preload("res://native_fonts.gd")
const Damage=preload('res://native_card_damage.gd')
var catalog: Dictionary
var textures: Dictionary={}
var asset_cache: Node
var model: Dictionary={}
var seats: Dictionary={}
var hands: Dictionary={}
var background: TextureRect
var table: Control
var controls_layer: Control
var overlay: Control
var effects: Control
var notice: Label
var turn_label: Label
var deck: Button
var discard: Button
var deck_face: TextureRect
var discard_face: TextureRect
var deck_count: Label
var discard_count: Label
var chest: Label
var venue_layer: Control
var action_layer: Control
var lobby_layer: Control
var lobby_info: Label
var room_input: LineEdit
var cpu: SpinBox
var room_buttons: VBoxContainer
var current_ticket:=-1
var epoch:=0
var running_tweens: Array[Tween]=[]
var leased: Array[CanvasItem]=[]
var played_card: TextureRect
var last_controls:=""
var chosen: Array=[]
var page:=0
var gallery: Array=[]
var gallery_title:=""
var private_finish: Callable
var effect_busy:=false
var local_busy:=false
var movie: Control
var video_card:=-1
var selected_key:=""
var pile_layers: Dictionary={}
var result_data: Dictionary={}
var coin_faces: Dictionary={}
var gallery_overview:=false
var audio: Node
var audio_enabled:=false
var pulse_clock:=0.0
var chest_art: TextureRect
var render_epoch:=0
var input_loading:=false
var gallery_art_mode:=-1
var lobby_data: Dictionary={}
var lobby_chat_view: RichTextLabel
var result_page:=0

func _ready() -> void:
	catalog=JSON.parse_string(FileAccess.get_file_as_string("res://native-card-catalog.json"))
	asset_cache=preload('res://native_card_assets.gd').new();asset_cache.catalog=catalog.files;add_child(asset_cache)
	asset_cache.failed.connect(func(key):notify_player('素材讀取失敗：'+key))
	theme=Theme.new();theme.default_font=Fonts.weighted(600);theme.default_font_size=18
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	background=_image(self,"art/card-arena.webp");background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	table=_layer(self);controls_layer=_layer(self)
	turn_label=_label(controls_layer,"連線中",24);turn_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	notice=_label(controls_layer,"",16);notice.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	deck=_button(table,"",func():_draw());discard=_button(table,"",func():_open_discard())
	_clear(deck);_clear(discard)
	for pile in [deck,discard]:
		var layers: Array=[]
		for i in range(8,0,-1):layers.append({'depth':i,'node':_image(pile,'images/cards/back.webp')})
		pile_layers[pile]=layers
	deck_face=_image(deck,'images/cards/back.webp');discard_face=_image(discard,'images/cards/back.webp')
	deck_count=_label(deck,'',16);discard_count=_label(discard,'',16)
	chest=_label(table,"",18)
	chest_art=_image(table,'images/reward/chest_closed.webp')
	for key in ["hand","drawn"]:
		var card:=_image(table,"");card.mouse_filter=Control.MOUSE_FILTER_STOP;card.gui_input.connect(_hand_input.bind(key));hands[key]=card
	venue_layer=_layer(table);action_layer=_layer(controls_layer)
	var library:=_button(controls_layer,"圖鑑",func():_open_gallery(range(20),"卡片圖鑑"));library.set_meta("role","library")
	var logs:=_button(controls_layer,"對局日誌",func():_show_log());logs.set_meta("role","log")
	var menu:=_button(controls_layer,"選項",func():_menu());menu.set_meta('role','menu')
	lobby_layer=_layer(self);_build_lobby()
	effects=_layer(self);overlay=_layer(self);overlay.hide()
	movie=preload('res://native_card_video.gd').new();add_child(movie)
	audio=preload('res://native_card_audio.gd').new();add_child(audio)
	movie.completed.connect(func():_finish(current_ticket,epoch))
	movie.failed.connect(_video_failed)
	resized.connect(_layout);_layout()

func _layer(parent: Node) -> Control:
	var node:=Control.new();node.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(node);return node

func _tex(key: String) -> Texture2D:
	if key.is_empty():return null
	if not catalog.files.has(key):push_warning("Card asset missing from catalog: "+key);return null
	textures[key]=true;return asset_cache.request(key)

func _image(parent: Node,key: String) -> TextureRect:
	var node:=TextureRect.new();node.texture=_tex(key);node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(node);return node

func _label(parent: Node,text: String,font_size: int=18) -> Label:
	var node:=Label.new();node.text=text;node.add_theme_color_override("font_color",Color("ffe3a0"));node.add_theme_color_override("font_shadow_color",Color("061624"));node.add_theme_constant_override("shadow_offset_x",1);node.add_theme_constant_override("shadow_offset_y",2);node.add_theme_font_size_override("font_size",font_size);node.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;node.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(node);return node

func _button(parent: Node,text: String,callback: Callable) -> Button:
	var node:=Button.new();node.text=text;node.add_theme_color_override("font_color",Color("ffe3a0"));node.add_theme_color_override("font_hover_color",Color.WHITE);node.add_theme_font_size_override("font_size",17)
	for state in ["normal","hover","pressed","disabled","focus"]:node.add_theme_stylebox_override(state,StyleBoxEmpty.new())
	node.pressed.connect(callback);parent.add_child(node)
	var art:=_image(node,'art/card-hud-panel.webp');art.show_behind_parent=true;art.stretch_mode=TextureRect.STRETCH_SCALE;art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return node

func _rect(node: Control,x: float,y: float,w: float,h: float) -> void:
	node.position=Vector2(x,y);node.size=Vector2(maxf(w,1),maxf(h,1))

func _clear(node: Node) -> void:
	for child in node.get_children():node.remove_child(child);child.queue_free()

func _state() -> Dictionary:
	return model.get("state",{}) if model.get("state")!=null else {}

func _card_key(id: Variant,override: Dictionary={}) -> String:
	if id==null or not (id is int or id is float) or int(id)<0:return "images/cards/back.webp"
	var state:=override if not override.is_empty() else _state();var enhanced:=false
	for venue in state.get("venues",[]):
		if venue.get("name","")==catalog.venues.get(str(int(id)),""):enhanced=true
	var base:="images/cards_lux/" if state.get("myDeluxe",[]).has(int(id)) else "images/cards/"
	return base+("enh/" if enhanced else "")+str(int(id))+".webp"

func _build_lobby() -> void:
	lobby_info=_label(lobby_layer,"偉大航道爭霸戰",28)
	room_input=LineEdit.new();room_input.placeholder_text="輸入房號";lobby_layer.add_child(room_input)
	cpu=SpinBox.new();cpu.min_value=0;cpu.max_value=3;cpu.prefix="CPU ";lobby_layer.add_child(cpu)
	var actions:=[['加入房間',func():_emit('join',{}, {'room':room_input.text,'cpuCount':int(cpu.value)})],['建立房間',func():_emit('join',{}, {'room':'C'+str(Time.get_ticks_usec()%100000),'cpuCount':int(cpu.value)})],['準備',func():_emit('LOBBY_READY')],['取消準備',func():_emit('LOBBY_UNREADY')],['開始',func():_emit('START_GAME')],['離開房間',func():_emit('leave')],['返回啟動器',func():_emit('exit')]]
	for i in range(actions.size()):var button:=_button(lobby_layer,actions[i][0],actions[i][1]);button.set_meta('lobby_index',i)
	var chat:=_button(lobby_layer,'房間聊天',func():_lobby_tools(false));chat.set_meta('lobby_index',7)
	var manage:=_button(lobby_layer,'管理玩家',func():_lobby_tools(true));manage.set_meta('lobby_index',8)
	room_buttons=VBoxContainer.new();lobby_layer.add_child(room_buttons)

func apply_json(json: String) -> void:
	var next: Dictionary=JSON.parse_string(json)
	render_epoch+=1;var requested:=render_epoch;input_loading=true
	var incoming: Dictionary=next.get('state',{}) if next.get('state')!=null else {};var keys: Array=[];var retained: Array=[]
	for p in incoming.get('players',[]):
		if int(p.id)==int(next.get('viewer',-1)):
			for key in ['hand','drawn']:
				if p.get(key)!=null:keys.append(_card_key(p[key],incoming))
	var incoming_pile: Array=incoming.get('discard',[])
	if not incoming_pile.is_empty():keys.append(_card_key(incoming_pile.back(),incoming))
	for key in keys:retained.append(_tex(key))
	while keys.any(func(key):return asset_cache.pending.has(key)):
		await get_tree().process_frame
		if requested!=render_epoch:return
	if requested!=render_epoch:return
	input_loading=false
	if next.get('phase')!=model.get('phase') and overlay.get_meta('lobby_tools',false):overlay.hide();overlay.set_meta('lobby_tools',false);_clear(overlay)
	if next.get('revision',0)!=model.get('revision',-1):_release_leases();selected_key='';notice.text=''
	model=next;var state:=_state();var playing:bool=model.get('phase','rooms')=='playing'
	table.visible=playing;controls_layer.visible=playing;lobby_layer.visible=not playing
	if not playing:_layout();return
	for p in state.get('players',[]):
		var id:=int(p.id)
		if not seats.has(id):
			var b:=_button(table,'',func():_target(id));_clear(b);var panel:=_image(b,'art/card-hud-panel.webp');panel.stretch_mode=TextureRect.STRETCH_SCALE;var portrait:=_image(b,'');var ring:=_image(b,'art/card-player-ring.webp');var name_label:=_label(b,'',17);var status:=_label(b,'',14)
			name_label.autowrap_mode=TextServer.AUTOWRAP_OFF;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
			var guard:=_image(b,'art/card-status-guard.webp');var dodge:=_image(b,'art/card-status-dodge.webp')
			b.add_theme_stylebox_override('normal',StyleBoxEmpty.new());b.add_theme_stylebox_override('hover',StyleBoxEmpty.new());b.add_theme_stylebox_override('pressed',StyleBoxEmpty.new());b.add_theme_stylebox_override('focus',StyleBoxEmpty.new())
			seats[id]={'node':b,'panel':panel,'portrait':portrait,'ring':ring,'name':name_label,'status':status,'guard':guard,'dodge':dodge}
		var row: Dictionary=seats[id];var avatar:=str(int(p.avatar)) if p.avatar is float or p.avatar is int else str(p.avatar)
		row.node.show();row.portrait.texture=_tex('images/avatars/'+avatar+'.webp');row.name.text=str(p.name)
		row.status.text=str(int(p.gold))+' 金 '+('出局' if not p.alive else '')+(' 凍結' if p.frozen else '')+(' 麻痺' if p.skipNext else '')+(' 冰鬼' if p.iceInfected or p.iceArmed else '')
		row.guard.visible=p.protected;row.dodge.visible=p.dodging;row.node.modulate=Color.WHITE if p.alive else Color(.65,.65,.65)
		row.ring.modulate=Color(1.25,1.15,.8) if id==int(state.get('turnIndex',-1)) else Color.WHITE
		if id==int(model.get('viewer',-1)):
			for key in hands:if not leased.has(hands[key]):hands[key].texture=_tex(_card_key(p.get(key)));hands[key].visible=p.get(key)!=null
	turn_label.text=str(model.get('controls',{}).get('title',''))
	turn_label.visible=not model.get('busy',false)
	var centered: bool=model.get('controls',{}).get('kind') in ['digits','coin','confirm']
	chest.visible=not centered;chest_art.visible=not centered
	chest.text='寶箱　'+str(int(state.get('chestCoins',0)))+' 金幣'
	deck_count.text=str(int(state.get('deckCount',0)))+' 張'
	var pile: Array=state.get('discard',[]);discard_face.texture=_tex(_card_key(pile.back() if not pile.is_empty() else null));discard_count.text='棄牌 '+str(pile.size())
	for pile_button in pile_layers:
		var count:=int(state.get('deckCount',0)) if pile_button==deck else pile.size()
		for layer in pile_layers[pile_button]:layer.node.visible=count>int(layer.depth)*3
	_rebuild_actions();_layout()
	if state.get('final')!=null and not model.get('busy',false) and not local_busy:_show_results()

func _rebuild_actions() -> void:
	var controls: Dictionary=model.get('controls',{});var signature:=JSON.stringify(controls)+str(model.get('busy',false))+selected_key
	if signature==last_controls:return
	last_controls=signature;_clear(action_layer)
	if model.get('busy',false):return
	if controls.get('kind') in ['order','multi']:
		var button:=_button(action_layer,'排列頂牌' if controls.kind=='order' else '選擇覆蓋牌',func():_pending_cards(controls));button.set_meta('action_index',0)
	else:
		var options: Array=controls.get('options',[])
		if controls.get('kind')=='play':
			for opt in options:
				if opt.get('which')==selected_key:
					_button(action_layer,'打出這張牌',func():_send_option(opt))
					_button(action_layer,'查看說明',func():_open_gallery([opt.card],'卡牌說明'))
			return
		for i in range(options.size()):
			var opt: Dictionary=options[i];var button:=_button(action_layer,str(opt.label),func():_send_option(opt));button.set_meta('action_index',i)
			if controls.get('kind')=='coin':
				_clear(button);button.text='';button.set_meta('coin',true);var face:=_image(button,'');face.texture=_coin_face(true);face.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)

func _layout() -> void:
	if background==null:return
	background.size=size
	for layer in [table,controls_layer,lobby_layer,effects,overlay,venue_layer,action_layer]:layer.size=size
	if movie!=null:movie.size=size
	var w:=size.x;var h:=size.y;var unit:=minf(w/1280.0,h/720.0)
	_rect(turn_label,w*.22,h*.25,w*.56,44*unit);_rect(notice,w*.2,h*.32,w*.6,34*unit)
	if model.get('controls',{}).get('kind')=='digits':turn_label.position.y=h*.20
	_rect(deck,w*.1,h*.42,92*unit,138*unit);_rect(discard,w*.81,h*.42,92*unit,138*unit);_rect(chest,w*.44,h*.38,w*.22,30*unit)
	_rect(chest_art,w*.37,h*.35,80*unit,68*unit)
	deck_face.size=deck.size;discard_face.size=discard.size;_rect(deck_count,0,deck.size.y,100,24);_rect(discard_count,0,discard.size.y,100,24)
	for pile in pile_layers:
		for layer in pile_layers[pile]:layer.node.size=pile.size;layer.node.position=Vector2(float(layer.depth)*.7,float(layer.depth)*1.25)
	var others: Array=[]
	for id in seats:if id!=int(model.get('viewer',-1)):others.append(id)
	for id in seats:
		var row: Dictionary=seats[id];var mine:bool=id==int(model.get('viewer',-1));var sw:=minf(260*maxf(unit,.75),w*.24);var sh:=105*maxf(unit,.63)
		var x:=w-sw-20*unit if mine else w*(float(others.find(id)+1)/float(others.size()+1))-sw*.5
		var y:=h-sh-50 if mine else 10*unit
		_rect(row.node,x,y,sw,sh);_rect(row.panel,sh*.55,sh*.06,sw-sh*.55,sh*.87);_rect(row.portrait,0,0,sh,sh);_rect(row.ring,-4*unit,-4*unit,sh+8*unit,sh+8*unit)
		row.name.add_theme_font_size_override('font_size',maxi(13,int(17*unit)));row.status.add_theme_font_size_override('font_size',maxi(12,int(14*unit)))
		_rect(row.name,sh+4,sh*.15,sw-sh-14,sh*.3);_rect(row.status,sh+4,sh*.6,sw-sh-12,sh*.28)
		_rect(row.guard,sh+3,sh*.4,22,22);_rect(row.dodge,sh+28,sh*.4,22,22)
	for key in hands:
		var i:=0 if key=='hand' else 1;var node: TextureRect=hands[key]
		if not leased.has(node):
			var card_h:=h*.36;var card_w:=card_h*.67;_rect(node,w*.5+(i-.9)*(card_w+8),h-card_h+(-18 if selected_key==key else 6),card_w,card_h);node.rotation=(-.06 if i==0 else .06);node.pivot_offset=Vector2(card_w*.5,card_h*.9)
	var button_index:=0
	for node in controls_layer.get_children():
		if node.has_meta('role'):_rect(node,w-(button_index+1)*maxf(88,134*unit)-12*unit,h-44,maxf(84,130*unit),42);button_index+=1
	var count:=action_layer.get_child_count()
	for i in range(count):
		var button: Control=action_layer.get_child(i)
		if button.has_meta('coin'):_rect(button,w*.5-60,h*.48,120,120)
		elif model.get('controls',{}).get('kind')=='digits':
			_rect(button,w*.5-168+(i%3)*112,h*.275+floorf(i/3.0)*49,106,45)
		else:
			var button_w:=maxf(110,140*unit);_rect(button,w*.5+(i-count*.5)*button_w,h*(.5 if model.get('controls',{}).get('kind')=='play' else .68),button_w-4,maxf(42,45*unit))
	_rect(lobby_info,w*.12,h*.08,w*.76,h*.29);_rect(room_input,w*.15,h*.4,w*.26,44*unit);_rect(cpu,w*.43,h*.4,130*unit,44*unit)
	for node in lobby_layer.get_children():
		if node.has_meta('lobby_index'):
			var i:=int(node.get_meta('lobby_index'));_rect(node,w*.15+(i%3)*190*unit,h*.53+(i/3)*62*unit,180*unit,54*unit)
	_rect(room_buttons,w*.65,h*.38,w*.25,h*.55)
	_refresh_venues()

func _refresh_venues() -> void:
	var venues: Array=_state().get('venues',[]);var stamp:=JSON.stringify(venues)+str(size)
	if venue_layer.get_meta('stamp','')==stamp:return
	venue_layer.set_meta('stamp',stamp);_clear(venue_layer)
	for i in range(venues.size()):
		var title:=str(venues[i].name);var button:=_button(venue_layer,title,func():background.texture=_tex(catalog.backgrounds[title]));_rect(button,12,size.y*.2+i*42,minf(160,size.x*.16),40)

func _emit(type: String,payload: Dictionary={},top: Dictionary={}) -> void:
	var data:={'type':type,'payload':payload};data.merge(top,true);command.emit(JSON.stringify(data))

func _send_option(opt: Dictionary) -> void:
	if model.get('busy',false) or local_busy or input_loading:return
	_emit(str(opt.type),opt.get('payload',{}))

func _target(id: int) -> void:
	var c: Dictionary=model.get('controls',{})
	if c.get('kind')=='targets' and c.get('targets',[]).has(id) and not model.get('busy',false) and not input_loading:
		var payload: Dictionary=c.get('targetPayload',{}).duplicate();payload.target=id;_emit(c.type,payload)

func _draw() -> void:
	if model.get('controls',{}).get('kind')=='draw' and not model.get('busy',false) and not input_loading:_emit('DRAW')

func _hand_input(event: InputEvent,key: String) -> void:
	if not (event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT):return
	if model.get('busy',false) or local_busy or input_loading:return
	for opt in model.get('controls',{}).get('options',[]):
		if opt.get('which')==key:
			selected_key=key;_rebuild_actions();_layout();return

func _open_discard() -> void:
	if model.get('busy',false) or local_busy:return
	_open_gallery(_state().get('discard',[]),'棄牌堆');_gallery_overview()

func _open_gallery(cards: Array,title: String,on_confirm: Callable=Callable(),confirm_text: String='看完了・返回牌桌') -> void:
	if effect_busy and not on_confirm.is_valid():return
	local_busy=true;_emit('reading',{}, {'value':true});gallery=cards;gallery_title=title;page=0;gallery_art_mode=-1;private_finish=on_confirm;_gallery_page(confirm_text)
	if title=='卡片圖鑑':_gallery_overview()

func _gallery_page(confirm_text: String) -> void:
	gallery_overview=false
	_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	var bg:=_image(overlay,'art/card-arena.webp');bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;bg.size=size
	var header:=_label(overlay,gallery_title+'　'+str(page+1)+' / '+str(maxi(gallery.size(),1)),24);_rect(header,size.x*.1,12,size.x*.8,40)
	var card_id: Variant=gallery[page] if not gallery.is_empty() else null
	var card_key:=_card_key(card_id)
	if card_id!=null and gallery_art_mode>=0:card_key='images/cards/'+('enh/' if gallery_art_mode==1 else '')+str(int(card_id))+'.webp'
	var card:=_image(overlay,card_key);_rect(card,size.x*.16,size.y*.12,size.x*.32,size.y*.7)
	var description:=_label(overlay,'覆蓋牌・內容未公開',19)
	if card_id!=null:
		var data: Dictionary=catalog.cards.get(str(int(card_id)),{});description.text=str(int(card_id))+'｜'+str(data.get('name',''))+'　'+str(catalog.counts.get(str(int(card_id)),0))+' 張\n\n'+str(data.get('baseTitle',''))+'\n'+str(data.get('base',''))+'\n\n強化・'+str(data.get('enhTitle',''))+'\n'+str(data.get('enh',''))
	_rect(description,size.x*.52,size.y*.16,size.x*.32,size.y*.56)
	var font_size:=19
	while font_size>12 and Fonts.base().get_multiline_string_size(description.text,HORIZONTAL_ALIGNMENT_LEFT,description.size.x,font_size).y>size.y*.6:font_size-=1
	description.add_theme_font_size_override('font_size',font_size)
	var close:=_button(overlay,confirm_text,func():
		var fn:=private_finish;overlay.hide();_clear(overlay);private_finish=Callable();local_busy=false;_emit('reading',{}, {'value':false})
		if fn.is_valid():fn.call()
	);_rect(close,size.x*.51,size.y*.8,size.x*.36,52)
	if page>0:var prev:=_button(overlay,'上一張',func():page-=1;_gallery_page(confirm_text));_rect(prev,12,size.y*.42,100,50)
	if page<gallery.size()-1:var next:=_button(overlay,'下一張',func():page+=1;_gallery_page(confirm_text));_rect(next,size.x-112,size.y*.42,100,50)
	if gallery_title in ['卡片圖鑑','棄牌堆']:
		var overview:=_button(overlay,'返回所有卡牌',func():_gallery_overview());_rect(overview,size.x*.52,size.y*.69,size.x*.34,40)
	if card_id!=null and gallery_title=='卡片圖鑑':
		var toggle:=_button(overlay,'基本卡面' if gallery_art_mode==1 else '強化卡面',func():gallery_art_mode=0 if gallery_art_mode==1 else 1;_gallery_page(confirm_text));_rect(toggle,size.x*.22,size.y*.83,size.x*.2,42)

func _gallery_overview() -> void:
	gallery_overview=true;_clear(overlay)
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var title:=_label(overlay,gallery_title+'　'+str(gallery.size())+' 張・點卡片查看詳情',22);_rect(title,24,10,size.x-48,40)
	var scroll:=ScrollContainer.new();overlay.add_child(scroll);_rect(scroll,30,58,size.x-60,size.y-122);scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED
	var grid:=GridContainer.new();grid.columns=maxi(4,int((size.x-70)/110));scroll.add_child(grid)
	for i in range(gallery.size()):
		var b:=_button(grid,'',func():page=i;_gallery_page('看完了・返回牌桌'));_clear(b);b.custom_minimum_size=Vector2(100,148)
		var art:=_image(b,_card_key(gallery[i]));art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var close:=_button(overlay,'返回牌桌',func():overlay.hide();local_busy=false;_emit('reading',{}, {'value':false}));_rect(close,size.x*.37,size.y-57,size.x*.26,46)

func _pending_cards(c: Dictionary) -> void:
	local_busy=true;_emit('reading',{}, {'value':true});chosen=[];_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	var bg:=_image(overlay,'art/card-arena.webp');bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;bg.size=size
	var title:=_label(overlay,str(c.title),22);_rect(title,24,12,size.x-48,44)
	var cards: Array=c.cards;var count:=cards.size();var buttons: Array=[]
	var finish:=_button(overlay,'確認',func():
		var payload:={'pickedIndices':chosen.duplicate()}
		if c.kind=='order':payload={'order':chosen.map(func(i):return cards[i])}
		if c.kind=='order' and chosen.size()!=cards.size():return
		overlay.hide();local_busy=false;_emit('reading',{}, {'value':false});_emit(str(c.type),payload)
	);_rect(finish,size.x*.38,size.y*.84,size.x*.24,52)
	for i in range(count):
		var button:=_button(overlay,'',func():
			if chosen.has(i):chosen.erase(i)
			else:chosen.append(i)
			for j in range(buttons.size()):buttons[j].text=str(chosen.find(j)+1) if chosen.has(j) else ''
			finish.disabled=c.kind=='order' and chosen.size()!=cards.size()
		);buttons.append(button);_rect(button,24+i*(size.x-48)/maxi(count,1),size.y*.18,(size.x-48)/maxi(count,1)-12,size.y*.6)
		var art:=_image(button,_card_key(cards[i]));art.show_behind_parent=true;art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	finish.disabled=c.kind=='order'

func _show_log() -> void:
	if model.get('busy',false) or local_busy:return
	local_busy=true;_emit('reading',{}, {'value':true});_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size
	var log:=RichTextLabel.new();log.text='\n'.join(_state().get('log',[]));overlay.add_child(log);_rect(log,size.x*.1,size.y*.08,size.x*.8,size.y*.73)
	var back:=_button(overlay,'返回牌桌',func():overlay.hide();local_busy=false;_emit('reading',{}, {'value':false}));_rect(back,size.x*.4,size.y*.85,size.x*.2,50)

func rooms_json(json: String) -> void:
	_clear(room_buttons)
	var rooms: Array=JSON.parse_string(json)
	for room in rooms.slice(0,6):
		var id:=str(room.get('roomId',room.get('id','')));var button:=_button(room_buttons,id,func():_emit('join',{}, {'room':id,'cpuCount':0}));button.custom_minimum_size=Vector2(150,40)

func lobby_json(json: String) -> void:
	var lobby: Dictionary=JSON.parse_string(json);var text:='房間 '+str(lobby.get('roomId',''))+'　CPU '+str(lobby.get('cpuCount',0))+'\n'
	lobby_data=lobby
	for p in lobby.get('players',[]):text+=str(p.name)+('　準備完成' if p.ready else '　未準備')+'\n'
	lobby_info.text=text
	if is_instance_valid(lobby_chat_view):lobby_chat_view.text='\n'.join(lobby.get('chat',[]).map(func(x):return str(x.name)+'：'+str(x.text)))

func _lobby_tools(manage: bool) -> void:
	if model.get('phase')!='lobby':notify_player('請先加入房間');return
	_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP;overlay.set_meta('lobby_tools',true)
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var close:=_button(overlay,'返回等待室',func():overlay.hide();_clear(overlay);overlay.set_meta('lobby_tools',false));_rect(close,size.x*.38,size.y-55,size.x*.24,44)
	if manage:
		var title:=_label(overlay,'玩家管理・只有房主能移除玩家',22);_rect(title,24,12,size.x-48,42)
		var i:=0
		for p in lobby_data.get('players',[]):
			if int(p.id)==int(model.get('viewer',-1)):continue
			var b:=_button(overlay,'移除 '+str(p.name),func():_emit('LOBBY_KICK',{}, {'top':{'targetPlayerId':int(p.id)}}));_rect(b,30+(i%2)*size.x*.48,65+floorf(i/2.0)*56,size.x*.44,48);b.disabled=lobby_data.get('host')!=model.get('viewer');i+=1
	else:
		lobby_chat_view=RichTextLabel.new();overlay.add_child(lobby_chat_view);_rect(lobby_chat_view,25,20,size.x-50,size.y-160);lobby_chat_view.scroll_following=true;lobby_chat_view.text='\n'.join(lobby_data.get('chat',[]).map(func(x):return str(x.name)+'：'+str(x.text)))
		var input:=LineEdit.new();input.max_length=160;input.placeholder_text='輸入訊息';overlay.add_child(input);_rect(input,25,size.y-125,size.x*.7,46)
		var send:=_button(overlay,'傳送',func():_emit('LOBBY_CHAT',{}, {'top':{'text':input.text}});input.text='');_rect(send,size.x*.76,size.y-125,size.x*.2,46)

func notify_player(text: String) -> void:
	if notice!=null:notice.text=text
	if lobby_info!=null and lobby_layer.visible:lobby_info.text=text

func _origin(id: int) -> Vector2:
	if id==int(model.get('viewer',-1)):
		for hand in hands.values():if hand.visible:return hand.position+hand.size*.5
		return Vector2(size.x*.5,size.y*.84)
	if seats.has(id):return seats[id].node.position+seats[id].node.size*.5
	return size*.5

func _tween() -> Tween:
	var t:=create_tween();running_tweens.append(t);t.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT);return t

func _lease(node: CanvasItem) -> void:
	if not leased.has(node):leased.append(node);node.hide()

func _release_leases() -> void:
	for node in leased:if is_instance_valid(node):node.show()
	leased.clear()

func _flight(card: Variant,from: Vector2,to: Vector2,seconds: float=.55) -> TextureRect:
	var sprite:=_image(effects,_card_key(card));sprite.size=Vector2(110,164)*minf(size.x/1280.0,size.y/720.0);sprite.position=from-sprite.size*.5
	var generation:=epoch
	while asset_cache.pending.has(_card_key(card)):await get_tree().process_frame
	if generation!=epoch or not is_instance_valid(sprite):return null
	var t:=_tween();t.tween_property(sprite,'position',to-sprite.size*.5,seconds);await t.finished
	return sprite

func present_json(ticket: int,json: String) -> void:
	current_ticket=ticket;effect_busy=true
	_run_step(ticket,JSON.parse_string(json),epoch)

func _run_step(ticket: int,step: Dictionary,generation: int) -> void:
	while input_loading:
		await get_tree().process_frame
		if generation!=epoch:return
	var kind:=str(step.kind)
	turn_label.visible=false
	if kind=='peek':
		if int(step.get('actor',-1))==int(model.get('viewer',-1)):
			for node in hands.values():if node.visible:_lease(node)
		if not step.get('cards',[]).is_empty():
			var card:=await _flight(step.cards[0],_origin(int(step.get('actor',-1))),size*.5,.45)
			if generation!=epoch:return
			card.queue_free()
		_open_gallery(step.get('cards',[]),step.get('title','查看手牌'),func():_finish(ticket,generation));return
	if kind=='venues':
		_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
		var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
		var label:=_label(overlay,'本局場地',24);_rect(label,24,10,size.x-48,40)
		var venues: Array=step.get('venues',[])
		for i in range(venues.size()):
			var art:=_image(overlay,'images/venues/'+str(venues[i].name)+'.webp');_rect(art,size.x*.16+i*size.x*.38,size.y*.15,size.x*.3,size.y*.62)
		var button:=_button(overlay,'開始對局',func():overlay.hide();_finish(ticket,generation));_rect(button,size.x*.35,size.y*.82,size.x*.3,48);return
	if kind=='play':
		var voice: Dictionary=catalog.voices.get(str(int(step.card)),{});var cue: Dictionary=voice.get('combos',{}).get(str(int(step.other)),voice.get('base',{})) if step.get('other')!=null else voice.get('base',{})
		if audio_enabled and not cue.is_empty():notice.text=str(cue.text);audio.cue(str(cue.file))
		var start:=_origin(int(step.actor))
		if int(step.actor)==int(model.get('viewer',-1)):
			for node in hands.values():
				if node.visible and node.texture==_tex(_card_key(step.card)):start=node.position+node.size*.5;_lease(node);break
		played_card=await _flight(step.card,start,size*Vector2(.5,.48),.55)
		if generation!=epoch:return
		var t:=_tween();t.tween_interval(.65);t.tween_property(played_card,'scale',Vector2(1,.78),.35);await t.finished
		var until:=Time.get_ticks_msec()+12000
		while audio_enabled and not audio.voice_done and Time.get_ticks_msec()<until:
			await get_tree().process_frame
			if generation!=epoch:return
		audio.stop_voice()
	elif kind=='discard_played':
		if is_instance_valid(played_card):
			var t:=_tween();t.tween_property(played_card,'position',discard.position,.48);await t.finished;played_card.queue_free();played_card=null
	elif kind=='draw':
		var card:=await _flight(step.get('card'),deck.position+deck.size*.5,_origin(int(step.actor)),.55)
		if generation!=epoch:return
		card.queue_free()
	elif kind=='announce':
		notice.text=step.text;var t:=_tween();t.tween_interval(.9);await t.finished
	elif kind=='result':
		notice.text='\n'.join(step.lines);var t:=_tween();t.tween_interval(.8);await t.finished
	elif kind=='duel':
		var left:=await _flight(null,_origin(int(step.left)),size*Vector2(.4,.48),.4)
		if generation!=epoch:return
		var right:=await _flight(null,_origin(int(step.right)),size*Vector2(.6,.48),.4)
		if generation!=epoch:return
		var t:=_tween();t.tween_interval(.6);await t.finished
		for loss in step.get('losses',[]):
			var target: TextureRect=left if int(loss.actor)==int(step.left) else right;target.texture=_tex(_card_key(loss.card))
			var number:=_label(effects,str(int(loss.card)),38);number.position=target.position-Vector2(0,42)
			var finish: Array=Damage.pick();var fx:=_image(effects,'art/card-finish-'+str(finish[0])+'-v1.webp');fx.size=Vector2(size.x*.43,size.y*.7);fx.position=target.position+target.size*.5-fx.size*.5;fx.modulate.a=0
			while not asset_cache.pending.is_empty():await get_tree().process_frame
			if generation!=epoch:return
			t=_tween();t.tween_property(fx,'modulate:a',1.0,.3);t.tween_interval(.7);await t.finished
			await Damage.animate(effects,target,str(finish[2]));t=_tween();t.tween_property(fx,'modulate:a',0.0,.35);await t.finished;fx.queue_free();number.queue_free()
		left.queue_free();right.queue_free()
	elif kind=='effect':
		var e: Dictionary=step.event;var target:=int(e.get('targetId',e.get('playerId',e.get('casterId',-1))))
		var key:='art/card-impact.webp'
		if step.effect in ['card_defense','chopper_status','bigmom_status']:key='art/card-status-dodge.webp' if e.get('status')=='dodge' else 'art/card-status-guard.webp'
		elif step.effect in ['usopp_hit','usopp_miss']:key='art/card-usopp-green-star-v1.webp'
		elif step.effect=='aokiji_freeze':key='art/card-fx-ice.webp'
		elif step.effect=='nami_paralyze':key='art/card-fx-lightning.webp'
		elif step.effect in ['zoro_discard','killer_disarm']:key='art/card-fx-slash.webp'
		var sprite:=_image(effects,key);sprite.size=Vector2(150,150);sprite.position=_origin(int(e.get('casterId',-1)))-sprite.size*.5
		var t:=_tween();t.tween_property(sprite,'position',_origin(target)-sprite.size*.5,.5);await t.finished
		if seats.has(target) and (step.effect=='usopp_miss' or e.get('status')=='dodge'):
			var node: Control=seats[target].node;var start:=node.position;t=_tween();t.tween_property(node,'position',start+Vector2(32,0),.18);t.tween_property(node,'position',start,.32);await t.finished
		elif step.effect in ['usopp_hit','zoro_discard','killer_disarm'] and seats.has(target):
			var node: Control=seats[target].node;var start:=node.position;t=_tween()
			for offset in [-8,8,-5,5,0]:t.tween_property(node,'position',start+Vector2(offset,0),.08)
			await t.finished
		t=_tween();t.tween_interval(.3);t.tween_property(sprite,'modulate:a',0.0,.3);await t.finished;sprite.queue_free()
	elif kind=='peek_notice':
		for target in step.get('targets',[]):
			if int(target)==int(model.get('viewer',-1)):
				for hand in hands.values():if hand.visible:_lease(hand)
			var card:=await _flight(null,_origin(int(target)),_origin(int(step.actor)),.55)
			if generation!=epoch:return
			var t:=_tween();t.tween_interval(.5);t.tween_property(card,'position',_origin(int(target))-card.size*.5,.55);await t.finished;card.queue_free()
	elif kind=='shuffle' or kind=='kid':
		var pile: Button=discard if kind=='kid' else deck;_lease(pile)
		if kind=='shuffle':
			for actor in step.get('actors',[]):
				if int(actor)==int(model.get('viewer',-1)):
					for hand in hands.values():if hand.visible:_lease(hand)
				var returning:=await _flight(null,_origin(int(actor)),deck.position+deck.size*.5,.3)
				if generation!=epoch:return
				returning.queue_free()
		var cards: Array=[]
		for i in range(5):var card:=_image(effects,'images/cards/back.webp');card.size=pile.size;card.position=pile.position;cards.append(card)
		for round_index in range(3):
			var t:=_tween();t.set_parallel(true)
			for i in range(cards.size()):t.tween_property(cards[i],'position',pile.position+Vector2((i-2)*20,(-1 if i%2 else 1)*14),.18)
			await t.finished;t=_tween();t.set_parallel(true)
			for card in cards:t.tween_property(card,'position',pile.position,.18)
			await t.finished
		for card in cards:card.queue_free()
		if kind=='kid':
			if int(step.actor)==int(model.get('viewer',-1)):
				var pick:=_button(effects,'點擊棄牌堆抽取',func():_kid_take(ticket,generation,step));_rect(pick,discard.position.x-50,discard.position.y,discard.size.x+100,discard.size.y);return
			else:
				var taking:=await _flight(null,discard.position+discard.size*.5,_origin(int(step.actor)),.55)
				if generation!=epoch:return
				taking.queue_free()
		else:
			for actor in step.get('actors',[]):
				var dealing:=await _flight(null,deck.position+deck.size*.5,_origin(int(actor)),.3)
				if generation!=epoch:return
				dealing.queue_free()
	elif kind=='pass':
		var actors: Array=step.get('actors',[]);var cards: Array=[]
		if actors.has(model.get('viewer')):
			for hand in hands.values():if hand.visible:_lease(hand)
		var t:=_tween();t.set_parallel(true)
		for i in range(actors.size()):
			var card:=_image(effects,'images/cards/back.webp');card.size=Vector2(90,134);card.position=_origin(int(actors[i]))-card.size*.5;cards.append(card);t.tween_property(card,'position',_origin(int(actors[(i+actors.size()-1)%actors.size()]))-card.size*.5,.95)
		if not cards.is_empty():await t.finished
		for card in cards:card.queue_free()
	elif kind=='coin':
		var coin:=_image(effects,'');coin.texture=_coin_face(true);coin.size=Vector2(160,160);coin.position=size*.5-coin.size*.5;coin.pivot_offset=coin.size*.5
		while not asset_cache.pending.is_empty():await get_tree().process_frame
		if generation!=epoch:return
		var destination:=TAU*4+(PI if step.get('face')=='tails' else 0.0)
		var t:=_tween();t.tween_method(func(angle):coin.scale.x=maxf(.04,absf(cos(angle)));coin.texture=_coin_face(cos(angle)>=0);coin.position.y=size.y*.5-80-sin(angle/destination*PI)*80,0.0,destination,2.4);await t.finished
		notice.text=str(step.get('text','判定完成'));t=_tween();t.tween_interval(1.1);await t.finished;coin.queue_free()
	elif kind=='reward':
		var reward:=_image(effects,'images/reward/chest_'+str(clampi(int(step.event.get('coins',1)),1,5))+'.webp');reward.size=Vector2(size.y*.55,size.y*.55);reward.position=size*.5-reward.size*.5;reward.pivot_offset=reward.size*.5;reward.scale=Vector2(.2,.2)
		var t:=_tween();t.tween_property(reward,'scale',Vector2.ONE,.6).set_trans(Tween.TRANS_BACK);t.tween_interval(.8);await t.finished;reward.queue_free()
		_open_gallery(step.event.get('cards',[]),'獎勵寶箱・'+str(step.event.get('coins',0))+' 金幣',func():_emit('reward_done',{}, {'roundNo':step.event.roundNo});_finish(ticket,generation));return
	elif kind=='video':
		video_card=int(step.card);movie.start(video_card);return
	elif kind=='swap':
		var e: Dictionary=step.event;var from:=int(e.casterId);var to:=int(e.targetId)
		if int(model.get('viewer',-1)) in [from,to]:
			for node in hands.values():if node.visible:_lease(node)
		var a:=_image(effects,'images/cards/back.webp');var b:=_image(effects,'images/cards/back.webp')
		for card in [a,b]:card.size=Vector2(100,150)
		a.position=_origin(from)-a.size*.5;b.position=_origin(to)-b.size*.5
		var t:=_tween();t.set_parallel(true);t.tween_property(a,'position',_origin(to)-a.size*.5,.8);t.tween_property(b,'position',_origin(from)-b.size*.5,.8);await t.finished;a.queue_free();b.queue_free()
	_finish(ticket,generation)

func _kid_take(ticket: int,generation: int,step: Dictionary) -> void:
	_clear(effects);var card:=await _flight(step.get('card'),discard.position+discard.size*.5,_origin(int(step.actor)),.55)
	if generation!=epoch:return
	card.queue_free();_finish(ticket,generation)

func _finish(ticket: int,generation: int) -> void:
	if generation!=epoch or ticket!=current_ticket:return
	effect_busy=false;turn_label.show();current_ticket=-1;running_tweens=running_tweens.filter(func(t):return t.is_valid() and t.is_running());presentation_done.emit(ticket)

func cancel_presentation() -> void:
	epoch+=1
	render_epoch+=1;input_loading=false
	for t in effects.get_meta('damage_tweens',[]):if t.is_valid():t.kill()
	effects.set_meta('damage_tweens',[])
	for t in running_tweens:if t.is_valid():t.kill()
	running_tweens.clear();_release_leases();_clear(effects);_clear(overlay);overlay.hide();played_card=null;current_ticket=-1;effect_busy=false;local_busy=false;private_finish=Callable()
	if movie!=null:movie.stop()
	if audio!=null:audio.stop_voice()
	turn_label.show()
	_layout()

func _video_failed() -> void:
	notify_player('強化影片載入失敗，可重試或略過這次播放')
	var retry:=_button(effects,'重試影片',func():_clear(effects);movie.start(video_card));_rect(retry,size.x*.3,size.y*.5,180,52)
	var skip:=_button(effects,'略過影片',func():_clear(effects);_finish(current_ticket,epoch));_rect(skip,size.x*.56,size.y*.5,180,52)

func _coin_face(heads: bool) -> Texture2D:
	if not coin_faces.has(heads):
		var atlas:=AtlasTexture.new();atlas.atlas=_tex('art/card-coin-toss-v1.webp');atlas.region=Rect2(52 if heads else 617,81,536,536);coin_faces[heads]=atlas
	return coin_faces[heads]

func account_tag(secret: String) -> String:return secret.sha256_text()

func store_pending_result(tag: String,json: String) -> void:
	if tag.length()!=64 or not tag.is_valid_hex_number():return
	var path:='user://card-result-'+tag+'.json'
	if json.is_empty():
		if FileAccess.file_exists(path):DirAccess.remove_absolute(path)
	else:
		var file:=FileAccess.open(path,FileAccess.WRITE)
		if file:file.store_string(json)

func load_pending_result(tag: String) -> String:
	if tag.length()!=64 or not tag.is_valid_hex_number():return ''
	var path:='user://card-result-'+tag+'.json'
	return FileAccess.get_file_as_string(path) if FileAccess.file_exists(path) else ''

func result_json(json: String) -> void:
	result_data=JSON.parse_string(json)
	if _state().get('final')!=null:_show_results()
	elif result_data.get('saved',false):
		if overlay.get_meta('result_recovery',false):overlay.hide();overlay.set_meta('result_recovery',false);local_busy=false
	else:
		_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP;overlay.set_meta('result_recovery',true);local_busy=true
		var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
		var text:=_label(overlay,'上次結算尚未同步\n'+str(result_data.get('error','請確認連線後重試；結算紀錄已保留。')),22);_rect(text,size.x*.15,size.y*.2,size.x*.7,size.y*.3)
		var retry:=_button(overlay,'重新同步結算',func():_emit('save_result'));_rect(retry,size.x*.2,size.y*.6,size.x*.27,50)
		var exit_button:=_button(overlay,'返回啟動器',func():_emit('exit'));_rect(exit_button,size.x*.53,size.y*.6,size.x*.27,50)

func _show_results() -> void:
	local_busy=true;_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var title:=_label(overlay,'偉大航道爭霸戰・賽季結算',24);_rect(title,24,12,size.x-48,42)
	var final: Dictionary=_state().get('final',{});var rows: Array=result_data.get('rows',final.get('ranking',[]))
	result_page=clampi(result_page,0,maxi(0,int(ceilf(rows.size()/4.0))-1))
	if rows.size()>4:
		var previous:=_button(overlay,'上一頁',func():result_page-=1;_show_results());_rect(previous,size.x-190,8,84,40);previous.disabled=result_page==0
		var next:=_button(overlay,'下一頁',func():result_page+=1;_show_results());_rect(next,size.x-100,8,84,40);next.disabled=(result_page+1)*4>=rows.size()
	for i in range(result_page*4,mini(rows.size(),(result_page+1)*4)):
		var p: Dictionary=rows[i];var score: Dictionary=final.get('scoreboard',{}).get(str(int(p.id)),{});var col:=i%2;var row:=floorf((i%4)/2.0)
		var row_h:=(size.y-170)/maxf(ceilf(mini(rows.size(),4)/2.0),1)
		var panel:=_image(overlay,'art/card-hud-panel.webp');panel.stretch_mode=TextureRect.STRETCH_SCALE;_rect(panel,20+col*size.x*.49,62+row*row_h,size.x*.47,row_h-4)
		var name_label:=_label(overlay,str(i+1)+'　'+str(p.name)+'　'+str(int(p.coins))+' 金幣',16);name_label.autowrap_mode=TextServer.AUTOWRAP_OFF;name_label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;_rect(name_label,panel.position.x+20,panel.position.y+14,panel.size.x-40,20)
		var title_text:=str(p.get('title',''));var detail:=_label(overlay,(title_text+'\n' if not title_text.is_empty() else '')+'攻擊 '+str(int(score.get('atkScore',0)))+'　防禦 '+str(int(score.get('defScore',0)))+'　命中 '+str(int(score.get('hitScore',0)))+'\n偵查 '+str(int(score.get('intelScore',0)))+'　生存 '+str(int(score.get('survivalScore',0))),12);detail.add_theme_constant_override('line_spacing',0);_rect(detail,panel.position.x+20,panel.position.y+34,panel.size.x-40,panel.size.y-52)
		var hit:=Button.new();hit.flat=true;hit.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND;overlay.add_child(hit);_rect(hit,panel.position.x,panel.position.y,panel.size.x,panel.size.y);hit.pressed.connect(func():_show_result_detail(int(p.id)))
		var hint:=_label(overlay,'查看 ›',12);_rect(hint,panel.position.x+panel.size.x-76,panel.position.y+panel.size.y-30,60,18)
	var status:=_label(overlay,'獎勵與段位已同步' if result_data.get('saved',false) else '正在同步結算；失敗時可重試',16);_rect(status,24,size.y-104,size.x-48,30)
	if result_data.has('error'):status.text=str(result_data.error)
	if result_data.get('saved',false):
		var rank: Dictionary=result_data.get('rank',{});status.text=str(result_data.get('rankName',''))+'　'+(str(int(rank.get('rp',0)))+' RP' if int(rank.get('tier',0))>0 else '已完成 '+str(int(rank.get('placement',{}).get('games',0)))+' / 3 場')+'　'+str(result_data.get('rankMeta',{}).get('deltaText',''))+'・獎勵已同步'
	var retry:=_button(overlay,'重新同步',func():_emit('save_result'));_rect(retry,size.x*.24,size.y-65,size.x*.24,48);retry.disabled=result_data.get('saved',false)
	var back:=_button(overlay,'返回大廳',func():overlay.hide();local_busy=false;result_data={};result_page=0;_emit('finish_room'));_rect(back,size.x*.52,size.y-65,size.x*.24,48)

func _show_result_detail(player_id: int) -> void:
	_clear(overlay);overlay.show();local_busy=true
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var final: Dictionary=_state().get('final',{});var rows: Array=result_data.get('rows',final.get('ranking',[]));var selected: Dictionary={};var index:=0
	for i in range(rows.size()):
		if int(rows[i].id)==player_id:selected=rows[i];index=i;break
	if selected.is_empty():_show_results();return
	var header:=_label(overlay,str(selected.name)+'・戰績與懸賞令',21);_rect(header,20,8,size.x*.65,40)
	var back:=_button(overlay,'返回結算',_show_results);_rect(back,size.x-140,8,120,40)
	var radar:=preload('res://native_card_radar.gd').new();radar.scores=final.get('scoreboard',{});radar.mine=int(model.get('viewer',player_id));radar.other=player_id;overlay.add_child(radar);_rect(radar,size.x*.45,65,size.x*.52,size.y-145)
	var legend:=_label(overlay,'藍色：自己　粉紅：'+str(selected.name),14);_rect(legend,size.x*.46,48,size.x*.49,30)
	var prev:=_button(overlay,'‹ 上一位',func():_show_result_detail(int(rows[posmod(index-1,rows.size())].id)));_rect(prev,size.x*.50,size.y-76,size.x*.18,38)
	var next:=_button(overlay,'下一位 ›',func():_show_result_detail(int(rows[(index+1)%rows.size()].id)));_rect(next,size.x*.73,size.y-76,size.x*.18,38)
	var message:=_label(overlay,'',13);message.name='PosterStatus';_rect(message,size.x*.44,size.y-37,size.x*.53,25)
	var viewport:=SubViewport.new();viewport.size=Vector2i(768,1152);viewport.transparent_bg=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;overlay.add_child(viewport)
	var canvas:=Control.new();canvas.theme=theme;canvas.size=Vector2(768,1152);viewport.add_child(canvas)
	var avatar:=str(selected.get('avatar',final.get('playersMeta',{}).get(str(player_id),{}).get('avatar',str(player_id%8+1))));if avatar.is_valid_float():avatar=str(int(float(avatar)))
	var picture:=_image(canvas,'images/avatars/'+avatar+'.webp');_rect(picture,132,239,500,500)
	var shader:=Shader.new();shader.code='shader_type canvas_item; void fragment(){vec4 c=texture(TEXTURE,UV);c.a*=1.0-smoothstep(0.495,0.5,length(UV-vec2(0.5)));COLOR=c;}'
	var material:=ShaderMaterial.new();material.shader=shader;picture.material=material
	var frame:=_image(canvas,'images/wanted.png');frame.stretch_mode=TextureRect.STRETCH_SCALE;frame.size=Vector2(768,1152)
	var name_text:=str(selected.name);var name_font:=mini(126,int(650.0/maxf(1,Fonts.base().get_string_size(name_text,HORIZONTAL_ALIGNMENT_LEFT,-1,126).x)*126))
	var name_label:=_label(canvas,name_text,maxi(28,name_font));name_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;name_label.add_theme_color_override('font_color',Color('674832'));_rect(name_label,55,939-name_font,650,name_font*1.25)
	var bounty:=float(selected.get('bounty',0))
	if bounty==0:
		var s: Dictionary=final.get('scoreboard',{}).get(str(player_id),{});bounty=(float(s.get('coinScore',0))*200000000+(float(s.get('atkScore',0))+float(s.get('hitScore',0)))*10000000+(float(s.get('defScore',0))+float(s.get('intelScore',0))+float(s.get('survivalScore',0)))*5000000)*6.0/maxi(1,rows.size())
	var digits:=String.num(bounty,0);var grouped:=''
	for i in range(digits.length()):
		if i>0 and (digits.length()-i)%3==0:grouped+=','
		grouped+=digits[i]
	var amount_font:=mini(78,int(675.0/maxf(1,Fonts.base().get_string_size(grouped,HORIZONTAL_ALIGNMENT_LEFT,-1,78).x)*78))
	var amount:=_label(canvas,grouped,amount_font);amount.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;amount.add_theme_color_override('font_color',Color('38281d'));_rect(amount,40,950,688,100)
	var preview:=TextureRect.new();preview.texture=viewport.get_texture();preview.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;preview.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;overlay.add_child(preview);_rect(preview,20,56,size.x*.40,size.y-118)
	var save:=_button(overlay,'存到個人頁面',func():poster_status('正在儲存…');_emit('save_poster',{'player':player_id}));_rect(save,20,size.y-55,size.x*.20,42);save.disabled=not result_data.get('saved',false)
	var export_button:=_button(overlay,'匯出圖片',func():_export_poster(viewport.get_texture().get_image()));_rect(export_button,size.x*.23,size.y-55,size.x*.18,42)
	export_button.disabled=true
	while is_instance_valid(viewport) and not viewport.is_queued_for_deletion() and not asset_cache.pending.is_empty():await get_tree().process_frame
	if not is_instance_valid(viewport) or viewport.is_queued_for_deletion():return
	await RenderingServer.frame_post_draw
	if is_instance_valid(viewport) and not viewport.is_queued_for_deletion():
		viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED
		if is_instance_valid(export_button):export_button.disabled=false

func poster_status(text: String) -> void:
	var label:=overlay.get_node_or_null('PosterStatus')
	if label!=null:label.text=text
	else:notify_player(text)

func _export_poster(picture: Image) -> void:
	if OS.get_name()=='iOS' and ClassDB.class_exists('PoIOSBridge'):
		var bridge: Object=ClassDB.instantiate('PoIOSBridge');var ok: bool=bridge.call('share_png',Marshalls.raw_to_base64(picture.save_png_to_buffer()));poster_status('請選擇儲存方式' if ok else '圖片匯出失敗，請再試');return
	var dialog:=FileDialog.new();dialog.access=FileDialog.ACCESS_FILESYSTEM;dialog.file_mode=FileDialog.FILE_MODE_SAVE_FILE;dialog.use_native_dialog=true;dialog.filters=PackedStringArray(['*.png ; PNG 圖片']);dialog.current_file='PIRATE-ODYSSEY-WANTED.png';add_child(dialog)
	dialog.file_selected.connect(func(file):poster_status('圖片已儲存' if picture.save_png(file)==OK else '無法寫入這個位置，請另選資料夾');dialog.queue_free())
	dialog.canceled.connect(func():dialog.queue_free());dialog.popup_centered_ratio(.8)

func _menu() -> void:
	if local_busy or effect_busy:return
	local_busy=true;_emit('reading',{}, {'value':true});_clear(overlay);overlay.show();overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	var bg:=_image(overlay,'art/card-arena.webp');bg.size=size;bg.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	for i in range(2):
		var label:=_label(overlay,'音樂音量' if i==0 else '語音與音效',18);_rect(label,size.x*.24,size.y*.2+i*64,130,32)
		var slider:=HSlider.new();overlay.add_child(slider);slider.min_value=0;slider.max_value=1;slider.step=.05;slider.value=audio.music if i==0 else audio.volume;slider.value_changed.connect(func(v):audio.set_volume(v,i==0));_rect(slider,size.x*.43,size.y*.2+i*64,size.x*.31,32)
	var back:=_button(overlay,'繼續對局',func():overlay.hide();local_busy=false;_emit('reading',{}, {'value':false}));_rect(back,size.x*.35,size.y*.62,size.x*.3,48)
	var exit_button:=_button(overlay,'離開牌局・返回啟動器',func():_emit('exit'));_rect(exit_button,size.x*.35,size.y*.8,size.x*.3,48)

func begin_audio() -> void:audio_enabled=true;audio.begin_music()

func _process(delta: float) -> void:
	pulse_clock+=delta
	var c: Dictionary=model.get('controls',{});var current:=int(_state().get('turnIndex',-1));var busy: bool=model.get('busy',false)
	for id in seats:
		var row: Dictionary=seats[id];var selectable: bool=c.get('kind')=='targets' and c.get('targets',[]).has(id) and not busy
		row.node.mouse_default_cursor_shape=Control.CURSOR_POINTING_HAND if selectable else Control.CURSOR_ARROW
		row.ring.modulate=Color(1.2,1.5,1.4) if selectable else Color(1.3,1.17,.85) if id==current else Color.WHITE
		row.ring.pivot_offset=row.ring.size*.5;row.ring.scale=Vector2.ONE*(1.02+sin(pulse_clock*3)*.025) if selectable or id==current else Vector2.ONE

func return_to_launcher() -> void:
	var parent:=get_parent()
	if parent!=null and parent.has_method('return_to_launcher'):parent.call('return_to_launcher')
	else:get_tree().quit()
