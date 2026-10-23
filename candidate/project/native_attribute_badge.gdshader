shader_type canvas_item;
uniform vec2 extent=vec2(22.0,20.0);
uniform int attribute_kind=0;
uniform float brightness=1.0;
uniform float saturation=1.0;
void fragment(){
 vec4 a=vec4(1.0,1.0,1.0,.1);vec4 b=a;vec4 border=vec4(1.0,.91,.737,.36);
 if(attribute_kind==1){a=vec4(161.0/255.0,29.0/255.0,37.0/255.0,.92);b=vec4(1.0,89.0/255.0,80.0/255.0,.42);border=vec4(1.0,96.0/255.0,96.0/255.0,.72);}
 if(attribute_kind==2){a=vec4(25.0/255.0,87.0/255.0,172.0/255.0,.92);b=vec4(81.0/255.0,183.0/255.0,1.0,.42);border=vec4(86.0/255.0,174.0/255.0,1.0,.72);}
 if(attribute_kind==3){a=vec4(21.0/255.0,124.0/255.0,69.0/255.0,.92);b=vec4(84.0/255.0,219.0/255.0,129.0/255.0,.42);border=vec4(92.0/255.0,219.0/255.0,137.0/255.0,.72);}
 vec2 p=UV*extent;float r=min(extent.x,extent.y)*.5;vec2 q=abs(p-extent*.5)-(extent*.5-vec2(r));float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-r;
 vec4 c=mix(mix(a,b,(p.x+p.y)/(extent.x+extent.y)),border,smoothstep(-1.5,-.5,d));float grey=dot(c.rgb,vec3(.2126,.7152,.0722));COLOR=vec4(mix(vec3(grey),c.rgb,saturation)*brightness,c.a*(1.0-smoothstep(-.5,.5,d)));
}
