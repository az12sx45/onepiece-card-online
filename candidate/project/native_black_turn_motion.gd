extends RefCounted
## Runtime CSS keyframe interpolation; browser samples are QA data only.
const Ease=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://black-turn-motion.json"))

static func _value(value: Variant,total: float,variables: Dictionary) -> float:
	if value is Array:return Ease._length(value,total)
	var fallback: float=_value(value.fallback,total,variables)
	var resolved: float=fallback
	if variables.has(value.variable):
		var text:=str(variables[value.variable]);resolved=float(text.trim_suffix("%"))*total/100.0 if text.ends_with("%") else text.to_float()
	return (resolved+float(value.percent)*total/100.0)*float(value.mult)

static func _transform(left: Array,right: Array,progress: float,extent: Vector2,variables: Dictionary) -> Transform3D:
	assert(left.size()==right.size(),"Black-turn transform list mismatch")
	var result:=Transform3D.IDENTITY
	for i in range(left.size()):
		var a: Dictionary=left[i];var b: Dictionary=right[i]
		assert(a.kind==b.kind)
		if a.kind in ["translate","scale"]:
			var value:=Vector3(lerpf(_value(a.x,extent.x,variables),_value(b.x,extent.x,variables),progress),lerpf(_value(a.y,extent.y,variables),_value(b.y,extent.y,variables),progress),lerpf(_value(a.z,1,variables),_value(b.z,1,variables),progress))
			result=result*Transform3D(Basis.IDENTITY,value) if a.kind=="translate" else result*Transform3D(Basis.from_scale(value),Vector3.ZERO)
		else:
			result=result*Transform3D(Basis(Vector3.UP if a.kind=="rotateY" else Vector3(0,0,1),lerpf(a.angle,b.angle,progress)),Vector3.ZERO)
	return result

static func sample(key: String,seconds: float,extent: Vector2,variables: Dictionary) -> Dictionary:
	var motion: Dictionary=data.catalog[key];var time:=clampf(seconds/float(motion.duration),0,1)
	var result: Dictionary={"clip_enabled":motion.get("hasClipPath",false)}
	for property in motion.tracks:
		var precise_time:=time
		for frame in motion.tracks[property]:
			if absf(time-float(frame.time))<.000000001:precise_time=frame.time;break
		var s:=Ease.segment(motion.tracks[property],precise_time,motion.easing)
		match str(property):
			"opacity":result.opacity=lerpf(s[0],s[1],s[2])
			"transform":result.transform=_transform(s[0],s[1],s[2],extent,variables)
			"filter":result.filters=Ease.filters(s[0],s[1],s[2])
			"clip-path":
				result.clip=[]
				for i in range(4):result.clip.append(lerpf(s[0][i],s[1][i],s[2]))
			"z-index":result.z=int(floor(lerpf(s[0],s[1],s[2])+.500000001))
	return result

static func matrix(transform: Transform3D) -> Array:
	var b:=transform.basis;var o:=transform.origin
	return [b.x.x,b.x.y,b.x.z,0,b.y.x,b.y.y,b.y.z,0,b.z.x,b.z.y,b.z.z,0,o.x,o.y,o.z,1]

static func screen_homography(transform: Transform3D,extent: Vector2,anchor: Vector2,perspective_origin: Vector2,distance: float,padding:=0.0,origin_ratio:=Vector2(.5,.5)) -> Basis:
	# CSS transform-origin is the element centre. The texture may include
	# off-box shadows; padding belongs to its local coordinate system.
	var center:=Vector3(extent.x*origin_ratio.x,extent.y*origin_ratio.y,0)
	var m:=Transform3D(Basis.IDENTITY,Vector3(anchor.x,anchor.y,0)+center)*transform*Transform3D(Basis.IDENTITY,-center-Vector3(padding,padding,0))
	var reciprocal:=1.0/distance if distance>0 else 0.0
	var a:=m.basis.x;var b:=m.basis.y;var c:=m.origin
	return Basis(Vector3(a.x-perspective_origin.x*a.z*reciprocal,a.y-perspective_origin.y*a.z*reciprocal,-a.z*reciprocal),Vector3(b.x-perspective_origin.x*b.z*reciprocal,b.y-perspective_origin.y*b.z*reciprocal,-b.z*reciprocal),Vector3(c.x-perspective_origin.x*c.z*reciprocal,c.y-perspective_origin.y*c.z*reciprocal,1.0-c.z*reciprocal))
