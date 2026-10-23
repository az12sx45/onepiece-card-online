extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://oars-motion.json")).catalog
static func _resolved(ops: Array,viewport: Vector2) -> Array:
	var result: Array=ops.duplicate(true)
	for op in result:
		if op.kind=="translate":
			for key in ["x","y"]:
				if op[key][1]=="vw":op[key]=[float(op[key][0])*viewport.x/100.0,"px"]
	return result
static func sample(key: String,seconds: float,extent: Vector2,viewport: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[key];var time:=clampf(seconds/float(motion.duration),0,1)
	var a:=Ease.segment(motion.tracks.opacity,time,motion.easing);var b:=Ease.segment(motion.tracks.transform,time,motion.easing)
	return {"opacity":lerpf(a[0],a[1],a[2]),"transform":Ease._transform(_resolved(b[0],viewport),_resolved(b[1],viewport),b[2],extent)}

