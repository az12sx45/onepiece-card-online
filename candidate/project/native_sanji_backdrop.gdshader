shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
uniform vec2 extent=vec2(740.0,360.0);
void fragment(){
 vec2 p=UV*extent;vec2 axis=vec2(sin(radians(115.0)),-cos(radians(115.0)));
 float span=abs(extent.x*axis.x)+abs(extent.y*axis.y);float t=dot(p-extent*.5,axis)/span+.5;
 vec4 a=vec4(1.0,9.0,18.0,249.9)/255.0;vec4 b=vec4(17.0,35.0,52.0,234.6)/255.0;vec4 c=vec4(20.0,4.0,10.0,247.35)/255.0;
 vec4 base=t<.46?mix(a,b,clamp(t/.46,0.0,1.0)):mix(b,c,clamp((t-.46)/.54,0.0,1.0));
 float radius=length(max(extent*vec2(.5,.48),extent*vec2(.5,.52)));
 float alpha=.24*(1.0-clamp(length(p-extent*vec2(.5,.48))/(radius*.29),0.0,1.0));
 COLOR=vec4(mix(base.rgb,vec3(40.0,195.0,255.0)/255.0,alpha),alpha+base.a*(1.0-alpha));
 COLOR*=tint;
}
