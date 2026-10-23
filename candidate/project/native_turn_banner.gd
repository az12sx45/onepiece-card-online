extends Control
## Original turn card proportions and source-generated title/subtitle/avatar.
var view: Control
var card:=TextureRect.new()
var avatar:=TextureRect.new()
var kicker: Label
var heading: Label
var subtitle: Label
var token:=0
var remote_event_id:=""
var fade: Tween

func _ready() -> void:
	theme=view.theme
	mouse_filter=Control.MOUSE_FILTER_STOP
	card.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	card.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	card.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(card)
	view._image(card,"images/board/map_hud_ui/map_turn_status_frame_v1.webp")
	avatar.expand_mode=TextureRect.EXPAND_IGNORE_SIZE
	avatar.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED
	avatar.mouse_filter=Control.MOUSE_FILTER_IGNORE
	var material:=ShaderMaterial.new()
	material.shader=preload("res://portrait_round_clip.gdshader")
	avatar.material=material
	card.add_child(avatar)
	kicker=view._label(card,13)
	heading=view._label(card,40)
	subtitle=view._label(card,15)
	heading.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	subtitle.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	view.resized.connect(_layout)
	_layout()
	hide()

func _layout() -> void:
	size=view.size
	var width:=minf(820,size.x-28)
	card.size=Vector2(width,width*583/1822)
	card.position=(size-card.size)/2
	avatar.position=card.size*Vector2(0.084,0.213)
	avatar.size=Vector2.ONE*width*0.209
	avatar.material.set_shader_parameter("card_size",avatar.size)
	avatar.material.set_shader_parameter("corner_radius",avatar.size.x/2)
	var x:=width*0.342
	var y:=card.size.y*0.22
	var text_width:=width*0.568
	kicker.position=Vector2(x,y)
	kicker.size=Vector2(text_width,20)
	heading.position=Vector2(x,y+24)
	heading.size=Vector2(text_width,64)
	heading.add_theme_font_size_override("font_size",int(clampf(size.x*0.05,30,56)))
	subtitle.position=Vector2(x,y+92)
	subtitle.size=Vector2(text_width,maxf(24,card.size.y*0.64-92))

func play(event: Dictionary) -> void:
	if fade:fade.kill()
	token += 1
	var current:=token
	remote_event_id=str(event.get("id","")) if event.get("__remote",false) else ""
	kicker.text="BATTLE TURN" if event.get("context","") == "battle" else "NEXT TURN"
	heading.text=str(event.get("title",""))
	subtitle.text=str(event.get("subtitle",""))
	view._image(avatar,str(event.get("avatarUrl","")))
	_layout()
	show()
	modulate.a=0
	fade=create_tween()
	fade.tween_property(self,"modulate:a",1.0,0.22)
	await get_tree().create_timer(maxf(0.9,float(event.get("duration",3700))/1000.0)).timeout
	if current == token: hide();remote_event_id=""

func cancel_remote(target: String="") -> void:
	if not target.is_empty() and target!=remote_event_id:return
	token+=1
	if fade:fade.kill()
	remote_event_id="";hide()
