extends Control
signal animation_finished(epoch: int)
## Display only. The original source supplies every result; this RNG is isolated
## from gameplay and is used solely for the rolling face animation.
var cache: Node
var title: Label
var subtitle: Label
var orbs: Array[Control] = []
var digits: Array[Label] = []
var visual_rng := RandomNumberGenerator.new()
var epoch := 0
var image_targets: Array[Control] = []
var extra_roll:=false
const Motion=preload("res://native_attack_motion.gd")
var motion_started:=0
var motion_name:=""
var face_origins: Array[Vector2]=[]

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(false)
	visual_rng.randomize()
	cache.asset_ready.connect(func(path,texture):
		for target in image_targets:
			if target.get_meta("wanted_asset","") == path: target.set("texture",texture)
	)
	title = _label(22,Vector2(12,6),Vector2(576,32))
	subtitle = _label(16,Vector2(12,168),Vector2(576,29))
	for i in range(3):
		var orb := TextureRect.new()
		orb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		orb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		orb.mouse_filter = Control.MOUSE_FILTER_IGNORE
		orb.size = Vector2(126,126)
		add_child(orb)
		orbs.append(orb)
		var path: String = "images/board/battle_dice_ui/"+(["battle_dice_blank.webp","battle_extra_dice_blank.webp","battle_eclipse_third_dice.webp"][i])
		_bind_texture(orb,path)
		var digit := _label(56,Vector2.ZERO,Vector2(126,126))
		digit.add_theme_font_override("font",preload("res://native_fonts.gd").battle_dice())
		digit.add_theme_color_override("font_color",Color("080604"))
		digit.add_theme_color_override("font_outline_color",Color("f0cf86"))
		digit.add_theme_constant_override("outline_size",1)
		digit.add_theme_color_override("font_shadow_color",Color(0,0,0,.92))
		digit.add_theme_constant_override("shadow_offset_y",2)
		digit.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		digits.append(digit)
		face_origins.append(Vector2.ZERO)
	hide()

func _label(font_size: int, at: Vector2, bounds: Vector2) -> Label:
	var label := Label.new()
	label.position = at
	label.size = bounds
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	label.add_theme_font_size_override("font_size",font_size)
	label.add_theme_color_override("font_color",Color("ffe8bc"))
	label.add_theme_color_override("font_outline_color",Color("07121d"))
	label.add_theme_constant_override("outline_size",5)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(label)
	return label

func _bind_texture(target: Control, path: String) -> void:
	if target.get_meta("wanted_asset","") == path: return
	target.set_meta("wanted_asset",path)
	if not image_targets.has(target): image_targets.append(target)
	var texture: Texture2D = cache.request(path)
	if texture: target.set("texture",texture)

func _faces(values: Array, third_only: bool = false) -> void:
	for i in range(3):
		orbs[i].visible = i < values.size()
		digits[i].visible = i < values.size()
		if i >= values.size(): continue
		orbs[i].position = Vector2(300-values.size()*67+i*134,36)
		face_origins[i]=orbs[i].position
		digits[i].position = orbs[i].position
		digits[i].text = str(int(values[i])) if values[i] is float or values[i] is int else str(values[i])
		if i == 0: _bind_texture(orbs[i],"images/board/battle_dice_ui/"+("battle_eclipse_third_dice.webp" if third_only else ("battle_extra_dice_blank.webp" if extra_roll and values.size()==1 else "battle_dice_blank.webp")))
	_sample_motion(0.0 if motion_name.is_empty() else float(Time.get_ticks_msec()-motion_started)/1000.0)

func _start_motion(value: String) -> void:
	motion_name=value;motion_started=Time.get_ticks_msec();set_process(not value.is_empty());_sample_motion(0)
func _process(_delta: float) -> void:
	_sample_motion(float(Time.get_ticks_msec()-motion_started)/1000.0)
func _sample_motion(seconds: float) -> void:
	var sample: Dictionary={"translation":Vector2.ZERO,"angle":0.0,"scale":1.0}
	if not motion_name.is_empty():sample=Motion.sample(motion_name,fposmod(seconds,.095) if motion_name=="diceRollShake" else seconds)
	for i in range(orbs.size()):
		for node in [orbs[i],digits[i]]:
			node.pivot_offset=node.size*.5;node.position=face_origins[i]+sample.translation;node.rotation=sample.angle;node.scale=Vector2.ONE*sample.scale

func _position_overlay(has_dice: bool) -> void:
	var parent:=get_parent_control()
	var compact:=parent.size.y<=432 or parent.size.x<=1000
	var top:=62.0 if compact else 112.0
	var bottom:=parent.size.y-(83 if compact else 104)
	var height:=197.0 if has_dice else 76.0
	position=Vector2((parent.size.x-600)*.5,maxf(top,(top+bottom-height)*.5))
	subtitle.position.y=168 if has_dice else 39

func play(packet: Dictionary) -> void:
	epoch += 1
	var token := epoch
	var event: Dictionary = packet.event
	extra_roll=bool(event.get("isExtraDice",false))
	_position_overlay(true)
	show()
	title.text = packet.rollingTitle
	subtitle.text = packet.rollingSubtitle
	_start_motion("diceRollShake")
	var resolved: bool = event.get("type") == "bonus" and event.get("firstDie",0) > 0 and event.get("secondDie",0) > 0
	var duration: float = 90 if resolved else maxf(1200,float(event.get("duration",1450)))
	var hold: float = maxf(720,float(event.get("duration",1800))-duration) if resolved else 520
	var deadline := Time.get_ticks_msec()+int(duration)
	while Time.get_ticks_msec() < deadline and token == epoch:
		_faces([visual_rng.randi_range(1,maxi(1,int(event.get("maxFace",6))))],event.get("extraDiceOrdinal",0) == 3)
		await get_tree().create_timer(0.09).timeout
	if token != epoch: return
	var values: Array = [event.get("settle","?")]
	if event.get("extraDiceOrdinal",0) != 3 and event.get("firstDie",0) > 0 and event.get("secondDie",0) > 0:
		values = [event.firstDie,event.secondDie]
		if event.get("thirdDie",0) > 0: values.append(event.thirdDie)
	_faces(values,event.get("extraDiceOrdinal",0) == 3)
	_start_motion("diceResultPop")
	title.text = packet.settledTitle
	subtitle.text = packet.settledSubtitle
	await get_tree().create_timer(hold/1000.0).timeout
	if token == epoch:
		_start_motion("")
		hide()
		animation_finished.emit(token)

func message(heading: String, detail: String, duration: float) -> void:
	epoch += 1
	var token := epoch
	_start_motion("")
	_position_overlay(false)
	_faces([])
	title.text = heading
	subtitle.text = detail
	show()
	await get_tree().create_timer(maxf(0.001,duration/1000)).timeout
	if token == epoch: hide()
