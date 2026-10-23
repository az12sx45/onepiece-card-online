shader_type canvas_item;
uniform int kind=0;
uniform vec2 extent=vec2(210.0);
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){
 vec2 p=UV*extent;vec4 c=vec4(0.0);
 if(kind==0){
  vec2 q=UV-.5;float r=length(q)/.5;vec4 a=vec4(1.0,249.0/255.0,196.0/255.0,.72);vec4 b=vec4(1.0,120.0/255.0,214.0/255.0,.28);
  vec4 radial=r<.42?mix(a,b,r/.42):mix(b,vec4(b.rgb,0.0),clamp((r-.42)/.28,0.0,1.0));
  float angle=mod(degrees(atan(q.x,-q.y))-20.0+360.0,360.0)/360.0;
  vec4 gold=vec4(1.0,219.0/255.0,105.0/255.0,.62);vec4 purple=vec4(183.0/255.0,96.0/255.0,1.0,.55);
  vec4 conic=angle<.333333?mix(vec4(1.0,1.0,1.0,0.0),gold,angle*3.0):angle<.666667?mix(gold,purple,(angle-.333333)*3.0):mix(purple,vec4(1.0,1.0,1.0,0.0),(angle-.666667)*3.0);
  float alpha=radial.a+conic.a*(1.0-radial.a);c=vec4((radial.rgb*radial.a+conic.rgb*conic.a*(1.0-radial.a))/max(alpha,.0001),alpha*(1.0-smoothstep(.98,1.0,r)));
 }else{
  float radius=extent.y*.5;vec4 border=vec4(1.0,237.0/255.0,170.0/255.0,.8);
  if(kind==1){vec4 a=vec4(31.0,10.0,44.0,234.6)/255.0;vec4 b=vec4(93.0,31.0,88.0,224.4)/255.0;vec4 d=vec4(16.0,33.0,55.0,229.5)/255.0;c=UV.x<.5?mix(a,b,UV.x*2.0):mix(b,d,(UV.x-.5)*2.0);}
  if(kind==2){c=mix(vec4(1.0,214.0/255.0,107.0/255.0,.94),vec4(1.0,112.0/255.0,66.0/255.0,.9),UV.x);radius=22.0;border=c;}
  if(kind==3){c=vec4(0.0,0.0,0.0,.58);border=vec4(1.0,232.0/255.0,188.0/255.0,.3);}
  vec2 q=abs(p-extent*.5)-(extent*.5-vec2(radius));float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;c=mix(c,border,smoothstep(-1.5,-.5,d));c.a*=1.0-smoothstep(-.5,.5,d);
 }COLOR=c*tint;
}
