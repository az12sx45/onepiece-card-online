shader_type canvas_item;
render_mode unshaded;
uniform float period=1.2;
uniform vec2 opacity_range=vec2(.9,1.0);
uniform float phase_override=-1.0;
uniform float source_phase=0.0;
uniform vec2 logical_size=vec2(30.0);
varying vec4 tint;
void vertex(){tint=COLOR;}
float ease(float x){
	float t=x;
	for(int i=0;i<6;i++){float u=1.0-t;float bx=3.0*u*u*t*.42+3.0*u*t*t*.58+t*t*t;float dx=3.0*u*u*.42+6.0*u*t*.16+3.0*t*t*.42;t=clamp(t-(bx-x)/max(dx,.001),0.0,1.0);}
	return t*t*(3.0-2.0*t);
}
void fragment(){
	float p=phase_override>=0.0?phase_override:source_phase;
	vec4 ink=texture(TEXTURE,UV);
	float shadow=0.0;
	for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
		vec2 uv=UV-(vec2(1.0,2.0)+vec2(float(x),float(y))*2.0)/logical_size;
		if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)continue;
		float weight=exp(-.5*float(x*x+y*y))/6.168924;
		shadow+=texture(TEXTURE,uv).a*weight;
	}
	float alpha=ink.a+shadow*.72*(1.0-ink.a);
	COLOR=vec4(alpha>.00001?ink.rgb*ink.a/alpha:vec3(0.0),alpha)*tint;
	COLOR.a*=mix(opacity_range.x,opacity_range.y,p);
}

