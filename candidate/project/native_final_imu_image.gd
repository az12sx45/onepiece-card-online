extends "res://native_css_ordered_image.gd"
## Keeps source filter order and projects the filtered image with its CSS matrix.
var fit:="contain"
var screen_blend:=false
var projection_shader:=preload("res://native_final_imu_project.gdshader")
func _ready() -> void:
	super._ready()
	var material:=ShaderMaterial.new();material.shader=projection_shader;display.material=material
func configure(image: Texture2D,box_size: Vector2) -> void:
	super.configure(image,box_size)
	# Existing image shader supports cover. A stretched source box is needed only
	# for the original shadow-pillar object-fit:fill declaration.
	passes[0].effect.set_shader_parameter("source_cover",fit=="cover")
	passes[0].effect.set_shader_parameter("image_size",box_size if fit=="fill" else image.get_size())
func project(value: Dictionary,anchor: Vector2) -> void:
	var m: Array=value.matrix;var center:=box*.5;var offset:=Vector2.ONE*PADDING+center;var absolute:=anchor+center
	var column_x:=Vector3(float(m[0])+absolute.x*float(m[3]),float(m[1])+absolute.y*float(m[3]),float(m[3]))
	var column_y:=Vector3(float(m[4])+absolute.x*float(m[7]),float(m[5])+absolute.y*float(m[7]),float(m[7]))
	var column_z:=Vector3(float(m[12])+absolute.x*float(m[15]),float(m[13])+absolute.y*float(m[15]),float(m[15]))-column_x*offset.x-column_y*offset.y
	var homography:=Basis(column_x,column_y,column_z);var bounds:=Rect2();var first:=true
	for point in [Vector2.ZERO,Vector2(extent.x,0),Vector2(extent),Vector2(0,extent.y)]:
		var q:=homography*Vector3(point.x,point.y,1);var projected:=Vector2(q.x,q.y)/q.z
		if first:bounds=Rect2(projected,Vector2.ZERO);first=false
		else:bounds=bounds.expand(projected)
	position=Vector2.ZERO;rotation=0;scale=Vector2.ONE;modulate.a=1;display.position=bounds.position;display.size=bounds.size
	var effect: ShaderMaterial=display.material;effect.set_shader_parameter("inverse_projection",homography.inverse());effect.set_shader_parameter("bounds_origin",bounds.position);effect.set_shader_parameter("bounds_extent",bounds.size);effect.set_shader_parameter("image_extent",Vector2(extent));effect.set_shader_parameter("alpha",float(value.opacity));effect.set_shader_parameter("screen_blend",screen_blend)
