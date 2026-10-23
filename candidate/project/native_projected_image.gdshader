shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform sampler2D source_texture: filter_linear,repeat_disable;
uniform sampler2D backdrop_texture: hint_screen_texture,filter_nearest,repeat_disable;
uniform int blend_mode=0;
uniform mat3 screen_to_plane;
uniform vec2 surface_size=vec2(740.0,360.0);
uniform vec2 texture_size=vec2(200.0);
uniform vec4 clip_insets=vec4(0.0);
uniform bool clip_enabled=false;
uniform vec2 element_size=vec2(200.0);
uniform float padding=180.0;
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){
 vec3 local=screen_to_plane*vec3(UV*surface_size,1.0);
 vec2 p=local.xy/local.z;vec2 uv=p/texture_size;
 vec2 e=p-vec2(padding);
 bool clipped=e.x<element_size.x*clip_insets.w||e.x>element_size.x*(1.0-clip_insets.y)||e.y<element_size.y*clip_insets.x||e.y>element_size.y*(1.0-clip_insets.z);
 // inset(0) clips shadows to the element; 'none' preserves their overflow.
 if(!clip_enabled)clipped=false;
 vec4 c=vec4(0.0);
 if(!clipped&&local.z>0.0&&all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))c=texture(source_texture,uv);
 c=vec4(c.rgb*tint.rgb*tint.a,c.a*tint.a);
 if(blend_mode!=0&&c.a>0.0){vec3 backdrop=texture(backdrop_texture,SCREEN_UV).rgb;c=vec4(blend_mode==1?backdrop*(vec3(1.0)-c.rgb)+c.rgb:backdrop*(vec3(1.0-c.a)+c.rgb),1.0);}
 COLOR=c;
}
