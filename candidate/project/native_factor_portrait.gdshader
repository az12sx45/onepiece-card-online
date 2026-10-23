shader_type canvas_item;
render_mode unshaded;
// board_game.html: cover, center 16%, scale(1.55), origin 50% 18%, ellipse clip.
uniform vec2 cover_crop = vec2(1.0);
void fragment() {
	vec2 transformed = vec2(0.5, 0.18) + (UV - vec2(0.5, 0.18)) / 1.55;
	vec2 source_uv = (vec2(1.0) - cover_crop) * vec2(0.5, 0.16) + transformed * cover_crop;
	float distance_from_center = length((UV - vec2(0.5)) * 2.0);
	float edge = max(fwidth(distance_from_center), 0.00001);
	float mask = 1.0 - smoothstep(1.0 - edge * 0.5, 1.0 + edge * 0.5, distance_from_center);
	COLOR = texture(TEXTURE, source_uv);
	COLOR.a *= mask;
}
