shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform int kind=0;
uniform vec2 extent=vec2(200.0);
uniform float padding=64.0;
uniform vec2 start=vec2(140.0,200.0);
uniform vec2 finish=vec2(590.0,200.0);
vec4 pm(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
vec4 rgba(float r,float g,float b,float a){return pm(vec4(r/255.0,g/255.0,b/255.0,a));}
float rounded(vec2 p,vec2 box,float radius){vec2 q=abs(p-box*.5)-(box*.5-vec2(radius));return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;}
float erf_approx(float x){float s=sign(x);x=abs(x);float t=1.0/(1.0+.3275911*x);return s*(1.0-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x));}
float gaussian_edge(float distance,float sigma){return .5*(1.0-erf_approx(distance/max(.0001,sigma*1.41421356)));}
float angle01(vec2 q,float origin){return mod(degrees(atan(q.x,-q.y))-origin+720.0,360.0)/360.0;}
float linear_at(vec2 p,vec2 box,float degrees_value){vec2 d=vec2(sin(radians(degrees_value)),-cos(radians(degrees_value)));return clamp(dot(p-box*.5,d)/dot(abs(d),box)+.5,0.0,1.0);}
float radial_at(vec2 p,vec2 box,vec2 center){return length(p-center)/length(max(center,box-center));}
void fragment(){
 vec2 p=UV*(extent+vec2(padding*2.0))-vec2(padding);vec4 c=vec4(0.0);
 if(kind==0){
  float x=clamp(p.x/extent.x,0.0,1.0);c=x<.5?mix(rgba(0,0,0,.72),rgba(19,0,31,.35),x*2.0):mix(rgba(19,0,31,.35),rgba(0,0,0,.68),(x-.5)*2.0);
  c=over(rgba(8,0,18,.5)*(1.0-clamp(radial_at(p,extent,start)/.28,0.0,1.0)),c);
  c=over(rgba(56,0,82,.52)*(1.0-clamp(radial_at(p,extent,finish)/.3,0.0,1.0)),c);
  c*=step(0.0,p.x)*step(0.0,p.y)*step(p.x,extent.x)*step(p.y,extent.y);
 }else if(kind==1||kind==2){
  vec2 q=p-extent*.5;float r=length(q)/length(extent*.5);float a=angle01(q,kind==1?120.0:180.0);
  vec4 conic;
  if(kind==1){vec4 b=rgba(166,95,255,.56),d=rgba(0,0,0,.85),e=rgba(92,21,142,.52);conic=a<.25?mix(vec4(0.0),b,a*4.0):a<.5?mix(b,d,(a-.25)*4.0):a<.75?mix(d,e,(a-.5)*4.0):mix(e,vec4(0.0),(a-.75)*4.0);}
  else{vec4 b=rgba(175,95,255,.44),d=rgba(0,0,0,.7);conic=a<1.0/3.0?mix(vec4(0.0),b,a*3.0):a<2.0/3.0?mix(b,d,(a-1.0/3.0)*3.0):mix(d,vec4(0.0),(a-2.0/3.0)*3.0);}
  vec4 radial;float end= kind==1?.72:.7;vec4 first=rgba(0,0,0,kind==1?.94:.85);vec4 second=kind==1?rgba(37,0,54,.56):rgba(68,0,98,.48);
  radial=r<.48?mix(first,second,r/.48):mix(second,vec4(0.0),clamp((r-.48)/(end-.48),0.0,1.0));
  float d=rounded(p,extent,kind==1?extent.x*.5:6.0);float mask=1.0-smoothstep(-.5,.5,d);c=over(radial,conic);
  if(kind==1){c=over(rgba(0,0,0,.82)*(1.0-gaussian_edge(d,16.0)),c);c=c*mask+rgba(149,71,255,.42)*gaussian_edge(d,12.0)*(1.0-mask);}
  else c*=mask;
 }else if(kind==3){
  float x=clamp(p.x/extent.x,0.0,1.0);vec4 a=vec4(0.0),b=rgba(26,0,42,.82),d=rgba(154,75,255,.52),e=rgba(0,0,0,.78);
  c=x<.18?mix(a,b,x/.18):x<.48?mix(b,d,(x-.18)/.3):x<.78?mix(d,e,(x-.48)/.3):mix(e,a,(x-.78)/.22);
  float line=mod(p.x,32.0);float stripe=line<18.0?0.0:line<20.0?(line-18.0)/2.0:1.0-(line-20.0)/12.0;
  c=over(c,rgba(196,132,255,.24)*stripe);c*=1.0-smoothstep(-.5,.5,rounded(p,extent,extent.y*.5));
 }else if(kind==4){
  float d=rounded(p,extent,12.0);float mask=1.0-smoothstep(-.5,.5,d);
  c=mix(rgba(18,53,82,.92),rgba(3,12,24,.94),linear_at(p,extent,145.0));
  c=over(rgba(255,255,255,.08)*clamp(1.0-p.y,0.0,1.0),c);
  c=over(rgba(255,232,178,.34)*smoothstep(-1.5,-.5,d),c);
  c=c*mask+rgba(0,0,0,.42)*gaussian_edge(rounded(p-vec2(0,24),extent,12.0),27.0)*(1.0-mask);
 }else if(kind==5){
  c=mix(rgba(16,2,24,.82),rgba(0,0,0,.92),clamp(p.y/extent.y,0.0,1.0));
  c=over(rgba(255,255,255,.18)*(1.0-clamp(radial_at(p,extent,extent*vec2(.5,.28))/.36,0.0,1.0)),c);
  c*=1.0-smoothstep(-.5,.5,rounded(p,extent,8.0));
 }else if(kind==6){
  float r=radial_at(p,extent,extent*.5);vec4 a=rgba(165,84,255,.62),b=rgba(23,0,37,.86),d=rgba(0,0,0,.96);
  c=r<.44?mix(a,b,r/.44):mix(b,d,clamp((r-.44)/.28,0.0,1.0));
  vec2 direction=vec2(sin(radians(135.0)),-cos(radians(135.0)));float line=mod(dot(p-extent*.5,direction)+dot(abs(direction),extent)*.5,14.0);
  c=over(c,rgba(255,255,255,.09)*(1.0-smoothstep(2.0,3.0,line)));c*=1.0-smoothstep(-.5,.5,rounded(p,extent,8.0));
 }else if(kind==7){
  vec2 q=p-extent*.5;float r=length(q)/length(extent*.5);float a=angle01(q,90.0);
  vec4 radial=r<.06?rgba(255,255,255,.82):r<.07?mix(rgba(255,255,255,.82),rgba(156,92,255,.5),(r-.06)/.01):r<.18?rgba(156,92,255,.5):mix(rgba(156,92,255,.5),vec4(0.0),clamp((r-.18)/.01,0.0,1.0));
  // CSS automatic stops: transparent 0, white 17%, transparent 34%, purple 53%, transparent 72%.
  vec4 b=rgba(255,255,255,.38),d=rgba(115,35,255,.62);vec4 conic=a<.17?mix(vec4(0.0),b,a/.17):a<.34?mix(b,vec4(0.0),(a-.17)/.17):a<.53?mix(vec4(0.0),d,(a-.34)/.19):a<.72?mix(d,vec4(0.0),(a-.53)/.19):vec4(0.0);
  c=over(radial,conic)*.9*(1.0-smoothstep(-.5,.5,length(q)-extent.x*.5));
 }else if(kind==8){
  float d=rounded(p,extent,extent.y*.5);c=rgba(0,0,0,.58);c=over(rgba(255,232,188,.3)*smoothstep(-1.5,-.5,d),c);c*=1.0-smoothstep(-.5,.5,d);
 }else if(kind==11){
  float d=rounded(p,extent,8.0);float mask=1.0-smoothstep(-.5,.5,d);
  vec4 shadow=over(rgba(0,0,0,.58)*gaussian_edge(rounded(p-vec2(0,20),extent,8.0),17.0),rgba(132,74,255,.55)*gaussian_edge(d,16.0));
  vec4 border=rgba(231,213,255,.78)*smoothstep(-2.5,-1.5,d);
  border=over(rgba(255,255,255,.14)*smoothstep(-1.5,-.5,d),border);
  c=border*mask+shadow*(1.0-mask);
 }else if(kind==9||kind==10){
  float r=radial_at(p,extent,extent*vec2(.5,.31));float d=rounded(p,extent,8.0);
  if(kind==9){
   vec4 a=rgba(255,44,101,.58),b=rgba(38,0,60,.28),e=rgba(0,0,0,.68);
   vec4 radial=r<.48?mix(a,b,r/.48):mix(b,e,clamp((r-.48)/.52,0.0,1.0));
   c=over(mix(rgba(113,0,97,.82),rgba(9,0,28,.78),linear_at(p,extent,145.0)),radial);
  }else{
   vec4 a=rgba(255,49,105,.18),b=rgba(18,0,34,.34),e=rgba(0,0,0,.94);
   c=r<.48?mix(a,b,r/.48):mix(b,e,clamp((r-.48)/.52,0.0,1.0));
   c=over(rgba(0,0,0,.82)*(1.0-gaussian_edge(d,32.0)),c);
   c=over(rgba(255,41,103,.2)*(1.0-gaussian_edge(d,17.0)),c);
  }
  c*=1.0-smoothstep(-.5,.5,d);
 }
 COLOR=c;
}
