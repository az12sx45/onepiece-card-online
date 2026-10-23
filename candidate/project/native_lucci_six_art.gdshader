shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded,blend_premul_alpha;
uniform int kind=0;
uniform vec2 extent=vec2(200.0);
uniform float padding=40.0;
uniform bool has_image=true;
vec4 pm(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
vec4 rgba(float r,float g,float b,float a){return pm(vec4(r/255.0,g/255.0,b/255.0,a));}
// CSS default ellipse farthest-corner: aspect from farthest-side radii,
// expanded by sqrt(2) until the ellipse reaches the farthest corner.
float radial(vec2 p,vec2 center){vec2 c=center*extent;vec2 radius=max(c,extent-c)*sqrt(2.0);return length((p-c)/radius);}
vec4 fade(vec4 color,float r,float inner,float outer){return color*(1.0-clamp((r-inner)/(outer-inner),0.0,1.0));}
void fragment(){
 vec2 p=UV*(extent+vec2(padding*2.0))-vec2(padding);float x=p.x/extent.x;vec4 c=vec4(0.0);
 if(kind==0){
  float r=radial(p,has_image?vec2(.50,.49):vec2(.48,.48));
  if(has_image){
   vec4 a=rgba(252,248,228,.96),b=rgba(231,230,218,.88),d=rgba(174,183,182,.42);
   c=r<.24?a:r<.43?mix(a,b,(r-.24)/.19):r<.59?mix(b,d,(r-.43)/.16):fade(d,r,.59,.75);
   c=over(c,over(fade(rgba(9,10,11,.5),radial(p,vec2(.19,.61)),.03,.27),fade(rgba(9,10,11,.46),radial(p,vec2(.82,.35)),.03,.26)));
  }else{
   vec4 a=rgba(4,5,6,.94),b=rgba(4,5,6,.78),d=rgba(4,5,6,.28);
   c=r<.12?a:r<.31?mix(a,b,(r-.12)/.19):r<.54?mix(b,d,(r-.31)/.23):fade(d,r,.54,.70);
   c=over(c,over(fade(rgba(0,0,0,.82),radial(p,vec2(.18,.60)),.05,.31),fade(rgba(0,0,0,.78),radial(p,vec2(.81,.36)),.04,.29)));
  }
 }else if(kind==1){
  if(has_image){vec4 a=rgba(246,242,220,.12),b=rgba(246,242,220,.8);c=x<.09?mix(vec4(0),a,clamp((x-.02)/.07,0.0,1.0)):x<.25?mix(a,b,(x-.09)/.16):x<.75?b:x<.91?mix(b,a,(x-.75)/.16):mix(a,vec4(0),clamp((x-.91)/.07,0.0,1.0));}
  else c=rgba(0,0,0,.96)*min(clamp((x-.02)/.16,0.0,1.0),clamp((.98-x)/.16,0.0,1.0));
 }else{
  c=rgba(0,0,0,.9)*min(clamp(x/.18,0.0,1.0),clamp((1.0-x)/.18,0.0,1.0));
  c=over(rgba(255,255,255,.64)*max(1.0-clamp(p.y,0.0,1.0),1.0-clamp(extent.y-p.y,0.0,1.0)),c);
 }
 c*=step(0.0,p.x)*step(0.0,p.y)*step(p.x,extent.x)*step(p.y,extent.y);COLOR=c;
 COLOR=vec4(COLOR.rgb*tint.rgb*tint.a,COLOR.a*tint.a);
}
