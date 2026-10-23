shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded,blend_premul_alpha;
uniform int mode=0;
uniform vec2 extent=vec2(740.0,360.0);
uniform float alpha=1.0;
uniform sampler2D screen_texture:hint_screen_texture,filter_nearest;
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
float stops(float t,float split,float a,float b,float c){return t<split?mix(a,b,clamp(t/split,0.0,1.0)):mix(b,c,clamp((t-split)/(1.0-split),0.0,1.0));}
void fragment(){
 vec4 color;
 if(mode==0){
  float r=length((UV-vec2(.5,.34))*extent)/length(vec2(.5,.66)*extent);
  float white=.22*(1.0-clamp(r/.12,0.0,1.0));
  float ellipse=length((UV-vec2(.5,.38))/vec2(.5,.62))/sqrt(2.0);
  float shade=ellipse<.54?mix(0.0,.18,clamp((ellipse-.22)/.32,0.0,1.0)):mix(.18,.68,clamp((ellipse-.54)/.46,0.0,1.0));
  color=over(vec4(vec3(white),white),over(vec4(0.0,0.0,0.0,shade),vec4(0.0,0.0,0.0,stops(UV.y,.54,0.0,.3,.72))));color*=alpha;
  color.rgb+=texture(screen_texture,SCREEN_UV).rgb*(color.a-color.rgb);
 }else if(mode==1){
  float ellipse=length((UV-vec2(.5,.44))/vec2(.5,.56))/sqrt(2.0);
  float shade=ellipse<.62?mix(0.0,.42,clamp((ellipse-.18)/.44,0.0,1.0)):mix(.42,.9,clamp((ellipse-.62)/.38,0.0,1.0));
  color=over(vec4(0.0,0.0,0.0,shade),vec4(0.0,0.0,0.0,stops(UV.y,.28,.45,0.0,.72)))*alpha;
 }else if(mode==2){
  vec4 center=vec4(vec3(36.0,3.0,5.0)/255.0*.9,.9);vec4 edge=vec4(0.0,0.0,0.0,.78);color=UV.x<.45?mix(edge,center,UV.x/.45):mix(center,edge,(UV.x-.45)/.55);
  float r=length((UV-vec2(.18,0.0))*extent)/length(vec2(.82,1.0)*extent);float light=.12*(1.0-clamp(r/.34,0.0,1.0));color=over(color,vec4(vec3(light),light));
  if(UV.y*extent.y<1.0)color=over(vec4(vec3(.24),.24),color);if((1.0-UV.y)*extent.y<1.0)color=over(vec4(vec3(181.0,11.0,18.0)/255.0*.46,.46),color);color*=alpha;
 }else if(mode==3){color=mix(vec4(vec3(181.0,11.0,18.0)/255.0*.95,.95),vec4(vec3(38.0,3.0,4.0)/255.0*.6,.6),UV.x)*alpha;}
 else{
  vec2 q=abs((UV-.5)*extent)-(extent*.5-vec2(4.0));float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-4.0;float aa=max(fwidth(d),.5);
  vec4 fill=mode==4?mix(vec4(vec3(194.0,17.0,22.0)/255.0*.95,.95),vec4(vec3(58.0,4.0,7.0)/255.0*.92,.92),UV.y):vec4(vec3(7.0,3.0,3.0)/255.0*.74,.74);
  vec4 border=mode==4?vec4(vec3(255.0,87.0,74.0)/255.0*.58,.58):vec4(vec3(.22),.22);color=mix(fill,border,smoothstep(-1.0-aa,-1.0+aa,d))*(1.0-smoothstep(-aa,0.0,d))*alpha;
 }
 COLOR=color;
 COLOR=vec4(COLOR.rgb*tint.rgb*tint.a,COLOR.a*tint.a);
}
