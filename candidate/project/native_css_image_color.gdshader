shader_type canvas_item;
render_mode unshaded,blend_disabled;
uniform sampler2D source_texture: filter_linear,repeat_disable;
uniform int count=0;
uniform vec2 operations[8];
void fragment(){
 vec4 c=texture(source_texture,UV);vec3 rgb=c.a>0.0?c.rgb/c.a:vec3(0.0);
 for(int i=0;i<8;i++){if(i>=count)break;float k=operations[i].x;float v=operations[i].y;
  if(k==1.0)rgb*=v;
  else if(k==2.0)rgb=(rgb-.5)*v+.5;
  else if(k==3.0)rgb=mix(rgb,vec3(1.0)-rgb,v);
  else if(k==4.0)rgb=mix(rgb,vec3(dot(rgb,vec3(.2126,.7152,.0722))),v);
  else if(k==5.0)rgb=mix(rgb,vec3(dot(rgb,vec3(.393,.769,.189)),dot(rgb,vec3(.349,.686,.168)),dot(rgb,vec3(.272,.534,.131))),v);
  else if(k==6.0)rgb=mix(vec3(dot(rgb,vec3(.213,.715,.072))),rgb,v);
  rgb=clamp(rgb,vec3(0.0),vec3(1.0));
 }COLOR=vec4(rgb*c.a,c.a);
}
