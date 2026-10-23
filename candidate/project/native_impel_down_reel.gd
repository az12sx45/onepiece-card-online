extends Control
## Paints the source-selected strip; never rolls a new result. Persistent node.
var data: Dictionary={}
var textures: Dictionary={}
var signature:=""
var started:=0
var offset:=0.0
var token_size:=Vector2.ZERO
var font: Font
var recruit_frame_width:=0.0
const PREFIX="images/board/impel_down_ui/"
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_IGNORE;font=preload("res://native_fonts.gd").weighted(550);resized.connect(func():_process(0));set_process(false)
func apply(value: Variant,key: String,assets: Dictionary) -> void:
	if value==null:reset();return
	data=value;textures=assets
	if signature!=key:signature=key;started=Time.get_ticks_msec()
	set_process(not data.settled);_process(0)
static func easing(p: float,x1: float,y1: float,x2: float,y2: float) -> float:
	var lo:=0.0;var hi:=1.0
	for i in range(24):
		var t:=(lo+hi)/2;var x:=3*(1-t)*(1-t)*t*x1+3*(1-t)*t*t*x2+t*t*t
		if x<p:lo=t
		else:hi=t
	var t:=(lo+hi)/2
	return 3*(1-t)*(1-t)*t*y1+3*(1-t)*t*t*y2+t*t*t
func _process(_delta: float) -> void:
	if data.is_empty():return
	var elapsed:=float(Time.get_ticks_msec()-started)
	if data.kind=="recruit":
		var viewport_width:=get_viewport_rect().size.x
		var factor:=recruit_frame_width/maxf(1,viewport_width*.96)
		var width:=clampf(viewport_width*.2,190,320)*factor
		token_size=Vector2(width,width/1.5)
		var gap:=clampf(viewport_width*.008,7,13)*factor
		var target: float=-int(data.target)*(token_size.x+gap)-token_size.x/2
		offset=target if data.settled else lerpf(token_size.x*1.4,target,easing(clampf(elapsed/5000,0,1),.07,.78,.15,1))
	else:
		token_size=Vector2(size.x,clampf(size.y*.38,40,62));var target: float=-int(data.target)*token_size.y-token_size.y/2
		if data.settled:offset=target
		else:
			var p:=clampf((elapsed-480)/1700,0,1)
			if p<.72:offset=lerpf(0,target-18,easing(p/.72,.14,.86,.16,1))
			elif p<.88:offset=lerpf(target-18,target+7,easing((p-.72)/.16,.14,.86,.16,1))
			else:offset=lerpf(target+7,target,easing((p-.88)/.12,.14,.86,.16,1))
	queue_redraw()
func _fit(texture: Texture2D,box: Rect2) -> void:
	if texture==null:return
	var factor:=minf(box.size.x/texture.get_width(),box.size.y/texture.get_height());var dimensions:=texture.get_size()*factor
	draw_texture_rect(texture,Rect2(box.position+(box.size-dimensions)/2,dimensions),false)
func _draw() -> void:
	if data.is_empty():return
	for i in range(data.tokens.size()):
		var token: Dictionary=data.tokens[i];var horizontal: bool=data.kind=="recruit"
		var gap:=clampf(get_viewport_rect().size.x*.008,7,13)*recruit_frame_width/maxf(1,get_viewport_rect().size.x*.96)
		var origin:=Vector2(size.x*.754+i*(token_size.x+gap)+offset,(size.y-token_size.y)/2) if horizontal else Vector2(0,size.y/2+i*token_size.y+offset)
		var box:=Rect2(origin,token_size)
		if not box.intersects(Rect2(Vector2.ZERO,size)):continue
		var frame: Texture2D=textures.get(PREFIX+("impel_down_prisoner_candidate_card_frame.webp" if horizontal else "impel_down_event_roulette_row_frame.webp"))
		_fit(frame,box)
		var portrait:=Rect2(origin+token_size*Vector2(.136,.142),token_size*Vector2(.268,.653)) if horizontal else Rect2(origin+Vector2(8,4),Vector2(token_size.x*.36,token_size.y-8))
		_fit(textures.get(token.image),portrait)
		if horizontal:
			var fs:=clampi(int(token_size.x*.055),8,12)
			draw_string(font,origin+token_size*Vector2(.45,.43),token.name,HORIZONTAL_ALIGNMENT_CENTER,token_size.x*.39,fs,Color("ecedf0"))
			draw_string(font,origin+token_size*Vector2(.45,.65),token.get("level",""),HORIZONTAL_ALIGNMENT_CENTER,token_size.x*.39,fs,Color("9fd2d2"))
		else:draw_string(font,origin+Vector2(token_size.x*.42,token_size.y*.55),token.name,HORIZONTAL_ALIGNMENT_LEFT,token_size.x*.55,13,Color("ffe4aa") if token.winner else Color("ecedf0"))
	if data.kind!="recruit":draw_colored_polygon(PackedVector2Array([Vector2(1,size.y/2-6),Vector2(1,size.y/2+6),Vector2(9,size.y/2)]),Color("ffe29b"))
func reset() -> void:data={};signature="";textures={};set_process(false);queue_redraw();hide()
