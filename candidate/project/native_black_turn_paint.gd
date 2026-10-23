extends Node
## Procedural original CSS material, rasterized by Godot only when its
## dimensions/parameters change. Contains no game state or recorded frames.
const ShaderArt=preload("res://native_black_turn_art.gdshader")
var surface: SubViewport
var quad: ColorRect
var extent:=Vector2.ONE
var padding:=128.0
var signature:=""
var paints:=0
func _ready() -> void:
	surface=SubViewport.new();surface.disable_3d=true;surface.transparent_bg=true;surface.size=Vector2i.ONE;surface.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(surface)
	quad=ColorRect.new();quad.material=ShaderMaterial.new();quad.material.shader=ShaderArt;surface.add_child(quad)
func configure(kind: int,dimensions: Vector2,start:=Vector2.ZERO,finish:=Vector2.ZERO) -> void:
	var next:=JSON.stringify([kind,dimensions.x,dimensions.y,start.x,start.y,finish.x,finish.y])
	if signature==next:return
	signature=next;extent=dimensions;paints+=1
	surface.size=Vector2i((extent+Vector2.ONE*padding*2).ceil());quad.size=Vector2(surface.size)
	quad.material.set_shader_parameter("kind",kind);quad.material.set_shader_parameter("extent",extent);quad.material.set_shader_parameter("padding",padding)
	quad.material.set_shader_parameter("start",start);quad.material.set_shader_parameter("finish",finish)
	surface.render_target_update_mode=SubViewport.UPDATE_ONCE
func texture() -> Texture2D:return surface.get_texture()
func paint_size() -> Vector2:return Vector2(surface.size)
func stop() -> void:surface.render_target_update_mode=SubViewport.UPDATE_DISABLED
