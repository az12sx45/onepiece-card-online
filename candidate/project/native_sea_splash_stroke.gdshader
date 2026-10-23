shader_type canvas_item;
render_mode unshaded;
void fragment(){
 float t=UV.x;vec4 c;
 if(t<.25)c=mix(vec4(0),vec4(1,1,1,.18),t*4.0);
 else if(t<.5)c=mix(vec4(1,1,1,.18),vec4(.839216,0,0,1),(t-.25)*4.0);
 else if(t<.75)c=mix(vec4(.839216,0,0,1),vec4(1,1,1,.24),(t-.5)*4.0);
 else c=mix(vec4(1,1,1,.24),vec4(0),(t-.75)*4.0);
 COLOR*=c;
}
