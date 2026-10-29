shader_type canvas_item;
uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform int damage_mode = 0;
void fragment() {
    vec2 p = UV;
    if (damage_mode == 1) p.x += sin(p.y * 35.0 + progress * 12.0) * progress * 0.035;
    vec4 card = texture(TEXTURE, p);
    float noise = fract(sin(dot(floor(UV * 100.0), vec2(12.9898,78.233))) * 43758.5453);
    float dist = length((UV - vec2(0.5)) * vec2(1.0,1.35));
    float mask = smoothstep(progress * 1.1 - 0.035, progress * 1.1 + 0.035, dist + noise * 0.035);
    if (damage_mode == 1) mask = smoothstep(progress - 0.02, progress + 0.02, 1.0 - UV.y + noise * 0.08);
    if (damage_mode == 2) mask = step(progress, noise);
    float edge = clamp(1.0 - abs(dist - progress * 1.1) * 25.0, 0.0, 1.0);
    card.rgb = mix(card.rgb, vec3(1.0,0.3,0.025), edge * progress * 2.0);
    card.a *= progress < 0.001 ? 1.0 : mask;
    COLOR = card * COLOR;
}
