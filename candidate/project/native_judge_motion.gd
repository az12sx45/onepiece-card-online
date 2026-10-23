extends RefCounted
const Interpolation=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://judge-motion.json"))
static func sample(key: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[key]
	var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Interpolation.segment(motion.tracks.opacity,time,motion.easing)
	var movement:=Interpolation.segment(motion.tracks.transform,time,motion.easing)
	var effect:=Interpolation.segment(motion.tracks.filter,time,motion.easing)
	return {"opacity":lerpf(opacity[0],opacity[1],opacity[2]),"transform":Interpolation._transform(movement[0],movement[1],movement[2],extent),"filters":Interpolation.filters(effect[0],effect[1],effect[2])}
