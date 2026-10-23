shader_type canvas_item;
render_mode unshaded;
uniform sampler2D backdrop:hint_screen_texture,repeat_disable,filter_nearest;
uniform vec2 extent=vec2(740.0,360.0);
varying float opacity;
void vertex(){opacity=COLOR.a;}
vec4 blend_stop(vec4 a,vec4 b,float t){a.rgb*=a.a;b.rgb*=b.a;vec4 c=mix(a,b,clamp(t,0.0,1.0));if(c.a>0.0)c.rgb/=c.a;return c;}
void fragment(){
 float radius=length(vec2(.74,.52)*extent);
 float distance=length((UV-vec2(.26,.52))*extent)/radius;
 vec4 a=vec4(1.0,1.0,1.0,.98),b=vec4(vec3(255.0,232.0,216.0)/255.0,.74),c=vec4(vec3(224.0,29.0,45.0)/255.0,.48);
 vec4 color=distance<.01?a:distance<.025?blend_stop(a,b,(distance-.01)/.015):distance<.07?blend_stop(b,c,(distance-.025)/.045):blend_stop(c,vec4(0.0),(distance-.07)/.14);
 vec3 behind=texture(backdrop,SCREEN_UV).rgb;
 COLOR=vec4(1.0-(1.0-behind)*(1.0-color.rgb),color.a*opacity);
}
