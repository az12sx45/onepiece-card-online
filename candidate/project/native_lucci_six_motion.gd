extends RefCounted
## Authored source keyframes, evaluated continuously; QA samples are not playback.
const Ease=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://lucci-six-motion.json")).catalog
static func sample(key: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[key];var time:=clampf(seconds/float(motion.duration),0,1)
	var a:=Ease.segment(motion.tracks.opacity,time,motion.easing)
	var b:=Ease.segment(motion.tracks.transform,time,motion.easing)
	var c:=Ease.segment(motion.tracks.filter,time,motion.easing)
	return {"opacity":lerpf(a[0],a[1],a[2]),"transform":Ease._transform(b[0],b[1],b[2],extent),"filters":Ease.filters(c[0],c[1],c[2])}
