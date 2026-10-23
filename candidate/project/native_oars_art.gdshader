shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform int kind=0;
uniform vec2 extent=vec2(740.0,360.0);
uniform float padding=0.0;
varying vec4 tint;
void vertex(){tint=COLOR;}
vec4 pm(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
void fragment(){
 vec2 p=UV*(extent+vec2(padding*2.0))-vec2(padding);
 vec4 color=vec4(0.0);
 if(kind==0){
  vec2 center=extent*vec2(.74,.42);float radius=length(max(center,extent-center));
  float a=.18*(1.0-clamp(length(p-center)/(radius*.38),0.0,1.0));
  color=over(pm(vec4(vec3(237.0,246.0,255.0)/255.0,a)),pm(vec4(vec3(1.0,3.0,10.0)/255.0,.48)));
 }else if(kind==1){
  float r=length((p-extent*.5)/(extent*.5*sqrt(2.0)));
  vec4 a=pm(vec4(vec3(33.0,5.0,54.0)/255.0,.94)),b=pm(vec4(vec3(89.0,20.0,142.0)/255.0,.48));
  color=r<.48?mix(a,b,r/.48):b*(1.0-clamp((r-.48)/.24,0.0,1.0));
 }else{
  // White circular box, CSS shadow blur radii converted to Gaussian sigma.
  float d=length(p-extent*.5)-extent.x*.5;
  float aa=max(fwidth(d),.5);
  float coverage=1.0-smoothstep(-aa*.5,aa*.5,d);
  color=vec4(vec3(coverage),coverage);
  vec3 colors[3];colors[0]=vec3(1.0);colors[1]=vec3(201.0,220.0,255.0)/255.0;colors[2]=vec3(139.0,76.0,240.0)/255.0;
  float radii[3];radii[0]=35.0;radii[1]=95.0;radii[2]=160.0;
  for(int i=0;i<3;i++){float sigma=radii[i]*.5;float a=.5*(1.0-tanh(d/(sigma*1.18)));color=over(color,pm(vec4(colors[i],a)));}
 }
 if(kind!=2)color*=step(0.0,p.x)*step(0.0,p.y)*step(p.x,extent.x)*step(p.y,extent.y);
 COLOR=vec4(color.rgb*tint.rgb*tint.a,color.a*tint.a);
}

