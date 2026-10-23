extends Control
## Original six-frame scene; incoming intro data owns artwork, text and duration.
const Motion=preload("res://native_enma_motion.gd")
var intro: Control
var background:=ColorRect.new()
var shade:=ColorRect.new()
var flash:=ColorRect.new()
var slots: Array[Dictionary]=[]
var dots: Array[TextureRect]=[]
var dot_images: Array[Texture2D]=[]
var frames: Array=[]
var textures: Dictionary={}
var index:=-1
var state:=""
var started:=0
var frame_started:=0
var closing:=-1
var frozen_ms:=-1
var history: Array=[]
var texture_writes:=0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;clip_contents=true
	background.color=Color("030107");background.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(background)
	for i in range(2):
		var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(image)
		image.material=ShaderMaterial.new();image.material.shader=preload("res://native_enma_frame.gdshader")
		slots.append({"image":image,"active":false,"changed":0,"filters":Motion.data.initial.duplicate(true),"fromFilters":Motion.data.initial.duplicate(true),"motion":"","opacity":0.0,"fromOpacity":0.0})
	for overlay in [shade,flash]:
		overlay.mouse_filter=Control.MOUSE_FILTER_IGNORE;overlay.material=ShaderMaterial.new();overlay.material.shader=preload("res://native_enma_overlay.gdshader");overlay.z_index=2 if overlay==shade else 3;add_child(overlay)
	flash.material.set_shader_parameter("flash",true)
	for path in ["res://enma-progress-idle.png","res://enma-progress-active.png"]:dot_images.append(ImageTexture.create_from_image(Image.load_from_file(path)))
	resized.connect(_layout);hide();set_process(false)
func _now() -> int:return frozen_ms if frozen_ms>=0 else Time.get_ticks_msec()
func prepare(source: Array) -> void:
	frames=source.duplicate(true);textures.clear();index=-1;state="";history=[];closing=-1
	while dots.size()<frames.size():
		var dot:=TextureRect.new();dot.mouse_filter=Control.MOUSE_FILTER_IGNORE;dot.z_index=6;add_child(dot);dots.append(dot)
	for i in range(dots.size()):dots[i].visible=i<frames.size();dots[i].texture=dot_images[0]
	for slot in slots:slot.image.texture=null;slot.image.modulate.a=0;slot.active=false;slot.opacity=0.0;slot.motion="";slot.filters=Motion.data.initial.duplicate(true);slot.fromFilters=slot.filters.duplicate(true)
	ready_assets();_layout()
func ready_assets() -> bool:
	var ready:=true
	for frame in frames:
		var path:=str(frame.src)
		if textures.has(path):continue
		var image: Texture2D=intro.view.cache.request(path)
		if image==null:ready=false
		else:textures[path]=image
	return ready
func failed_asset() -> String:
	for frame in frames:
		if intro.view.cache.failed.has(str(frame.src)):return str(frame.src)
	return ""
func start() -> void:
	started=_now();closing=-1;show();set_process(true);_tick()
func stop() -> void:
	hide();set_process(false);textures.clear();frames=[];index=-1;state="";closing=-1
	for slot in slots:slot.image.texture=null
func show_frame(next: int) -> void:
	_tick();index=next;frame_started=_now();state=str(frames[index].get("state","scene"))
	var selected: int=index%2
	for i in range(2):
		var slot: Dictionary=slots[i];slot.fromFilters=slot.filters.duplicate(true);slot.fromOpacity=slot.opacity;slot.changed=_now();slot.active=i==selected;slot.motion=""
		if slot.active:
			slot.image.texture=textures[str(frames[index].src)];texture_writes+=1;slot.image.z_index=1
			if state in ["drain-start","drained"]:slot.motion="drain"
			elif state=="reclaim":slot.motion="reclaim"
		else:slot.image.z_index=0
	for i in range(frames.size()):dots[i].texture=dot_images[1 if i==index else 0]
	history.append({"time":_now()-started,"index":index,"state":state,"source":str(frames[index].src)})
	intro.show_cinematic_line(frames[index]);_tick()
func begin_close() -> void:closing=_now();_tick()
func _process(_delta: float) -> void:_tick()
func _tick() -> void:
	if not visible:return
	intro.modulate.a=1.0-Motion.Ease._ease(clampf(float(_now()-closing)/320,0,1),[.25,.1,.25,1]) if closing>=0 else Motion.Ease._ease(clampf(float(_now()-started)/160,0,1),[.25,.1,.25,1])
	for slot in slots:
		var seconds:=maxf(0,float(_now()-int(slot.changed))/1000)
		slot.opacity=lerpf(slot.fromOpacity,1.0 if slot.active else 0.0,Motion.Ease._ease(clampf(seconds/float(Motion.data.transition.opacity),0,1),Motion.data.transition.easing));slot.image.modulate.a=slot.opacity
		if slot.active and not str(slot.motion).is_empty():slot.filters=Motion.sample(slot.motion,seconds,size).filters
		else:slot.filters=Motion.Ease.filters(slot.fromFilters,Motion.data.active if slot.active else Motion.data.initial,Motion.Ease._ease(clampf(seconds/float(Motion.data.transition.filter),0,1),Motion.data.transition.easing))
		for filter in slot.filters:slot.image.material.set_shader_parameter("saturation" if filter.kind=="saturate" else filter.kind,filter.value)
	var age:=maxf(0,float(_now()-frame_started)/1000)
	flash.visible=index>=0 and state in ["drained","reclaim"]
	if flash.visible:flash.material.set_shader_parameter("reclaim",state=="reclaim");flash.modulate.a=Motion.sample("reclaimFlash" if state=="reclaim" else "flash",age,size).opacity
	if index>=0:
		var motion:=Motion.sample("dialogue",age,intro.quote.size);intro.quote.position=Vector2(size.x*.5,size.y*.72)+motion.transform.origin;intro.quote.modulate.a=motion.opacity
func _layout() -> void:
	background.size=size;shade.size=size;flash.size=size
	for overlay in [shade,flash]:overlay.material.set_shader_parameter("viewport_size",size)
	for slot in slots:slot.image.size=size
	var right:=clampf(size.x*.024,18,42);var bottom:=clampf(size.y*.024,15,24)
	for i in range(dots.size()):dots[i].size=Vector2(48,48);dots[i].position=Vector2(size.x-right-8-(frames.size()-1-i)*15-20,size.y-bottom-8-20)
func test_state() -> Dictionary:
	return {"index":index,"state":state,"history":history,"textureWrites":texture_writes,"slotIds":slots.map(func(slot):return slot.image.get_instance_id()),"dotIds":dots.map(func(dot):return dot.get_instance_id()),"sources":slots.map(func(slot):return "" if slot.image.texture==null else str(slot.image.texture.get_instance_id())),"opacities":slots.map(func(slot):return slot.opacity),"filters":slots.map(func(slot):return slot.filters),"alpha":intro.modulate.a}
