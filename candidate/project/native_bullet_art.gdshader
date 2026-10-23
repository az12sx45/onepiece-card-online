shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
varying vec4 tint;
void vertex(){tint=COLOR;}
uniform int kind=0;
uniform vec2 extent=vec2(100.0);
uniform float padding=30.0;
uniform bool kyubi=false;
uniform bool grayscale=false;
vec4 rgba(float r,float g,float b,float a){return vec4(vec3(r,g,b)/255.0*a,a);}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
float rounded(vec2 p,float radius){vec2 q=abs(p-extent*.5)-(extent*.5-vec2(radius));return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;}
void fragment(){
 vec2 p=UV*(extent+vec2(padding*2.0))-vec2(padding);vec4 color;
 if(kind==0){
  float x=clamp(p.x/extent.x,0.0,1.0);vec4 a=rgba(0,5,13,.52),b=rgba(0,4,11,.12),c=rgba(0,4,11,.45);color=x<.5?mix(a,b,x*2.0):mix(b,c,(x-.5)*2.0);
  vec2 center=extent*vec2(.73,.38);float radial=length(p-center)/length(max(center,extent-center));color=over(rgba(105,38,179,.18*(1.0-clamp(radial/.32,0.0,1.0))),color);
 }else if(kind==7){
  float edge=length(p-extent*.5)-extent.x*.5;
  float lower=length(p-vec2(0.0,18.0)-extent*.5)-extent.x*.5;
  color=over(rgba(146,75,255,.68*.5*(1.0-tanh(edge/14.75))),rgba(0,0,0,.72*.5*(1.0-tanh(lower/16.52))));
 }else{
  vec4 border=rgba(238,205,132,.72);vec4 base=rgba(3,14,25,.94);vec4 glow=rgba(133,64,233,.36);
  float radius=10.0;float x=clamp(p.x/extent.x,0.0,1.0);
  if(kind==1){radius=extent.y*.5;vec4 a=rgba(5,16,28,.95),b=rgba(55,19,79,.92);base=mix(a,b,1.0-abs(x*2.0-1.0));}
  else if(kind==2){base=mix(rgba(5,16,28,.94),rgba(17,37,47,.9),clamp((p.x+p.y)/(extent.x+extent.y),0.0,1.0));border=rgba(235,204,139,.58);glow=rgba(0,0,0,.46);}
  else if(kind==3){radius=extent.x*.5;base=rgba(2,4,10,1.0);border=rgba(247,209,121,.82);glow=rgba(139,66,245,.84);}
  else if(kind==4){radius=8.0;base=rgba(2,5,10,1.0);border=rgba(237,203,128,.58);glow=rgba(129,63,224,.34);}
  else if(kind==5){base=rgba(2,5,10,.88);border=rgba(244,210,128,.72);glow=rgba(150,75,255,.82);}
  else {radius=12.0;if(kyubi){border=rgba(255,123,224,.85);glow=rgba(255,88,215,.62);}}
  float edge=rounded(p,radius);float width=kind==3?2.0:1.0;vec4 fill=mix(base,border,smoothstep(-width-.5,-width+.5,edge))*(1.0-smoothstep(-.5,.5,edge));
  color=over(fill,glow*exp(-max(edge,0.0)*max(edge,0.0)/100.0));
 }
 if(grayscale)color.rgb=vec3(dot(color.rgb,vec3(.2126,.7152,.0722)));
 COLOR=vec4(color.rgb*tint.rgb*tint.a,color.a*tint.a);
}
