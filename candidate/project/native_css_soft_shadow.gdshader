shader_type canvas_item;
render_mode unshaded,blend_disabled;
uniform sampler2D source_texture: filter_linear,repeat_disable;
uniform vec2 pixel_size=vec2(1.0);
uniform vec2 direction=vec2(1.0,0.0);
uniform float sigma=0.0;
void fragment(){
 float sum=0.0;float weight_sum=0.0;
 for(int i=-48;i<=48;i++){
  float d=float(i);float weight=exp(-.5*d*d/max(.01,sigma*sigma));vec2 uv=UV+direction*d*pixel_size;float a=0.0;
  if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))a=texture(source_texture,uv).a;
  sum+=a*weight;weight_sum+=weight;
 }COLOR=vec4(0.0,0.0,0.0,sum/weight_sum);
}
