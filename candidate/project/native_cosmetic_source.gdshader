shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D source_image: filter_linear, repeat_disable;
uniform vec2 surface_size=vec2(1.0);
uniform vec2 image_size=vec2(1.0);
uniform vec2 element_size=vec2(1.0);
uniform vec2 center=vec2(0.0);
uniform float angle=0.0;
uniform vec2 flip=vec2(1.0);
uniform float brightness=1.0;
uniform float saturation=1.0;
uniform float contrast=1.0;
uniform bool portrait=false;
vec3 filtered(vec3 c){
 c*=brightness;
 float l=dot(c,vec3(.213,.715,.072));c=mix(vec3(l),c,saturation);
 return clamp((c-.5)*contrast+.5,vec3(0.0),vec3(1.0));
}
float rounded_mask(vec2 p,vec2 extent,float radius){vec2 q=abs(p-extent*.5)-(extent*.5-vec2(radius));float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;return 1.0-smoothstep(-.5,.5,d);}
void fragment(){
 vec2 d=UV*surface_size-center;float c=cos(angle);float s=sin(angle);
 vec2 local=vec2(c*d.x+s*d.y,-s*d.x+c*d.y)*flip+element_size*.5;
 float fit=portrait?max(element_size.x/image_size.x,element_size.y/image_size.y):min(element_size.x/image_size.x,element_size.y/image_size.y);
 vec2 fitted=image_size*fit;vec2 origin=(element_size-fitted)*(portrait?vec2(.5,.18):vec2(.5));vec2 uv=(local-origin)/fitted;
 vec4 color=vec4(0.0);if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))color=texture(source_image,uv);
 color.rgb=filtered(color.rgb);color.rgb*=color.a;
 if(portrait){
  float t=clamp(.5+dot(local-element_size*.5,vec2(.573576,.819152))/dot(element_size,vec2(.573576,.819152)),0.0,1.0);
  vec3 bg=mix(vec3(7.,22.,39.)/255.,vec3(2.,9.,18.)/255.,t);color=vec4(color.rgb+bg*(1.0-color.a),1.0)*rounded_mask(local,element_size,element_size.x*.03);
 }
 COLOR=color;
}
