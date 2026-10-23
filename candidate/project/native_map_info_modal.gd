extends "res://native_encounter_modal.gd"
func _init() -> void:frame_path="images/board/map_info_ui/map_node_info_panel_frame.webp"
func _ready() -> void:
	super._ready()
	var regions=[Rect2(478,6,727,126),Rect2(117,148,565,451),Rect2(117,607,564,89),Rect2(712,147,819,80),Rect2(703,424,840,255),Rect2(709,688,820,65)]
	for i in range(6):parts[i].set_meta("region",regions[i])
	for i in range(6):parts[6+i].set_meta("region",Rect2(713+(i%3)*270,239+(i/3)*92,259,85))
	message.add_theme_color_override("default_color",Color("35230f"))
	var effect:=ShaderMaterial.new();effect.shader=preload("res://native_map_info_portrait.gdshader");portrait.material=effect;portrait.stretch_mode=TextureRect.STRETCH_SCALE
func _layout() -> void:
	super._layout()
	if busy or model.is_empty():return
	# Fit the original oval frame as one proportional picture; stretching the
	# desktop circle into a mobile column would visibly deform it.
	var bounds:=Rect2(8,52,size.x*.31,size.y-154);var region: Rect2=parts[1].get_meta("region");var factor:=minf(bounds.size.x/region.size.x,bounds.size.y/region.size.y);var extent:=region.size*factor;parts[1].scale=Vector2.ONE*factor;parts[1].size=region.size;parts[1].position=bounds.get_center()-extent*.5
	portrait.position=parts[1].position+extent*Vector2(.12,.09);portrait.size=extent*Vector2(.76,.82);portrait_fallback.position=portrait.position;portrait_fallback.size=portrait.size
	if portrait.texture:
		var natural: Vector2=portrait.texture.get_size();var cover:=maxf(portrait.size.x/natural.x,portrait.size.y/natural.y);portrait.material.set_shader_parameter("cover_crop",portrait.size/(natural*cover));portrait.material.set_shader_parameter("align_top",model.get("imageMode","")=="portrait")
