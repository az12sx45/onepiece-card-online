extends RefCounted
const Interpolation=preload("res://native_evolution_motion.gd")
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://shiki-motion.json"))
static var heights: Dictionary={}
static func sample(key: String,elapsed: float,extent: Vector2,viewport_height: float) -> Dictionary:
	if not heights.has(viewport_height):
		var catalog: Dictionary=data.catalog.duplicate(true)
		for definition in catalog.values():
			for frame in definition.tracks.transform:
				for operation in frame.value:
					if operation.kind=="translate":
						for axis in ["x","y"]:
							if operation[axis][1]=="vh":operation[axis]=[float(operation[axis][0])*viewport_height/100.0,"px"]
		heights[viewport_height]=catalog
	var motion: Dictionary=heights[viewport_height][key]
	var time:=clampf(elapsed/float(motion.duration),0,1)
	var opacity:=Interpolation.segment(motion.tracks.opacity,time,motion.easing)
	var movement:=Interpolation.segment(motion.tracks.transform,time,motion.easing)
	var effect:=Interpolation.segment(motion.tracks.filter,time,motion.easing)
	return {"opacity":lerpf(opacity[0],opacity[1],opacity[2]),"transform":Interpolation._transform(movement[0],movement[1],movement[2],extent),"filters":Interpolation.filters(effect[0],effect[1],effect[2])}
