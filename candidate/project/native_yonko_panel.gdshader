shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform int mode=0;
uniform vec2 extent=vec2(640.0,320.0);
uniform bool disabled=false;
vec4 rgba(vec3 rgb,float a){return vec4(rgb*a,a);}
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
void fragment(){
 vec4 color;
 if(mode==0){
  float a=UV.y<.64?mix(.22,.72,UV.y/.64):mix(.72,.96,(UV.y-.64)/.36);float b=UV.x<.52?mix(.94,.46,UV.x/.52):mix(.46,.86,(UV.x-.52)/.48);
  color=over(rgba(vec3(5.0,6.0,14.0)/255.0,a),rgba(vec3(5.0,6.0,14.0)/255.0,b));float r=length((UV-vec2(.76,.2))*extent)/length(vec2(.76,.8)*extent);float glow=.28*(1.0-clamp(r/.26,0.0,1.0));color=over(over(rgba(vec3(168.0,43.0,52.0)/255.0,glow),rgba(vec3(0.0),UV.y*.62))*.88,color);
 }else if(mode==1||mode==2){
  color=mode==1?mix(rgba(vec3(12.0,14.0,28.0)/255.0,.9),rgba(vec3(6.0,8.0,17.0)/255.0,.94),UV.y):rgba(vec3(8.0,10.0,22.0)/255.0,.9);
  if(mode==1){float line=1.0-smoothstep(.5,1.5,mod((UV.x*extent.x+UV.y*extent.y)/sqrt(2.0),18.0));color=over(rgba(vec3(255.0,214.0,129.0)/255.0,line*.09),color);}
  vec2 edge=min(UV,1.0-UV)*extent;if(min(edge.x,edge.y)<1.0)color=over(rgba(vec3(255.0,214.0,129.0)/255.0,.46),color);if(mode==1&&UV.y*extent.y<3.0)color=over(rgba(vec3(255.0,214.0,129.0)/255.0,.82),color);
 }else{
  color=mode==3?mix(rgba(vec3(255.0,232.0,166.0)/255.0,1.0),rgba(vec3(207.0,129.0,49.0)/255.0,1.0),UV.y):mix(rgba(vec3(18.0,96.0,99.0)/255.0,.92),rgba(vec3(8.0,43.0,52.0)/255.0,.96),UV.y);
  vec2 q=abs((UV-.5)*extent)-(extent*.5-vec2(4.0));float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-4.0;float aa=max(fwidth(d),.5);vec4 edge=rgba(vec3(255.0,235.0,169.0)/255.0,.78);color=mix(color,edge,smoothstep(-1.0-aa,-1.0+aa,d))*(1.0-smoothstep(-aa,0.0,d));
  if(disabled){float gray=dot(color.rgb,vec3(.2126,.7152,.0722));color.rgb=mix(color.rgb,vec3(gray),.4);color*=.45;}
 }
 COLOR=color;
}
