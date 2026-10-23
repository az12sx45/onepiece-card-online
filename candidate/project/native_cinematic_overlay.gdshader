shader_type canvas_item;
render_mode unshaded,blend_premul_alpha;
uniform int mode=0;
uniform bool history=false;
uniform vec2 extent=vec2(740.0,360.0);
vec4 over(vec4 a,vec4 b){return a+b*(1.0-a.a);}
void fragment(){
 vec4 color=vec4(0.0);
 if(mode==0){float stop=history?.48:.45;float first=history?.04:.06;float mid=history?.1:.08;float last=history?.5:.46;float a=UV.y<stop?mix(first,mid,UV.y/stop):mix(mid,last,(UV.y-stop)/(1.0-stop));color=vec4(0.0,0.0,0.0,a);}
 else if(mode==1){float r=length((UV-vec2(.5,.48))*extent)/length(vec2(.5,.52)*extent);float a=r<.72?mix(0.0,.2,clamp((r-.48)/.24,0.0,1.0)):mix(.2,.52,clamp((r-.72)/.28,0.0,1.0));float edge=.18*(1.0-clamp(min(UV.x,1.0-UV.x)/.22,0.0,1.0));color=over(vec4(0.0,0.0,0.0,a),vec4(0.0,0.0,0.0,edge));}
 else if(mode==2){float r=length((UV-vec2(.52,1.0))/vec2(.52,1.0))/sqrt(2.0);float a=.22*(1.0-clamp(r/.52,0.0,1.0));color=over(vec4(vec3(255.0,224.0,139.0)/255.0*a,a),vec4(vec3(0.0,9.0,16.0)/255.0*UV.y*.5,UV.y*.5))*.58;}
 else{float height=clamp(extent.y*.075,42.0,86.0);float t=min(UV.y,1.0-UV.y)*extent.y/height;float a=t<.5?mix(.92,.5,clamp(t/.5,0.0,1.0)):mix(.5,0.0,clamp((t-.5)/.5,0.0,1.0));color=vec4(0.0,0.0,0.0,a);}
 COLOR=color;
}
