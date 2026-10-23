extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://king-motion.json"))
static func sample(name: String,seconds: float,extent: Vector2,loop:=true) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var t:=maxf(0,seconds/float(motion.duration))
	if loop and motion.repeat:
		var cycle:=int(floor(t));t=fposmod(t,1.0)
		if motion.alternate and cycle%2==1:t=1.0-t
	else:t=minf(t,1.0)
	var result:={"opacity":motion.opacity,"transform":Transform2D.IDENTITY,"filters":[],"positions":[]}
	for property in motion.tracks:
		var segment:=Ease.segment(motion.tracks[property],t,motion.easing)
		match str(property):
			"opacity":result.opacity=lerpf(segment[0],segment[1],segment[2])
			"transform":result.transform=Ease._transform(segment[0],segment[1],segment[2],extent)
			"filter":result.filters=Ease.filters(segment[0],segment[1],segment[2])
			"background-position":
				for i in range(segment[0].size()):result.positions.append(Vector2(segment[0][i][0],segment[0][i][1]).lerp(Vector2(segment[1][i][0],segment[1][i][1]),segment[2]))
	return result
