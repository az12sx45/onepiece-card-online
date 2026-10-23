shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded;
uniform vec2 extent=vec2(640.0,320.0);
void fragment(){
 // Original ::before uses inset -10%, a farthest-corner radial gradient,
 // and the three-stop veil. Composite the transparent gradient in premultiplied space.
 vec2 uv=(UV+vec2(.1))/1.2;
 vec4 top=vec4(8.0,12.0,18.0,219.3)/255.0;
 vec4 mid=vec4(11.0,9.0,8.0,183.6)/255.0;
 vec4 low=vec4(4.0,5.0,8.0,224.4)/255.0;
 top.rgb*=top.a;mid.rgb*=mid.a;low.rgb*=low.a;
 vec4 base=uv.y<.48?mix(top,mid,uv.y/.48):mix(mid,low,(uv.y-.48)/.52);
 float radius=length(extent*vec2(.5,.58));
 float glow=.48*clamp(1.0-length((uv-vec2(.5,.42))*extent)/(radius*.42),0.0,1.0);
 float alpha=glow+base.a*(1.0-glow);
 COLOR=vec4((vec3(1.0,219.0/255.0,128.0/255.0)*glow+base.rgb*(1.0-glow))/max(alpha,.0001),alpha);
 COLOR*=tint;
}
