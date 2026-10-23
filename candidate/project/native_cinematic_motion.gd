extends RefCounted
const Shared=preload("res://native_evolution_motion.gd")
const Matrix=preload("res://native_final_imu_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://cinematic-motion.json"))
static func scene(class_text: String) -> Dictionary:
	var key:=class_text.replace(" scene-switching","").replace(" has-inline-choice","")
	if data.scenes.has(key):return data.scenes[key]
	assert(key.contains("scene-feature-island-"),"Cinematic CSS scene not indexed "+key)
	return data.scenes["final-ending-screen final-ending-cinematic ending-history scene-feature-island-shop"]
static func sample(id: String,seconds: float,extent: Vector2) -> Dictionary:
	var motion: Dictionary=data.catalog[id];var t:=clampf(seconds/float(motion.duration),0,1)
	var opacity:=Shared.segment(motion.tracks.opacity,t,motion.easing);var move:=Shared.segment(motion.tracks.transform,t,motion.easing);var filter:=Shared.segment(motion.tracks.filter,t,motion.easing)
	var matrix:=Matrix.matrix(move[0],move[1],float(move[2]),extent)
	return {"opacity":lerpf(opacity[0],opacity[1],opacity[2]),"transform":Transform2D(Vector2(matrix[0],matrix[1]),Vector2(matrix[4],matrix[5]),Vector2(matrix[12],matrix[13])),"matrix":matrix,"filters":Shared.filters(filter[0],filter[1],float(filter[2]))}
