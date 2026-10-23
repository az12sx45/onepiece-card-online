extends RefCounted
## Authored original CSS keyframes. Browser samples are verification only.
const Shared=preload('res://native_evolution_motion.gd')
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string('res://rokuogan-motion.json'))
static func sample(name: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var time:=clampf(seconds/float(motion.duration),0,1)
	var opacity:=Shared.segment(motion.tracks.opacity,time,motion.easing)
	var move:=Shared.segment(motion.tracks.transform,time,motion.easing)
	var filter:=Shared.segment(motion.tracks.filter,time,motion.easing)
	var background:=Shared.segment(motion.tracks.background,time,motion.easing)
	var a: Array=background[0];var b: Array=background[1];var alpha:=lerpf(a[3],b[3],background[2]);var color:=Color(0,0,0,alpha)
	for c in range(3):color[c]=lerpf(float(a[c])*float(a[3]),float(b[c])*float(b[3]),background[2])/alpha if alpha>0 else 0
	return {'opacity':lerpf(opacity[0],opacity[1],opacity[2]),'transform':Shared._transform(move[0],move[1],move[2],extent),'filters':Shared.filters(filter[0],filter[1],filter[2]),'background':color}

static func layout(extent: Vector2) -> Dictionary:
	var compact:=extent.x<=960 or extent.y<=560
	var impact:=minf(minf(extent.x,extent.y)*(.78 if compact else .84),620 if compact else 880)
	return {'cast':Rect2(Vector2.ZERO,extent),'impact':Rect2(extent*Vector2(.28 if compact else .27,.53),Vector2.ONE*impact),'shock':Rect2(extent*-.18,extent*1.36)}
