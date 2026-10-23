extends RefCounted
const Base=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://sea-train-motion.json")).catalog
static func sample(type: String,name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[type][name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Base.segment(motion.tracks.opacity,time,motion.easing);var movement:=Base.segment(motion.tracks.transform,time,motion.easing);var effect:=Base.segment(motion.tracks.filter,time,motion.easing)
	var filters: Array=Base.filters(effect[0],effect[1],float(effect[2]))
	# These original cubic curves overshoot 1. CSS clamps nonnegative blur and
	# bounded opacity after interpolation, while transforms may overshoot.
	for op in filters:
		if op.kind=="drop-shadow":
			op.blur=maxf(0,op.blur)
			for i in range(4):op.color[i]=clampf(op.color[i],0,1)
		elif op.kind in ["blur","brightness","contrast","saturate"]:op.value=maxf(0,op.value)
	return {"opacity":clampf(lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),0,1),"transform":Base._transform(movement[0],movement[1],float(movement[2]),extent),"filters":filters}
