extends RefCounted
## Original computed phone CSS, shared persistent native materials.
## No map rules, per-frame JSON, image download or control rebuilding.
const SOURCE="res://map-tile-source.json"
const SHADER=preload("res://native_map_tile.gdshader")
const ICON_SHADER=preload("res://native_map_tile_icon.gdshader")
static var catalog: Dictionary=JSON.parse_string(FileAccess.get_file_as_string(SOURCE))
static var materials: Dictionary={}
static var icon_materials: Dictionary={}
static var empty:=StyleBoxEmpty.new()
static func key(tile: Dictionary) -> String:
	return ("scout" if tile.scout else "normal")+"-"+("route" if not str(tile.routeChoiceId).is_empty() else "plain")+"-"+(str(tile.claimed) if not str(tile.claimed).is_empty() else "free")
static func vector(value: Array) -> Vector4:return Vector4(value[0],value[1],value[2],value[3])
static func material_for(id: String) -> ShaderMaterial:
	if materials.has(id):return materials[id]
	var s: Dictionary=catalog.cases[id]
	assert(s.angle==180,"Map tile gradient orientation requires source-specific projection")
	var m:=ShaderMaterial.new();m.shader=SHADER
	for pair in [["radius","radius"],["border_width","borderWidth"],["outline_width","outlineWidth"],["outline_offset","outlineOffset"],["period","period"]]:m.set_shader_parameter(pair[0],s[pair[1]])
	for pair in [["top_color","top"],["bottom_color","bottom"],["border_color","border"],["outline_color","outline"]]:m.set_shader_parameter(pair[0],vector(s[pair[1]]))
	m.set_shader_parameter("tile_size",Vector2(s.width,s.height))
	m.set_shader_parameter("opacity_range",Vector2(s.startOpacity,s.peakOpacity))
	var padding: float=s.outlineWidth+s.outlineOffset+2
	for field in ["startShadows","peakShadows"]:
		var geometry:=PackedVector4Array();var colors:=PackedVector4Array()
		for shadow in s[field]:
			geometry.append(Vector4(shadow.x,shadow.y,shadow.blur,shadow.spread));colors.append(vector(shadow.color))
			padding=maxf(padding,maxf(absf(shadow.x),absf(shadow.y))+maxf(0,shadow.spread)+shadow.blur*1.5+2)
		while geometry.size()<3:geometry.append(Vector4.ZERO);colors.append(Vector4.ZERO)
		var suffix: String="start" if field=="startShadows" else "peak"
		m.set_shader_parameter("shadow_geometry_"+suffix,geometry);m.set_shader_parameter("shadow_color_"+suffix,colors)
	m.set_shader_parameter("shadow_count",s.startShadows.size())
	m.set_shader_parameter("padding",ceilf(padding));m.set_meta("padding",ceilf(padding))
	materials[id]=m
	return m
static func apply(entry: Dictionary,tile: Dictionary) -> void:
	var id:=key(tile);var s: Dictionary=catalog.cases[id];var button: Button=entry.button
	if button.get_meta("tile_style","")==id:return
	button.set_meta("tile_style",id)
	for state in ["normal","hover","pressed","focus","disabled"]:button.add_theme_stylebox_override(state,empty)
	if not entry.has("tile_art"):
		var art:=ColorRect.new();art.color=Color.WHITE;art.mouse_filter=Control.MOUSE_FILTER_IGNORE;art.show_behind_parent=true
		button.add_child(art);button.move_child(art,0);entry.tile_art=art
	var m:=material_for(id);var pad: float=m.get_meta("padding")
	entry.tile_art.material=m;entry.tile_art.position=Vector2(-pad,-pad);entry.tile_art.size=Vector2(s.width,s.height)+Vector2.ONE*pad*2
	button.z_index=int(s.zIndex)
	entry.tile_scout=bool(tile.scout)
	entry.path=str(catalog.icon) if tile.scout else ""
	entry.picture.set_meta("wanted_asset",entry.path)
	entry.image_width=float(s.width)*.82
	entry.image_top=-float(s.height)*.82/2.0
	entry.tile_icon_rect=s.iconRect if s.scout else {}
	if tile.scout:
		if not icon_materials.has(id):
			var icon:=ShaderMaterial.new();icon.shader=ICON_SHADER;icon.set_shader_parameter("period",s.period);icon.set_shader_parameter("opacity_range",Vector2(s.startOpacity,s.peakOpacity));icon.set_shader_parameter("logical_size",Vector2(s.iconRect.width,s.iconRect.height));icon_materials[id]=icon
		entry.picture.material=icon_materials[id]
	else:
		entry.picture.texture=null;entry.picture.material=null;entry.current_path=""
static func freeze_phase(phase: float) -> void:
	for m in materials.values():m.set_shader_parameter("phase_override",phase)
	for m in icon_materials.values():m.set_shader_parameter("phase_override",phase)
static func advance(milliseconds: int) -> void:
	# One eased value per original period, not a Bezier solve per GPU pixel.
	# Monotonic integer time also avoids the shader TIME hourly wrap seam.
	var phases: Dictionary={}
	for id in materials:
		var period: int=roundi(float(catalog.cases[id].period)*1000)
		if period<=0:continue
		if not phases.has(period):
			var cycle:=float(milliseconds%period)/period
			phases[period]=preload("res://native_evolution_motion.gd")._ease(1.0-absf(2.0*cycle-1.0),[.42,0,.58,1])
		materials[id].set_shader_parameter("source_phase",phases[period])
		if icon_materials.has(id):icon_materials[id].set_shader_parameter("source_phase",phases[period])

