shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded;
uniform int mode=0;
uniform vec2 extent=vec2(1.);
uniform vec2 core=vec2(0.);
uniform float grid_opacity=.42;
uniform vec2 box=vec2(34.);
uniform float padding=100.;
void fragment(){
 vec2 p=UV*extent;vec4 c=vec4(0.);
 if(mode==0){
  vec2 radius=max(max(core,extent-core),vec2(1.));float d=length((p-core)/radius);
  if(d<.18)c=mix(vec4(.278,1.,.588,.34),vec4(.102,.855,.435,.2),smoothstep(.06,.18,d));else if(d<.45)c=mix(vec4(.102,.855,.435,.2),vec4(.008,.075,.071,.5),smoothstep(.18,.45,d));else c=mix(vec4(.008,.075,.071,.5),vec4(0.,.016,.035,.82),smoothstep(.45,.78,d));
  vec4 base=mix(vec4(.004,.063,.071,.52),vec4(0.,.02,.039,.78),UV.y);c.rgb=mix(base.rgb,c.rgb,c.a);c.a=1.-(1.-c.a)*(1.-base.a);
  vec2 cell=mod(p-core+43.,86.);float line=max(1.-step(1.,cell.x),1.-step(1.,cell.y))*.22*grid_opacity*(1.-smoothstep(.44,.76,d));c.rgb=mix(c.rgb,vec3(.412,1.,.682),line);c.a=max(c.a,line);
 }else{
  vec2 q=UV*(box+vec2(padding*2.))-padding-box*.5;
  if(mode==1){float center=exp(-pow(abs(q.y)/3.,2.));float halo=exp(-abs(q.y)/18.)*.45;float ends=smoothstep(0.,.09,UV.x)*(1.-smoothstep(.91,1.,UV.x));c=vec4(mix(vec3(.216,1.,.506),vec3(.835,1.,.882),center),max(center,halo)*ends);}
  else if(mode==2){float r=length(q)/17.;float solid=1.-smoothstep(.38,.74,r);float halo=exp(-length(q)/36.)*.58;c=vec4(mix(vec3(.08,.788,.408),vec3(.973,1.,.949),1.-smoothstep(.14,.62,r)),max(solid,halo));}
  else{float r=length(q)/115.;float ring=(1.-smoothstep(1.,1.018,r))*smoothstep(.982,1.,r)*.62;float glow=exp(-length(q)/72.)*.48;float inner=(1.-smoothstep(.07,.66,r))*.62;c=vec4(mix(vec3(.278,1.,.573),vec3(.953,1.,.933),1.-smoothstep(.07,.22,r)),max(max(ring,inner),glow));}
 }
 COLOR=c;
 COLOR*=tint;
}
