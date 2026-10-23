extends RefCounted
const Css=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://nika-motion.json")).catalog.nika
static func _segment(track: Array,time: float,curve: Array) -> Array:
	# At an exact keyframe CSS starts the following interpolation interval.
	# This matters when its next filter list adds/removes an identity shadow.
	for i in range(1,track.size()):
		if time<float(track[i].time)-.0000000001:return [track[i-1].value,track[i].value,Css._ease(clampf((time-float(track[i-1].time))/(float(track[i].time)-float(track[i-1].time)),0,1),curve)]
	return [track[-1].value,track[-1].value,1.0]
static func sample(name: String,elapsed: float,extent: Vector2,loop:=false) -> Dictionary:
	return sample_catalog(catalog,name,elapsed,extent,loop)

static func sample_catalog(source: Dictionary,name: String,elapsed: float,extent: Vector2,loop:=false) -> Dictionary:
	var motion: Dictionary=source[name];var time:=fposmod(elapsed,float(motion.duration))/float(motion.duration) if loop else clampf(elapsed/float(motion.duration),0,1)
	var opacity:=_segment(motion.tracks.opacity,time,motion.easing);var movement:=_segment(motion.tracks.transform,time,motion.easing);var effect:=_segment(motion.tracks.filter,time,motion.easing)
	var filters: Array=Css.filters(effect[0],effect[1],float(effect[2]))
	var paint:=_segment(motion.tracks.boxShadow,time,motion.easing)
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":Css._transform(movement[0],movement[1],float(movement[2]),extent),"filters":filters,"boxShadow":shadows(paint[0],paint[1],paint[2])}

static func shadows(left: Array,right: Array,progress: float) -> Array:
	# CSS box-shadow becomes discrete when corresponding inset flags differ.
	for i in range(mini(left.size(),right.size())):
		if left[i].inset!=right[i].inset:return left if progress<0.5 else right
	var a: Array=[];var b: Array=[];var flags: Array=[];var spreads: Array=[]
	for i in range(maxi(left.size(),right.size())):
		var l: Dictionary=left[i].duplicate() if i<left.size() else {"x":0,"y":0,"blur":0,"spread":0,"color":[0,0,0,0],"inset":right[i].inset}
		var r: Dictionary=right[i].duplicate() if i<right.size() else {"x":0,"y":0,"blur":0,"spread":0,"color":[0,0,0,0],"inset":left[i].inset}
		l.kind="drop-shadow";r.kind="drop-shadow";a.append(l);b.append(r);flags.append(l.inset);spreads.append(lerpf(l.spread,r.spread,progress))
	var result:=Css.filters(a,b,progress)
	for i in range(result.size()):result[i].erase("kind");result[i].inset=flags[i];result[i].spread=spreads[i]
	return result
