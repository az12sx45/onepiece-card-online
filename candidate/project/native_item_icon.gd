extends Control
## Original item bitmaps and composite clue layers, without raster resizing.
var model: Dictionary={}
var textures: Dictionary={}
var factor_portrait:=TextureRect.new()
var factor_frame:=TextureRect.new()
var factor_material:=ShaderMaterial.new()
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	factor_material.shader=preload("res://native_factor_portrait.gdshader")
	for layer in [factor_portrait,factor_frame]:
		layer.mouse_filter=Control.MOUSE_FILTER_IGNORE;layer.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;add_child(layer)
	factor_portrait.material=factor_material;factor_portrait.stretch_mode=TextureRect.STRETCH_SCALE
	factor_frame.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	resized.connect(_layout_factor);_layout_factor()
func present(value: Dictionary, loaded: Dictionary) -> void:
	if value==model and loaded==textures:return
	model=value;textures=loaded;_layout_factor();queue_redraw()
func _layout_factor() -> void:
	var active: bool=model.get("kind","")=="factor"
	factor_portrait.visible=active;factor_frame.visible=active
	if active:
		factor_frame.texture=textures.get(model.get("image",""));factor_frame.position=Vector2.ZERO;factor_frame.size=size
		factor_portrait.texture=textures.get(model.get("portrait",""));factor_portrait.position=size*Vector2(.226,.218);factor_portrait.size=size*Vector2(.548,.56)
		if factor_portrait.texture!=null and factor_portrait.size.x>0 and factor_portrait.size.y>0:
			var natural: Vector2=factor_portrait.texture.get_size();var cover:=maxf(factor_portrait.size.x/natural.x,factor_portrait.size.y/natural.y)
			factor_material.set_shader_parameter("cover_crop",factor_portrait.size/(natural*cover))
	queue_redraw()
func _contain(texture: Texture2D,bounds: Rect2,clip: Rect2) -> void:
	if texture==null:return
	var natural:=Vector2(texture.get_width(),texture.get_height());var scale_factor:=minf(bounds.size.x/natural.x,bounds.size.y/natural.y);var area:=Rect2(bounds.position+(bounds.size-natural*scale_factor)/2,natural*scale_factor);var visible:=area.intersection(clip)
	if visible.has_area():draw_texture_rect_region(texture,visible,Rect2((visible.position-area.position)/scale_factor,visible.size/scale_factor))
func _draw() -> void:
	if model.is_empty():return
	var bounds:=Rect2(Vector2.ZERO,size);var texture: Texture2D=textures.get(model.get("image",""),textures.get(model.get("fallback","")))
	if model.kind=="item":_contain(texture,bounds.grow(-3),bounds);return
	if model.kind=="factor":
		var black:=StyleBoxFlat.new();black.bg_color=Color.BLACK;black.set_corner_radius_all(8);draw_style_box(black,bounds);return
	if model.kind!="clue":push_error("Unsupported original item icon");return
	_contain(texture,bounds,Rect2(size*Vector2(.166,.014),size*Vector2(.668,.971)))
	var window:=Rect2(size*Vector2(.302,.193),size*Vector2(.396,.608));var reveal: bool=model.get("reveal",false)
	if not reveal:draw_style_box(_window_style(),window)
	_contain(textures.get(model.portrait),Rect2(window.get_center()-window.size*1.04/2,window.size*1.04),window.grow(8) if reveal else window)
	var font:=preload("res://native_fonts.gd").weighted(900);var font_size:=int(clampf(size.x*(.08 if model.rank.length()>1 else .105),(11 if model.rank.length()>1 else 13) if reveal else 6,(30 if model.rank.length()>1 else 38) if reveal else 22));var rank_size:=size*Vector2(.108,.108)
	for bottom in [false,true]:
		var origin:=size*Vector2(.202,.07) if not bottom else size*Vector2(.798,.93)
		draw_set_transform(origin,PI if bottom else 0)
		var text_width:=font.get_string_size(model.rank,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x
		draw_string(font,Vector2((rank_size.x-text_width)/2,font_size),model.rank,HORIZONTAL_ALIGNMENT_LEFT,-1,font_size,Color("fff2b8"))
		draw_string(font,Vector2(rank_size.x*.3,font_size*1.45),"◆",HORIZONTAL_ALIGNMENT_LEFT,-1,maxi(4,int(font_size*.46)),Color("63eaff"))
	draw_set_transform(Vector2.ZERO)
func _window_style() -> StyleBoxFlat:
	var style:=StyleBoxFlat.new();style.bg_color=Color("102e40");style.set_corner_radius_all(int(size.x*.028));return style
