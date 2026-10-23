shader_type canvas_item;
render_mode unshaded;
uniform sampler2D portrait:filter_linear_mipmap,repeat_disable;
uniform vec2 image_size=vec2(1.0);
uniform vec2 box_size=vec2(1.0);
void fragment(){
 vec2 extent=image_size*max(box_size.x/image_size.x,box_size.y/image_size.y);
 vec2 uv=(UV*box_size-vec2((box_size.x-extent.x)*.5,0.0))/extent;
 vec4 c=texture(portrait,uv);float mask=1.0-smoothstep(.49,.5,length(UV-.5));
 COLOR=vec4(c.rgb,c.a*mask);
}
