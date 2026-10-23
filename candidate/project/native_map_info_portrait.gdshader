shader_type canvas_item;
render_mode unshaded;
uniform vec2 cover_crop=vec2(1.0);
uniform bool align_top=false;
void fragment(){
 vec2 offset=(1.0-cover_crop)*.5;if(align_top)offset.y=0.0;
 vec4 image=texture(TEXTURE,UV*cover_crop+offset);
 float radial=clamp(length((UV-vec2(.48,.42))*2.0),0.0,1.0);
 vec3 background=radial<.58?mix(vec3(.290,.659,.792),vec3(.090,.408,.537),radial/.58):mix(vec3(.090,.408,.537),vec3(.039,.220,.325),(radial-.58)/.42);
 float edge=1.0-smoothstep(.492,.5,length(UV-.5));COLOR=vec4(mix(background,image.rgb,image.a),edge);
}
