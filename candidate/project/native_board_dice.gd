extends Control
## Original board dice frame/face artwork. Result is supplied by source JS;
## this independent RNG changes only the rolling-face presentation.
signal finished(id: String, result: int, error: String)
var cache: Node
var frame:=TextureRect.new()
var face:=TextureRect.new()
var title:=Label.new()
var subtitle:=Label.new()
var digit:=Label.new()
var model: Dictionary={}
var current_id := ""
var epoch := 0
var textures: Dictionary={}
var visual_rng:=RandomNumberGenerator.new()
var rolling := false
var elapsed := 0.0
var next_face := 0.0
var settled_time := 0.0

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	visual_rng.randomize()
	var weighted:=preload("res://native_fonts.gd").weighted(850.0)
	for image in [frame,face]:
		image.mouse_filter=Control.MOUSE_FILTER_IGNORE
		image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
		image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		add_child(image)
	for label in [title,subtitle,digit]:
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE
		label.add_theme_font_override("font",weighted)
		label.add_theme_color_override("font_color",Color("fff1c7"))
		label.add_theme_color_override("font_outline_color",Color("4c270b"))
		label.add_theme_constant_override("outline_size",2)
		label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		label.max_lines_visible=2
		label.clip_text=true
		add_child(label)
	subtitle.add_theme_color_override("font_color",Color("d8f7ff"))
	cache.asset_ready.connect(_asset_ready)
	resized.connect(_layout)
	hide();set_process(false)

func _draw() -> void:draw_rect(Rect2(Vector2.ZERO,size),Color(0,0,0,0.36))

func _layout() -> void:
	title.add_theme_font_size_override("font_size",int(clampf(size.y*0.031,14,20)) if size.y<=520 else int(clampf(size.x*0.0225,17,30)))
	subtitle.add_theme_font_size_override("font_size",int(clampf(size.y*0.024,10,14)) if size.y<=520 else int(clampf(size.x*0.0155,12,19)))
	var width:=minf(1040,minf(size.x*0.96,(size.y-16)*1672.0/941.0))
	frame.size=Vector2(width,width*941.0/1672.0)
	frame.position=(size-frame.size)/2.0
	title.position=frame.position+frame.size*Vector2(0.28,0.055)
	title.size=frame.size*Vector2(0.44,0.115)
	subtitle.position=frame.position+frame.size*Vector2(0.24,0.834)
	subtitle.size=frame.size*Vector2(0.52,0.11)
	face.size=Vector2.ONE*width*0.31
	face.position=(size-face.size)/2.0
	face.pivot_offset=face.size/2.0
	digit.size=face.size*0.72
	digit.position=(size-digit.size)/2.0
	digit.add_theme_font_size_override("font_size",int(clampf(size.x*0.054,30,74)))
	digit.pivot_offset=digit.size/2.0
	queue_redraw()

func start(id: String, value: Dictionary) -> void:
	cancel()
	epoch+=1;current_id=id;model=value
	textures.clear()
	for path in [str(model.frame)]+model.faces:
		var texture: Texture2D=cache.request(path)
		if texture!=null:textures[path]=texture
	_begin_when_ready(epoch)

func _begin_when_ready(token: int) -> void:
	var paths: Array=[str(model.frame)]+model.faces
	var deadline:=Time.get_ticks_msec()+15000
	while token==epoch:
		var ready:=true
		for path in paths:
			if cache.failed.has(path):_finish("Native board dice image failed: "+str(path));return
			if not textures.has(path):ready=false
		if ready:break
		if Time.get_ticks_msec()>deadline:_finish("Native board dice loading timed out");return
		await get_tree().process_frame
	if token!=epoch:return
	frame.texture=textures[model.frame]
	title.text=model.title;subtitle.text=model.subtitle
	elapsed=0;next_face=85;settled_time=0;rolling=true
	face.hide();digit.text="?";digit.show()
	face.scale=Vector2.ONE;digit.scale=Vector2.ONE
	_layout();show();set_process(true)
	# Text shaping invalidates the wrapped minimum height after its width changes.
	# Reapply bounds once deferred so the initial narrow-width height cannot linger.
	call_deferred("_layout")
	await get_tree().create_timer(float(model.settleDelay)/1000.0).timeout
	if token!=epoch:return
	rolling=false;settled_time=elapsed
	_face(int(model.settle))
	await get_tree().create_timer(float(model.resultHoldMs)/1000.0).timeout
	if token==epoch:_finish("")

func _asset_ready(path: String, texture: Texture2D) -> void:
	if model.get("frame","")==path or model.get("faces",[]).has(path):textures[path]=texture

func _face(value: int) -> void:
	if not model.faces.is_empty():
		face.texture=textures[model.faces[value-1]];face.show();digit.hide()
	else:
		digit.text=str(model.labels[value-1]);digit.show();face.hide()

func _process(delta: float) -> void:
	elapsed+=delta*1000
	if rolling:
		if elapsed>=next_face:
			next_face=elapsed+85
			_face(visual_rng.randi_range(1,int(model.maxFace)))
		var pulse:=sin(elapsed/220.0*PI)
		face.rotation=deg_to_rad(pulse*8);digit.rotation=face.rotation
	else:
		face.rotation=0;digit.rotation=0
		var progress:=clampf((elapsed-settled_time)/360.0,0,1)
		var scale_value:=1.0+0.12*sin(progress*PI)*(1-progress)
		face.scale=Vector2.ONE*scale_value;digit.scale=face.scale

func cancel(remote_id: String="") -> void:
	if not remote_id.is_empty() and str(model.get("remoteEventId",""))!=remote_id:return
	if current_id.is_empty():hide();set_process(false);return
	_finish("")

func _finish(error: String) -> void:
	var id:=current_id
	var result:=int(model.get("settle",0))
	current_id="";epoch+=1;rolling=false
	hide();set_process(false)
	if not id.is_empty():finished.emit(id,result,error)
