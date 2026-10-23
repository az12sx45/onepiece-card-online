shader_type canvas_item;
render_mode unshaded;
uniform vec2 surface_size;
uniform vec2 ring_size;
uniform float corner_radius=50.0;
uniform bool ellipse=false;
uniform float border_width=3.0;
uniform vec4 border_color=vec4(1.0);
uniform float motion_blur=0.0;
uniform int shadow_count=0;
uniform vec4 shadow_geometry[3]; // x, y, blur, inset
uniform vec4 shadow_colors[3];
varying vec4 tint;
void vertex(){tint=COLOR;}
float shape(vec2 p){
 if(ellipse){vec2 r=max(ring_size*.5,vec2(1.0));return (length(p/r)-1.0)*min(r.x,r.y);}
 vec2 q=abs(p)-ring_size*.5+vec2(min(corner_radius,min(ring_size.x,ring_size.y)*.5));
 return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-min(corner_radius,min(ring_size.x,ring_size.y)*.5);
}
float coverage(float d,float sigma){
 if(sigma<.1)return 1.0-smoothstep(-.65,.65,d);
 float x=d/(max(sigma,.1)*1.41421356);float t=1.0/(1.0+.3275911*abs(x));
 float e=1.0-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x);
 return .5*(1.0-sign(x)*e);
}
void fragment(){
 vec2 p=(UV-.5)*surface_size;float d=shape(p);float inside=coverage(d,0.0);vec4 c=vec4(0.0);
 // CSS paints the first shadow on top. Distance-field Gaussian is an
 // approximation; independent image comparison remains a release gate.
 for(int i=2;i>=0;i--){if(i>=shadow_count)continue;vec4 s=shadow_geometry[i];float q=shape(p-s.xy);
  float a=s.w>.5?(1.0-coverage(q,max(.1,s.z*.5)))*inside:coverage(q,max(.1,s.z*.5))*(1.0-inside);
  a*=shadow_colors[i].a;c=vec4(shadow_colors[i].rgb*a+c.rgb*(1.0-a),a+c.a*(1.0-a));
 }
 float a=max(0.0,coverage(d,motion_blur)-coverage(d+border_width,motion_blur))*border_color.a;
 c=vec4(border_color.rgb*a+c.rgb*(1.0-a),a+c.a*(1.0-a));
 COLOR=vec4(c.a>0.0?c.rgb/c.a:vec3(0.0),c.a)*tint;
}
