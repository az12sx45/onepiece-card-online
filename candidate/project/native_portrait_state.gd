extends RefCounted
static var source: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://portrait-presentation.json"))
static func state(requested: String,hp: float,max_hp: float) -> String:
	if requested in ["hitPlayerSide","hitEnemySide"]:return "hit"
	if requested.is_empty():requested="normal"
	if requested=="normal" and hp>0 and hp/maxf(1,max_hp)<=float(source.weakRatio):return "weak"
	return requested
static func path(side: String,portraits: Dictionary,pose: String) -> String:
	var fallbacks: Dictionary=source.fallback[side]
	for key in fallbacks.get(pose,fallbacks.normal):
		if not str(portraits.get(key,"")).is_empty():return str(portraits[key])
	return str(source.placeholder)
