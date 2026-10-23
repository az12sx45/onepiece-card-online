extends Node
## Compile the original portrait's material variants in an offscreen target
## before enabling chapter controls. First-use work must not interrupt a cut.
var complete:=false
var preparing:=false
func begin() -> void:
	if complete or preparing:return
	preparing=true
	var target:=SubViewport.new();target.disable_3d=true;target.transparent_bg=true;target.size=Vector2i(16,16);target.render_target_update_mode=SubViewport.UPDATE_ALWAYS;add_child(target)
	var image:=Image.create(1,1,false,Image.FORMAT_RGBA8);image.fill(Color.WHITE);var texture:=ImageTexture.create_from_image(image)
	var shader=preload("res://native_marineford_portrait.gdshader")
	var index:=0
	for side in [-1,0,1]:
		for count in [0,2,3,4]:
			for blur in [0.0,.5]:
				var node:=TextureRect.new();node.texture=texture;node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;node.size=Vector2(2,2);node.position=Vector2((index%8)*2,floori(float(index)/8)*2);index+=1
				var material:=ShaderMaterial.new();material.shader=shader;material.set_shader_parameter("count",count);material.set_shader_parameter("operations",PackedVector2Array([Vector2(4,.8),Vector2(6,.1),Vector2(1,.6),Vector2(2,1.12),Vector2.ZERO,Vector2.ZERO,Vector2.ZERO,Vector2.ZERO]));material.set_shader_parameter("half_side",side);material.set_shader_parameter("blur_pixels",blur);material.set_shader_parameter("displayed_size",Vector2(2,2));node.material=material;target.add_child(node)
	for kind in range(5):
		var node:=ColorRect.new();node.size=Vector2(2,2);node.position=Vector2(kind*2,8)
		var material:=ShaderMaterial.new();material.shader=preload("res://native_marineford_rescue.gdshader");material.set_shader_parameter("kind",kind);material.set_shader_parameter("extent",node.size);node.material=material;target.add_child(node)
	for i in range(3):await RenderingServer.frame_post_draw
	if target.get_texture().get_image().get_pixel(1,1).a<.9:
		push_error("Marineford material warmup did not render");target.queue_free();return
	complete=true;preparing=false;target.queue_free()
