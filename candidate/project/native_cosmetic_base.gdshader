shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform vec2 surface_size=vec2(1.0);
uniform vec4 card_rect=vec4(0.0,0.0,1.0,1.0);
uniform bool has_frame=false;
float distance_box(vec2 p,vec2 extent,float radius){vec2 q=abs(p-extent*.5)-(extent*.5-vec2(radius));return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;}
void fragment(){
 vec2 p=UV*surface_size-card_rect.xy;vec2 extent=card_rect.zw;float radius=extent.x*.04;
 float distance=distance_box(p,extent,radius);float mask=1.0-smoothstep(-.5,.5,distance);
 float t=clamp(.5+dot(p-extent*.5,vec2(.573576,.819152))/dot(extent,vec2(.573576,.819152)),0.0,1.0);
 vec4 a=vec4(11.,35.,61.,has_frame?.7:.94);a.rgb/=255.;vec4 b=vec4(2.,10.,22.,has_frame?.78:.96);b.rgb/=255.;vec4 color=mix(a,b,t);color.rgb*=color.a;
 if(!has_frame){float edge=mask-(1.0-smoothstep(-.5,.5,distance+1.0));vec4 border=vec4(vec3(231.,190.,111.)/255.*.5,.5)*edge;color=border+color*(1.0-border.a);}
 COLOR=color*mask;
}
