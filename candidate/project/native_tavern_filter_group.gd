extends Node2D
## GPU equivalents of the project's pixi-filters 6.1.5 GL shaders. Keep the
## original brightness extraction, Kawase offsets, shockwave and RGB offsets.
## Pixel comparison remains required; compilation alone is not visual parity.
var raw:=SubViewport.new()
var content:=Node2D.new()
var output:=TextureRect.new()
var passes: Array=[]
var signature:=""
var extent:=Vector2i(1,1)
const EXTRACT="uniform float threshold=0.1; vec4 effect(vec2 uv){vec4 c=texture(TEXTURE,uv); float b=(max(max(c.r,c.g),c.b)+min(min(c.r,c.g),c.b))*.5; return b>threshold?c:vec4(0.0);}"
const KAWASE="uniform vec2 offset=vec2(1.0); vec4 effect(vec2 uv){vec2 d=offset*TEXTURE_PIXEL_SIZE; return .25*(texture(TEXTURE,uv+vec2(-d.x,d.y))+texture(TEXTURE,uv+d)+texture(TEXTURE,uv+vec2(d.x,-d.y))+texture(TEXTURE,uv-d));}"
const BLOOM="uniform sampler2D original_texture:filter_linear,repeat_disable;uniform float bloom_scale=1.25;uniform float brightness=1.08;vec4 effect(vec2 uv){vec4 c=texture(original_texture,uv);c.rgb*=brightness;return c+vec4(texture(TEXTURE,uv).rgb*bloom_scale,0.0);}"
const RGB="uniform vec2 red=vec2(0.0);uniform vec2 green=vec2(0.0);uniform vec2 blue=vec2(0.0);vec4 effect(vec2 uv){return vec4(texture(TEXTURE,uv+red*TEXTURE_PIXEL_SIZE).r,texture(TEXTURE,uv+green*TEXTURE_PIXEL_SIZE).g,texture(TEXTURE,uv+blue*TEXTURE_PIXEL_SIZE).b,texture(TEXTURE,uv).a);}"
const SHOCK="uniform vec4 frame_clamp=vec4(0.0,0.0,1.0,1.0);uniform vec2 center=vec2(0.0);uniform float clock=0.0;uniform float speed=750.0;uniform float amplitude=13.0;uniform float wavelength=72.0;uniform float brightness=1.05;uniform float radius=-1.0;vec4 effect(vec2 uv){vec2 extent=1.0/TEXTURE_PIXEL_SIZE;float half_wave=wavelength*.5/extent.x;float max_radius=radius/extent.x;float current=clock*speed/extent.x;float fade=1.0;if(max_radius>0.0){if(current>max_radius)return texture(TEXTURE,uv);fade=1.0-pow(current/max_radius,2.0);}vec2 dir=uv-center/extent;dir.y*=extent.y/extent.x;float distance=length(dir);if(distance<=0.0||distance<current-half_wave||distance>current+half_wave)return texture(TEXTURE,uv);float diff=(distance-current)/half_wave;float p=1.0-pow(abs(diff),2.0);float displacement=1.25*sin(diff*3.14159)*p*amplitude*fade;vec2 coord=uv+normalize(dir)*displacement/extent;vec2 clamped=clamp(coord,frame_clamp.xy,frame_clamp.zw);vec4 c=texture(TEXTURE,clamped);if(coord!=clamped)c*=max(0.0,1.0-length(coord-clamped));c.rgb*=1.0+(brightness-1.0)*p*fade;return c;}"
func _ready() -> void:
	_setup_viewport(raw);add_child(raw);raw.add_child(content)
	output.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;output.mouse_filter=Control.MOUSE_FILTER_IGNORE;output.texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	var shader:=Shader.new();shader.code="shader_type canvas_item;render_mode unshaded,blend_premul_alpha;void fragment(){COLOR=texture(TEXTURE,UV);}"
	var material_value:=ShaderMaterial.new();material_value.shader=shader;output.material=material_value;add_child(output)
	output.texture=raw.get_texture()
func _setup_viewport(view: SubViewport) -> void:
	view.disable_3d=true;view.transparent_bg=true;view.size=extent;view.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	view.canvas_item_default_texture_filter=Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
func children_root() -> Node:return content
func _pass(code: String,input: Texture2D) -> ShaderMaterial:
	var view:=SubViewport.new();_setup_viewport(view);add_child(view)
	var quad:=TextureRect.new();quad.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;quad.size=Vector2(extent);quad.texture=input;quad.texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	var shader:=Shader.new();shader.code="shader_type canvas_item;render_mode unshaded,blend_disabled;uniform sampler2D source_texture:filter_linear,repeat_disable;uniform vec2 pixel_size=vec2(1.0);"+code.replace("TEXTURE_PIXEL_SIZE","pixel_size").replace("TEXTURE","source_texture")+"void fragment(){COLOR=effect(UV);}"
	var material_value:=ShaderMaterial.new();material_value.shader=shader;material_value.set_shader_parameter("source_texture",input);material_value.set_shader_parameter("pixel_size",Vector2.ONE/Vector2(extent));quad.material=material_value;view.add_child(quad)
	passes.append({"view":view,"quad":quad,"material":material_value});output.texture=view.get_texture();return material_value
func _clear_passes() -> void:
	output.texture=raw.get_texture()
	for item in passes:item.view.queue_free()
	passes.clear()
func configure(value: Dictionary,_assets: Dictionary,_additive: Material) -> void:
	var m: Array=value.matrix;transform=Transform2D(Vector2(m[0],m[1]),Vector2(m[2],m[3]),Vector2(m[4],m[5]))
	modulate=Color.from_rgba8((int(value.tint)>>16)&255,(int(value.tint)>>8)&255,int(value.tint)&255);modulate.a=float(value.alpha)
	var next_signature:=""
	for filter in value.filters:next_signature+=str(filter.type)+":"+str(filter.get("quality",0))+";"
	var pipeline_changed:=signature!=next_signature
	if pipeline_changed:
		_clear_passes();signature=next_signature
		for filter in value.filters:
			if filter.type=="bloom":
				_pass(EXTRACT,output.texture)
				for i in range(int(filter.quality)):_pass(KAWASE,output.texture)
				_pass(BLOOM,output.texture)
			elif filter.type=="shockwave":_pass(SHOCK,output.texture)
			elif filter.type=="rgb-split":_pass(RGB,output.texture)
			else:assert(false,"Unimplemented native tavern filter "+str(filter.type))
	var index:=0
	for filter in value.filters:
		if filter.type=="bloom":
			if not pipeline_changed:index+=int(filter.quality)+2;continue
			passes[index].material.set_shader_parameter("threshold",filter.threshold);index+=1
			for i in range(int(filter.quality)):
				var offset: float=float(filter.blur)*(1.0-float(i)/float(filter.quality))+0.5
				passes[index].material.set_shader_parameter("offset",Vector2.ONE*offset);index+=1
			passes[index].material.set_shader_parameter("original_texture",raw.get_texture());passes[index].material.set_shader_parameter("bloom_scale",filter.bloomScale);passes[index].material.set_shader_parameter("brightness",filter.brightness);index+=1
		elif filter.type=="shockwave":
			var material_value: ShaderMaterial=passes[index].material
			# Pixi clips filter bounds to the viewport before rounding. Its center
			# remains relative to the earlier un-clipped getBounds() result.
			var origin:=Vector2(floorf(maxf(0,value.filterOrigin[0])),floorf(maxf(0,value.filterOrigin[1])))
			var end:=Vector2(ceilf(minf(extent.x,value.filterOrigin[0]+value.filterExtent[0])),ceilf(minf(extent.y,value.filterOrigin[1]+value.filterExtent[1])))
			material_value.set_shader_parameter("center",Vector2(filter.center.x,filter.center.y)+origin)
			material_value.set_shader_parameter("frame_clamp",Vector4((origin.x+0.5)/extent.x,(origin.y+0.5)/extent.y,(end.x-0.5)/extent.x,(end.y-0.5)/extent.y))
			for pair in [["clock","time"],["speed","speed"],["amplitude","amplitude"],["wavelength","wavelength"],["brightness","brightness"],["radius","radius"]]:material_value.set_shader_parameter(pair[0],filter.get(pair[1],0.0))
			index+=1
		elif filter.type=="rgb-split":
			for color in ["red","green","blue"]:passes[index].material.set_shader_parameter(color,Vector2(filter.get(color+"X",filter[color].x),filter.get(color+"Y",filter[color].y)))
			index+=1
func resize_surface(size_value: Vector2i) -> void:
	if extent==size_value:return
	extent=size_value;raw.size=extent;output.size=Vector2(extent)
	for item in passes:item.view.size=extent;item.quad.size=Vector2(extent);item.material.set_shader_parameter("pixel_size",Vector2.ONE/Vector2(extent))
