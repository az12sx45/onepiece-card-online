extends Control
## Source result art and data; mobile replacement list scrolls within its well.
signal command_requested(key: String)
var model: Dictionary={}
var panel:=Control.new()
var frame:=TextureRect.new()
var portrait:=TextureRect.new()
var heading:=Label.new()
var nameplate:=Label.new()
var grade:=Label.new()
var stats: Array[Label]=[]
var scroll:=ScrollContainer.new()
var content:=VBoxContainer.new()
var buttons: Dictionary={}
var replacements: Array[Dictionary]=[]
var assets: Dictionary={}
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	add_child(panel)
	for picture in [frame,portrait]:
		_picture(picture);panel.add_child(picture)
	for label in [heading,nameplate,grade]:
		_label(label);panel.add_child(label)
	for i in range(6):
		var label:=Label.new();_label(label);stats.append(label);panel.add_child(label)
	scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;panel.add_child(scroll)
	content.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_theme_constant_override("separation",8);scroll.add_child(content)
	resized.connect(_layout);hide()
func _picture(node: TextureRect) -> void:
	node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
func _label(node: Label) -> void:
	node.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;node.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;node.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;node.clip_text=true;node.mouse_filter=Control.MOUSE_FILTER_IGNORE
	node.add_theme_color_override("font_color",Color("f4dda6"))
func _button(key: String,text: String,parent: Node) -> Button:
	var button:=Button.new();button.text=text;button.flat=true;button.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;parent.add_child(button);buttons[key]=button
	button.pressed.connect(func():command_requested.emit(key));return button
func apply(value: Dictionary,textures: Dictionary) -> void:
	model=value;assets=textures
	for button in buttons.values():
		if button.get_parent()==panel:panel.remove_child(button);button.queue_free()
	buttons.clear();replacements.clear()
	for child in content.get_children():content.remove_child(child);child.queue_free()
	frame.texture=assets[model.art.frame];portrait.texture=assets[model.image]
	heading.text=model.title;nameplate.text=model.name;grade.text=model.art.grade
	for i in range(6):stats[i].text=model.art.stats[i].label+" "+model.art.stats[i].value
	var explanation:=Label.new();_label(explanation);explanation.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	explanation.clip_text=false
	explanation.text=model.name+" · "+model.meta+"\n"+model.subtitle;explanation.add_theme_font_size_override("font_size",11);content.add_child(explanation)
	if not model.full:
		for text in model.art.offer:
			var label:=Label.new();_label(label);label.size_flags_horizontal=Control.SIZE_EXPAND_FILL
			label.clip_text=false
			label.text=text;label.add_theme_font_size_override("font_size",14 if text==model.name else 12);content.add_child(label)
	else:
		for row in model.replacements:
			var root:=Control.new();root.size_flags_horizontal=Control.SIZE_EXPAND_FILL;content.add_child(root)
			var border:=TextureRect.new();_picture(border);border.texture=assets[model.art.replacementFrame];root.add_child(border)
			var image:=TextureRect.new();_picture(image);image.texture=assets[row.image];root.add_child(image)
			var text:=Label.new();_label(text);text.text=row.name;text.add_theme_font_size_override("font_size",10);root.add_child(text)
			var tags:=Label.new();_label(tags);tags.text=" · ".join(PackedStringArray(row.tags));tags.add_theme_font_size_override("font_size",7);root.add_child(tags)
			var status:=Label.new();_label(status);status.text="\n".join(PackedStringArray(row.status));status.add_theme_font_size_override("font_size",8);root.add_child(status)
			var action:=_button(row.key,row.buttonLabel,root)
			replacements.append({"root":root,"frame":border,"portrait":image,"text":text,"tags":tags,"status":status,"button":action})
	for action in model.actions:
		var button:=_button(action.key,action.label,panel);button.disabled=action.disabled
	show();_layout();_layout.call_deferred()
func _rect(node: Control,x: float,y: float,w: float,h: float) -> void:
	node.position=Vector2(x,y);node.size=Vector2(maxf(1,w),maxf(1,h))
func _box(node: Control,x: float,y: float,w: float,h: float) -> void:
	_rect(node,panel.size.x*x,panel.size.y*y,panel.size.x*w,panel.size.y*h)
func _layout() -> void:
	if model.is_empty():return
	var w:=minf(size.x*.98,size.y*.98*1672.0/941.0)
	panel.size=Vector2(w,w*941.0/1672.0);panel.position=(size-panel.size)/2
	heading.add_theme_font_size_override("font_size",clampi(int(w*.018),10,20))
	nameplate.add_theme_font_size_override("font_size",clampi(int(w*.017),8,14))
	grade.add_theme_font_size_override("font_size",clampi(int(w*.022),10,18))
	_box(frame,0,0,1,1);_box(portrait,.1364,.1435,.1435,.4091)
	_box(heading,.3115,.0705,.3815,.1025);_box(nameplate,.1285,.5805,.1585,.0525)
	_box(grade,.1305,.1235,.04,.05)
	for i in range(6):
		stats[i].add_theme_font_size_override("font_size",clampi(int(w*.015),8,12))
		_box(stats[i],.0945+(i%2)*.1192,.6615+floori(i/2.0)*.062,.1053,.054)
	_box(scroll,.358,.281,.5125,.532)
	for row in replacements:
		var rw:=maxf(1,scroll.size.x-14);var rh:=rw*5.0/8.0
		row.root.custom_minimum_size.y=rh;_rect(row.frame,0,0,rw,rh)
		_rect(row.portrait,rw*.1435,rh*.168,rw*.282,rh*.461)
		_rect(row.text,rw*.47,rh*.085,rw*.407,rh*.134)
		_rect(row.tags,rw*.444,rh*.252,rw*.432,rh*.106)
		_rect(row.status,rw*.452,rh*.38,rw*.415,rh*.232)
		row.button.add_theme_font_size_override("font_size",11)
		_rect(row.button,rw*.144,rh*.6625,rw*.726,maxf(32,rh*.225))
	for i in range(model.actions.size()):
		var index:=1 if model.actions.size()==1 else i
		var button: Button=buttons[model.actions[i].key];button.add_theme_font_size_override("font_size",clampi(int(w*.022),12,18))
		_box(button,.2315+index*.29,.8675,.247,.085)
		button.size.y=maxf(32,button.size.y)
func button_rect(key: String) -> String:
	var button: Button=buttons.get(key)
	if button==null or button.disabled or not button.is_visible_in_tree():return "null"
	var rect:=button.get_global_rect()
	if scroll.is_ancestor_of(button):rect=rect.intersection(scroll.get_global_rect())
	return JSON.stringify([rect.position.x,rect.position.y,rect.size.x,rect.size.y])
func reveal(key: String) -> bool:
	var button: Button=buttons.get(key)
	if button==null:return false
	if scroll.is_ancestor_of(button):scroll.ensure_control_visible(button)
	return true
func layout_json() -> String:
	var contained:=Rect2(Vector2.ZERO,size).encloses(panel.get_rect())
	for node in [frame,portrait,heading,nameplate,grade,scroll]+stats:
		contained=contained and Rect2(Vector2.ZERO,panel.size).encloses(node.get_rect())
	var clear:=true
	for button in buttons.values():
		if button.get_parent()==panel:clear=clear and not button.get_global_rect().intersects(scroll.get_global_rect())
	var text_rows: Array=[]
	for child in content.get_children():
		if child is Label:text_rows.append({"text":child.text,"size":[child.size.x,child.size.y],"lines":child.get_line_count(),"lineHeight":child.get_line_height(),"visible":child.is_visible_in_tree()})
	return JSON.stringify({"rowsContained":contained,"footerClear":clear,"originalFrame":frame.texture!=null,"rows":replacements.size(),"copy":text_rows,"scroll":[scroll.size.x,scroll.size.y],"content":[content.size.x,content.size.y]})
