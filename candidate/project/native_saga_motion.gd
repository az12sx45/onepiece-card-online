extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://saga-motion.json")).catalog
static func sample(key: String,seconds: float,extent: Vector2,parent: Vector2) -> Dictionary:
	var m: Dictionary=catalog[key];var t:=clampf((seconds-float(m.delay))/float(m.duration),0,1)
	var a:=Ease.segment(m.tracks.opacity,t,m.easing);var b:=Ease.segment(m.tracks.transform,t,m.easing);var c:=Ease.segment(m.tracks.filter,t,m.easing)
	var result:={"opacity":lerpf(a[0],a[1],a[2]),"transform":Ease._transform(b[0],b[1],b[2],extent),"filters":Ease.filters(c[0],c[1],c[2])}
	for key_name in ["left","top"]:
		var v:=Ease.segment(m.tracks[key_name],t,m.easing);var total:=parent.x if key_name=="left" else parent.y
		result[key_name]=lerpf(Ease._length(v[0],total),Ease._length(v[1],total),v[2])
	return result

