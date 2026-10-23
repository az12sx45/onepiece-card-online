extends Control
## Original phone compact map HUD. CSS pixel sizes survive product stretching.
const FRAME="mobile/art-ui/map-hud-compact-v009.png"
const ICONS="mobile/art-ui/icons-v006.png"
const HudShader=preload("res://native_map_hud.gdshader")
var toggle:=Button.new()
var turn:=Label.new()
var kicker:=Label.new()
var step:=Label.new()
var frame:=TextureRect.new()
var portrait:=TextureRect.new()
var wheel:=TextureRect.new()
var data: Dictionary={}
var generation:=0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	for picture in [frame,portrait,wheel]:
		picture.mouse_filter=Control.MOUSE_FILTER_IGNORE;picture.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;add_child(picture)
	frame.material=ShaderMaterial.new();frame.material.shader=HudShader
	portrait.material=ShaderMaterial.new();portrait.material.shader=HudShader;portrait.material.set_shader_parameter("avatar",true)
	var empty:=StyleBoxEmpty.new()
	for state in ["normal","hover","pressed","focus","disabled"]:toggle.add_theme_stylebox_override(state,empty)
	toggle.tooltip_text="航海選單";add_child(toggle)
	for row in [[turn,16,950,"f7fcff"],[kicker,12,950,"ffe38c"],[step,14,800,"e5f7ffe0"]]:
		var label: Label=row[0];label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.clip_text=true
		label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(row[2]))
		label.add_theme_font_size_override("font_size",row[1]);label.add_theme_color_override("font_color",Color(row[3]))
		label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;add_child(label)
func prepare(value: Dictionary,cache: Node) -> bool:
	data=value;generation+=1;var token:=generation
	var avatar_path:=str(data.get("avatar",""))
	if avatar_path.begins_with("/"):avatar_path=avatar_path.substr(1)
	var until:=Time.get_ticks_msec()+15000
	while token==generation:
		var background: Texture2D=cache.request(FRAME)
		var atlas: Texture2D=cache.request(ICONS)
		var face: Texture2D=cache.request(avatar_path) if not avatar_path.is_empty() else null
		if background and atlas and (avatar_path.is_empty() or face):
			# Publish one complete generation. Do not blank a visible avatar while
			# the next player's source image is still decoding.
			frame.texture=background;portrait.texture=face
			turn.text=str(data.name);kicker.text=str(data.kicker);step.text=str(data.step)
			if not wheel.has_meta("source") or wheel.get_meta("source")!=atlas:
				var tile:=AtlasTexture.new();tile.atlas=atlas;tile.region=Rect2(Vector2.ZERO,Vector2(atlas.get_width()/4.0,atlas.get_height()/5.0));wheel.texture=tile;wheel.set_meta("source",atlas)
			return true
		if Time.get_ticks_msec()>until:push_error("Original compact map HUD artwork unavailable");return false
		await get_tree().process_frame
	return false
func layout_physical(logical_size: Vector2) -> void:
	var factor:=preload("res://native_screen_metrics.gd").css_factor(get_viewport())
	if factor<=0:return
	size=logical_size
	var physical:=size*factor
	var width:=minf(280,physical.x-76)
	var origin:=Vector2(physical.x-6-width,6)
	frame.position=origin;frame.size=Vector2(width,48);frame.material.set_shader_parameter("extent",frame.size)
	portrait.position=origin+Vector2(8,8);portrait.size=Vector2(32,32)
	toggle.position=Vector2(6,6);toggle.size=Vector2(48,48);wheel.position=Vector2(14,14);wheel.size=Vector2(32,32)
	for row in [[turn,16],[kicker,12],[step,14]]:row[0].add_theme_font_size_override("font_size",roundi(row[1]/factor))
	var kicker_width:=kicker.get_theme_font("font").get_string_size(kicker.text,HORIZONTAL_ALIGNMENT_LEFT,-1,kicker.get_theme_font_size("font_size")).x*factor
	kicker.position=origin+Vector2(width-8-kicker_width,2);kicker.size=Vector2(kicker_width,24)
	turn.position=origin+Vector2(46,2);turn.size=Vector2(maxf(0,width-60-kicker_width),24)
	step.position=origin+Vector2(46,26);step.size=Vector2(width-54,20)
	for node in [frame,portrait,toggle,wheel,turn,kicker,step]:
		node.position/=factor;node.size/=factor
