extends RefCounted
const Interpolation=preload("res://native_nika_motion.gd")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://opening-motion.json")).catalog.opening
static func sample(name: String,elapsed: float,extent: Vector2,loop:=false) -> Dictionary:return Interpolation.sample_catalog(catalog,name,elapsed,extent,loop)
