shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded;
uniform vec2 box_size=vec2(1.0);
uniform float pad=32.0;
uniform vec4 light_color:source_color=vec4(0.3,1.0,.9,1.0);
uniform vec4 core_color:source_color=vec4(1.0,1.0,.8,1.0);
uniform vec4 rgb_color:source_color=vec4(0.3,1.0,.9,1.0);
uniform bool ring=false;
uniform bool pop=false;
void fragment(){
 vec2 p=UV*(box_size+pad*2.0)-pad;vec2 q=(p-box_size*.5)/(box_size*.5);float d=length(q);
 float edge=(d-1.0)*min(box_size.x,box_size.y)*.5;
 vec4 result;
 if(ring){float line=1.0-smoothstep(1.0,2.0,abs(edge));float glow=exp(-edge*edge/(pop?80.0:50.0))*.65;float a=max(line,glow);result=vec4(mix(light_color.rgb,core_color.rgb,line),a);}
 else{float dist=distance(p,box_size*vec2(.5,.72))/max(length(box_size*vec2(.5,.72)),length(box_size*vec2(.5,.28)));float mask=1.0-smoothstep(.98,1.02,d);float t=clamp(dist/.2,0.0,1.0);vec4 center=mix(core_color,vec4(rgb_color.rgb,.52),t);center.a*=1.0-smoothstep(.2,.68,dist);float inner=exp(-edge*edge/242.0)*.72;float outer=exp(-edge*edge/162.0)*.55;result=vec4(mix(rgb_color.rgb,center.rgb,center.a),max(center.a,inner)*mask+outer*(1.0-mask));}
 COLOR=result*tint;
}
