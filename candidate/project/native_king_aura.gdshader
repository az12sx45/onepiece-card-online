shader_type canvas_item;
uniform sampler2D backdrop:hint_screen_texture,repeat_disable,filter_nearest;
uniform vec2 extent=vec2(200.0);
uniform bool lit=true;
uniform vec2 fire_offset=vec2(0.0);
uniform vec2 fire_scale=vec2(1.0);
uniform float fire_opacity=1.0;
uniform float speed_offset=0.0;
uniform vec2 ember_positions[5];
uniform vec2 ash_positions[3];
vec4 over(vec4 a,vec4 b){float opacity=a.a+b.a*(1.0-a.a);return vec4((a.rgb*a.a+b.rgb*b.a*(1.0-a.a))/max(opacity,.00001),opacity);}
float ellipse(vec2 p,vec2 center,vec2 box){return length((p-center)/max(max(center,box-center),vec2(.001)))/sqrt(2.0);}
vec4 flame(vec2 p,vec2 box,vec2 center,float inner,float middle,float edge,float end,vec3 warm,vec3 hot,float a,float b){float t=ellipse(p,box*center,box);if(t<inner)return vec4(warm,a);if(t<middle){float f=(t-inner)/(middle-inner);float opacity=mix(a,b,f);return vec4(mix(warm*a,hot*b,f)/opacity,opacity);}return vec4(hot,b*(1.0-clamp((t-edge)/(end-edge),0.0,1.0)));}
vec4 fire(vec2 p,vec2 box){
    vec4 value=flame(p,box,vec2(.91,.80),.025,.03,.09,.17,vec3(255,218,93)/255.0,vec3(255,75,4)/255.0,.92,.7);
    value=over(flame(p,box,vec2(.68,.92),.03,.04,.10,.18,vec3(255,225,112)/255.0,vec3(255,73,5)/255.0,.9,.72),value);
    value=over(flame(p,box,vec2(.31,.94),.03,.04,.11,.19,vec3(255,231,128)/255.0,vec3(255,67,4)/255.0,.88,.7),value);
    return over(flame(p,box,vec2(.10,.82),.026,.03,.08,.16,vec3(255,221,102)/255.0,vec3(255,83,8)/255.0,.92,.72),value);
}
vec4 speck(vec2 p,vec2 period,vec2 center,vec2 offset,vec3 color,float inner,float outer,float alpha){float d=length(mod(p-offset,period)-period*center);return vec4(color,alpha*(1.0-clamp((d-inner)/(outer-inner),0.0,1.0)));}
void fragment(){
    vec2 p=UV*extent;vec4 base=texture(backdrop,SCREEN_UV);vec4 layer;
    if(lit){
        layer=mix(vec4(255.0,136.0,30.0,.04*255.0),vec4(91.0,8.0,0.0,.18*255.0),UV.y)/255.0;
        float glow=.4*(1.0-clamp(ellipse(p,extent*vec2(.5,1.06),extent)/.55,0.0,1.0));layer=over(vec4(vec3(255,62,5)/255.0,glow),layer);
        vec2 box=extent*vec2(1.16,1.34);vec2 q=(p+extent*vec2(.08,.14)-box*.5-fire_offset)/fire_scale+box*.5;
        vec4 f=fire(q,box);f.rgb=clamp(mix(vec3(dot(f.rgb,vec3(.2126,.7152,.0722))),f.rgb,1.3),vec3(0),vec3(1));f.a*=fire_opacity;layer=over(f,layer);
        vec2 e=p-extent*.04;vec4 sparks=vec4(0);
        sparks=over(speck(e,vec2(41,57),vec2(.54,.18),ember_positions[4],vec3(255,196,92)/255.0,1.0,2.0,.72),sparks);
        sparks=over(speck(e,vec2(59,67),vec2(.86,.32),ember_positions[3],vec3(255,122,36)/255.0,1.0,2.0,.72),sparks);
        sparks=over(speck(e,vec2(37,53),vec2(.71,.65),ember_positions[2],vec3(255,215,109)/255.0,1.2,2.4,.72),sparks);
        sparks=over(speck(e,vec2(47,61),vec2(.30,.42),ember_positions[1],vec3(255,142,56)/255.0,1.0,2.0,.72),sparks);
        sparks=over(speck(e,vec2(31,43),vec2(.14,.76),ember_positions[0],vec3(255,215,116)/255.0,1.0,2.0,.72),sparks);
        if(all(greaterThanEqual(UV,vec2(.04)))&&all(lessThanEqual(UV,vec2(.96))))layer=over(sparks,layer);
        base.rgb=mix(base.rgb,vec3(1.0)-(vec3(1.0)-base.rgb)*(vec3(1.0)-layer.rgb),layer.a);
    }else{
        float r=ellipse(p,extent*.5,extent);layer=vec4(0,16.0/255.0,28.0/255.0,.56*clamp((r-.38)/.62,0.0,1.0));
        vec2 axis=vec2(sin(radians(110.0)),-cos(radians(110.0)));float span=dot(abs(axis),extent);float t=clamp(dot(p-extent*.5,axis)/span+.5,0.0,1.0);
        vec4 a=vec4(3.0/255.0,16.0/255.0,30.0/255.0,.5),b=vec4(11.0/255.0,54.0/255.0,75.0/255.0,.2),c=vec4(1.0/255.0,7.0/255.0,15.0/255.0,.58);
        vec4 gradient=t<.48?mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),t/.48):mix(vec4(b.rgb*b.a,b.a),vec4(c.rgb*c.a,c.a),(t-.48)/.52);layer=over(vec4(gradient.rgb/max(gradient.a,.00001),gradient.a),layer);
        vec2 box=extent*vec2(2.2,1.56),q=p+extent*vec2(.6,.28)-vec2(speed_offset,0);axis=vec2(sin(radians(164.0)),-cos(radians(164.0)));float stripe=mod(dot(q-box*.5,axis)/dot(abs(axis),box)+.5,.15);float line=clamp((stripe-.07)/.004,0.0,1.0)*(1.0-clamp((stripe-.078)/.004,0.0,1.0))*.55*.88;layer=over(vec4(vec3(127,224,255)/255.0,line),layer);
        layer=over(speck(p,vec2(43,59),vec2(.41,.72),ash_positions[2],vec3(153,193,205)/255.0,1.0,2.0,.4*.7),layer);
        layer=over(speck(p,vec2(53,47),vec2(.72,.36),ash_positions[1],vec3(175,211,222)/255.0,1.2,2.4,.42*.7),layer);
        layer=over(speck(p,vec2(37,31),vec2(.18,.22),ash_positions[0],vec3(202,230,236)/255.0,1.0,2.0,.48*.7),layer);
        base.rgb=mix(base.rgb,base.rgb*layer.rgb,layer.a);
    }
    vec2 edge=abs(p-extent*.5)-(extent*.5-vec2(16));float d=length(max(edge,vec2(0)))+min(max(edge.x,edge.y),0.0)-16.0;
    COLOR=vec4(base.rgb,base.a*(1.0-smoothstep(-.75,.75,d)));
}
