extends Control
## Live GPU texture projected through the original CSS perspective plane.
## No screen capture/readback or animation frame recordings at runtime.
const Filtered=preload("res://native_css_ordered_image.gd")
const Motion=preload("res://native_black_turn_motion.gd")
var filtered: Control
var quad: ColorRect
var element_size:=Vector2.ONE
var source_image: Texture2D
var texture_padding:=180.0
var backdrop: BackBufferCopy

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	filtered=Filtered.new();add_child(filtered);filtered.hide()
	filtered.passes[0].effect.set_shader_parameter("source_fill",true)
	filtered.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	backdrop=BackBufferCopy.new();backdrop.copy_mode=BackBufferCopy.COPY_MODE_VIEWPORT;backdrop.hide();add_child(backdrop)
	quad=ColorRect.new();quad.mouse_filter=Control.MOUSE_FILTER_IGNORE;quad.material=ShaderMaterial.new();quad.material.shader=preload("res://native_projected_image.gdshader");add_child(quad)

func configure(image: Texture2D,extent: Vector2,surface: Vector2,logical_extent:=Vector2.ZERO,paint_padding:=0.0) -> void:
	source_image=image;element_size=extent if logical_extent==Vector2.ZERO else logical_extent;texture_padding=180.0+paint_padding;size=surface;quad.size=surface
	filtered.configure(image,extent)
	quad.material.set_shader_parameter("surface_size",surface)
	quad.material.set_shader_parameter("element_size",element_size)
	quad.material.set_shader_parameter("padding",texture_padding)

func apply_state(state: Dictionary,anchor: Vector2,perspective_origin: Vector2,distance:=1100.0) -> void:
	filtered.apply_filters(state.filters)
	var mapping:=Motion.screen_homography(state.transform,element_size,anchor,perspective_origin,distance,texture_padding,state.get("origin_ratio",Vector2(.5,.5)))
	var determinant:=mapping.determinant()
	if absf(determinant)<.000001 or (state.get("backface_hidden",false) and determinant<0):quad.hide();backdrop.hide();return
	quad.show();quad.modulate.a=state.opacity
	var blend_mode:=1 if state.get("screen_blend",false) else 2 if state.get("multiply_blend",false) else 0;backdrop.visible=blend_mode!=0
	quad.material.set_shader_parameter("blend_mode",blend_mode)
	quad.material.set_shader_parameter("source_texture",filtered.display.texture)
	quad.material.set_shader_parameter("texture_size",Vector2(filtered.extent))
	quad.material.set_shader_parameter("screen_to_plane",mapping.inverse())
	quad.material.set_shader_parameter("clip_insets",Vector4(state.clip[0],state.clip[1],state.clip[2],state.clip[3])/100.0)
	quad.material.set_shader_parameter("clip_enabled",state.get("clip_enabled",false))

func source_changed() -> void:
	filtered.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE
	filtered.filter_signature=""

func stop() -> void:
	filtered.stop();backdrop.hide();hide()
