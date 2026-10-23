extends RefCounted
const Shared=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://battle-entry-motion.json"))
static func sample(name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Shared.segment(motion.tracks.opacity,time,motion.easing)
	var movement:=Shared.segment(motion.tracks.transform,time,motion.easing)
	var left: Array=movement[0].duplicate(true);var right: Array=movement[1].duplicate(true)
	if name=="battleMapShakeTwice":
		for operations in [left,right]:
			if operations.size()==1:operations.append({"kind":"rotate","angle":0.0})
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":Shared._transform(left,right,float(movement[2]),extent)}
