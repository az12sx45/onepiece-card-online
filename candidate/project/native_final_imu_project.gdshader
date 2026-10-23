shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform mat3 inverse_projection;
uniform vec2 bounds_origin;
uniform vec2 bounds_extent;
uniform vec2 image_extent;
uniform float alpha=1.0;
uniform bool screen_blend=false;
uniform sampler2D screen_texture:hint_screen_texture,filter_nearest;
void fragment(){
 vec2 pixel=bounds_origin+UV*bounds_extent;vec3 local=inverse_projection*vec3(pixel,1.0);vec2 uv=(local.xy/local.z)/image_extent;vec4 color=vec4(0.0);
 if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))color=texture(TEXTURE,uv)*alpha;
 if(screen_blend)color.rgb+=texture(screen_texture,SCREEN_UV).rgb*(color.a-color.rgb);
 COLOR=color;
}
