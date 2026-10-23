shader_type canvas_item;
render_mode unshaded;
uniform sampler2D portrait:filter_linear_mipmap,repeat_disable;
uniform vec2 image_size=vec2(1.0);
uniform vec2 box_size=vec2(1.0);
uniform vec3 circle=vec3(100.0,50.0,50.0);
uniform bool bubble=false;
void fragment(){
 vec2 p=UV*box_size;vec2 extent=image_size*max(box_size.x/image_size.x,box_size.y/image_size.y);
 vec2 uv=(p-vec2((box_size.x-extent.x)*.5,0.0))/extent;
 vec4 c=texture(portrait,uv);
 vec2 r=box_size*vec2(bubble?.48:.45,UV.y<.5?(bubble?.48:.45):(bubble?.42:.38));
 vec2 d=(abs(p-box_size*.5)-(box_size*.5-r))/r;float rounded=length(max(d,vec2(0.0)));
 float mask=1.0-smoothstep(.98,1.02,rounded);
 if(bubble){float radius=circle.x*.01*length(box_size)/sqrt(2.0);float dist=distance(p,box_size*circle.yz*.01);mask*=1.0-smoothstep(radius-.5,radius+.5,dist);}
 COLOR=vec4(c.rgb,c.a*mask);
}
