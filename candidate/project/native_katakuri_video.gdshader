shader_type canvas_item;
varying vec4 vertex_tint;
void vertex(){vertex_tint=COLOR;}
void fragment(){
    vec4 sample=texture(TEXTURE,UV);
    float grey=dot(sample.rgb,vec3(.2126,.7152,.0722));
    sample.rgb=clamp(((mix(vec3(grey),sample.rgb,1.08)-.5)*1.06+.5)*.88,vec3(0.0),vec3(1.0));
    COLOR=sample*vertex_tint;
}
