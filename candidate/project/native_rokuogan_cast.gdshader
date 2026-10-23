shader_type canvas_item;
render_mode unshaded;
uniform int count=0;
uniform vec2 operations[8];
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){
 vec4 c=texture(TEXTURE,UV);vec3 rgb=c.rgb;
 for(int i=0;i<8;i++){if(i>=count)break;float k=operations[i].x;float value=operations[i].y;
  if(k==1.0)rgb*=value;
  else if(k==2.0)rgb=(rgb-.5)*value+.5;
  else if(k==3.0)rgb=mix(vec3(dot(rgb,vec3(.213,.715,.072))),rgb,value);
  rgb=clamp(rgb,vec3(0.0),vec3(1.0));
 }COLOR=vec4(rgb,c.a)*tint;
}
