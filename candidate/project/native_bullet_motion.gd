extends RefCounted
const Ease=preload("res://native_evolution_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://bullet-motion.json")).catalog
static func sample(key: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=catalog[key];var t:=clampf((seconds-float(motion.delay))/float(motion.duration),0,1)
	var a:=Ease.segment(motion.tracks.opacity,t,motion.easing);var b:=Ease.segment(motion.tracks.transform,t,motion.easing)
	return {"opacity":lerpf(a[0],a[1],a[2]),"transform":Ease._transform(b[0],b[1],b[2],extent)}
static func parse_transform(value: String) -> Array:
	var expression:=RegEx.new();expression.compile("(translate|scale|rotate)\\(([^)]+)\\)");var result: Array=[]
	for match in expression.search_all(value):
		var args:=match.get_string(2).split(",");var key:=match.get_string(1)
		if key=="translate":result.append({"kind":"translate","x":[float(args[0]),"px"],"y":[float(args[1]),"px"]})
		elif key=="scale":result.append({"kind":"scale","x":float(args[0]),"y":float(args[1]) if args.size()>1 else float(args[0])})
		else:result.append({"kind":"rotate","angle":deg_to_rad(float(args[0].trim_suffix("deg")))})
	return result
static func compile_flight(packet: Dictionary) -> Dictionary:
	var opacity: Array=[];var movement: Array=[]
	for i in range(packet.keyframes.size()):
		var frame: Dictionary=packet.keyframes[i];var offset:=float(frame.get("offset",0 if i==0 else 1))
		opacity.append({"time":offset,"value":frame.opacity});movement.append({"time":offset,"value":parse_transform(frame.transform)})
	var easing: Array=[];var curve:=str(packet.options.easing).trim_prefix("cubic-bezier(").trim_suffix(")")
	for value in curve.split(","):easing.append(float(value))
	assert(easing.size()==4,"Original WAAPI easing required")
	return {"at":float(packet.at)+float(packet.options.delay),"duration":float(packet.options.duration),"easing":easing,"opacity":opacity,"movement":movement}
static func sample_flight(motion: Dictionary,ms: float,extent: Vector2) -> Dictionary:
	# WAAPI timing-function applies to whole progress, unlike per-keyframe CSS.
	if ms<float(motion.at):return {"opacity":1.0,"transform":Transform2D.IDENTITY}
	var raw:=clampf((ms-float(motion.at))/float(motion.duration),0,1);var t:=Ease._ease(raw,motion.easing)
	var opacity: Array=motion.opacity;var movement: Array=motion.movement
	var a:=Ease.segment(opacity,t,[0,0,1,1]);var b:=Ease.segment(movement,t,[0,0,1,1])
	return {"opacity":lerpf(a[0],a[1],a[2]),"transform":Ease._transform(b[0],b[1],b[2],extent)}
static func flight(packet: Dictionary,ms: float,extent: Vector2) -> Dictionary:
	return sample_flight(compile_flight(packet),ms,extent)
