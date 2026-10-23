extends RefCounted
## Runtime interpolation of authored CSS; browser samples are separate QA data.
const Ease=preload("res://native_evolution_motion.gd")
const Matrix=preload("res://native_final_imu_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tot-actor-motion.json"))
static func matrix(left: Array,right: Array,u: float,extent: Vector2) -> Array:
	assert(left.size()==right.size());var result:=Matrix.identity()
	for i in range(left.size()):
		var a: Dictionary=left[i];var b: Dictionary=right[i];assert(a.kind==b.kind);var op:=Matrix.identity()
		match str(a.kind):
			"translate":op[12]=lerpf(Ease._length(a.x,extent.x),Ease._length(b.x,extent.x),u);op[13]=lerpf(Ease._length(a.y,extent.y),Ease._length(b.y,extent.y),u)
			"scale":op[0]=lerpf(a.x,b.x,u);op[5]=lerpf(a.y,b.y,u)
			"perspective":op[11]=-lerpf(1.0/float(a.value),1.0/float(b.value),u)
			"rotateX","rotateY","rotate":
				var angle:=lerpf(a.value,b.value,u);var cosine:=cos(angle);var sine:=sin(angle)
				if a.kind=="rotateX":op[5]=cosine;op[6]=sine;op[9]=-sine;op[10]=cosine
				elif a.kind=="rotateY":op[0]=cosine;op[2]=-sine;op[8]=sine;op[10]=cosine
				else:op[0]=cosine;op[1]=sine;op[4]=-sine;op[5]=cosine
			_:assert(false,"Unsupported authored actor transform")
		result=Matrix.multiply(result,op)
	return result
static func sample(name: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var t:=clampf(seconds/float(motion.duration),0,1);var result: Dictionary={"matrix":Matrix.identity(),"translate":Vector2.ZERO,"filters":[],"pitch":0.0}
	for property in motion.tracks:
		var segment:=Ease.segment(motion.tracks[property],t,motion.easing);var a=segment[0];var b=segment[1];var u: float=segment[2]
		match str(property):
			"transform":result.matrix=matrix(a,b,u,extent)
			"filter":result.filters=Ease.filters(a,b,u)
			"translate":result.translate=Vector2(lerpf(Ease._length(a[0],extent.x),Ease._length(b[0],extent.x),u),lerpf(Ease._length(a[1],extent.y),Ease._length(b[1],extent.y),u))
			"--battle-hit-active-pitch":result.pitch=lerpf(float(a),float(b),u)
			_:assert(false,"Unsupported authored actor track")
	if motion.translation is Dictionary:
		var rule: Dictionary=motion.translation;result.translate.y=-extent.y*extent.y*sin(float(result.pitch))/float(rule.yDivisor)
		if rule.has("xDivisor"):result.translate.x=-extent.x*extent.x*absf(sin(float(result.pitch)))/float(rule.xDivisor)
	return result
static func homography(m: Array) -> Basis:
	return Basis(Vector3(m[0],m[1],m[3]),Vector3(m[4],m[5],m[7]),Vector3(m[12],m[13],m[15]))
static func from_transform(value: Transform2D) -> Basis:
	return Basis(Vector3(value.x.x,value.x.y,0),Vector3(value.y.x,value.y.y,0),Vector3(value.origin.x,value.origin.y,1))
