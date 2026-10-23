extends Node2D
## One persistent draw item. Transforms/colors change without rebuilding images.
var texture: Texture2D
var extent:=Vector2.ZERO
var anchor:=Vector2.ZERO
var shapes: Array=[]
var shapes_key:=""
func apply_motion(values: Array,offset: int) -> void:
	transform=Transform2D(Vector2(values[offset],values[offset+1]),Vector2(values[offset+2],values[offset+3]),Vector2(values[offset+4],values[offset+5]))
	var tint:=int(values[offset+7]);modulate=Color.from_rgba8((tint>>16)&255,(tint>>8)&255,tint&255);modulate.a=float(values[offset+6])
func configure(value: Dictionary,assets: Dictionary,additive: Material) -> void:
	var m: Array=value.matrix
	transform=Transform2D(Vector2(m[0],m[1]),Vector2(m[2],m[3]),Vector2(m[4],m[5]))
	modulate=Color.from_rgba8((int(value.tint)>>16)&255,(int(value.tint)>>8)&255,int(value.tint)&255);modulate.a=float(value.alpha)
	material=additive if value.blend=="add" else null
	if value.has("texture") and texture!=assets[value.texture]:
		texture=assets[value.texture];extent=Vector2(value.width,value.height);anchor=Vector2(value.anchor[0],value.anchor[1]);queue_redraw()
	if value.has("shapes"):
		var key:=JSON.stringify(value.shapes)
		if key!=shapes_key:shapes_key=key;shapes=value.shapes;queue_redraw()
func _draw() -> void:
	if texture!=null:draw_texture_rect(texture,Rect2(-extent*anchor,extent),false)
	for shape in shapes:
		var style: Dictionary=shape.get("fill",shape.get("stroke",{}));var tint: int=style.get("color",0xffffff)
		var color:=Color.from_rgba8((tint>>16)&255,(tint>>8)&255,tint&255);color.a=float(style.get("alpha",1.0))
		if shape.type=="rect":draw_rect(Rect2(shape.x,shape.y,shape.width,shape.height),color)
		elif shape.type=="poly":
			var points:=PackedVector2Array()
			for i in range(0,shape.points.size(),2):points.append(Vector2(shape.points[i],shape.points[i+1]))
			draw_colored_polygon(points,color)
		elif shape.type=="ellipse":
			var points:=PackedVector2Array()
			for i in range(97):var angle:=TAU*float(i)/96.0;points.append(Vector2(shape.x+cos(angle)*shape.width,shape.y+sin(angle)*shape.height))
			draw_polyline(points,color,float(style.get("width",1.0)),true)
