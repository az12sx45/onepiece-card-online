extends Node2D
## Native GPU playback of original BoardMoveFx.resolve profiles. No gameplay or
## portrait/background node is modified. Sprites are pooled across attacks.
var cache: Node
var stage_size := Vector2(1280,600)
var attack_scale := 1.0
var impact_hold_ms := 0.0
var active: Array[Dictionary] = []
var pool: Array[Sprite2D] = []
var started_count := 0

func warm(profiles: Array) -> void:
	for profile in profiles:
		if profile is Dictionary and not str(profile.get("sheet", "")).is_empty():
			cache.request(str(profile.sheet))

func play(profile: Dictionary, event: Dictionary, source: Vector2, target: Vector2, options: Dictionary = {}) -> bool:
	if profile.is_empty() or event.get("miss",false) or event.get("specialFx","") == "lucci-rokuogan": return false
	var phase: String = options.get("phase","impact")
	if phase == "launch" and profile.animation not in ["projectile","sweep"]: return false
	var texture: Texture2D = cache.request(str(profile.sheet))
	# Never replay a cold effect late. The caller warms it before dice/launch.
	if texture == null: return false
	var actor_side: String = options.get("actorSide",event.get("side","player"))
	var frame_start: int = 0 if phase == "launch" or profile.animation == "aura" else clampi(int(options.get("frameStart",profile.impactStart)),0,int(profile.frames)-1)
	var frame_count: int = int(profile.launchFrames) if phase == "launch" else int(profile.frames)-frame_start
	var attack: bool = event.get("type","") == "attack" or (event.get("type","") not in ["heal","status"] and profile.get("damageClass","") != "status")
	var duration: float = clampf(float(options.get("durationMs",340 if phase == "launch" else profile.durationMs)) + (clampf(float(options.get("impactHoldMs",impact_hold_ms)),0,500) if attack and phase == "impact" else 0),80,5000)
	var sprite: Sprite2D
	if pool.is_empty():
		sprite = Sprite2D.new()
		sprite.centered = false
		add_child(sprite)
	else: sprite = pool.pop_back()
	sprite.texture = texture
	sprite.hframes = int(profile.columns)
	sprite.vframes = int(profile.rows)
	sprite.visible = true
	active.append({"sprite":sprite,"profile":profile,"elapsed":0.0,"duration":duration,"phase":phase,"actorSide":actor_side,"source":source,"target":target,"frameStart":frame_start,"frameCount":frame_count,"presentationScale":attack_scale if attack else 1.0})
	if active.size() > 24: _release(active.pop_front())
	started_count += 1
	set_process(true)
	_update_entry(active.back())
	return true

func _ready() -> void:
	set_process(false)

func _process(delta: float) -> void:
	for i in range(active.size()-1,-1,-1):
		active[i].elapsed += delta*1000.0
		if active[i].elapsed >= active[i].duration:
			_release(active[i])
			active.remove_at(i)
		else: _update_entry(active[i])
	if active.is_empty(): set_process(false)

func _update_entry(entry: Dictionary) -> void:
	var profile: Dictionary = entry.profile
	var sprite: Sprite2D = entry.sprite
	var progress: float = clampf(entry.elapsed/entry.duration,0,1)
	var launching: bool = entry.phase == "launch"
	var travel: float = 1.0-pow(1.0-progress,2) if launching else 1.0
	var tile_size := sprite.texture.get_size()/Vector2(profile.columns,profile.rows)
	var frame: int = int(entry.frameStart)+mini(int(entry.frameCount)-1,int(floor(progress*entry.frameCount)))
	if sprite.frame != frame: sprite.frame = frame
	var width: float = minf(float(profile.width),stage_size.x*0.48)*float(profile.scale)*float(entry.presentationScale)
	var fade_in: float = clampf(progress/0.08,0,1) if launching else 1.0
	var fade_out: float = clampf((1-progress)/(0.14 if launching else 0.26),0,1)
	var pulse: float = 1.0 if profile.animation == "none" else (0.9+0.14*sin(progress*PI) if profile.animation == "aura" else (0.78+progress*0.22 if launching else 1.0))
	var flip: float = -1.0 if profile.get("flip",true) != false and entry.actorSide == "enemy" else 1.0
	sprite.position = Vector2(entry.source).lerp(entry.target,travel)
	sprite.rotation = (-1.0 if entry.actorSide == "enemy" else 1.0)*(-0.18+progress*0.3) if profile.animation == "sweep" else 0.0
	sprite.scale = Vector2(flip*pulse,pulse)*(width/tile_size.x)
	sprite.offset = -tile_size*Vector2(profile.anchor[0],profile.anchor[1])
	sprite.modulate.a = fade_in*fade_out

func _release(entry: Dictionary) -> void:
	entry.sprite.visible = false
	entry.sprite.texture = null
	pool.append(entry.sprite)

func clear() -> void:
	for entry in active: _release(entry)
	active.clear()
	set_process(false)
