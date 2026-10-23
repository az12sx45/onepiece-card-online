shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
render_mode unshaded;
uniform int mode=0;
uniform float glow=0.0;
uniform float breath=0.26;
uniform bool reading=false;
void fragment(){
 vec2 p=UV;vec4 c=vec4(0.0);
 if(mode==0){
  float vignette=smoothstep(.38,1.,length((p-vec2(.5,.48))*vec2(1.6,1.5)));
  c=vec4(0.,0.,0.,vignette*.52+.12*abs(p.x-.5)*2.);
  float light=0.;light+=max(0.,1.-distance(p,vec2(.34,.35))/.17)*.18;light+=max(0.,1.-distance(p,vec2(.66,.35))/.16)*.15;light+=max(0.,1.-distance(p,vec2(.66,.68))/.17)*.13;light+=max(0.,1.-distance(p,vec2(.34,.68))/.16)*.14;
  c.rgb+=vec3(1.,.87,.58)*light*glow;c.a=max(c.a,light*glow);
  float shine=max(0.,1.-abs(p.x+p.y*.47-.75)/.12)*.10*breath;c.rgb+=vec3(1.,.96,.76)*shine;c.a=max(c.a,shine);
  if(reading){float shade=mix(.08,.72,p.y*p.y);c.a=1.-(1.-c.a)*(1.-shade);float purple=max(0.,1.-distance(p,vec2(.78,.18))/.26)*.22;c.rgb+=vec3(.44,.37,.75)*purple;c.a=max(c.a,purple);}
 }else if(mode==1){c=vec4(mix(vec3(.035,.055,.106),vec3(.012,.027,.055),p.y),.95);}
 else{c=vec4(mix(vec3(1.,.91,.65),vec3(.86,.66,.31),p.y),1.);}
 COLOR=c;
 COLOR*=tint;
}
