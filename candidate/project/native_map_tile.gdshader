shader_type canvas_item;
render_mode unshaded;
uniform vec2 tile_size=vec2(48.0);
uniform float padding=20.0;
uniform float radius=4.0;
uniform float border_width=1.0;
uniform vec4 top_color=vec4(1.0);
uniform vec4 bottom_color=vec4(1.0);
uniform vec4 border_color=vec4(1.0);
uniform vec4 outline_color=vec4(1.0);
uniform float outline_width=3.0;
uniform float outline_offset=1.0;
uniform float period=0.0;
uniform vec2 opacity_range=vec2(1.0);
uniform float phase_override=-1.0;
uniform float source_phase=0.0;
uniform int shadow_count=0;
uniform vec4 shadow_geometry_start[3];
uniform vec4 shadow_geometry_peak[3];
uniform vec4 shadow_color_start[3];
uniform vec4 shadow_color_peak[3];
varying vec4 tint;
void vertex(){tint=COLOR;}
float ease(float x){
	float t=x;
	for(int i=0;i<6;i++){
		float u=1.0-t;
		float bx=3.0*u*u*t*.42+3.0*u*t*t*.58+t*t*t;
		float dx=3.0*u*u*.42+6.0*u*t*.16+3.0*t*t*.42;
		t=clamp(t-(bx-x)/max(dx,.001),0.0,1.0);
	}
	return t*t*(3.0-2.0*t);
}
float rounded_distance(vec2 p,vec2 half_size,float r){
	vec2 q=abs(p)-half_size+vec2(r);
	return length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-r;
}
float shape(float distance){return 1.0-smoothstep(-.5,.5,distance);}
float gaussian_tail(float x){
	float a=abs(x)/sqrt(2.0),t=1.0/(1.0+.3275911*a);
	float erf=1.0-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-a*a);
	return .5*(1.0-sign(x)*erf);
}
vec4 over(vec4 base,vec4 color,float coverage){
	float alpha=color.a*coverage;
	return vec4(color.rgb*alpha+base.rgb*(1.0-alpha),alpha+base.a*(1.0-alpha));
}
float blurred_box(vec2 p,vec2 half_size,float r,float sigma){
	// Finite rectangle convolution prevents the infinite-edge halo produced
	// by blurring only a signed distance. Account for rounded corner cutouts.
	float x=gaussian_tail((abs(p.x)-half_size.x)/sigma)-gaussian_tail((abs(p.x)+half_size.x)/sigma);
	float y=gaussian_tail((abs(p.y)-half_size.y)/sigma)-gaussian_tail((abs(p.y)+half_size.y)/sigma);
	float removed=0.0;
	vec2 center=half_size-vec2(.22336794*r);
	for(int k=0;k<4;k++){
		vec2 corner=center*vec2(k<2?-1.0:1.0,k%2==0?-1.0:1.0);
		vec2 delta=p-corner;
		removed+=.21460184*r*r/(6.2831853*sigma*sigma)*exp(-dot(delta,delta)/(2.0*sigma*sigma));
	}
	return clamp(x*y-removed,0.0,1.0);
}
void fragment(){
	float progress=phase_override>=0.0?phase_override:source_phase;
	if(period<=0.0)progress=0.0;
	vec2 p=UV*(tile_size+2.0*padding)-padding-tile_size*.5;
	float d=rounded_distance(p,tile_size*.5,radius);
	float body=shape(d);
	vec4 result=vec4(0.0);
	for(int i=2;i>=0;i--){
		if(i>=shadow_count)continue;
		vec4 g=mix(shadow_geometry_start[i],shadow_geometry_peak[i],progress);
		vec4 color=mix(shadow_color_start[i],shadow_color_peak[i],progress);
		float sd=rounded_distance(p-g.xy,tile_size*.5+vec2(g.w),max(0.0,radius+g.w));
		float coverage=g.z>0.0?blurred_box(p-g.xy,tile_size*.5+vec2(g.w),max(0.0,radius+g.w),max(.001,g.z*.5)):shape(sd);
		result=over(result,color,coverage*(1.0-body));
	}
	vec4 gradient=mix(top_color,bottom_color,clamp((p.y+tile_size.y*.5-border_width)/(tile_size.y-2.0*border_width),0.0,1.0));
	result=over(result,gradient,body);
	result=over(result,border_color,body-shape(d+border_width));
	float outline=shape(d-outline_offset-outline_width)-shape(d-outline_offset);
	result=over(result,outline_color,outline);
	COLOR=vec4(result.a>.00001?result.rgb/result.a:vec3(0.0),result.a*mix(opacity_range.x,opacity_range.y,progress))*tint;
}

