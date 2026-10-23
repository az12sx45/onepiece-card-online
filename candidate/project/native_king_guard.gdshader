shader_type canvas_item;
uniform vec2 extent=vec2(200.0);
vec4 over(vec4 a,vec4 b){float alpha=a.a+b.a*(1.0-a.a);return vec4((a.rgb*a.a+b.rgb*b.a*(1.0-a.a))/max(alpha,.00001),alpha);}
void fragment(){
    vec2 p=UV*extent;float radius=min(extent.x,extent.y)*.48;vec2 q=abs(p-extent*.5)-(extent*.5-vec2(radius));float d=length(max(q,vec2(0)))+min(max(q.x,q.y),0.0)-radius;
    float radial=length(p-extent*.5)/length(extent*.5);vec4 mid=vec4(vec3(255,75,5)/255.0,.32),first=vec4(vec3(255,207,87)/255.0,.08);float t=clamp((radial-.3)/.34,0.0,1.0);vec4 mixed=mix(vec4(first.rgb*first.a,first.a),vec4(mid.rgb*mid.a,mid.a),t);vec4 result=vec4(mixed.rgb/max(mixed.a,.00001),mixed.a*(1.0-clamp((radial-.64)/.08,0.0,1.0)));
    result=over(vec4(vec3(255,85,5)/255.0,.46*exp(-pow(max(-d,0.0)/14.0,2.0)*.5)),result);
    float border=(1.0-smoothstep(-.5,.5,d))*(1.0-smoothstep(2.5,3.5,-d));result=over(vec4(vec3(255,225,134)/255.0,.94*border),result);result.a*=1.0-smoothstep(-.5,.5,d);
    COLOR*=result;
}
