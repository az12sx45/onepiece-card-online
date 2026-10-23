extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://attack-motion.json"))
static func sample(name: String,seconds: float) -> Dictionary:
	var motion: Dictionary=data.catalog[name]
	var time:=clampf(seconds/float(motion.duration),0,1)
	var frames: Array=motion.frames
	var left: Dictionary=frames[0];var right: Dictionary=frames[-1]
	for i in range(1,frames.size()):
		if time<=float(frames[i].time):
			left=frames[i-1];right=frames[i];break
	var progress:=Ease._ease(clampf((time-float(left.time))/(float(right.time)-float(left.time)),0,1),motion.easing)
	return {"translation":Vector2(lerpf(left.x,right.x,progress),lerpf(left.y,right.y,progress)),"angle":lerpf(left.angle,right.angle,progress),"scale":lerpf(left.scale,right.scale,progress)}
