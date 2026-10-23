shader_type canvas_item;
render_mode unshaded;
uniform vec2 extent=vec2(740,360);
uniform vec3 ink=vec3(0,.9,.82);
uniform vec2 slash_a=vec2(0,.15);
uniform vec2 slash_b=vec2(0,.15);
vec4 over(vec4 base,vec4 front){float a=front.a+base.a*(1.0-front.a);return vec4((front.rgb*front.a+base.rgb*base.a*(1.0-front.a))/max(a,.00001),a);}
vec4 slash(vec2 uv,float y,float angle,vec2 pose,float height){
 vec2 p=(uv-vec2(.5,y))*extent;float c=cos(angle),s=sin(angle);p=mat2(vec2(c,-s),vec2(s,c))*p;
 float width=extent.x*1.36*pose.y;float t=p.x/width+.5;float line=1.0-smoothstep(height*.5,height*.5+1.0,abs(p.y));
 float a=max(0.0,1.0-abs(t-.5)*2.0)*line*pose.x;
 return vec4(mix(vec3(1),vec3(.839216,0,0),clamp(1.0-abs(t-.5)*4.0,0,1)),a);
}
void fragment(){
 float t=dot(UV*extent,vec2(1))/max(1.0,extent.x+extent.y);float middle=clamp(1.0-abs(t-.5)/.16,0,1);vec4 base=mix(vec4(0,0,0,.98),vec4(.117647,0,0,.92),middle);
 float radial=length((UV-vec2(.5,.48))*extent)/(length(extent*.5)*.31);base=over(base,vec4(.839216,0,0,.18*clamp(1.0-radial,0,1)));
 vec2 p=(UV-.5)/max(.01,ink.y)/1.2+.5;float black=length((p-.5)*2.0);float red=length((p-vec2(.5,.55))*2.0);
 float lines=1.0-step(1.0,mod(p.x*extent.x*1.2,11.0));vec4 cloud=vec4(vec3(lines),lines*.04);
 cloud=over(cloud,vec4(.839216,0,0,.2*(1.0-smoothstep(.12,.34,red))));cloud=over(cloud,vec4(0,0,0,.58*(1.0-smoothstep(.22,.45,black))));cloud.rgb=(cloud.rgb-.5)*ink.z+.5;cloud.a*=ink.x;base=over(base,cloud);
 base=over(base,slash(UV,.5,radians(-10.0),slash_a,2.0));base=over(base,slash(UV,.58,radians(8.0),slash_b,1.0));COLOR*=base;
}
