extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://enma-motion.json"))
static func sample(name: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var t:=clampf(seconds/float(motion.duration),0,1);var value:={"transform":Transform2D.IDENTITY,"opacity":1.0,"filters":[]}
	for property in motion.tracks:
		var segment:=Ease.segment(motion.tracks[property],t,motion.easing)
		match str(property):
			"transform":value.transform=Ease._transform(segment[0],segment[1],segment[2],extent)
			"filter":value.filters=Ease.filters(segment[0],segment[1],segment[2])
			"opacity":value.opacity=lerpf(segment[0],segment[1],segment[2])
	return value
