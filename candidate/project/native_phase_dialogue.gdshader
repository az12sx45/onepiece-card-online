shader_type canvas_item;
uniform vec2 extent=vec2(960.0,432.0);
void fragment(){
 float radius=length((UV-vec2(.74,.38))*extent)/length(max(vec2(.74,.38),vec2(.26,.62))*extent);
 float red=.2*(1.0-smoothstep(0.0,.28,radius));float black=mix(.08,.28,UV.y);float alpha=red+black*(1.0-red);
 COLOR=vec4(vec3(145.0,5.0,12.0)/255.0*red/max(alpha,.0001),alpha)*COLOR;
}
