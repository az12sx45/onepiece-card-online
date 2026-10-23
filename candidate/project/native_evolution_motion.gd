extends RefCounted
## Interpolate original authored keyframes. Browser samples are independent QA,
## never runtime frame playback. Filter-list mismatches follow CSS discrete rules.
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://evolution-motion.json")).catalog

static func _ease(value: float,curve: Array) -> float:
	if value<=0:return 0.0
	if value>=1:return 1.0
	var lo:=0.0;var hi:=1.0
	for i in range(32):
		var t:=(lo+hi)*0.5;var u:=1.0-t
		var x:=3.0*u*u*t*float(curve[0])+3.0*u*t*t*float(curve[2])+t*t*t
		if x<value:lo=t
		else:hi=t
	var t:=(lo+hi)*0.5;var u:=1.0-t
	return 3.0*u*u*t*float(curve[1])+3.0*u*t*t*float(curve[3])+t*t*t

static func segment(track: Array,time: float,curve: Array) -> Array:
	for i in range(1,track.size()):
		if time<=float(track[i].time):return [track[i-1].value,track[i].value,_ease(clampf((time-float(track[i-1].time))/(float(track[i].time)-float(track[i-1].time)),0,1),curve)]
	return [track[-1].value,track[-1].value,1.0]

static func _length(value: Array,total: float) -> float:return float(value[0])*total/100.0 if value[1]=="percent" else float(value[0])

static func _transform(left: Array,right: Array,progress: float,extent: Vector2) -> Transform2D:
	assert(left.size()==right.size(),"Unbound evolution transform list interpolation")
	var result:=Transform2D.IDENTITY
	for i in range(left.size()):
		var a: Dictionary=left[i];var b: Dictionary=right[i]
		assert(a.kind==b.kind,"Unbound evolution transform mismatch")
		if a.kind=="translate":result=result*Transform2D(0,Vector2(lerpf(_length(a.x,extent.x),_length(b.x,extent.x),progress),lerpf(_length(a.y,extent.y),_length(b.y,extent.y),progress)))
		elif a.kind=="scale":result=result*Transform2D(0,Vector2(lerpf(a.x,b.x,progress),lerpf(a.y,b.y,progress)),0,Vector2.ZERO)
		else:result=result*Transform2D(lerpf(a.angle,b.angle,progress),Vector2.ZERO)
	return result

static func _filter_identity(kind: String) -> Dictionary:
	if kind=="drop-shadow":return {"kind":kind,"x":0.0,"y":0.0,"blur":0.0,"color":[0.0,0.0,0.0,0.0]}
	return {"kind":kind,"value":1.0 if kind in ["brightness","contrast","saturate"] else 0.0}

static func filters(left: Array,right: Array,progress: float) -> Array:
	for i in range(mini(left.size(),right.size())):
		if left[i].kind!=right[i].kind:return left if progress<0.5 else right
	var result: Array=[]
	for i in range(maxi(left.size(),right.size())):
		var a: Dictionary=left[i] if i<left.size() else _filter_identity(str(right[i].kind))
		var b: Dictionary=right[i] if i<right.size() else _filter_identity(str(left[i].kind))
		var op: Dictionary={"kind":a.kind}
		if a.kind=="drop-shadow":
			for key in ["x","y","blur"]:op[key]=lerpf(float(a[key]),float(b[key]),progress)
			var alpha:=lerpf(float(a.color[3]),float(b.color[3]),progress);var rgba: Array=[]
			for c in range(3):rgba.append(lerpf(float(a.color[c])*float(a.color[3]),float(b.color[c])*float(b.color[3]),progress)/alpha if alpha>0 else 0.0)
			rgba.append(alpha);op.color=rgba
		else:op.value=lerpf(float(a.value),float(b.value),progress)
		result.append(op)
	return result

static func sample(type: String,name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[type][name];var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=segment(motion.tracks.opacity,time,motion.easing);var movement:=segment(motion.tracks.transform,time,motion.easing);var effect:=segment(motion.tracks.filter,time,motion.easing)
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":_transform(movement[0],movement[1],float(movement[2]),extent),"filters":filters(effect[0],effect[1],float(effect[2]))}
