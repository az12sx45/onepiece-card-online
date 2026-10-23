extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://kyubi-motion.json"))
static func _length(value: Variant,total: float,start: Vector2,target: Vector2) -> float:
	if value is Dictionary:return {"--kyubi-start-x":start.x,"--kyubi-start-y":start.y,"--kyubi-target-x":target.x,"--kyubi-target-y":target.y}[value.variable]
	return Ease._length(value,total)
static func sample(key: String,seconds: float,extent: Vector2,parent: Vector2,start:=Vector2.ZERO,target:=Vector2.ZERO) -> Dictionary:
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
				result[property]=lerpf(_length(s[0],total,start,target),_length(s[1],total,start,target),s[2])
	return result
