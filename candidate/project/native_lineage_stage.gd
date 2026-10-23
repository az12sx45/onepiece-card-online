extends Control
## Persistent presentation of the original lineage controller. No grading,
## inventory mutation, random selection or completion rules live in this file.
signal source_input(uid: String, type: String, x: float, y: float, pointer: int)
signal source_assets_ready(scope: String)
signal surface_closed
const ROOT := "images/board/lineage_extraction_ui/"
const CHOICE := "images/board/battle_command_ui/battle_command_choice_button_frame.webp"
const FRAME := "images/board/battle_switch_ui/battle_switch_panel_frame.webp"
var cache: Node
var battle_view: Control
var model: Dictionary={}
var textures: Dictionary={}
var controls: Dictionary={}
var touched: Dictionary={}
var saved_visibility: Dictionary={}
var prepare_scope := ""
var epoch := 0
var packets := 0
var text_writes := 0
var native_inputs := 0
var rotator := Control.new()
var target_layer := Control.new()
var outcome_layer:=preload("res://native_lineage_outcome.gd").new()
var flash_started: Dictionary={}
var target_key := ""
var target_started := 0.0
var outcome_started := 0.0
var wheel_angle := 90.0
var wheel_from := 90.0
var wheel_goal := 90.0
var wheel_started := 0.0
var wheel_duration := 0.0
var dragging := false
var pointer_index := -1
var held_uid := ""
var manifest: Dictionary

func _ready() -> void:
	hide();clip_contents=true;mouse_filter=Control.MOUSE_FILTER_STOP
	theme=Theme.new();theme.default_font=preload("res://native_fonts.gd").weighted(750.0)
	manifest=JSON.parse_string(FileAccess.get_file_as_string("res://lineage-visual-assets.json"))
	cache.asset_ready.connect(func(path,texture):
		for key in controls:
			var node: Control=controls[key]
			if node is TextureRect and node.get_meta("asset_path","")==path:node.texture=texture;textures[path]=texture
	)
	rotator.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(rotator)
	target_layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;target_layer.clip_contents=true;add_child(target_layer)
	add_child(outcome_layer)
	resized.connect(_layout)
	set_process(false)

func prepare_source_json(value: String) -> void:
	var packet: Dictionary=JSON.parse_string(value)
	var scope: String=packet.scope
	if prepare_scope==scope:return
	prepare_scope=scope;epoch+=1
	var extra: Array=[str(packet.get("enemy",{}).get("portrait",""))]
	for participant in packet.get("participants",[]):extra.append(str(participant.get("avatarUrl","")))
	_prepare(scope,epoch,extra)

func _prepare(scope: String, ticket: int,extra: Array) -> void:
	# Bound worker concurrency and retain the currently painted battle while
	# decoding. The original timed minigame begins only after this warmup.
	var paths: Array=manifest.paths.duplicate()
	for path in extra:
		if not str(path).is_empty() and not paths.has(path):paths.append(path)
	for path in textures.keys():
		if not paths.has(path):textures.erase(path)
	while not paths.is_empty():
		var batch: Array=[]
		for index in range(mini(2,paths.size())):
			var path: String=paths.pop_front();batch.append(path)
			var texture: Texture2D=cache.request(path)
			if texture:textures[path]=texture
		while true:
			if ticket!=epoch:return
			var waiting:=false
			for path in batch:
				if cache.failed.has(path):push_error("Extraction asset failed: "+path);return
				if not textures.has(path):
					var texture: Texture2D=cache.request(path)
					if texture:textures[path]=texture
					else:waiting=true
			if not waiting:break
			await get_tree().process_frame
	source_assets_ready.emit(scope)

func _seconds() -> float:return Time.get_ticks_msec()/1000.0
func _rect(x: float,y: float,w: float,h: float) -> Rect2:return Rect2(size*Vector2(x,y),size*Vector2(w,h))
func _showcase() -> Rect2:return Rect2(size*Vector2(.045,.24),Vector2(size.x*.37,size.x*.37*9.0/16.0))
func _enemy() -> Rect2:
	if not "lineage-extraction-operation" in model.get("stageClasses",[]):
		return Rect2(battle_view.portraits.enemy.position,battle_view.portraits.enemy.size)
	# Preserve the square portrait, bounded to the upper playfield on short phones.
	var edge:=minf(340.0,size.y*(.64 if model.get("mode","")=="waiting" else .69))
	return Rect2(Vector2(size.x*.97-edge,size.y*.02),Vector2.ONE*edge)
func _enemy_wrap() -> Rect2:return _enemy().grow(-8.0)
func source_bounds_json(name: String) -> String:
	var rect:=Rect2(Vector2.ZERO,size)
	if name=="enemyCard":rect=_enemy()
	elif name=="enemyPortraitWrap":rect=_enemy_wrap()
	elif name=="lineage-launcher-showcase":rect=_showcase()
	elif name=="lineage-launcher-bay":
		var box:=_showcase();var edge:=box.size.x*.315
		rect=Rect2(box.position+box.size*Vector2(.25,.466)-Vector2.ONE*edge*.5,Vector2.ONE*edge)
	elif name=="lineage-cylinder-rotator":rect=Rect2(rotator.position,rotator.size)
	elif name not in ["battleStage","lineageExtractionRoot"]:push_error("Unknown source extraction bounds: "+name)
	return JSON.stringify({"left":rect.position.x,"top":rect.position.y,"right":rect.end.x,"bottom":rect.end.y,"width":rect.size.x,"height":rect.size.y,"x":rect.position.x,"y":rect.position.y})

func _number(value: Variant, fallback: float=0.0) -> float:
	if value==null:return fallback
	return str(value).to_float()
func _angle(value: String) -> float:return value.trim_prefix("rotate(").to_float()
func _bezier(t: float,a: float,b: float) -> float:return 3.0*(1.0-t)*(1.0-t)*t*a+3.0*(1.0-t)*t*t*b+t*t*t
func _ease(progress: float,x1: float,y1: float,x2: float,y2: float) -> float:
	var low:=0.0;var high:=1.0
	for index in range(18):
		var mid: float=(low+high)*.5
		if _bezier(mid,x1,x2)<progress:low=mid
		else:high=mid
	return _bezier((low+high)*.5,y1,y2)
func rendered_rotation(_uid: String, _fallback: float) -> float:
	_advance_wheel();return wheel_angle
func _advance_wheel() -> void:
	var t:=clampf((_seconds()-wheel_started)/maxf(.0001,wheel_duration),0,1)
	wheel_angle=lerpf(wheel_from,wheel_goal,_ease(t,.08,.76,.12,1)) if wheel_duration>0 else wheel_goal
	rotator.rotation_degrees=wheel_angle

func apply_source_json(value: String) -> void:
	var incoming: Dictionary=JSON.parse_string(value);packets+=1
	if incoming.mode=="outcome" and model.get("mode","")!="outcome":outcome_started=_seconds()
	model=incoming
	if not model.visible:close_surface();return
	var styles: Dictionary=model.rotator
	var goal:=_angle(str(styles.get("transform","rotate(90deg)")))
	if goal!=wheel_goal:
		_advance_wheel();wheel_from=wheel_angle;wheel_goal=goal;wheel_started=_seconds()
		wheel_duration=0.0 if "is-cylinder-spinning" in model.classes else _number(model.theme.get("--lineage-cylinder-duration","460ms"))/1000.0
	show();_hide_battle_controls();_layout()
	set_process(model.mode not in ["offer","result","unavailable","waiting"])

func _hide_battle_controls() -> void:
	var operation: bool="lineage-extraction-operation" in model.stageClasses
	for node in [battle_view.command_strip,battle_view.attack_strip,battle_view.sheets,battle_view.matchup,battle_view.choice_frame,battle_view.escape_frame]:
		if node==null:continue
		if not saved_visibility.has(node):saved_visibility[node]=node.visible
		node.hide()
	for node in [battle_view.portraits.enemy,battle_view.portraits.player,battle_view.hud.player.panel,battle_view.hud.enemy.panel]:
		if not saved_visibility.has(node):saved_visibility[node]=node.visible
		node.visible=false if node==battle_view.portraits.enemy or operation else saved_visibility[node]

func close_surface() -> void:
	var was_visible:=visible
	hide();set_process(false);dragging=false;held_uid=""
	for node in saved_visibility:
		if is_instance_valid(node):node.visible=saved_visibility[node]
	saved_visibility.clear()
	if was_visible:surface_closed.emit()

func reset_surface() -> void:
	close_surface();epoch+=1;prepare_scope="";model={};target_key="";flash_started.clear()

func _process(_delta: float) -> void:
	_advance_wheel();_layout()

func _node(key: String, kind: String, parent: Control=null) -> Control:
	touched[key]=true
	if controls.has(key):controls[key].show();return controls[key]
	var node: Control
	if kind=="image" or kind=="portrait":
		if kind=="portrait":node=preload("res://native_portrait_card.gd").new();node.enemy=true;node.cache=cache
		else:node=TextureRect.new()
		node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	elif kind=="scroll":
		node=ScrollContainer.new();node.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_SHOW_NEVER;node.vertical_scroll_mode=ScrollContainer.SCROLL_MODE_AUTO
	elif kind=="group":node=Control.new()
	elif kind=="label":
		node=Label.new();node.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;node.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;node.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		node.add_theme_color_override("font_color",Color("fff0bd"));node.add_theme_color_override("font_shadow_color",Color.BLACK);node.add_theme_constant_override("shadow_offset_y",2)
	else:
		node=Button.new();node.flat=true;node.mouse_filter=Control.MOUSE_FILTER_STOP;node.focus_mode=Control.FOCUS_NONE
		node.gui_input.connect(func(event):_button_input(node,event))
		for state in ["normal","hover","pressed","disabled","focus"]:node.add_theme_stylebox_override(state,StyleBoxEmpty.new())
		for state in ["font_color","font_hover_color","font_pressed_color","font_disabled_color"]:node.add_theme_color_override(state,Color("fff0bd"))
		node.add_theme_font_size_override("font_size",13)
	if kind not in ["button","scroll"]:node.mouse_filter=Control.MOUSE_FILTER_IGNORE
	(parent if parent!=null else self).add_child(node);controls[key]=node
	return node
func _place(node: Control,rect: Rect2) -> void:
	if node.position!=rect.position:node.position=rect.position
	if node.size!=rect.size:node.size=rect.size
func _image(key: String,path: String,rect: Rect2,parent: Control=null,stretch: bool=false) -> TextureRect:
	var node: TextureRect=_node(key,"image",parent)
	node.set_meta("asset_path",path)
	_place(node,rect);node.stretch_mode=TextureRect.STRETCH_SCALE if stretch else TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var texture: Texture2D=textures.get(path)
	if texture==null and not path.is_empty():texture=cache.request(path)
	if texture and node.texture!=texture:node.texture=texture;textures[path]=texture
	return node
func _label(key: String,text: String,rect: Rect2,font_size: int=13,parent: Control=null) -> Label:
	var node: Label=_node(key,"label",parent);_place(node,rect)
	if node.text!=text:node.text=text;text_writes+=1
	if node.get_theme_font_size("font_size")!=font_size:node.add_theme_font_size_override("font_size",font_size)
	return node
func _scroll_text(key: String,text: String,rect: Rect2,font_size: int) -> void:
	var scroll: ScrollContainer=_node(key+"-scroll","scroll");_place(scroll,rect)
	var label:=_label(key,text,Rect2(Vector2.ZERO,Vector2(rect.size.x-10,0)),font_size,scroll)
	label.custom_minimum_size.x=rect.size.x-10;label.size_flags_horizontal=Control.SIZE_EXPAND_FILL
func _button(key: String,action: Dictionary,rect: Rect2,pointer: bool=false,transparent: bool=false,parent: Control=null) -> void:
	if action.is_empty():return
	if not transparent:_image(key+"-frame","images/board/battle_command_ui/battle_command_danger_button_frame.webp" if "danger" in str(action.get("classes","")) else CHOICE,rect,parent,true)
	var node: Button=_node(key,"button",parent);_place(node,rect)
	node.set_meta("uid",str(action.uid));node.set_meta("pointer",pointer);node.disabled=bool(action.get("disabled",false))
	var text: String="" if transparent else str(action.get("label",""))
	if node.text!=text:node.text=text;text_writes+=1
	if not transparent:node.add_theme_font_size_override("font_size",clampi(int(size.x*.018),11,18))
func _button_input(node: Button,event: InputEvent) -> void:
	if node.disabled:return
	if event is InputEventMouseButton and event.device==-1:return
	var down:=false;var up:=false;var point:=Vector2.ZERO;var pointer:=0
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:down=event.pressed;up=not event.pressed;point=get_local_mouse_position()
	elif event is InputEventScreenTouch:down=event.pressed;up=not event.pressed;point=event.position+node.position;pointer=event.index
	else:return
	var uid: String=node.get_meta("uid")
	if down:
		held_uid=uid
		if node.get_meta("pointer"):native_inputs+=1;source_input.emit(uid,"pointerdown",point.x,point.y,pointer)
	elif up and held_uid==uid and not node.get_meta("pointer"):
		native_inputs+=1;source_input.emit(uid,"click",point.x,point.y,pointer);held_uid=""
	node.accept_event()

func _gui_input(event: InputEvent) -> void:
	if model.get("mode","")!="cylinder":return
	if event is InputEventMouse and event.device==-1:return
	var point:=Vector2.ZERO;var type:=""
	if event is InputEventMouseButton:
		point=event.position
		if event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed;type="pointerdown" if event.pressed else "pointerup"
		elif event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:type="wheel";point.y=-85 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 85
	elif event is InputEventMouseMotion and dragging:point=event.position;type="pointermove"
	elif event is InputEventScreenTouch:
		point=event.position;dragging=event.pressed;pointer_index=event.index;type="pointerdown" if event.pressed else "pointerup"
	elif event is InputEventScreenDrag and dragging and event.index==pointer_index:point=event.position;type="pointermove"
	if not type.is_empty():native_inputs+=1;source_input.emit(str(model.cylinderUid),type,point.x,point.y,maxi(0,pointer_index));accept_event()

func _layout() -> void:
	if model.is_empty() or not visible:return
	touched.clear()
	var operation: bool="lineage-extraction-operation" in model.stageClasses
	if operation:_image("background",ROOT+"lineage_extraction_minigame_bg_v1.webp",Rect2(Vector2.ZERO,size),null,true).stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	# Keep the source portrait resource, restoring its visible non-KO presentation.
	var portrait: TextureRect=_node("enemy","portrait");_place(portrait,_enemy());portrait.texture=textures.get(str(model.get("enemy",{}).get("portrait","")),battle_view.portraits.enemy.texture)
	portrait.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	if operation:
		var title_box:=Rect2(size*Vector2(.06,.025),Vector2(_enemy().position.x-size.x*.08,size.y*.085))
		var title_size:=clampi(int(size.x*.024),15,26)
		while title_size>12 and theme.default_font.get_string_size(model.title,HORIZONTAL_ALIGNMENT_LEFT,-1,title_size).x>title_box.size.x:title_size-=1
		_label("title",model.title,title_box,title_size)
		_operation()
	else:_panels()
	for key in controls:
		if not touched.has(key):controls[key].hide()
	rotator.visible=operation;target_layer.visible=operation and model.get("target")!=null
	outcome_layer.visible=model.mode=="outcome";outcome_layer.size=size
	if outcome_layer.visible:outcome_layer.paint(model,_enemy_wrap(),_showcase(),_seconds()-outcome_started)
	# Explicit canvas ordering; persistent children never depend on creation order.
	for key in ["background"]:
		if controls.has(key):move_child(controls[key],0)
	move_child(rotator,mini(1,get_child_count()-1))
	move_child(portrait,get_child_count()-1);move_child(target_layer,get_child_count()-1)
	move_child(outcome_layer,get_child_count()-1)

func _panels() -> void:
	# Two original framed panels; reserve footer actions and scroll long copy so
	# short landscape devices cannot hide the source dismiss/decline controls.
	var top:=.65 if model.mode=="waiting" else .72
	var height:=.33 if model.mode=="waiting" else .258
	for side in ["info","action"]:
		var box:=_rect(.022 if side=="info" else .507,top,.48,height)
		_image(side+"-frame",FRAME,box,null,true)
		_label(side+"-title",str(model.infoTitle if side=="info" else model.actionTitle),Rect2(box.position+Vector2(15,5),Vector2(box.size.x-30,20)),13)
		if side=="info":
			_scroll_text("info-copy",str(model.info),Rect2(box.position+Vector2(18,25),box.size-Vector2(36,33)),clampi(int(size.y*.029),10,13))
	var box:=_rect(.507,top,.48,height);var actions: Array=model.actions
	var footer:=26.0 if model.mode=="waiting" else minf(34,box.size.y*.34)
	var body:=Rect2(box.position+Vector2(20,25),Vector2(box.size.x-40,maxf(15,box.size.y-31-footer)))
	var copy: String=str(model.copy)
	if not model.resultStats.is_empty():
		copy=""
		for stat in model.resultStats:copy+=str(stat.label)+" "+str(stat.value)+"　"
		copy+="\n"+str(model.copy)
	if not model.waitingSummary.is_empty():
		copy=str(model.waitingSummary)
		for participant in model.participants:copy+="\n"+str(participant.name)+" · "+str(participant.status)+" · "+str(participant.terminal)
	if model.mode=="waiting":_participants(body)
	else:_scroll_text("action-copy",copy,body,clampi(int(size.y*.027),10,12))
	for index in range(actions.size()):
		var width: float=minf(220,(box.size.x-40)/maxi(1,actions.size()))
		var x: float=box.position.x+box.size.x*.5-width*actions.size()*.5+index*width
		_button("action-"+str(index),actions[index],Rect2(Vector2(x,box.end.y-footer-5),Vector2(width-4,footer)))

func _participants(body: Rect2) -> void:
	_label("waiting-summary",str(model.waitingSummary),Rect2(body.position-Vector2(0,2),Vector2(body.size.x,12)),10)
	var scroll: ScrollContainer=_node("waiting-scroll","scroll");_place(scroll,Rect2(body.position+Vector2(0,12),Vector2(body.size.x,maxf(35,body.size.y-12))))
	var content: Control=_node("waiting-content","group",scroll)
	var width:=body.size.x-10;content.custom_minimum_size=Vector2(width,ceilf(model.participants.size()/2.0)*38)
	for index in range(model.participants.size()):
		var item: Dictionary=model.participants[index];var box:=Rect2(Vector2((index%2)*width*.5,floorf(index/2.0)*38),Vector2(width*.5-3,35))
		_image("waiting-frame-"+str(index),ROOT+"lineage_extractor_selection_panel_frame.webp",box,content,true)
		_image("waiting-avatar-"+str(index),str(item.image),Rect2(box.position+Vector2(4,4),Vector2(27,27)),content)
		_label("waiting-name-"+str(index),str(item.name)+" · "+str(item.terminal)+"\n"+str(item.status),Rect2(box.position+Vector2(33,1),Vector2(box.size.x-37,33)),9,content)

func _operation() -> void:
	var styles: Dictionary=model.rotator
	rotator.position=Vector2(_number(styles.get("left")),_number(styles.get("top")));rotator.size=Vector2(_number(styles.get("width",100)),_number(styles.get("height",100)));rotator.pivot_offset=rotator.size*.5
	_image("cylinder",ROOT+"lineage_extractor_cylinder_7_slot.webp",Rect2(Vector2.ZERO,rotator.size),rotator)
	for slot in model.slots:
		if slot.item==null:continue
		var visual: Dictionary=slot.visual;var edge: float=rotator.size.x*.172*.88
		var a: float=deg_to_rad(-90+int(slot.index)*360.0/7.0)
		var center:=rotator.size*.5+Vector2(cos(a),sin(a))*rotator.size.x*.293
		var image:=_image("slot-"+str(slot.index),ROOT+str(visual.image),Rect2(center-Vector2.ONE*edge*.5,Vector2.ONE*edge),rotator,true)
		image.pivot_offset=image.size*.5;image.rotation_degrees=-wheel_angle+_number(visual.start);image.scale=Vector2.ONE*_number(visual.get("cylinderScale",1))
		image.position+=Vector2(0,edge*_number(visual.get("cylinderOffsetY",0))/100).rotated(deg_to_rad(image.rotation_degrees))
		if image.get_meta("source_clip","")!=str(visual.get("cylinderClip","none")):
			image.material=ShaderMaterial.new();image.material.shader=preload("res://native_lineage_device.gdshader")
			var values: PackedStringArray=str(visual.get("cylinderClip","inset(0% 0% 0% 0%)")).trim_prefix("inset(").trim_suffix(")").split(" ")
			if values.size()==4:image.material.set_shader_parameter("crop",Vector4(values[0].to_float(),values[1].to_float(),values[2].to_float(),values[3].to_float())/100)
			image.set_meta("source_clip",str(visual.get("cylinderClip","none")))
		image.modulate=Color(1,1,1,.0 if model.mode=="outcome" and int(model.selectedIndex)==int(slot.index) else (1.0 if int(model.selectedIndex)==int(slot.index) or model.mode=="cylinder" else .5))
	var showcase:=_showcase()
	var frame:=_image("launcher",ROOT+"lineage_extractor_launcher_frame_v2.webp",showcase,null,true)
	if frame.material==null:
		frame.material=ShaderMaterial.new();frame.material.shader=preload("res://native_lineage_mask.gdshader");frame.material.set_shader_parameter("launcher_hole",true)
	if model.mode!="cylinder" and not model.slots.is_empty():
		var selected: Dictionary=model.slots[int(model.selectedIndex)]
		if selected.item!=null:
			var visual: Dictionary=selected.visual;var edge:=showcase.size.x*.315
			var bay:=_image("launcher-bay",ROOT+str(visual.image),Rect2(showcase.position+showcase.size*Vector2(.25,.466)-Vector2.ONE*edge*.5,Vector2.ONE*edge),null,true)
			if bay.material==null:bay.material=ShaderMaterial.new();bay.material.shader=preload("res://native_lineage_launcher.gdshader")
			var turn:=0.0
			if "is-outcome-locked" in model.classes:turn=_ease(clampf((_seconds()-outcome_started-1.4)/1.25,0,1),.2,.85,.2,1)
			bay.material.set_shader_parameter("angle",deg_to_rad(lerpf(_number(visual.start),_number(visual.fire),turn)))
			bay.material.set_shader_parameter("art_y",_number(visual.get("artOffsetY",0))/100)
			if "is-outcome-firing" in model.classes:
				var recoil:=preload("res://native_lineage_motion.gd").sample("lineage-launcher-recoil",_seconds()-outcome_started-2.2,bay.size)
				bay.position+=recoil.translate
	var caption:=_label("caption",str(model.selectedName),Rect2(showcase.position+showcase.size*Vector2(.4075,.708),showcase.size*Vector2(.495,.1)),10)
	caption.autowrap_mode=TextServer.AUTOWRAP_OFF;caption.clip_text=true;caption.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	_label("selection-detail",str(model.selectedDetail),Rect2(showcase.position+Vector2(0,showcase.size.y+6),Vector2(showcase.size.x,48)),11)
	if model.mode=="cylinder":
		_label("instruction",str(model.instruction),_rect(.415,.82,.25,.12),12)
		var lock_rect:=Rect2(showcase.position+showcase.size*Vector2(.036,.28),Vector2.ONE*showcase.size.x*.28)
		_button("lock",model.lock,lock_rect,false,true)
	elif "is-minigame" in model.classes:
		for index in range(model.stats.size()):
			var stat: Dictionary=model.stats[index]
			_label("stat-"+str(index),str(stat.label)+"\n"+str(stat.value),_rect(.415+index*.085,.73,.08,.12),12)
		_label("hint",str(model.phaseHint),_rect(.415,.86,.25,.12),11)
		_target()
	elif model.mode=="outcome":
		_label("outcome-status",str(model.outcome.status),_rect(.38,.79,.3,.13),12)
		if model.outcome.next!=null:_button("outcome-next",model.outcome.next,_rect(.41,.91,.25,.08))

func _target() -> void:
	var wrap:=_enemy_wrap();var layer:=Rect2(wrap.position+wrap.size*Vector2(.03,.025),wrap.size*Vector2(.94,.825))
	_place(target_layer,layer)
	if model.target==null:return
	var target: Dictionary=model.target;var styles: Dictionary=target.styles;var images: Dictionary=target.images
	if target_key!=str(target.uid):target_key=str(target.uid);target_started=_seconds()
	var age:=_seconds()-target_started
	if "lineage-osu-target" in target.kind:
		var edge: float=layer.size.x*_number(styles.get("--target-size",27))/100
		var center:=layer.size*Vector2(_number(styles.get("left",50))/100,_number(styles.get("top",50))/100)
		var box:=Rect2(center-Vector2.ONE*edge*.5,Vector2.ONE*edge)
		_image("hit",images.hit,box,target_layer)
		var sample:=preload("res://native_lineage_motion.gd").sample("lineage-approach",age*1.35/maxf(.001,_number(styles.get("--target-duration",1350))/1000),Vector2.ONE*edge)
		if "is-start" in target.kind:sample=preload("res://native_lineage_motion.gd").sample("lineage-start-pulse",fmod(age,1.35),Vector2.ONE*edge)
		var factor: float=sample.transform.get_scale().x
		_image("approach",images.approach,Rect2(center-Vector2.ONE*edge*factor*.5,Vector2.ONE*edge*factor),target_layer).modulate.a=sample.opacity
		_label("number","開始" if "is-start" in target.kind else str(target.number),box,15,target_layer)
		_button("target",{"uid":target.uid},box,true,true,target_layer)
		if target.preview!=null:
			var preview: Dictionary=target.preview.styles
			var p:=layer.size*Vector2(_number(preview.left)/100,_number(preview.top)/100)
			var image:=_image("preview",images.hit,Rect2(p-Vector2.ONE*edge*.5,Vector2.ONE*edge),target_layer);image.modulate.a=.34
			_label("preview-number",str(target.preview.number),Rect2(p-Vector2.ONE*edge*.5,Vector2.ONE*edge),14,target_layer).modulate.a=.34
	else:
		var center:=layer.size*.5
		if "lineage-lock-target" in target.kind:
			_image("track",images.track,Rect2(center-layer.size*.73,layer.size*1.46),target_layer)
			for side in ["left","right"]:
				var edge:=layer.size.x*.31;var x:=layer.size.x*_number(styles.get("--lock-"+side,-4 if side=="left" else 104))/100
				var image:=_image("marker-"+side,images[side],Rect2(Vector2(x,center.y)-Vector2.ONE*edge*.5,Vector2.ONE*edge),target_layer);image.flip_h=side=="right"
		else:
			var base:=layer.size*.92;var factor:=_number(styles.get("--seal-scale",.52))
			_image("fixed",images.fixed,Rect2(center-base*.5+base*Vector2(-.0114,.0143),base),target_layer)
			_image("pulse",images.pulse,Rect2(center-base*factor*.5+base*Vector2(.0013,.002),base*factor),target_layer)
		_button("target",{"uid":target.uid},Rect2(Vector2.ZERO,layer.size),true,true,target_layer)
		if target.start!=null:
			_button("start",target.start,Rect2(center-Vector2(layer.size.x*.33,28),Vector2(layer.size.x*.66,56)),true,false,target_layer)
	var live_flashes: Dictionary={}
	for index in range(model.flashes.size()):
		var flash: Dictionary=model.flashes[index]
		# Reuse one label per overlapping source flash, hide after its source
		# lifetime, and use the original opacity/transform curve.
		var key: String=str(flash.uid)
		live_flashes[key]=true
		if not flash_started.has(key):flash_started[key]=_seconds()
		var font_size:=clampi(int(size.x*.034),24,48)
		var text_size:=theme.default_font.get_string_size(str(flash.label),HORIZONTAL_ALIGNMENT_LEFT,-1,font_size)+Vector2(8,8)
		var label:=_label("flash-"+str(index),str(flash.label),Rect2(Vector2.ZERO,text_size),font_size,target_layer)
		var sample:=preload("res://native_lineage_motion.gd").sample("lineage-grade-pop",_seconds()-float(flash_started[key]),label.size)
		label.modulate=Color("ff8c8c") if flash.label=="Miss" else Color("78f3e9") if flash.label=="Good" else Color.WHITE
		var transform: Transform2D=sample.transform
		label.modulate.a=sample.opacity;label.pivot_offset=label.size*.5;label.scale=transform.get_scale();label.position=layer.size*.5+transform.origin
	for key in flash_started.keys():
		if not live_flashes.has(key):flash_started.erase(key)

func diagnostics_json() -> String:
	var buttons: Array=[]
	for key in controls:
		var node: Control=controls[key]
		if node is Button and node.is_visible_in_tree():buttons.append({"key":key,"uid":node.get_meta("uid"),"disabled":node.disabled,"rect":[node.global_position.x,node.global_position.y,node.size.x,node.size.y]})
	return JSON.stringify({"mode":model.get("mode",""),"packets":packets,"textWrites":text_writes,"nodes":controls.size(),"nativeInputs":native_inputs,"buttons":buttons,"assets":textures.size(),"visible":visible,"wheelAngle":wheel_angle})

func test_resize_window(width: int,height: int) -> void:
	get_window().size=Vector2i(width,height)

func test_pixel_digest() -> String:
	var digest:=HashingContext.new();digest.start(HashingContext.HASH_SHA256)
	digest.update(get_viewport().get_texture().get_image().get_data())
	return digest.finish().hex_encode()

func test_waiting_layout() -> bool:
	if model.get("mode","")!="waiting":return false
	var scroll: Control=controls["waiting-scroll"];var action: Control=controls["action-0"]
	return scroll.size.y>=35 and scroll.global_position.y+scroll.size.y<action.global_position.y and action.global_position.y+action.size.y<=size.y
