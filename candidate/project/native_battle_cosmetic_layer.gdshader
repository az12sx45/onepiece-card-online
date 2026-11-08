shader_type canvas_item;
render_mode unshaded, blend_mix;

uniform float strength = 1.0;
uniform float brightness = 1.0;
// 0 is normal or the additive half of screen. 1 and 2 are the multiply passes.
uniform int multiply_kind = 0;
varying vec4 tint;

void vertex() {
	tint = COLOR;
}

void fragment() {
	vec4 sample_color = texture(TEXTURE, UV);
	vec3 rgb = sample_color.rgb * brightness;
	float luminance = dot(rgb, vec3(0.213, 0.715, 0.072));
	rgb = (mix(vec3(luminance), rgb, strength) - vec3(0.5)) * strength + vec3(0.5);
	rgb = clamp(rgb, vec3(0.0), vec3(1.0)) * tint.rgb;
	float alpha = sample_color.a * tint.a;
	if (multiply_kind == 1) {
		COLOR = vec4(vec3(1.0) - rgb * alpha, 1.0);
	} else if (multiply_kind == 2) {
		COLOR = vec4(mix(vec3(1.0), rgb, alpha), 1.0);
	} else {
		COLOR = vec4(rgb, alpha);
	}
}
