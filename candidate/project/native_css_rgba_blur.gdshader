shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D source_texture: filter_linear, repeat_disable;
uniform vec2 pixel_size=vec2(1.0);
uniform vec2 direction=vec2(1.0,0.0);
uniform float sigma=0.0;
void fragment(){
 float step_size=max(1.0,ceil(3.0*sigma/15.0));vec4 result=vec4(0.0);float weight_sum=0.0;
 for(int i=-15;i<=15;i++){
  float distance=float(i)*step_size;float weight=exp(-.5*distance*distance/max(.01,sigma*sigma));vec2 uv=UV+direction*distance*pixel_size;
  vec4 c=vec4(0.0);if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))c=texture(source_texture,uv);
  result+=c*weight;weight_sum+=weight;
 }COLOR=result/weight_sum;
}
