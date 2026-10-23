extends RefCounted
## Native interpolation of authored CSS keyframes, not captured frame playback.
## The browser samples are used only by the parity probe.
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tavern-host-motion.json"))
static func motion_name(value: String) -> String:return str(catalog.mapping.get(value,"tavern-host-steady"))
static func duration() -> float:return float(catalog.duration)
static func _ease(value: float) -> float:
	var lo:=0.0;var hi:=1.0
	for i in range(32):
		var t:=(lo+hi)*0.5;var u:=1.0-t;var x:=3.0*u*u*t*0.42+3.0*u*t*t*0.58+t*t*t
		if x<value:lo=t
		else:hi=t
	var t:=(lo+hi)*0.5;return 3.0*(1.0-t)*t*t+t*t*t
static func _segment(track: Array,time: float) -> Array:
	for i in range(1,track.size()):
		if time<=float(track[i].time):
			return [track[i-1].value,track[i].value,_ease(clampf((time-float(track[i-1].time))/(float(track[i].time)-float(track[i-1].time)),0,1))]
	return [track[-1].value,track[-1].value,1.0]
static func _identity(kind: String) -> Dictionary:
	if kind=="translate":return {"kind":kind,"x":0.0,"y":0.0}
	if kind=="scale":return {"kind":kind,"x":1.0,"y":1.0}
	return {"kind":kind,"angle":0.0}
static func _operation(value: Dictionary) -> Transform2D:
	if value.kind=="translate":return Transform2D(0,Vector2(value.x,value.y))
	if value.kind=="scale":return Transform2D(0,Vector2(value.x,value.y),0,Vector2.ZERO)
	return Transform2D(float(value.angle),Vector2.ZERO)
static func _matrix(ops: Array,start: int) -> Transform2D:
	var result:=Transform2D.IDENTITY
	for i in range(start,ops.size()):result=result*_operation(ops[i])
	return result
static func _interpolate(left: Array,right: Array,progress: float) -> Transform2D:
	var result:=Transform2D.IDENTITY
	for i in range(maxi(left.size(),right.size())):
		var a: Dictionary=left[i] if i<left.size() else _identity(str(right[i].kind))
		var b: Dictionary=right[i] if i<right.size() else _identity(str(left[i].kind))
		if a.kind!=b.kind:
			# CSS mismatched transform lists interpolate the decomposed remainder.
			return result*_matrix(left,i).interpolate_with(_matrix(right,i),progress)
		var op: Dictionary={"kind":a.kind}
		if a.kind=="rotate":op.angle=lerpf(float(a.angle),float(b.angle),progress)
		else:op.x=lerpf(float(a.x),float(b.x),progress);op.y=lerpf(float(a.y),float(b.y),progress)
		result=result*_operation(op)
	return result
static func sample(name: String,elapsed: float) -> Dictionary:
	var tracks: Dictionary=catalog.motions[name];var time:=clampf(elapsed/duration(),0,1)
	var opacity:=_segment(tracks.opacity,time);var movement:=_segment(tracks.transform,time)
	return {"opacity":lerpf(float(opacity[0]),float(opacity[1]),float(opacity[2])),"transform":_interpolate(movement[0],movement[1],float(movement[2]))}
