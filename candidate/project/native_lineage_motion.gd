extends RefCounted
const Base=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://lineage-motion.json")).catalog
static func sample(name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Base.segment(motion.tracks.opacity,time,motion.easing)
	var movement:=Base.segment(motion.tracks.transform,time,motion.easing)
	var left:=Base.segment(motion.tracks.left,time,motion.easing)
	var translate:=Base.segment(motion.tracks.translate,time,motion.easing)
	return {"opacity":lerpf(opacity[0],opacity[1],opacity[2]),"transform":Base._transform(movement[0],movement[1],movement[2],extent),"left":lerpf(left[0],left[1],left[2])*extent.x/100,"translate":Vector2(lerpf(translate[0][0],translate[1][0],translate[2]),lerpf(translate[0][1],translate[1][1],translate[2]))*extent/100}
