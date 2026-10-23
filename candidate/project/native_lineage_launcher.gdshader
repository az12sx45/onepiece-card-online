shader_type canvas_item;
uniform float angle=0.0;
uniform float art_y=0.0;
void fragment(){
 vec2 p=(UV-vec2(.5))/1.15;
 float c=cos(angle),s=sin(angle);p=mat2(vec2(c,-s),vec2(s,c))*p;
 p.y-=art_y;
 vec2 extent=vec2(textureSize(TEXTURE,0));extent/=max(extent.x,extent.y);
 vec2 uv=p/extent+vec2(.5);
 vec4 pixel=texture(TEXTURE,clamp(uv,vec2(0),vec2(1)))*COLOR;
 pixel.a*=step(0.0,uv.x)*step(0.0,uv.y)*step(uv.x,1.0)*step(uv.y,1.0)*(1.0-smoothstep(.487,.49,length(UV-vec2(.5))));
 COLOR=pixel;
}
