shader_type canvas_item;
render_mode unshaded,blend_disabled;
uniform sampler2D source_image: filter_linear_mipmap,repeat_disable;
uniform vec2 surface_size=vec2(1.0);
uniform vec2 box_size=vec2(1.0);
uniform vec2 image_size=vec2(1.0);
uniform float padding=180.0;
uniform bool source_premultiplied=false;
uniform bool source_cover=false;
uniform bool source_fill=false;
uniform vec2 image_alignment=vec2(.5);
void fragment(){
 vec2 p=UV*surface_size-vec2(padding);vec2 ratios=box_size/image_size;vec2 extent=source_fill?box_size:image_size*(source_cover?max(ratios.x,ratios.y):min(ratios.x,ratios.y));vec2 origin=(box_size-extent)*image_alignment;vec2 uv=(p-origin)/extent;vec4 c=vec4(0.0);
 bool clip_ok=!source_cover||(all(greaterThanEqual(p,vec2(0.0)))&&all(lessThanEqual(p,box_size)));
 if(clip_ok&&all(greaterThanEqual(uv,vec2(0.0)))&&all(lessThanEqual(uv,vec2(1.0)))){c=texture(source_image,uv);if(!source_premultiplied)c.rgb*=c.a;}COLOR=c;
}
