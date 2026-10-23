extends RefCounted
const Shared=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://kuma-motion.json"))
static func sample(id: String,seconds: float) -> Dictionary:
	var motion: Dictionary=data.catalog[id];var t:=clampf(seconds/float(motion.duration),0,1);var result: Dictionary={}
	for key in motion.tracks:
		var segment:=Shared.segment(motion.tracks[key],t,motion.easing);result[key]=lerpf(segment[0],segment[1],segment[2])
	result.opacity=clampf(result.opacity,0,1);return result
