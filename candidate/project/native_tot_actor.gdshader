shader_type canvas_item;
// All card layers share the parent's plane. Only the portrait receives child
// motion; interpolate texture coordinates projectively after the plane tilts.
uniform mat3 card_to_world = mat3(1.0);
uniform mat3 world_to_card = mat3(1.0);
uniform mat3 parent_motion = mat3(1.0);
uniform mat3 image_motion = mat3(1.0);
uniform vec2 parent_translate = vec2(0.0);
uniform vec2 image_translate = vec2(0.0);
uniform vec2 card_size = vec2(300.0);
uniform bool portrait_layer = false;
uniform vec4 image_rect = vec4(0.0);
uniform vec4 clip_rect = vec4(0.0);
uniform float portrait_radius = 16.0;
uniform bool style_mode = false;
uniform vec4 style_rect = vec4(0.0);
uniform float style_radius = 0.0;
uniform float border_width = 0.0;
uniform vec4 border_color : source_color = vec4(0.0);
uniform float gradient_angle = 0.0;
uniform float gradient_middle = 0.5;
uniform vec4 gradient_a : source_color = vec4(0.0);
uniform vec4 gradient_b : source_color = vec4(0.0);
uniform vec4 gradient_c : source_color = vec4(0.0);
uniform float brightness = 1.0;
uniform float saturation = 1.0;
varying vec2 projected_uv;
varying vec2 projected_clip;
varying vec4 projected_color;
varying float reciprocal_w;
void vertex() {
    vec2 center = card_size * 0.5;
    vec2 world = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
    vec2 local = (world_to_card * vec3(world, 1.0)).xy;
    if (portrait_layer) {
        vec2 image_center = image_rect.z > 0.0 ? image_rect.xy + image_rect.zw * 0.5 : center;
        vec3 child = image_motion * vec3(local - image_center, 1.0);
        local = child.xy / child.z + image_center + image_translate;
    }
    vec3 posed = parent_motion * vec3(local - center, 1.0);
    reciprocal_w = 1.0 / posed.z;
    vec2 destination = posed.xy * reciprocal_w + center + parent_translate;
    vec2 target_world = (card_to_world * vec3(destination, 1.0)).xy;
    VERTEX = (inverse(MODEL_MATRIX) * vec4(target_world, 0.0, 1.0)).xy;
    projected_uv = UV * reciprocal_w;
    projected_clip = local * reciprocal_w;
    projected_color = COLOR * reciprocal_w;
}
float rounded_edge(vec2 point, vec2 extent, float radius) {
    vec2 p = abs(point - extent * 0.5) - (extent * 0.5 - vec2(radius));
    return length(max(p, vec2(0.0))) + min(max(p.x, p.y), 0.0) - radius;
}
vec4 premultiplied_mix(vec4 a, vec4 b, float t) {
    vec4 mixed = mix(vec4(a.rgb * a.a, a.a), vec4(b.rgb * b.a, b.a), clamp(t, 0.0, 1.0));
    return vec4(mixed.rgb / max(mixed.a, 0.00001), mixed.a);
}
void fragment() {
    COLOR = texture(TEXTURE, projected_uv / reciprocal_w) * projected_color / reciprocal_w;
    vec2 local = projected_clip / reciprocal_w;
    if (style_mode) {
        vec2 point = local - style_rect.xy;
        vec2 direction = vec2(sin(gradient_angle), -cos(gradient_angle));
        // CSS background-origin defaults to padding-box and repeats underneath
        // the translucent border, including the opposite edge of the gradient.
        vec2 gradient_extent = max(style_rect.zw - vec2(border_width * 2.0), vec2(1.0));
        vec2 gradient_point = mod(point - vec2(border_width), gradient_extent);
        float length = dot(abs(direction), gradient_extent);
        float t = dot(gradient_point - gradient_extent * 0.5, direction) / max(length, 0.00001) + 0.5;
        vec4 fill = t < gradient_middle ? premultiplied_mix(gradient_a, gradient_b, t / max(gradient_middle, 0.00001)) : premultiplied_mix(gradient_b, gradient_c, (t - gradient_middle) / max(1.0 - gradient_middle, 0.00001));
        float edge = rounded_edge(point, style_rect.zw, style_radius);
        float border_alpha = border_color.a * smoothstep(-border_width - 0.5, -border_width + 0.5, edge);
        float alpha = border_alpha + fill.a * (1.0 - border_alpha);
        COLOR = vec4((border_color.rgb * border_alpha + fill.rgb * fill.a * (1.0 - border_alpha)) / max(alpha, 0.00001), alpha);
        COLOR *= projected_color / reciprocal_w;
        COLOR.a *= 1.0 - smoothstep(-0.5, 0.5, edge);
    }
    if (portrait_layer) {
        vec4 clip = clip_rect.z > 0.0 ? clip_rect : vec4(0.0, 0.0, card_size);
        float edge = rounded_edge(local - clip.xy, clip.zw, portrait_radius);
        COLOR.a *= 1.0 - smoothstep(-0.75, 0.75, edge);
    }
    COLOR.rgb *= brightness;
    float luma = dot(COLOR.rgb, vec3(0.2126, 0.7152, 0.0722));
    COLOR.rgb = mix(vec3(luma), COLOR.rgb, saturation);
}
