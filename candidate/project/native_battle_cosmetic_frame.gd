extends Node

const LayerShader = preload("res://native_battle_cosmetic_layer.gdshader")
const Motion = preload("res://native_evolution_motion.gd")
static var additive: Shader
static var multiply: Shader

var cache: Node
var portrait: Control
var base_frame: Control
var base_shadow: Control
var model: Dictionary = {}
var textures: Dictionary = {}
var pool: Array[TextureRect] = []
var active_layers: Array[Dictionary] = []
var pulse_started := 0

func _ready() -> void:
	set_process(false)
	portrait.resized.connect(_layout)
	cache.asset_ready.connect(_asset_ready)
	for path in ["images/board/battle/cosmetic_frames/", "images/board/battle/enemy_frames/", "images/board/battle/nika_frame/"]:
		if not path in cache.mipmap_prefixes:
			cache.mipmap_prefixes.append(path)

func sync(next: Dictionary) -> void:
	if next == model:
		return
	_clear_layers()
	model = next
	for layer in model.get("layers", []):
		textures[str(layer.asset)] = null
	for path in textures:
		var image: Texture2D = cache.request(path)
		if image != null:
			textures[path] = image
	_publish_when_ready()

func _asset_ready(path: String, texture: Texture2D) -> void:
	if not textures.has(path) or not active_layers.is_empty():
		return
	textures[path] = texture
	_publish_when_ready()

func _clear_layers() -> void:
	set_process(false)
	textures.clear()
	active_layers.clear()
	base_frame.show()
	base_shadow.show()
	for layer in pool:
		layer.hide()
		layer.texture = null

func _publish_when_ready() -> void:
	if textures.is_empty() or not active_layers.is_empty():
		return
	for texture in textures.values():
		# Cosmetic artwork never gates battle controls or removes the base frame early.
		if texture == null:
			return
	var animated := false
	for layer in model.layers:
		match str(layer.get("blend", "normal")):
			"screen":
				# Screen = destination * (1 - alpha * source) + alpha * source.
				# Two cheap canvas passes avoid framebuffer copies or another viewport.
				_add_layer(layer, "multiply", 1)
				_add_layer(layer, "add", 0)
			"multiply":
				_add_layer(layer, "multiply", 2)
			_:
				_add_layer(layer, "normal", 0)
		animated = animated or bool(layer.get("pulse", false))
	base_frame.visible = bool(model.get("showBaseFrame", true))
	base_shadow.visible = base_frame.visible
	_layout()
	if animated:
		pulse_started = Time.get_ticks_msec()
		_process(0.0)
		set_process(true)

func _add_layer(source: Dictionary, blend: String, multiply_kind: int) -> void:
	var index := active_layers.size()
	if index == pool.size():
		var new_layer := TextureRect.new()
		new_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		new_layer.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		new_layer.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		new_layer.material = ShaderMaterial.new()
		portrait.add_child(new_layer)
		pool.append(new_layer)
	var layer := pool[index]
	var material: ShaderMaterial = layer.material
	material.shader = _shader(blend)
	material.set_shader_parameter("strength", float(source.get("strength", 1)))
	material.set_shader_parameter("brightness", float(source.get("brightness", 1)))
	material.set_shader_parameter("multiply_kind", multiply_kind)
	layer.self_modulate.a = float(source.get("opacity", 1))
	layer.texture = textures[str(source.asset)]
	layer.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED if model.get("contain", false) else TextureRect.STRETCH_SCALE
	layer.flip_h = bool(source.get("flipX", false))
	layer.flip_v = bool(source.get("flipY", false))
	# Keep the desktop card's own stacking context. Negative global z would
	# send layers behind the battle backdrop instead of behind this portrait.
	layer.show_behind_parent = float(source.get("z", 1)) < 4
	layer.show()
	active_layers.append({"rect": layer, "source": source})

static func _shader(blend: String) -> Shader:
	if blend == "normal":
		return LayerShader
	if additive == null:
		additive = Shader.new()
		additive.code = LayerShader.code.replace("blend_mix", "blend_add")
		multiply = Shader.new()
		multiply.code = LayerShader.code.replace("blend_mix", "blend_mul")
	return additive if blend == "add" else multiply

func _layout() -> void:
	var extent := portrait.size
	for entry in active_layers:
		var layer: TextureRect = entry.rect
		var source: Dictionary = entry.source
		layer.size = extent * Vector2(float(source.get("w", 100)), float(source.get("h", 100))) * 0.01
		layer.position = extent * Vector2(float(source.get("x", 50)), float(source.get("y", 50))) * 0.01 - layer.size * 0.5
		layer.pivot_offset = layer.size * 0.5
		layer.rotation_degrees = float(source.get("rotate", 0))

func _process(_delta: float) -> void:
	if not portrait.is_visible_in_tree():
		return
	var time := fposmod(float(Time.get_ticks_msec() - pulse_started) / 1000.0, 5.6)
	var progress := (time if time <= 2.8 else 5.6 - time) / 2.8
	var phase := Motion._ease(progress, [0.42, 0.0, 0.58, 1.0])
	for entry in active_layers:
		if not entry.source.get("pulse", false):
			continue
		var layer: TextureRect = entry.rect
		layer.self_modulate.a = lerpf(0.58, 0.90, phase)
		layer.material.set_shader_parameter("brightness", lerpf(0.95, 1.08, phase))
