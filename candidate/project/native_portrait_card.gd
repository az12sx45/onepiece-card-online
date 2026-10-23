extends TextureRect
## Native equivalents of the original combat-card / card-inner / portrait-wrap
## border layers. Source images keep their intrinsic height and top anchoring
## inside the square wrapper; a centered cover crop would cut off taller faces.
var enemy := false
var cache: Node
var demon: Control
var rings: Array[StyleBoxFlat] = []
var frame:=Control.new()
var shadow:=Control.new()
var shadow_style:=StyleBoxFlat.new()
const AttackMotion=preload("res://native_attack_motion.gd")
var attack_tick: int=-1
var attack_origin:=Vector2.ZERO
var attack_base_scale:=Vector2.ONE
var attack_base_rotation:=0.0
var attack_base_pivot:=Vector2.ZERO
var attack_starts:=0
var attack_samples:=0
var attack_duration:=.9
var hit_tick: int=-1
var hit_duration:=.7
var hit_starts:=0
var idle_enabled:=false
var idle_started:=0
var resting_origin:=Vector2.ZERO
const IdleEase=preload("res://native_evolution_motion.gd")
static var idle_source: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://idle-motion.json"))

func _ready() -> void:
	set_process(false)
	expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	stretch_mode = TextureRect.STRETCH_SCALE
	var clip := ShaderMaterial.new()
	clip.shader = preload("res://portrait_round_clip.gdshader")
	material = clip
	material.set_shader_parameter("intrinsic_top_crop",true)
	material.set_shader_parameter("portrait_shift",Vector2(0,0 if enemy else -.02))
	frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(frame)
	frame.draw.connect(_draw_frame)
	for settings in [["d6ad6d",2,16],["5c2425" if enemy else "294c60",5,14],["e2bc79",1,10],["1c080b" if enemy else "081322",2,8]]:
		var ring := StyleBoxFlat.new()
		ring.bg_color = Color.TRANSPARENT
		ring.border_color = Color(settings[0])
		ring.set_border_width_all(settings[1])
		ring.set_corner_radius_all(settings[2])
		ring.anti_aliasing = true
		rings.append(ring)
	# StyleBox shadows also fill the interior. Draw behind the portrait, never
	# with the foreground border, or every source portrait is darkened.
	shadow.mouse_filter=Control.MOUSE_FILTER_IGNORE
	shadow.show_behind_parent=true
	add_child(shadow)
	shadow_style.bg_color=Color.TRANSPARENT
	shadow_style.set_corner_radius_all(16)
	shadow_style.shadow_color=Color(0,0,0,.38)
	shadow_style.shadow_size=42;shadow_style.shadow_offset=Vector2(0,18)
	shadow.draw.connect(func():shadow.draw_style_box(shadow_style,Rect2(Vector2.ZERO,size)))
	resized.connect(_geometry)
	visibility_changed.connect(func():set_process(is_visible_in_tree() and (idle_enabled or attack_tick>=0 or hit_tick>=0)))
	_geometry()
	if enemy:
		demon=preload("res://native_demon_frame.gd").new();demon.cache=cache;demon.portrait=self
		add_child(demon);move_child(demon,0)

func set_layout_rect(origin: Vector2,extent: Vector2) -> void:
	size=extent
	resting_origin=origin
	if hit_tick>=0:
		_process(0)
	elif attack_tick>=0:
		attack_origin=origin
		pivot_offset=size*.5
		_process(0)
	else:
		position=origin
		if idle_enabled:sample_idle_motion(float(Time.get_ticks_msec()-idle_started)/1000)

static func idle_offset(seconds: float,duration: float,height: float) -> float:
	var phase:=fposmod(seconds,duration)/duration
	var progress:=phase*2 if phase<=.5 else (phase-.5)*2
	var eased:=IdleEase._ease(progress,[.42,0.0,.58,1.0])
	return lerpf(0,-height,eased) if phase<=.5 else lerpf(-height,0,eased)

func set_idle_pose(enabled: bool) -> void:
	if idle_enabled==enabled:return
	idle_enabled=enabled
	if enabled:
		idle_started=Time.get_ticks_msec()
		sample_idle_motion(0)
	else:
		if attack_tick<0:position=resting_origin
		material.set_shader_parameter("idle_translation_y",0.0)
	set_process(is_visible_in_tree() and (idle_enabled or attack_tick>=0 or hit_tick>=0))

func sample_idle_motion(seconds: float) -> void:
	var card: Dictionary=idle_source.catalog.cardFloat;var portrait: Dictionary=idle_source.catalog.portraitIdle
	position=resting_origin+Vector2(0,idle_offset(seconds+(float(idle_source.enemyDelay) if enemy else 0.0),card.duration,card.height))
	material.set_shader_parameter("idle_translation_y",idle_offset(seconds,portrait.duration,portrait.height))

func play_attack_motion(duration_ms: float=900) -> void:
	stop_hit_motion()
	stop_attack_motion()
	attack_duration=maxf(.001,duration_ms/1000.0)
	attack_origin=position;attack_base_scale=scale;attack_base_rotation=rotation;attack_base_pivot=pivot_offset
	pivot_offset=size*.5
	attack_tick=Time.get_ticks_msec();attack_starts+=1
	material.set_shader_parameter("attack_motion_active",true)
	set_process(true);_process(0)

func _process(_delta: float) -> void:
	if hit_tick>=0:
		var hit_elapsed:=float(Time.get_ticks_msec()-hit_tick)/1000.0
		if hit_elapsed>=hit_duration:stop_hit_motion();return
		sample_hit_motion(hit_elapsed*.7/hit_duration);return
	if attack_tick<0:
		if idle_enabled:sample_idle_motion(float(Time.get_ticks_msec()-idle_started)/1000)
		return
	var elapsed:=float(Time.get_ticks_msec()-attack_tick)/1000.0
	if elapsed>=attack_duration:stop_attack_motion();return
	sample_attack_motion(elapsed*.9/attack_duration)

func sample_attack_motion(elapsed: float) -> void:
	var card:=AttackMotion.sample("enemyCardAttackShake" if enemy else "cardAttackShake",elapsed)
	position=attack_origin+card.translation
	rotation=attack_base_rotation+card.angle
	scale=attack_base_scale*card.scale
	var image:=AttackMotion.sample("enemyPortraitAttack" if enemy else "portraitAttack",elapsed)
	# The existing portrait crop is the resting placement. CSS starts at ±5%;
	# apply its motion relative to that same resting transform, without a jump.
	material.set_shader_parameter("attack_translation",(image.translation-Vector2(-5 if enemy else 5,0))*.01)
	material.set_shader_parameter("attack_angle",image.angle)
	material.set_shader_parameter("attack_scale",image.scale)
	attack_samples+=1

func stop_attack_motion() -> void:
	if attack_tick<0:return
	position=attack_origin;rotation=attack_base_rotation;scale=attack_base_scale;pivot_offset=attack_base_pivot
	attack_tick=-1;set_process(idle_enabled and is_visible_in_tree())
	if material:material.set_shader_parameter("attack_motion_active",false)

func play_hit_motion(duration_ms: float=700) -> void:
	stop_attack_motion();stop_hit_motion();hit_duration=maxf(.001,duration_ms/1000.0)
	hit_tick=Time.get_ticks_msec();hit_starts+=1;set_process(true);sample_hit_motion(0)
func sample_hit_motion(seconds: float) -> void:
	var shake: float=AttackMotion.sample("cardHitShake",seconds).translation.x
	var distance: float=AttackMotion.sample("battleHitKnockback",seconds).translation.x*minf(192,size.x*.45)*(1 if enemy else -1)
	position=resting_origin+Vector2(shake+distance,0)
	material.set_shader_parameter("hit_translation_x",AttackMotion.sample("portraitHit",seconds).translation.x)
func stop_hit_motion() -> void:
	if hit_tick<0:return
	hit_tick=-1;position=resting_origin
	if material:material.set_shader_parameter("hit_translation_x",0.0)
	set_process((idle_enabled or attack_tick>=0) and is_visible_in_tree())
func _exit_tree() -> void:stop_attack_motion();stop_hit_motion()

func sync_demon(value: Dictionary,pose: String) -> void:
	if demon==null:return
	demon.sync(value,pose)
	var color:=Color(1,56.0/255,112.0/255,.52) if value.get("active",false) else Color("e2bc79")
	if rings[2].border_color!=color:rings[2].border_color=color;frame.queue_redraw()

func set_asset_texture(value: Texture2D) -> void:
	texture=value
	if demon!=null:demon.texture_changed()

func test_demon_state_json() -> String:
	return JSON.stringify(demon.debug_state() if demon!=null else {})

func _geometry() -> void:
	if material: material.set_shader_parameter("card_size",size)
	frame.size=size
	frame.queue_redraw()
	shadow.size=size;shadow.queue_redraw()

func _draw_frame() -> void:
	var insets := [0.0,2.0,7.0,8.0]
	for i in range(rings.size()):
		var inset: float = insets[i]
		frame.draw_style_box(rings[i],Rect2(Vector2.ONE*inset,size-Vector2.ONE*inset*2))
