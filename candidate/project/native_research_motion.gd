extends RefCounted
const Base=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://research-motion.json")).catalog
static func sample(type: String,name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[type][name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Base.segment(motion.tracks.opacity,time,motion.easing);var movement:=Base.segment(motion.tracks.transform,time,motion.easing);var effect:=Base.segment(motion.tracks.filter,time,motion.easing)
	var clip:=Base.segment(motion.tracks.clip,time,motion.easing);var origin:=Base.segment(motion.tracks.origin,time,motion.easing)
	var clipping: Array=[];var pivot: Array=[]
	for i in range(3):clipping.append(lerpf(clip[0][i],clip[1][i],clip[2]))
	for i in range(2):pivot.append(lerpf(origin[0][i],origin[1][i],origin[2]))
	return {"clip":clipping,"origin":pivot,"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":Base._transform(movement[0],movement[1],float(movement[2]),extent),"filters":effect[1] if float(effect[2])>=1 else effect[0] if float(effect[2])<=0 else Base.filters(effect[0],effect[1],float(effect[2]))}
