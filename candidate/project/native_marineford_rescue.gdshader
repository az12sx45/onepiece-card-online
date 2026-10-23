shader_type canvas_item;
render_mode unshaded;
uniform int kind=0;
uniform vec2 extent=vec2(1.0);
uniform float stroke=4.0;
uniform vec4 ink: source_color=vec4(1.0);
vec4 over(vec4 a,vec4 b){float alpha=a.a+b.a*(1.0-a.a);return vec4(alpha>0.0?(a.rgb*a.a+b.rgb*b.a*(1.0-a.a))/alpha:vec3(0.0),alpha);}
vec4 radial(vec2 p,vec2 center,float stop,vec4 color){vec2 farthest=max(center,extent-center);float t=length(p-center)/length(farthest);return vec4(color.rgb,color.a*clamp(1.0-t/stop,0.0,1.0));}
float projection(vec2 p,float angle){vec2 direction=vec2(sin(radians(angle)),-cos(radians(angle)));float span=dot(abs(direction),extent);return .5+dot(p-extent*.5,direction)/span;}
vec4 line(float t,float a,float b,float c,float d,vec4 color){return vec4(color.rgb,color.a*clamp(min((t-a)/(b-a),(d-t)/(d-c)),0.0,1.0));}
void fragment(){
 vec4 tint=COLOR;vec4 pixel=vec4(0.0);vec2 p=UV*extent;
 if(kind==0){
  pixel=radial(p,extent*vec2(.5,.52),.58,vec4(4.0/255.0,16.0/255.0,31.0/255.0,.82));
  pixel=over(radial(p,extent*vec2(.5,.48),.29,vec4(142.0/255.0,213.0/255.0,1.0,.45)),pixel);
  pixel=over(radial(p,extent*vec2(.5,.46),.08,vec4(1.0,1.0,1.0,.42)),pixel);
 }else if(kind==1){
  vec2 r=extent*.5;vec2 q=p-r;float outer=length(q/r);float inner=length(q/max(r-vec2(stroke),vec2(1.0)));
  float aa=max(fwidth(outer),.0001);float ai=max(fwidth(inner),.0001);pixel=vec4(ink.rgb,ink.a*(1.0-smoothstep(1.0-aa,1.0+aa,outer))*smoothstep(1.0-ai,1.0+ai,inner));
 }else if(kind==2){
  float t=UV.x;
  if(t<1.0/3.0)pixel=vec4(1.0,1.0,1.0,.95*t*3.0);
  else if(t<2.0/3.0){float f=t*3.0-1.0;float a=mix(.95,.9,f);pixel=vec4(mix(vec3(.95),vec3(121.0/255.0,211.0/255.0,1.0)*.9,f)/a,a);}
  else pixel=vec4(121.0/255.0,211.0/255.0,1.0,.9*(1.0-t)*3.0);
 }else if(kind==4){
  float t=length(p-extent*.5)/length(extent*.5);
  if(t<.28){float f=t/.28;float a=mix(.62,.22,f);pixel=vec4(mix(vec3(.62),vec3(241.0,191.0,88.0)/255.0*.22,f)/a,a);}
  else pixel=vec4(vec3(241.0,191.0,88.0)/255.0,.22*clamp((.58-t)/.3,0.0,1.0));
 }else{
  pixel=line(projection(p,71.0),.58,.582,.588,.592,vec4(111.0/255.0,202.0/255.0,1.0,.86));
  pixel=over(line(projection(p,97.0),.50,.502,.507,.511,vec4(1.0,1.0,1.0,.72)),pixel);
  float t=projection(p,148.0);vec4 layer=vec4(0.0);
  if(t<.481)layer=line(t,.47,.472,.481,.484,vec4(18.0/255.0,58.0/255.0,88.0/255.0,.86));
  else if(t<.484){float f=(t-.481)/.003;float a=mix(.86,.9,f);layer=vec4(mix(vec3(18.0,58.0,88.0)/255.0*.86,vec3(159.0,223.0,255.0)/255.0*.9,f)/a,a);}
  else layer=line(t,.481,.484,.489,.494,vec4(159.0/255.0,223.0/255.0,1.0,.9));
  pixel=over(layer,pixel);pixel=over(line(projection(p,22.0),.43,.434,.442,.448,vec4(239.0/255.0,251.0/255.0,1.0,.95)),pixel);
 }
 COLOR=pixel*tint;
}
