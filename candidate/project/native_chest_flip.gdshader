shader_type canvas_item;
render_mode unshaded;
uniform sampler2D front: filter_linear_mipmap,repeat_disable;
uniform sampler2D back: filter_linear_mipmap,repeat_disable;
uniform vec2 front_size=vec2(1.0);
uniform vec2 back_size=vec2(1.0);
uniform vec2 plane_size=vec2(100.0);
uniform float angle=0.0;
// Original .sea-chest-stage-modal .sea-chest-flip: perspective 1000px.
void fragment(){
 vec2 screen=(UV-vec2(.5))*plane_size;
 float cosine=cos(angle),sine=sin(angle);
 float divisor=cosine-screen.x*sine/1000.0;
 vec4 result=vec4(0.0);
 if(abs(divisor)>.0001){
  float x=screen.x/divisor;
  vec2 local=vec2(x,screen.y*(1.0+x*sine/1000.0));
  bool rear=cosine<0.0;if(rear)local.x=-local.x;
  vec2 natural=rear?back_size:front_size;
  vec2 extent=natural*min(plane_size.x/natural.x,plane_size.y/natural.y);
  vec2 uv=local/extent+vec2(.5);
  if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))result=rear?texture(back,uv):texture(front,uv);
 }
 COLOR=result;
}
