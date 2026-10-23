shader_type canvas_item;
render_mode unshaded;
uniform vec2 box_size=vec2(160.0,180.0);
uniform float angle=0.0;
uniform float card_scale=1.0;
uniform float brightness=0.68;
uniform float gray=0.0;
uniform bool reflection=false;
varying vec2 uv_over_w;
varying float one_over_w;
void vertex(){
 vec2 point=(VERTEX-box_size*.5)*card_scale;
 float z=-sin(angle)*point.x;
 float w=1.0+z/900.0;
 VERTEX=vec2(cos(angle)*point.x,point.y)/w+box_size*.5;
 uv_over_w=UV/w;one_over_w=1.0/w;
}
void fragment(){
 vec2 uv=uv_over_w/one_over_w;
 if(reflection)uv.y=1.0-uv.y;
 vec4 c=texture(TEXTURE,uv);float lum=dot(c.rgb,vec3(.2126,.7152,.0722));
 c.rgb=mix(c.rgb,vec3(lum),gray)*brightness;
 if(reflection)c.a*=.22*(1.0-smoothstep(0.0,.88,1.0-uv.y));
 COLOR*=c;
}
