extends RefCounted
const Shared=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://marineford-motion.json")).catalog
static func sample(name: String,elapsed: float,extent: Vector2,bolt_angle:=0.0) -> Dictionary:
	var motion: Dictionary=catalog[name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Shared.segment(motion.tracks.opacity,time,motion.easing)
	var movement:=Shared.segment(motion.tracks.transform,time,motion.easing)
	var effects:=Shared.segment(motion.tracks.filter,time,motion.easing)
	var left: Array=movement[0].duplicate(true);var right: Array=movement[1].duplicate(true)
	for track in [left,right]:
		for operation in track:
			if operation.get("variable","")=="--bolt-angle":operation.angle=bolt_angle
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":Shared._transform(left,right,float(movement[2]),extent),"filters":Shared.filters(effects[0],effects[1],float(effects[2]))}
