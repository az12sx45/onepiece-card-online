shader_type canvas_item;
uniform float brightness = 1.0;
uniform float saturation = 1.0;
varying vec4 vertex_tint;
void vertex() { vertex_tint = COLOR; }
void fragment() {
    vec4 pixel = texture(TEXTURE, UV) * vertex_tint;
    float gray = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
    pixel.rgb = mix(vec3(gray), pixel.rgb, saturation) * brightness;
    COLOR = pixel;
}
