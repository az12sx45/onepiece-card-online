shader_type canvas_item;
varying vec4 tint;
void vertex(){tint=COLOR;}
uniform bool sweep=false;
uniform float diameter=300.0;
void fragment(){
 vec2 p=(UV-.5)*diameter;float radius=diameter*.5;float d=length(p);float border=1.0-smoothstep(1.2,2.5,abs(d-(radius-2.0)));
 if(sweep){
  float angle=mod(degrees(atan(p.x,-p.y))-12.0+360.0,23.0);
  float aa=degrees(1.0/max(d,1.0));float alpha=smoothstep(8.0-aa,9.0+aa,angle)*(1.0-smoothstep(11.0-aa,12.0+aa,angle))*.45;
  COLOR=vec4(vec3(80.0,229.0,255.0)/255.0,alpha*(1.0-smoothstep(radius-1.0,radius+1.0,d)));
 }else{
  float glow=exp(-pow(abs(d-radius)/18.0,2.0))*.72;
  float inner=exp(-pow(abs(d-radius)/32.0,2.0))*.28*step(d,radius);
  COLOR=vec4(vec3(90.0,228.0,255.0)/255.0,max(border*.78,max(glow,inner)));
 }
 COLOR*=tint;
}
