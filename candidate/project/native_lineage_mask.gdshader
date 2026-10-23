shader_type canvas_item;
uniform bool launcher_hole=false;
uniform bool circle=false;
uniform vec4 crop=vec4(0.0);
void fragment(){
 vec4 pixel=texture(TEXTURE,UV)*COLOR;
 if(launcher_hole){float d=length((UV-vec2(.247,.466))/vec2(.132,.2347));pixel.a*=smoothstep(.974,.995,d);}
 if(circle)pixel.a*=1.0-smoothstep(.487,.49,length(UV-vec2(.5)));
 pixel.a*=step(crop.w,UV.x)*step(crop.x,UV.y)*step(UV.x,1.0-crop.y)*step(UV.y,1.0-crop.z);
 COLOR=pixel;
}
