shader_type canvas_item;
render_mode unshaded;
uniform int kind=0;
void fragment(){
 vec2 p=UV-.5;float r=length(p)*2.0;float angle=atan(p.y,p.x);
 vec3 rgb;float a;
 if(kind==0){
  if(r<.15){rgb=vec3(1.,1.,.937);a=.98;}else if(r<.34){rgb=vec3(1.,.882,.396);a=.92;}else{float u=clamp((r-.34)/.33,0.,1.);rgb=mix(vec3(1.,.882,.396),vec3(1.,.459,.137),u);a=mix(.92,0.,u);}
  float ray=(sin(angle*3.)*.5+.5)*smoothstep(.25,.65,r)*(1.-smoothstep(.5,1.,r));rgb=mix(rgb,vec3(.412,.867,1.),ray*.5);a=max(a,ray*.6);
 }else{rgb=mix(vec3(1.,.96,.69),vec3(.184,.467,1.),smoothstep(.14,.48,r));rgb=mix(vec3(1.),rgb,smoothstep(.08,.14,r));a=1.-smoothstep(.14,.7,r);}
 COLOR=vec4(rgb,a)*COLOR;
}
