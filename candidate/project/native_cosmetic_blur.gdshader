shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D source_texture: filter_linear, repeat_disable;
uniform vec2 pixel_size=vec2(1.0);
uniform vec2 direction=vec2(1.0,0.0);
uniform float sigma=10.0;
void fragment(){
 float step_size=max(1.0,ceil(3.0*sigma/15.0));float result=0.0;float weight_sum=0.0;
 for(int i=-15;i<=15;i++){
  float distance=float(i)*step_size;float weight=exp(-.5*distance*distance/max(.01,sigma*sigma));vec2 uv=UV+direction*distance*pixel_size;
  float a=0.0;if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))a=texture(source_texture,uv).a;
  result+=a*weight;weight_sum+=weight;
 }
 COLOR=vec4(0.0,0.0,0.0,result/weight_sum);
}
