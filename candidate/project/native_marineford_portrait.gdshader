shader_type canvas_item;
render_mode unshaded;
uniform int count=0;
uniform vec2 operations[8];
uniform int half_side=-1;
uniform float blur_pixels=0.0;
uniform vec2 displayed_size=vec2(1.0);
uniform bool rescued=false;
vec4 source(sampler2D original,vec2 point){
 if(point.x<0.0||point.y<0.0||point.x>1.0||point.y>1.0)return vec4(0.0);
 vec4 c=texture(original,point);return vec4(c.rgb*c.a,c.a);
}
void fragment(){
 vec4 tint=COLOR;
 if((half_side==0&&UV.x>.5)||(half_side==1&&UV.x<.5)){COLOR=vec4(0.0);}else{
  vec4 pixel=source(TEXTURE,UV);
  if(blur_pixels>.001){pixel=vec4(0.0);float sum=0.0;
   for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
    float weight=exp(-float(x*x+y*y)*.5);sum+=weight;
    pixel+=source(TEXTURE,UV+vec2(float(x),float(y))*blur_pixels/max(displayed_size,vec2(1.0)))*weight;
   }
   pixel/=sum;
  }
  vec3 rgb=pixel.a>0.0?pixel.rgb/pixel.a:vec3(0.0);
  if(rescued)rgb=clamp(mix(vec3(dot(rgb,vec3(.213,.715,.072))),rgb,1.06),vec3(0.0),vec3(1.0))*1.08;
  else rgb=mix(rgb,vec3(dot(rgb,vec3(.2126,.7152,.0722))),.18);
  for(int i=0;i<8;i++){if(i>=count)break;float kind=operations[i].x;float value=operations[i].y;
   if(kind==1.0)rgb*=value;
   else if(kind==2.0)rgb=(rgb-.5)*value+.5;
   else if(kind==4.0)rgb=mix(rgb,vec3(dot(rgb,vec3(.2126,.7152,.0722))),value);
   else if(kind==6.0)rgb=mix(vec3(dot(rgb,vec3(.213,.715,.072))),rgb,value);
   rgb=clamp(rgb,vec3(0.0),vec3(1.0));
  }
  COLOR=vec4(rgb,pixel.a)*tint;
 }
}
