shader_type canvas_item;
uniform vec2 card_size = vec2(300.0, 300.0);
uniform float corner_radius = 16.0;
uniform bool king_flame_off = false;
uniform bool intrinsic_top_crop = false;
uniform vec2 portrait_shift = vec2(0.0);
uniform float image_inset = 10.0;
uniform bool attack_motion_active = false;
uniform vec2 attack_translation = vec2(0.0);
uniform float attack_angle = 0.0;
uniform float attack_scale = 1.0;
uniform float idle_translation_y = 0.0;
uniform float hit_translation_x = 0.0;
varying vec2 local_position;
varying vec4 portrait_tint;
void vertex() { local_position = VERTEX; portrait_tint = COLOR; }
void fragment() {
    vec2 box=card_size;
    vec2 p=local_position;
    float inner_radius=corner_radius;
    if (intrinsic_top_crop) {
        box=max(card_size-vec2(image_inset*2.0),vec2(1.0));
        vec2 natural=1.0/TEXTURE_PIXEL_SIZE;
        vec2 rendered=vec2(box.x,max(box.y,box.x*natural.y/natural.x));
        p=local_position-vec2(image_inset);
        vec2 source_position=p-rendered*portrait_shift-vec2(hit_translation_x,idle_translation_y);
        if (attack_motion_active) {
            vec2 center=rendered*.5;
            vec2 q=source_position-center-rendered*attack_translation;
            float c=cos(attack_angle),s=sin(attack_angle);
            source_position=vec2(c*q.x+s*q.y,-s*q.x+c*q.y)/attack_scale+center;
        }
        vec2 source_uv=source_position/rendered;
        COLOR=texture(TEXTURE,clamp(source_uv,vec2(0.0),vec2(1.0)))*portrait_tint;
        if (attack_motion_active && (any(lessThan(source_uv,vec2(0.0))) || any(greaterThan(source_uv,vec2(1.0))))) {
            COLOR=vec4(.02,.06,.1,.6)*portrait_tint;
        }
        inner_radius=max(1.0,corner_radius-image_inset);
    }
    if (king_flame_off) {
        float grey=dot(COLOR.rgb,vec3(.2126,.7152,.0722));
        vec3 value=mix(COLOR.rgb,vec3(grey),.24);
        grey=dot(value,vec3(.2126,.7152,.0722));value=mix(vec3(grey),value,.42)*.7;
        COLOR.rgb=clamp((value-.5)*1.08+.5,vec3(0.0),vec3(1.0));
    }
    vec2 edge = abs(p-box*.5)-(box*.5-vec2(inner_radius));
    float distance_to_edge = length(max(edge,vec2(0.0)))+min(max(edge.x,edge.y),0.0)-inner_radius;
    COLOR.a *= 1.0 - smoothstep(-0.75, 0.75, distance_to_edge);
}
