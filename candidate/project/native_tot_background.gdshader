shader_type canvas_item;
render_mode unshaded;
uniform float camera = 0.0;
uniform vec2 viewport_size = vec2(740.0,360.0);
void fragment(){
 vec2 p=UV;
 vec2 sample_uv=vec2((p.x+0.08)/1.16,(p.y+2.0*(1.0-camera))/3.0);
 vec4 art=texture(TEXTURE,sample_uv);
 float gray=dot(art.rgb,vec3(.2126,.7152,.0722));
 art.rgb=mix(vec3(gray),art.rgb,mix(1.08,1.12,camera))*mix(.94,1.02,camera);
 // Original two pane tints remain separate from the source texture.
 bool song=p.x>=.5;
 vec3 tint=song?vec3(.145,.021,.166):vec3(.014,.091,.183);
 art.rgb=mix(art.rgb,tint,.09);
 vec2 point=p*viewport_size;
 float shift=mix(-54.0,54.0,mod(TIME,1.1)/1.1);
 float stripe=mod(dot(point-vec2(shift,0.0),vec2(.927184,.374607)),96.0);
 float line=step(43.0,stripe)*(1.0-step(46.0,stripe))*.09*.42;
 art.rgb=mix(art.rgb,vec3(1.0),line);
 COLOR=vec4(art.rgb,1.0);
}
