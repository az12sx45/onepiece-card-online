extends RefCounted
const Base=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://item-reveal-motion.json")).catalog
static func sample(type: String,name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[type][name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Base.segment(motion.tracks.opacity,time,motion.easing);var movement:=Base.segment(motion.tracks.transform,time,motion.easing);var effect:=Base.segment(motion.tracks.filter,time,motion.easing)
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":Base._transform(movement[0],movement[1],float(movement[2]),extent),"filters":Base.filters(effect[0],effect[1],float(effect[2]))}
