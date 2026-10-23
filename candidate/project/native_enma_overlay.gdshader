shader_type canvas_item;
uniform vec2 viewport_size = vec2(740.0, 360.0);
uniform bool flash = false;
uniform bool reclaim = false;
float circle_distance(vec2 point,vec2 center) {
    vec2 farthest = max(center, viewport_size - center);
    return length(point - center) / max(length(farthest), 0.001);
}
vec4 blend_over(vec4 top,vec4 bottom) {
    float alpha = top.a + bottom.a * (1.0 - top.a);
    return vec4((top.rgb * top.a + bottom.rgb * bottom.a * (1.0 - top.a)) / max(alpha, 0.00001), alpha);
}
void fragment() {
    vec2 point = UV * viewport_size;
    if (flash) {
        float t = circle_distance(point, viewport_size * vec2(0.38,0.48));
        vec4 first = reclaim ? vec4(1.0,241.0/255.0,193.0/255.0,0.42) : vec4(220.0/255.0,178.0/255.0,1.0,0.5);
        vec4 middle = reclaim ? vec4(128.0/255.0,48.0/255.0,218.0/255.0,0.22) : vec4(123.0/255.0,31.0/255.0,219.0/255.0,0.18);
        float stop = reclaim ? 0.4 : 0.34;
        float end = reclaim ? 0.72 : 0.7;
        vec4 a = vec4(first.rgb * first.a,first.a);
        vec4 b = vec4(middle.rgb * middle.a,middle.a);
        vec4 result = t < stop ? mix(a,b,clamp(t/stop,0.0,1.0)) : b * (1.0-clamp((t-stop)/(end-stop),0.0,1.0));
        COLOR *= vec4(result.rgb/max(result.a,0.00001),result.a);
    } else {
        float vertical = UV.y < 0.23 ? mix(0.46,0.0,UV.y/0.23) : UV.y > 0.57 ? mix(0.0,0.8,(UV.y-0.57)/0.43) : 0.0;
        float radial = clamp((circle_distance(point,viewport_size*vec2(0.36,0.42))-0.28)/0.72,0.0,1.0)*0.3;
        COLOR *= blend_over(vec4(1.0/255.0,0.0,5.0/255.0,vertical),vec4(4.0/255.0,0.0,10.0/255.0,radial));
    }
}
