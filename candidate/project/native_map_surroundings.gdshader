shader_type canvas_item;
render_mode unshaded;
// Existing board_game.html body, body::before and viewport backgrounds.
// This canvas stays behind the moving world; it never overlays map artwork.
uniform vec2 extent=vec2(960.0,480.0);
vec3 over(vec3 base,vec4 front){return mix(base,front.rgb,front.a);}
float cloud(vec2 uv,vec2 origin,float stop,float opacity){
 vec2 farthest=max(origin,vec2(1.0)-origin)*extent;
 return opacity*clamp(1.0-length((uv-origin)*extent)/(length(farthest)*stop),0.0,1.0);
}
void fragment(){
 vec2 pixels=vec2(textureSize(TEXTURE,0));
 float cover=max(extent.x/pixels.x,extent.y/pixels.y);
 vec2 coord=(UV-.5)*extent/(pixels*cover)+.5;
 vec3 base=texture(TEXTURE,coord).rgb;
 base=over(base,mix(vec4(242.0,250.0,255.0,35.7),vec4(128.0,200.0,232.0,25.5),UV.y)/255.0);
 float a=cloud(UV,vec2(.79,.25),.05,.56);
 a=1.0-(1.0-a)*(1.0-cloud(UV,vec2(.72,.21),.07,.8));
 a=1.0-(1.0-a)*(1.0-cloud(UV,vec2(.29,.25),.06,.58));
 a=1.0-(1.0-a)*(1.0-cloud(UV,vec2(.21,.28),.07,.78));
 vec4 haze=UV.y<.38?mix(vec4(247.0,252.0,255.0,56.1),vec4(242.0,250.0,255.0,25.5),UV.y/.38)/255.0:mix(vec4(242.0,250.0,255.0,25.5),vec4(104.0,181.0,216.0,20.4),(UV.y-.38)/.62)/255.0;
 vec3 premult=vec3(a)*(1.0-haze.a)+haze.rgb*haze.a;
 float combined=a+(1.0-a)*haze.a;
 base=base*(1.0-combined*.72)+premult*.72;
 COLOR=vec4(over(base,vec4(1.0,1.0,1.0,mix(.12,.04,UV.y))),1.0);
}
