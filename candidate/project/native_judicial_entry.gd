extends Control
signal command_requested(key: String)
signal surface_ready
var cache: Node
var model: Dictionary={}
var epoch:=0
var busy:=false
var parts: Array=[]
var heading:=Label.new()
var subtitle:=RichTextLabel.new()
var portrait:=TextureRect.new()
var feature:=RichTextLabel.new()
var hp:=ProgressBar.new()
var hp_text:=Label.new()
var scroll:=ScrollContainer.new()
var content:=Control.new()
var phases: Array=[]
var participants: Array=[]
var actions: Array=[]
var empty:=Label.new()
func _label(parent: Node,font_size: int) -> Label:
	var label:=Label.new();label.add_theme_font_size_override("font_size",font_size);label.add_theme_color_override("font_color",Color("f6dfae"));label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;label.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(label);return label
func _image(parent: Node) -> TextureRect:
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(image);return image
func _part(region: Rect2) -> NinePatchRect:
	var patch:=NinePatchRect.new();patch.mouse_filter=Control.MOUSE_FILTER_IGNORE;patch.scale=Vector2.ONE*.25;patch.set_meta("region",region)
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:patch.set_patch_margin(side,35)
	add_child(patch);parts.append(patch);return patch
func _place(patch: NinePatchRect,rect: Rect2) -> void:patch.position=rect.position;patch.size=rect.size/.25
func _card() -> Dictionary:
	var root:=Control.new();root.mouse_filter=Control.MOUSE_FILTER_PASS;content.add_child(root)
	return {"root":root,"frame":_image(root),"picture":_image(root),"name":_label(root,12),"state":_label(root,10),"detail":_label(root,10),"stats":[_label(root,10),_label(root,10),_label(root,10),_label(root,10)]}
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS;var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(650);theme=t
	for region in [Rect2(409,5,853,213),Rect2(461,217,970,58),Rect2(126,198,364,417),Rect2(95,610,509,194)]:_part(region)
	heading.add_theme_font_size_override("font_size",17);heading.add_theme_color_override("font_color",Color("ffe4ad"));heading.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;heading.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(heading)
	for text in [subtitle,feature]:text.scroll_active=true;text.add_theme_font_size_override("normal_font_size",12);text.add_theme_color_override("default_color",Color("edd9af"));add_child(text)
	portrait.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;portrait.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(portrait)
	hp.show_percentage=false;hp.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(hp);hp_text.add_theme_font_size_override("font_size",11);hp_text.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;hp_text.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(hp_text)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;add_child(scroll);content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.mouse_filter=Control.MOUSE_FILTER_PASS;scroll.add_child(content)
	for i in range(6):phases.append(_card())
	for i in range(4):participants.append(_card())
	empty.add_theme_font_size_override("font_size",12);content.add_child(empty)
	for i in range(2):
		var button:=Button.new();button.add_theme_font_size_override("font_size",14);button.add_theme_color_override("font_color",Color("ffe5aa"))
		for state in ["normal","hover","pressed","disabled"]:button.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		add_child(button);var frame:=_image(button);frame.show_behind_parent=true;actions.append({"button":button,"frame":frame});button.pressed.connect(func():if visible and not busy and not button.disabled:command_requested.emit(str(button.get_meta("key"))))
	resized.connect(_layout);hide()
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("060f19"));draw_rect(Rect2(1,1,size.x-2,size.y-2),Color("9d7948"),false,2)
func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==model and visible and not busy:surface_ready.emit();return
	if not visible:scroll.scroll_vertical=0;feature.scroll_to_line(0);subtitle.scroll_to_line(0)
	epoch+=1;busy=true;model=next;_prepare(epoch)
func _prepare(sequence: int) -> void:
	var textures: Dictionary={};var paths: Array=[model.frame];var pictures: Array=[model.portrait]+model.phases+model.participants;var deadline:=Time.get_ticks_msec()+20000
	for entry in model.phases+model.participants+model.actions:paths.append(entry.get("frame",entry.get("image","")))
	while sequence==epoch:
		var ready:=true
		for entry in pictures:
			var path: String=str(entry.image)
			if cache.failed.has(path):path=str(entry.get("fallback",""))
			if path.is_empty() or cache.failed.has(path) or textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			else:ready=false
		for path in paths:
			if textures.has(path):continue
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
			elif cache.failed.has(path):push_error("Original judicial frame unavailable: "+str(path));return
			else:ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:push_error("Judicial image timeout");return
		await get_tree().process_frame
	if sequence!=epoch:return
	for patch in parts:var atlas:=AtlasTexture.new();atlas.atlas=textures[model.frame];atlas.region=patch.get_meta("region");patch.texture=atlas
	heading.text=model.title;subtitle.text=model.subtitle;feature.text="\n\n".join(model.feature);portrait.texture=_picture_texture(model.portrait,textures);hp.visible=model.hp!=null;hp_text.visible=hp.visible
	if model.hp:hp.value=model.hp.percent;hp_text.text=model.hp.text
	for i in range(6):_bind(phases[i],model.phases[i],textures,false)
	for i in range(4):
		participants[i].root.visible=i<model.participants.size()
		if i<model.participants.size():_bind(participants[i],model.participants[i],textures,true)
	empty.text=model.empty;empty.visible=model.participants.is_empty()
	for i in range(2):actions[i].button.text=model.actions[i].label;actions[i].button.disabled=model.actions[i].disabled;actions[i].button.set_meta("key",model.actions[i].key);actions[i].frame.texture=textures[model.actions[i].image]
	busy=false;_layout();show();surface_ready.emit()
func _picture_texture(entry: Dictionary,textures: Dictionary) -> Texture2D:return textures.get(entry.image,textures.get(entry.get("fallback","")))
func _bind(card: Dictionary,entry: Dictionary,textures: Dictionary,participant: bool) -> void:
	card.frame.texture=textures[entry.frame];card.picture.texture=_picture_texture(entry,textures);card.name.text=entry.name;card.state.text=entry.state;card.detail.text="  ".join(entry.stats) if participant else entry.rank;card.root.modulate=Color("aeb5c0") if entry.get("defeated",false) else Color.WHITE;card.state.add_theme_color_override("font_color",Color("77e2dd" if entry.get("current",false) else "f6dfae"))
	card.detail.visible=not participant
	for i in range(4):
		card.stats[i].visible=participant
		if participant:card.stats[i].text=str(entry.stats[i]).replace(" ","\n");card.stats[i].horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
func _card_layout(card: Dictionary,rect: Rect2,participant: bool) -> void:
	card.root.position=rect.position;card.root.size=rect.size;card.frame.position=Vector2.ZERO;card.frame.size=rect.size
	card.picture.position=rect.size*Vector2(.12,.22);card.picture.size=rect.size*Vector2(.15,.57)
	card.name.position=rect.size*Vector2(.33,.38 if not participant else .27);card.name.size=rect.size*Vector2(.38,.33);card.state.position=rect.size*Vector2(.33,.14);card.state.size=rect.size*Vector2(.4,.19)
	card.detail.position=rect.size*Vector2(.33,.60) if participant else rect.size*Vector2(.79,.4);card.detail.size=rect.size*Vector2(.57,.3) if participant else rect.size*Vector2(.1,.3)
	if participant:
		card.name.position=rect.size*Vector2(.32,.37);card.name.size=rect.size*Vector2(.33,.2);card.state.position=rect.size*Vector2(.32,.65);card.state.size=rect.size*Vector2(.33,.18)
		for i in range(4):card.stats[i].position=rect.size*Vector2(.683+(i%2)*.109,.315+(i/2)*.25);card.stats[i].size=rect.size*Vector2(.083,.2)
func _layout() -> void:
	queue_redraw()
	if busy or model.is_empty():return
	_place(parts[0],Rect2(8,0,size.x-16,51));heading.position=Vector2(30,19);heading.size=Vector2(size.x-60,24)
	_place(parts[1],Rect2(8,51,size.x-16,42));subtitle.position=Vector2(22,59);subtitle.size=Vector2(size.x-44,27)
	var left:=size.x*.29;var height:=size.y-150;var picture_height:=height*.56;var region: Rect2=parts[2].get_meta("region");var factor:=minf((left-16)/region.size.x,picture_height/region.size.y);var extent:=region.size*factor;parts[2].scale=Vector2.ONE*factor;parts[2].size=region.size;parts[2].position=Vector2((left-extent.x)/2,96)
	portrait.position=parts[2].position+extent*Vector2(.12,.13);portrait.size=extent*Vector2(.76,.74);_place(parts[3],Rect2(8,98+picture_height,left-16,height-picture_height));feature.position=Vector2(20,108+picture_height);feature.size=Vector2(left-40,height-picture_height-22-(18 if model.hp else 0));hp.position=Vector2(22,size.y-78);hp.size=Vector2(left-44,12);hp_text.position=Vector2(22,size.y-81);hp_text.size=Vector2(left-44,17)
	scroll.position=Vector2(left,96);scroll.size=Vector2(size.x-left-8,height+2);var width:=scroll.size.x-16;var cell_width:=width/2;var phase_height:=cell_width/3+16
	for i in range(6):_card_layout(phases[i],Rect2((i%2)*cell_width,(i/2)*phase_height,cell_width,phase_height),false)
	var y:=phase_height*3+4;var participant_height:=width/3
	for i in range(model.participants.size()):_card_layout(participants[i],Rect2(0,y+i*participant_height,width,participant_height),true)
	empty.position=Vector2(12,y+12);empty.size=Vector2(width-24,26);content.custom_minimum_size=Vector2(0,y+maxf(45,model.participants.size()*participant_height))
	for i in range(2):actions[i].button.position=Vector2(16+i*(size.x-24)/2,size.y-48);actions[i].button.size=Vector2((size.x-40)/2,40);actions[i].frame.size=actions[i].button.size
func close_surface() -> void:epoch+=1;busy=false;hide()
func test_ready() -> bool:return visible and not busy
func test_reveal_button(key: String) -> bool:
	for action in actions:if test_ready() and str(action.button.get_meta("key",""))==key:return not action.button.disabled
	return false
func test_button_rect_json(key: String) -> String:
	for action in actions:if str(action.button.get_meta("key",""))==key:var r: Rect2=action.button.get_global_rect();return JSON.stringify([r.position.x,r.position.y,r.size.x,r.size.y])
	return "null"
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,subtitle,portrait,feature,scroll]+actions.map(func(a):return a.button):bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	var text_fits:=true
	for card in phases+participants:
		if not card.root.visible:continue
		for label in [card.name,card.state,card.detail]+card.stats:
			if label.visible:text_fits=text_fits and Rect2(Vector2.ZERO,card.root.size).encloses(label.get_rect()) and label.get_minimum_size().y<=label.size.y
	return JSON.stringify({"bounded":bounded,"textFits":text_fits,"readingClear":scroll.position.y+scroll.size.y<actions[0].button.position.y,"phases":phases.size(),"participants":model.participants.size()})
func test_scroll_bottom() -> void:scroll.scroll_vertical=100000


