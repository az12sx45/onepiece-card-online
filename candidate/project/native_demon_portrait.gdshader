shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform vec2 card_size=vec2(200.0);
uniform float padding=180.0;
uniform bool vignette=false;
uniform float overlay_opacity=.62;
varying vec4 tint;
vec4 pm(vec4 c){return vec4(c.rgb*c.a,c.a);}
void vertex(){tint=COLOR;}
void fragment(){
 vec4 c=texture(TEXTURE,UV);
 vec2 p=UV*(card_size+vec2(padding*2.0))-vec2(padding+10.0);
 vec2 box=card_size-vec2(20.0);
 // The original portrait-wrap clips both the filtered portrait and ::after.
 vec2 edge=abs(p-box*.5)-(box*.5-vec2(6.0));
 float sdf=length(max(edge,vec2(0.0)))+min(max(edge.x,edge.y),0.0)-6.0;
 c*=1.0-smoothstep(-.75,.75,sdf);
 if(vignette){
  vec2 direction=vec2(sin(radians(145.0)),-cos(radians(145.0)));
  float t=clamp(dot(p-box*.5,direction)/dot(abs(direction),box)+.5,0.0,1.0);
  vec4 upper=mix(pm(vec4(113.0/255.0,0,97.0/255.0,.32)),pm(vec4(9.0/255.0,0,28.0/255.0,.2)),t);
  vec2 center=box*vec2(.5,.31);float radius=length(max(center,box-center));
  float r=clamp(length(p-center)/radius,0.0,1.0);
  vec4 a=pm(vec4(1,49.0/255.0,105.0/255.0,.18));vec4 b=pm(vec4(18.0/255.0,0,34.0/255.0,.34));vec4 d=pm(vec4(0,0,0,.94));
  vec4 lower=r<.48?mix(a,b,r/.48):mix(b,d,(r-.48)/.52);
  vec4 overlay=upper+lower*(1.0-upper.a);
  c.rgb*=vec3(1.0-overlay.a*overlay_opacity)+overlay.rgb*overlay_opacity;
 }
 COLOR=vec4(c.rgb*tint.rgb*tint.a,c.a*tint.a);
}
