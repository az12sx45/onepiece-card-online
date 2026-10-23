shader_type canvas_item;
render_mode unshaded;
uniform int kind=0;
varying vec4 tint;
void vertex(){tint=COLOR;}
void fragment(){
 if(kind==0){float y=UV.y;vec4 a=vec4(1.0/255.0,3.0/255.0,9.0/255.0,.42),b=vec4(a.rgb,.97);COLOR=(y<.5?vec4(a.rgb,0.0):y<.69?vec4(a.rgb,a.a*(y-.5)/.19):mix(a,b,clamp((y-.69)/.31,0.0,1.0)))*tint;}
 else{vec4 c=texture(TEXTURE,UV);float gray=dot(c.rgb,vec3(.213,.715,.072));c.rgb=clamp((mix(vec3(gray),c.rgb,1.04)-vec3(.5))*1.03+vec3(.5),vec3(0),vec3(1));COLOR=c*tint;}
}
