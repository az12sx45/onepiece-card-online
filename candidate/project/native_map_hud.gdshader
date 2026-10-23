shader_type canvas_item;
render_mode unshaded;
uniform bool avatar=false;
uniform vec2 extent=vec2(280.0,48.0);
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){
 if(avatar){
  float r=length((UV-.5)*32.0);
  vec4 photo=texture(TEXTURE,(UV-.5)*32.0/30.0+.5);
  vec4 color=mix(vec4(vec3(231.0,201.0,134.0)/255.0,1.0),photo,1.0-smoothstep(14.5,15.5,r));
  color.a*=1.0-smoothstep(15.5,16.5,r);COLOR=color*tint;
 }else{
  vec2 q=abs((UV-.5)*extent)-(extent*.5-12.0);
  float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-12.0;
  vec4 color=texture(TEXTURE,vec2(UV.x,(UV.y-.5)/1.81+.5));
  color.a*=.65*(1.0-smoothstep(-.5,.5,d));COLOR=color*tint;
 }
}
