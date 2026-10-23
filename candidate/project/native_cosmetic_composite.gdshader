shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D source_texture: filter_linear, repeat_disable;
uniform sampler2D shadow_texture: filter_linear, repeat_disable;
uniform sampler2D backdrop_texture: filter_linear, repeat_disable;
uniform vec4 shadow_color=vec4(1.0,.839216,.439216,.3);
uniform float opacity=1.0;
uniform int blend_mode=0;
void fragment(){
 vec4 source=texture(source_texture,UV);float shadow=texture(shadow_texture,UV).a*shadow_color.a;
 source=vec4(source.rgb+shadow_color.rgb*shadow*(1.0-source.a),source.a+shadow*(1.0-source.a))*opacity;
 vec4 dest=texture(backdrop_texture,UV);vec3 rgb;
 if(blend_mode==1)rgb=source.rgb+dest.rgb-source.rgb*dest.rgb;
 else if(blend_mode==2)rgb=source.rgb*dest.rgb+source.rgb*(1.0-dest.a)+dest.rgb*(1.0-source.a);
 else rgb=source.rgb+dest.rgb*(1.0-source.a);
 COLOR=vec4(rgb,source.a+dest.a*(1.0-source.a));
}
