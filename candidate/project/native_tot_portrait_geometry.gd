extends RefCounted
static var data: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://tot-portrait-geometry.json")).geometry
static func rects(extent: Vector2,viewport: Vector2,source_scale: float,natural: Vector2) -> Dictionary:
	var padding:=clampf(viewport.x*float(data.innerPadding.vw),data.innerPadding.min,data.innerPadding.max)
	var inset: float=(data.outerBorder+data.outerPadding+data.innerBorder+padding+data.wrapperBorder)*source_scale
	var clip:=Rect2(Vector2.ONE*inset,(extent-Vector2.ONE*inset*2).max(Vector2.ONE))
	var image:=clip
	if natural.x>0:image.size.y=maxf(clip.size.y,clip.size.x*natural.y/natural.x)
	return {"clip":clip,"image":image,"radius":float(data.wrapperRadius)*source_scale,"innerInset":float(data.outerBorder+data.outerPadding)*source_scale,"wrapperInset":inset-float(data.wrapperBorder)*source_scale}
