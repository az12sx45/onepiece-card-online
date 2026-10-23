shader_type canvas_item;
uniform vec4 crop=vec4(0.0);
void fragment(){
 vec2 extent=vec2(textureSize(TEXTURE,0));extent/=max(extent.x,extent.y);
 vec2 uv=(UV-vec2(.5))/extent+vec2(.5);
 vec4 pixel=texture(TEXTURE,clamp(uv,vec2(0),vec2(1)))*COLOR;
 pixel.a*=step(0.0,uv.x)*step(0.0,uv.y)*step(uv.x,1.0)*step(uv.y,1.0);
 pixel.a*=step(crop.w,UV.x)*step(crop.x,UV.y)*step(UV.x,1.0-crop.y)*step(UV.y,1.0-crop.z);
 COLOR=pixel;
}
