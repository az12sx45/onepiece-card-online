shader_type canvas_item;
render_mode unshaded,blend_disabled;
uniform sampler2D source_texture: filter_linear,repeat_disable;
uniform sampler2D shadow_texture: filter_linear,repeat_disable;
uniform vec4 shadow_color=vec4(0.0);
uniform vec2 offset_uv=vec2(0.0);
void fragment(){
 vec4 c=texture(source_texture,UV);vec2 p=UV-offset_uv;float a=0.0;if(all(greaterThanEqual(p,vec2(0.0)))&&all(lessThanEqual(p,vec2(1.0))))a=texture(shadow_texture,p).a*shadow_color.a;
 COLOR=vec4(c.rgb+shadow_color.rgb*a*(1.0-c.a),c.a+a*(1.0-c.a));
}
