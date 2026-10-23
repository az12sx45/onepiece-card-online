extends Control
## Four persistent native buttons; source JS supplies each shuffle animation.
signal command_requested(key: String)
signal surface_ready
const Ease=preload("res://native_evolution_motion.gd")
var cache: Node
var model: Dictionary={}
var panel:=Control.new()
var frame:=TextureRect.new()
var heading:=Label.new()
var subtitle:=Label.new()
var note:=Label.new()
var start:=Button.new()
var start_frame:=TextureRect.new()
var cards: Array[Dictionary]=[]
var loaded: Dictionary={}
var busy:=false
var epoch:=0
var grid:=Rect2()
var animations: Dictionary={}
var animation_batch_tick:=0
var bounds_batch_active:=false
var transform_pattern:=RegEx.new()
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	var t:=Theme.new();t.default_font=preload("res://native_fonts.gd").weighted(900);theme=t
	panel.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(panel)
	for image in [frame,start_frame]:image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE
	panel.add_child(frame)
	for label in [heading,subtitle,note]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.clip_text=true;panel.add_child(label)
	heading.add_theme_color_override("font_color",Color("fff2b4"));subtitle.add_theme_color_override("font_color",Color("bfeef4"));note.add_theme_color_override("font_color",Color("fff1b1"));note.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	note.max_lines_visible=2;note.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	panel.add_child(start);start.flat=true;start.add_child(start_frame);start.move_child(start_frame,0);start_frame.show_behind_parent=true;start.add_theme_color_override("font_color",Color("fff3c9"));start.pressed.connect(func():command_requested.emit(model.start.key))
	for i in range(4):
		var button:=Button.new();button.flat=true;panel.add_child(button)
		var art:=ColorRect.new();var effect:=ShaderMaterial.new();effect.shader=preload("res://native_chest_flip.gdshader");art.material=effect;art.mouse_filter=Control.MOUSE_FILTER_IGNORE;button.add_child(art)
		var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;label.add_theme_color_override("font_color",Color("fff0a8"));button.add_child(label)
		button.pressed.connect(func():command_requested.emit(model.entries[i].key))
		cards.append({"button":button,"art":art,"label":label,"origin":Vector2.ZERO,"face_down":false,"flip_tick":-1})
	transform_pattern.compile("^translate\\(([-\\d.e+]+)(?:px)?,([-\\d.e+]+)(?:px)?\\) rotate\\(([-\\d.e+]+)deg\\) scale\\(([-\\d.e+]+)\\)$")
	resized.connect(_layout);hide();set_process(false)
func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color("040b12"))
func apply_json(value: String) -> void:
	epoch+=1;busy=true;model=JSON.parse_string(value);animations.clear()
	start.set_meta("key",model.start.key)
	for i in range(4):cards[i].button.set_meta("key",model.entries[i].key)
	for card in cards:card.face_down=false;card.flip_tick=-1;card.button.rotation=0;card.button.scale=Vector2.ONE
	_load(epoch)
func _load(token: int) -> void:
	var paths: Array=[model.frame,"images/board/encounter_ui/encounter_action_button_frame.webp"]
	for entry in model.entries:
		for path in [entry.front,entry.back]:
			if not paths.has(path):paths.append(path)
	loaded.clear();var deadline:=Time.get_ticks_msec()+15000
	while loaded.size()<paths.size() and token==epoch:
		for path in paths:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Original chest art failed: "+path);return
			if cache.pending.size()>=2 and not cache.records.has(path) and not cache.live_textures.has(path):continue
			var image: Texture2D=cache.request(path)
			if image!=null:loaded[path]=image
		if Time.get_ticks_msec()>deadline:push_error("Original chest art timeout");return
		await get_tree().process_frame
	if token!=epoch:return
	frame.texture=loaded[model.frame];start_frame.texture=loaded[paths[1]]
	for i in range(4):
		var effect: ShaderMaterial=cards[i].art.material;var entry: Dictionary=model.entries[i]
		for face in ["front","back"]:effect.set_shader_parameter(face,loaded[entry[face]]);effect.set_shader_parameter(face+"_size",loaded[entry[face]].get_size())
	busy=false;_layout();_sync();show();set_process(true);surface_ready.emit()
func update_json(value: String) -> void:model=JSON.parse_string(value);if not busy:_sync()
func _sync() -> void:
	heading.text=model.title;subtitle.text=model.subtitle;note.text=model.note;start.text=model.start.label;start.disabled=model.start.disabled;start.visible=not model.start.removed
	_fit_copy()
	for i in range(4):
		var c: Dictionary=cards[i];var e: Dictionary=model.entries[i];c.button.disabled=e.disabled or e.classes.has("spectator-readonly-card");c.label.text=e.label;c.label.visible=not model.gridClasses.has("is-shuffling")
		var face: bool=e.classes.has("is-face-down")
		if face!=c.face_down:c.face_down=face;c.flip_tick=Time.get_ticks_msec()
func _layout() -> void:
	if model.is_empty():return
	var width:=minf(1480,minf(size.x-16,(size.y-10)*1.776833));panel.size=Vector2(width,width*941/1672);panel.position=(size-panel.size)/2;frame.size=panel.size
	# Keep the original frame proportions; use its actual text wells instead
	# of shrinking all copy with the artwork on low-height phones.
	heading.add_theme_font_size_override("font_size",maxi(14,int(width*.0215)));heading.position=panel.size*Vector2(.3,.08);heading.size=panel.size*Vector2(.4,.07)
	subtitle.add_theme_font_size_override("font_size",maxi(8,int(width*.0092)));subtitle.position=panel.size*Vector2(.3,.157);subtitle.size=panel.size*Vector2(.4,.045)
	note.add_theme_font_size_override("font_size",maxi(11,int(width*.012)));note.position=panel.size*Vector2(.16,.728);note.size=panel.size*Vector2(.68,.1)
	start.add_theme_font_size_override("font_size",maxi(12,int(width*.0135)));start.position=panel.size*Vector2(.364,.852);start.size=panel.size*Vector2(.272,.088);start_frame.size=start.size
	grid=Rect2(panel.size*Vector2(.1045,.2315),panel.size*Vector2(.791,.462))
	var gap:=grid.size.x*.0225;var card_size:=Vector2((grid.size.x-gap*3)/4,grid.size.y);var sorted: Array=[0,1,2,3];sorted.sort_custom(func(a,b):return model.entries[a].order<model.entries[b].order if model.entries[a].order!=model.entries[b].order else a<b)
	for slot in range(4):
		var c: Dictionary=cards[sorted[slot]];c.origin=grid.position+Vector2(slot*(card_size.x+gap),0);c.button.position=c.origin;c.button.size=card_size;c.button.pivot_offset=card_size/2
		c.art.position=card_size*Vector2(.0584,.0384);c.art.size=card_size*Vector2(.8832,.7532);c.art.pivot_offset=c.art.size/2
		c.art.material.set_shader_parameter("plane_size",c.art.size)
		c.label.add_theme_font_size_override("font_size",maxi(9,int(width*.0096)));c.label.clip_text=true;c.label.position=card_size*Vector2(.17,.87);c.label.size=card_size*Vector2(.66,.112)
	_fit_copy()
	queue_redraw()
func _fit_copy() -> void:
	if panel.size.x<=1:return
	var font: Font=subtitle.get_theme_font("font")
	var font_size:=subtitle.get_theme_font_size("font_size")
	subtitle.visible=font.get_string_size(str(model.subtitle),HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x<=subtitle.size.x
	heading.position.y=panel.size.y*(.08 if subtitle.visible else .105)
	note.text=str(model.note) if subtitle.visible else str(model.note)+"\n"+str(model.subtitle)
	note.add_theme_font_size_override("font_size",maxi(11,int(panel.size.x*.012)) if subtitle.visible else maxi(9,int(panel.size.x*.01)))
func _index(key: String) -> int:
	for i in range(model.entries.size()):
		if model.entries[i].key==key:return i
	return -1
func set_order(key: String,order: int) -> void:model.entries[_index(key)].order=order;_layout()
func bounds_json(key: String) -> String:
	# getBoundingClientRect samples the current animation, not the last drawn
	# frame. Timers can fire between native process frames during a shuffle.
	# Source samples the grid once, then starts four Web Animations within
	# one synchronous callback. Share that timeline origin across the native
	# bridge calls; their execution cost must not stagger the four starts.
	if key=="grid":animation_batch_tick=Time.get_ticks_msec();bounds_batch_active=true
	_animate_cards(animation_batch_tick if bounds_batch_active else Time.get_ticks_msec())
	var bounds:=Rect2(panel.position+grid.position,grid.size)
	if key!="grid":
		var button: Button=cards[_index(key)].button;var transform:=button.get_global_transform();bounds=Rect2(transform*Vector2.ZERO,Vector2.ZERO)
		for point in [Vector2(button.size.x,0),button.size,Vector2(0,button.size.y)]:bounds=bounds.expand(transform*point)
	return JSON.stringify({"left":bounds.position.x,"top":bounds.position.y,"width":bounds.size.x,"height":bounds.size.y})
func end_bounds_batch() -> void:bounds_batch_active=false
func animate_json(key: String,value: String) -> void:
	var data: Dictionary=JSON.parse_string(value);var frames: Array=[]
	for i in range(data.frames.size()):
		var frame_data: Dictionary=data.frames[i];var match:=transform_pattern.search(frame_data.transform);assert(match!=null,"Unbound original chest transform")
		frames.append({"time":frame_data.get("offset",float(i)/(data.frames.size()-1)),"x":float(match.get_string(1)),"y":float(match.get_string(2)),"angle":float(match.get_string(3)),"scale":float(match.get_string(4)),"z":int(frame_data.zIndex)})
	assert(data.options.easing=="cubic-bezier(.18,.78,.2,1)" and data.options.fill=="both","Unbound original chest easing")
	animations[key]={"frames":frames,"duration":float(data.options.duration),"delay":float(data.options.delay),"tick":animation_batch_tick}
func cancel_animation(key: String) -> void:
	animations.erase(key);var c: Dictionary=cards[_index(key)];c.button.position=c.origin;c.button.rotation=0;c.button.scale=Vector2.ONE;c.button.z_index=2
func _process(_delta: float) -> void:
	_animate_cards(Time.get_ticks_msec())
func _animate_cards(now: int) -> void:
	if busy or loaded.is_empty():return
	for i in range(4):
		var c: Dictionary=cards[i];var e: Dictionary=model.entries[i];var flip:=1.0 if c.face_down else 0.0
		if c.flip_tick>=0:
			var t:=Ease._ease(clampf((now-c.flip_tick)/700.0,0,1),[.2,.82,.2,1]);flip=t if c.face_down else 1-t
		c.art.material.set_shader_parameter("angle",flip*PI)
		if animations.has(e.key):
			var a: Dictionary=animations[e.key];var progress:=Ease._ease(clampf((now-a.tick-a.delay)/a.duration,0,1),[.18,.78,.2,1]);var left: Dictionary=a.frames[0];var right: Dictionary=a.frames[-1]
			for j in range(1,a.frames.size()):
				if progress<=a.frames[j].time:left=a.frames[j-1];right=a.frames[j];break
			var t:=clampf((progress-left.time)/(right.time-left.time),0,1);c.button.position=c.origin+Vector2(lerpf(left.x,right.x,t),lerpf(left.y,right.y,t));c.button.rotation=deg_to_rad(lerpf(left.angle,right.angle,t));c.button.scale=Vector2.ONE*lerpf(left.scale,right.scale,t);c.button.z_index=int(left.z if t<.5 else right.z)
func close_surface() -> void:epoch+=1;busy=false;animations.clear();hide();set_process(false)
func test_ready() -> bool:return visible and not busy
func test_press(key: String) -> bool:
	if not test_ready():return false
	var button: Button=start if key==model.start.key else cards[_index(key)].button
	if not button.visible or button.disabled:return false
	button.pressed.emit();return true
func test_layout() -> bool:
	if not test_ready() or not Rect2(Vector2.ZERO,size).encloses(panel.get_rect()):return false
	for text in [heading,subtitle,note,start]:
		if text.visible and not Rect2(Vector2.ZERO,panel.size).encloses(text.get_rect()):return false
	if (subtitle.visible and heading.get_rect().intersects(subtitle.get_rect())) or note.get_rect().intersects(grid):
		print("CHEST_TEXT_BOUNDS ",heading.get_rect()," ",subtitle.get_rect()," ",note.get_rect()," ",grid)
		return false
	if note.get_line_count()>note.get_visible_line_count():return false
	for card in cards:
		if not Rect2(Vector2.ZERO,panel.size).encloses(Rect2(card.origin,card.button.size)):return false
		if not Rect2(Vector2.ZERO,card.button.size).encloses(card.label.get_rect()):return false
	return true
