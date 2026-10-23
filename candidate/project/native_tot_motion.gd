extends RefCounted
## Authored CSS keyframes, evaluated against the element and viewport sizes.
const Interpolation=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tot-motion.json"))
static func length(value: Array,axis: float,viewport: Vector2) -> float:
	match str(value[1]):
		"percent":return float(value[0])*axis/100.0
		"vw":return float(value[0])*viewport.x/100.0
		"vh":return float(value[0])*viewport.y/100.0
	return float(value[0])
static func _move(a: Array,b: Array,u: float,extent: Vector2,viewport: Vector2) -> Transform2D:
	assert(a.size()==b.size(),"Tot transform list mismatch")
	var result:=Transform2D.IDENTITY
	for i in range(a.size()):
		var left: Dictionary=a[i];var right: Dictionary=b[i]
		assert(left.kind==right.kind,"Tot transform operation mismatch")
		if left.kind=="translate":result=result*Transform2D(0,Vector2(lerpf(length(left.x,extent.x,viewport),length(right.x,extent.x,viewport),u),lerpf(length(left.y,extent.y,viewport),length(right.y,extent.y,viewport),u)))
		elif left.kind=="rotate":result=result*Transform2D(lerpf(left.angle,right.angle,u),Vector2.ZERO)
		elif left.kind=="scale":result=result*Transform2D(0,Vector2(lerpf(left.x,right.x,u),lerpf(left.y,right.y,u)),0,Vector2.ZERO)
	return result
static func sample(name: String,seconds: float,extent: Vector2,viewport: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[name];var progress:=clampf(seconds/float(motion.duration),0,1)
	var result:={"opacity":1.0,"transform":Transform2D.IDENTITY,"translate":Vector2.ZERO,"filters":[]}
	for key in motion.tracks:
		var segment:=Interpolation.segment(motion.tracks[key],progress,motion.easing);var a=segment[0];var b=segment[1];var u: float=segment[2]
		match str(key):
			"opacity":result.opacity=clampf(lerpf(a,b,u),0,1)
			"transform":result.transform=_move(a,b,u,extent,viewport)
			"filter":result.filters=Interpolation.filters(a,b,u)
			"translate":result.translate=Vector2(lerpf(length(a[0],extent.x,viewport),length(b[0],extent.x,viewport),u),lerpf(length(a[1],extent.y,viewport),length(b[1],extent.y,viewport),u))
			_:result[key]=lerpf(length(a,viewport.x if key in ["left","right"] else viewport.y,viewport),length(b,viewport.x if key in ["left","right"] else viewport.y,viewport),u)
	return result
static func apply(node: Control,sample: Dictionary,anchor: Vector2,origin_ratio:=Vector2(.5,.5)) -> void:
	var transform: Transform2D=sample.transform;var origin:=node.size*origin_ratio
	node.position=anchor+sample.translate+origin+transform.origin-transform.basis_xform(origin);node.rotation=transform.get_rotation();node.scale=transform.get_scale();node.modulate.a=float(sample.opacity)
