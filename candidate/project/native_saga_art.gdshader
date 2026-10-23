shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
varying vec4 tint;
void vertex(){tint=COLOR;}
uniform int kind=0;
uniform vec2 extent=vec2(740.0,360.0);
uniform float padding=0.0;
vec4 pm(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec4 rgba(float r,float g,float b,float a){return pm(vec4(r/255.0,g/255.0,b/255.0,a));}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
float radius(vec2 c){return length(max(c,extent-c));}
float rounded(vec2 p,float r){vec2 q=abs(p-extent*.5)-(extent*.5-vec2(r));return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-r;}
void fragment(){
 vec2 p=UV*(extent+vec2(padding*2.0))-vec2(padding);vec4 color=vec4(0.0);
 if(kind==0){
  vec2 axis=vec2(sin(radians(115.0)),-cos(radians(115.0)));float t=dot(p-extent*.5,axis)/(abs(axis.x*extent.x)+abs(axis.y*extent.y))+.5;
  vec4 a=rgba(1,7,10,.96),b=rgba(24,0,6,.9),c=rgba(0,9,7,.96);color=t<.5?mix(a,b,t*2.0):mix(b,c,(t-.5)*2.0);
  float blood=.3*(1.0-clamp(length(p-extent*vec2(.5,.42))/(radius(extent*vec2(.5,.42))*.54),0.0,1.0));color=over(rgba(157,0,18,blood),color);
  float green=.16*(1.0-clamp(length(p-extent*vec2(.5,.45))/(radius(extent*vec2(.5,.45))*.29),0.0,1.0));color=over(rgba(102,255,141,green),color);
 }else if(kind==1){
  float r=length(p-extent*vec2(.44,.38))/radius(extent*vec2(.44,.38));
  vec4 a=rgba(255,122,112,1),b=rgba(165,12,34,1),c=rgba(69,0,13,1),d=rgba(31,0,7,.05);
  color=r<.04?a:r<.24?mix(a,b,(r-.04)/.20):r<.58?mix(b,c,(r-.24)/.34):mix(c,d,clamp((r-.58)/.14,0.0,1.0));
  float edge=length(p-extent*.5)-extent.x*.5;color*=1.0-smoothstep(-.5,.5,edge);
  color=over(color,over(rgba(213,12,36,.66*.5*(1.0-tanh(edge/26.55))),rgba(121,0,20,.5*.5*(1.0-tanh(edge/64.9)))));
 }else if(kind==2){
  float edge=length(p-extent*.5)-(extent.x*.5-2.5);float ring=1.0-smoothstep(2.0,3.0,abs(edge));
  color=rgba(158,255,184,.85*ring);color=over(color,rgba(62,255,116,.8*exp(-edge*edge/(2.0*14.0*14.0))));color=over(color,rgba(255,30,59,.62*exp(-edge*edge/(2.0*13.0*13.0))*step(edge,0.0)));
 }else{
  float x=clamp(p.x/extent.x,0.0,1.0);vec4 a,b,c,border;
  if(kind==3){a=rgba(7,16,22,.9);b=rgba(91,5,20,.88);c=rgba(4,30,25,.9);border=rgba(239,198,113,.72);}
  else{a=rgba(4,24,20,.94);b=rgba(62,3,15,.94);c=a;border=rgba(131,245,163,.68);}
  color=x<.5?mix(a,b,x*2.0):mix(b,c,(x-.5)*2.0);float edge=rounded(p,kind==3?extent.y*.5:12.0);color=mix(color,border,smoothstep(-1.5,-.5,edge))*(1.0-smoothstep(-.5,.5,edge));
 }
 COLOR=vec4(color.rgb*tint.rgb*tint.a,color.a*tint.a);
}

