shader_type canvas_item;
uniform vec2 viewport_size=vec2(740.0,360.0);
vec4 over(vec4 a,vec4 b){float alpha=a.a+b.a*(1.0-a.a);return vec4((a.rgb*a.a+b.rgb*b.a*(1.0-a.a))/max(alpha,.00001),alpha);}
void fragment(){
    vec2 center=viewport_size*vec2(.5,.44);
    float radius=length(max(center,viewport_size-center));
    float t=length(UV*viewport_size-center)/max(radius,.001);
    vec4 mid=vec4(38.0/255.0,0.0,16.0/255.0,.2),end=vec4(2.0/255.0,0.0,7.0/255.0,.82);
    vec4 radial=vec4(0.0);
    if(t>.36&&t<.68){radial=mid;radial.a*=clamp((t-.36)/.32,0.0,1.0);}
    else if(t>=.68){float f=clamp((t-.68)/.32,0.0,1.0);vec4 p=mix(vec4(mid.rgb*mid.a,mid.a),vec4(end.rgb*end.a,end.a),f);radial=vec4(p.rgb/max(p.a,.00001),p.a);}
    float vertical=UV.y<.26?mix(.34,0.0,UV.y/.26):UV.y>.68?mix(0.0,.82,(UV.y-.68)/.32):0.0;
    COLOR*=over(radial,vec4(0.0,0.0,0.0,vertical));
}
