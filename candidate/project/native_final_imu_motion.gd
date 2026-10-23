extends RefCounted
## Authored CSS keyframes; four-dimensional transforms retain portal perspective.
const Shared=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://final-imu-motion.json"))
static func identity() -> Array:return [1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0]
static func multiply(a: Array,b: Array) -> Array:
	var out:=identity()
	for col in range(4):
		for row in range(4):
			var value:=0.0
			for k in range(4):value+=float(a[k*4+row])*float(b[col*4+k])
			out[col*4+row]=value
	return out
static func matrix(left: Array,right: Array,progress: float,extent: Vector2) -> Array:
	left=left.duplicate(true);right=right.duplicate(true)
	# CSS suffixes differ only by an omitted identity translateY at the end of
	# portal/shadow entrance. Inserting that identity preserves the exact matrix.
	if left.size()!=right.size():
		var short: Array=left if left.size()<right.size() else right
		short.insert(1,{"kind":"translate","x":[0,"px"],"y":[0,"px"]})
	assert(left.size()==right.size(),"Unknown final-imu transform interpolation")
	var result:=identity()
	for i in range(left.size()):
		var a: Dictionary=left[i];var b: Dictionary=right[i];var op:=identity();assert(a.kind==b.kind,"Final-imu transform order changed")
		match a.kind:
			"translate":op[12]=lerpf(Shared._length(a.x,extent.x),Shared._length(b.x,extent.x),progress);op[13]=lerpf(Shared._length(a.y,extent.y),Shared._length(b.y,extent.y),progress)
			"scale":op[0]=lerpf(a.x,b.x,progress);op[5]=lerpf(a.y,b.y,progress)
			"perspective":op[11]=-lerpf(1.0/float(a.value),1.0/float(b.value),progress)
			"rotateX":
				var angle:=lerpf(a.value,b.value,progress);op[5]=cos(angle);op[6]=sin(angle);op[9]=-sin(angle);op[10]=cos(angle)
			_:assert(false,"Unsupported final transform")
		result=multiply(result,op)
	return result
static func sample(name: String,elapsed: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var t:=clampf(elapsed/float(motion.duration),0,1);var result: Dictionary={}
	for property in motion.tracks:
		var segment:=Shared.segment(motion.tracks[property],t,motion.easing);var a=segment[0];var b=segment[1];var fraction: float=segment[2]
		if property=="opacity":result.opacity=lerpf(float(a),float(b),fraction)
		elif property=="filter":result.filters=Shared.filters(a,b,fraction)
		else:result.matrix=matrix(a,b,fraction,extent)
	return result
static func compose(layer: String,elapsed: float,extent: Vector2) -> Dictionary:
	var description: Dictionary=data.layers[layer];var base: Dictionary=description.base
	var result: Dictionary={"opacity":float(base.opacity),"matrix":matrix(base.transform,base.transform,0,extent),"filters":base.filter}
	for name in description.animations:
		var motion: Dictionary=data.catalog[name];var t:=elapsed-float(motion.delay)
		if t<0 and not motion.fill in ["both","backwards"]:continue
		if t>float(motion.duration) and not motion.infinite and not motion.fill in ["both","forwards"]:continue
		if motion.infinite and t>=0:t=fmod(t,float(motion.duration))
		result.merge(sample(name,t,extent),true)
	return result
