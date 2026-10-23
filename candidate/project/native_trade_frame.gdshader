shader_type canvas_item;
render_mode unshaded;
uniform vec2 extent=vec2(100.0,40.0);
uniform vec4 top_color:source_color=vec4(0.988,0.988,0.988,1.0);
uniform vec4 mid_color:source_color=vec4(0.784,0.820,0.839,1.0);
uniform vec4 bottom_color:source_color=vec4(0.620,0.671,0.698,1.0);
uniform vec4 border_color:source_color=vec4(0.612,0.659,0.678,1.0);
uniform float mid_stop=0.58;
uniform float radius=5.0;
uniform float border_width=2.0;
uniform bool grid=false;
uniform bool disabled=false;
void fragment(){
 vec2 point=UV*extent;vec2 q=abs(point-extent*.5)-(extent*.5-vec2(radius));
 float d=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;
 float aa=max(fwidth(d),.5);
 vec4 fill=UV.y<mid_stop?mix(top_color,mid_color,UV.y/mid_stop):mix(mid_color,bottom_color,(UV.y-mid_stop)/(1.0-mid_stop));
 if(grid){vec2 line=mod(point,vec2(13.0));float amount=max(1.0-smoothstep(.5,1.5,line.x),1.0-smoothstep(.5,1.5,line.y))*.08;fill.rgb=mix(fill.rgb,vec3(.373,.439,.478),amount);}
 vec4 color=mix(fill,border_color,smoothstep(-border_width-aa,-border_width+aa,d));
 color.rgb=mix(color.rgb,vec3(1.0),(1.0-smoothstep(.0,1.0,abs(d+border_width+1.0)))*.7);
 if(disabled){float gray=dot(color.rgb,vec3(.2126,.7152,.0722));color.rgb=mix(color.rgb,vec3(gray),.75);color.a*=.56;}
 color.a*=1.0-smoothstep(-aa,0.0,d);COLOR=color;
}
