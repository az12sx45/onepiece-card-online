extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://sanji-motion.json"))
static func sample(key: String,seconds: float,extent: Vector2,parent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[key];var t:=clampf(seconds/float(motion.duration),0,1)
	var result:={"opacity":1.0,"transform":Transform2D.IDENTITY,"filters":[],"left":parent.x*.5,"top":parent.y*.48}
	for property in motion.tracks:
		var s:=Ease.segment(motion.tracks[property],t,motion.easing)
		match str(property):
			"opacity":result.opacity=lerpf(s[0],s[1],s[2])
			"transform":result.transform=Ease._transform(s[0],s[1],s[2],extent)
			"filter":result.filters=Ease.filters(s[0],s[1],s[2])
			"left","top":
				var total:=parent.x if property=="left" else parent.y
				result[property]=lerpf(Ease._length(s[0],total),Ease._length(s[1],total),s[2])
	return result
