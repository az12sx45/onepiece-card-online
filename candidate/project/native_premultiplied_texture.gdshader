shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){vec4 c=texture(TEXTURE,UV);COLOR=vec4(c.rgb*tint.rgb*tint.a,c.a*tint.a);}
