extends RefCounted
const Shared=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://final-ritual-motion.json"))
static func sample(id: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[id];var t:=clampf(seconds/float(motion.duration),0,1)
	var opacity:=Shared.segment(motion.tracks.opacity,t,motion.easing);var move:=Shared.segment(motion.tracks.transform,t,motion.easing);var filter:=Shared.segment(motion.tracks.filter,t,motion.easing)
	var matrix:=Shared._transform(move[0],move[1],float(move[2]),extent)
	var filters:=Shared.filters(filter[0],filter[1],float(filter[2]))
	for item in filters:
		if item.kind=="drop-shadow":item.blur=maxf(0,item.blur);item.color[3]=clampf(item.color[3],0,1)
		else:item.value=maxf(0,item.value)
	return {"opacity":clampf(lerpf(opacity[0],opacity[1],opacity[2]),0,1),"transform":matrix,"matrix":[matrix.x.x,matrix.x.y,matrix.y.x,matrix.y.y,matrix.origin.x,matrix.origin.y],"filters":filters}

