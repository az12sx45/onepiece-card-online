shader_type canvas_item;
render_mode unshaded;
varying vec4 tint;
void vertex(){tint=COLOR;}
uniform vec2 extent=vec2(40.0);
uniform bool cover=false;
uniform vec2 alignment=vec2(.5);
uniform float radius=0.0;
uniform bool grayscale=false;
void fragment(){
 vec2 source_size=vec2(textureSize(TEXTURE,0));vec2 ratios=extent/source_size;
 vec2 image_size=source_size*(cover?max(ratios.x,ratios.y):min(ratios.x,ratios.y));
 vec2 origin=(extent-image_size)*alignment;vec2 uv=(UV*extent-origin)/image_size;
 vec4 c=vec4(0.0);if(all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0))))c=texture(TEXTURE,uv);
 vec2 q=abs(UV*extent-extent*.5)-(extent*.5-vec2(radius));
 float edge=length(max(q,vec2(0.0)))+min(max(q.x,q.y),0.0)-radius;c.a*=1.0-smoothstep(-.5,.5,edge);
 if(grayscale)c.rgb=vec3(dot(c.rgb,vec3(.2126,.7152,.0722)));
 COLOR=c*tint;
}
