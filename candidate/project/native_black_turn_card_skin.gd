extends Node
## Live native composition of the source cast card. Front/back imagery is
## supplied by the original event, never a prerecorded animation frame.
const Paint=preload("res://native_black_turn_paint.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
const Projected=preload("res://native_projected_image.gd")
const Motion=preload("res://native_black_turn_motion.gd")
var cache: Node
var surface: SubViewport
var body: Control
var face_surface: SubViewport
var face_image: TextureRect
var front: Control
var back_surface: SubViewport
var back: TextureRect
var ornaments: Dictionary={}
var overlays: Array[Control]=[]
var paint_nodes: Dictionary={}
var extent:=Vector2.ZERO
var inset:=8.0
var padding:=256.0
var catalog: Dictionary
var skin: Dictionary
var last_image: Texture2D
var fraction:=-1.0
var facing:=true
var ready_art:=false
var paints:=0

func _ready() -> void:
	catalog=JSON.parse_string(FileAccess.get_file_as_string("res://demon-art-catalog.json")).catalog
	if not "images/board/battle/black_turn/" in cache.mipmap_prefixes:cache.mipmap_prefixes.append("images/board/battle/black_turn/")
	skin=Motion.data.skin
	surface=_viewport();body=Control.new();body.mouse_filter=Control.MOUSE_FILTER_IGNORE;surface.add_child(body)
	face_surface=_viewport();back_surface=_viewport()
	_paint("body",4,body)
	var ordered: Array=catalog.layers.duplicate();ordered.sort_custom(func(a,b):return float(a.z)<float(b.z))
	for layer in ordered:
		if layer.display=="none" or float(layer.opacity)==0:continue
		var art:=Filtered.new();body.add_child(art);art.passes[0].effect.set_shader_parameter("source_fill",true);art.hide();ornaments[layer.key]=art
	front=Filtered.new();body.add_child(front);front.passes[0].effect.set_shader_parameter("source_fill",true);front.passes[0].effect.set_shader_parameter("source_premultiplied",true)
	back=TextureRect.new();back.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;back.flip_h=true;back.mouse_filter=Control.MOUSE_FILTER_IGNORE;body.add_child(back)
	_premultiplied(back)
	for pair in [["tint",9],["vignette",10]]:
		var painter:=Paint.new();add_child(painter);paint_nodes[pair[0]]={"paint":painter}
		var overlay:=Projected.new();body.add_child(overlay);overlays.append(overlay)
	# Source wings are below the portrait; all remaining ornament layers are
	# above the portrait and its two multiply pseudo-elements.
	for layer in ordered:
		if ornaments.has(layer.key) and int(layer.z)>2:body.move_child(ornaments[layer.key],body.get_child_count()-1)
	_paint("face-bg",5,face_surface)
	face_image=TextureRect.new();face_image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;face_image.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;face_image.material=ShaderMaterial.new();face_image.material.shader=preload("res://portrait_round_clip.gdshader");face_image.material.set_shader_parameter("corner_radius",6.0);face_image.mouse_filter=Control.MOUSE_FILTER_IGNORE;face_surface.add_child(face_image)
	_paint("face-border",11,face_surface)
	_paint("back-bg",6,back_surface);_paint("back-border",11,back_surface)
	var sigil:=Paint.new();add_child(sigil);var sigil_filter:=Filtered.new();back_surface.add_child(sigil_filter);sigil_filter.passes[0].effect.set_shader_parameter("source_fill",true);sigil_filter.passes[0].effect.set_shader_parameter("source_premultiplied",true);paint_nodes.sigil={"paint":sigil,"image":sigil_filter}
	cache.asset_ready.connect(_asset_ready)
	for layer in ordered:
		if not ornaments.has(layer.key):continue
		var image: Texture2D=cache.request(layer.image)
		if image!=null:ornaments[layer.key].set_meta("image",image)

func _viewport() -> SubViewport:
	var value:=SubViewport.new();value.disable_3d=true;value.transparent_bg=true;value.size=Vector2i.ONE;value.render_target_update_mode=SubViewport.UPDATE_DISABLED;add_child(value);return value

func _paint(key: String,kind: int,parent: Node) -> void:
	var painter:=Paint.new();add_child(painter)
	var image:=TextureRect.new();image.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;image.mouse_filter=Control.MOUSE_FILTER_IGNORE;parent.add_child(image)
	_premultiplied(image)
	paint_nodes[key]={"paint":painter,"image":image,"kind":kind}

func _premultiplied(image: TextureRect) -> void:
	image.material=ShaderMaterial.new();image.material.shader=preload("res://native_premultiplied_texture.gdshader")

func _place_paint(key: String,dimensions: Vector2,origin: Vector2) -> void:
	var item: Dictionary=paint_nodes[key];item.paint.configure(item.kind,dimensions);item.image.texture=item.paint.texture();item.image.position=origin-Vector2.ONE*item.paint.padding;item.image.size=item.paint.paint_size()
	RenderingServer.viewport_set_parent_viewport(item.paint.surface.get_viewport_rid(),item.image.get_viewport().get_viewport_rid())

func configure(dimensions: Vector2,stage_width: float) -> void:
	extent=dimensions;inset=clampf(stage_width*.01,8,12);padding=maxf(256,ceilf(extent.x*.6+80))
	surface.size=Vector2i((extent+Vector2.ONE*padding*2).ceil());body.size=Vector2(surface.size)
	# CSS absolute descendants use the padding box inside the 1px card border.
	var origin:=Vector2.ONE*padding;var face_extent:=extent-Vector2.ONE*(inset*2+2)
	_place_paint("body",extent,origin)
	var face_padding: float=paint_nodes["face-bg"].paint.padding
	face_surface.size=Vector2i((face_extent+Vector2.ONE*face_padding*2).ceil());back_surface.size=face_surface.size
	for key in ["face-bg","face-border","back-bg","back-border"]:_place_paint(key,face_extent,Vector2.ONE*face_padding)
	face_image.position=Vector2.ONE*(face_padding+2);face_image.size=face_extent-Vector2.ONE*4;face_image.material.set_shader_parameter("card_size",face_image.size)
	front.configure(face_surface.get_texture(),Vector2(face_surface.size));front.position=origin+Vector2.ONE*(1+inset-face_padding)
	front.bind_live_source(face_surface)
	RenderingServer.viewport_set_parent_viewport(back_surface.get_viewport_rid(),surface.get_viewport_rid())
	back.texture=back_surface.get_texture();back.size=Vector2(back_surface.size);back.position=front.position
	var sigil: Dictionary=paint_nodes.sigil;var sigil_size:=Vector2.ONE*(face_extent.x-4)*.62;sigil.paint.configure(7,sigil_size);sigil.image.configure(sigil.paint.texture(),sigil.paint.paint_size());sigil.image.position=Vector2.ONE*face_padding+(face_extent-sigil_size)*.5-Vector2.ONE*sigil.paint.padding
	sigil.image.apply_filters([{"kind":"blur","value":.4},{"kind":"drop-shadow","x":0.0,"y":0.0,"blur":18.0,"color":[180.0/255,114.0/255,1.0,.82]}])
	sigil.image.bind_live_source(sigil.paint.surface)
	for i in range(2):
		var painter: Node=paint_nodes["tint" if i==0 else "vignette"].paint;painter.configure(9+i,face_extent)
		overlays[i].configure(painter.texture(),painter.paint_size(),Vector2(surface.size),face_extent,painter.padding)
		overlays[i].filtered.bind_live_source(painter.surface)
	_layout_ornaments();face_surface.render_target_update_mode=SubViewport.UPDATE_ONCE;back_surface.render_target_update_mode=SubViewport.UPDATE_ONCE;front.filter_signature="";surface.render_target_update_mode=SubViewport.UPDATE_ONCE

func _asset_ready(path: String,image: Texture2D) -> void:
	for layer in catalog.layers:
		if layer.image==path and ornaments.has(layer.key):ornaments[layer.key].set_meta("image",image);_layout_ornaments();surface.render_target_update_mode=SubViewport.UPDATE_ONCE

func _layout_ornaments() -> void:
	if extent==Vector2.ZERO:return
	ready_art=true
	for layer in catalog.layers:
		if not ornaments.has(layer.key):continue
		var art: Control=ornaments[layer.key]
		if not art.has_meta("image"):ready_art=false;continue
		var content:=extent-Vector2.ONE*2;var dimensions: Vector2=content*Vector2(layer.w,layer.h);art.configure(art.get_meta("image"),dimensions);art.apply_filters(layer.filters);art.position=Vector2.ONE*(padding+1)+content*Vector2(layer.x,layer.y)-dimensions*.5
	for layer in catalog.layers:
		if ornaments.has(layer.key):ornaments[layer.key].visible=ready_art and facing and fraction>=0;ornaments[layer.key].modulate.a=maxf(0,fraction)*float(layer.opacity)

func set_state(image: Texture2D,demon_fraction: float,front_facing: bool) -> bool:
	var changed:=false
	if image!=last_image:
		last_image=image;face_image.texture=image;face_surface.render_target_update_mode=SubViewport.UPDATE_ONCE;front.passes[0].view.render_target_update_mode=SubViewport.UPDATE_ONCE;front.filter_signature="";changed=true
	if fraction!=demon_fraction or facing!=front_facing or front.filter_signature.is_empty():
		fraction=demon_fraction;facing=front_facing;changed=true
		front.visible=facing;back.visible=not facing
		front.apply_filters(skin.demonFilters if fraction>=0 else skin.normalFilters)
		for layer in catalog.layers:
			if not ornaments.has(layer.key):continue
			ornaments[layer.key].visible=facing and ready_art and fraction>=0;ornaments[layer.key].modulate.a=maxf(0,fraction)*float(layer.opacity)
		for i in range(2):
			var overlay: Control=overlays[i];overlay.visible=facing and fraction>=0
			if overlay.visible:overlay.apply_state({"transform":Transform3D.IDENTITY,"filters":[],"opacity":fraction*float(skin.tintOpacity if i==0 else skin.vignetteOpacity),"clip":[0,0,0,0],"multiply_blend":true},Vector2.ONE*(padding+1+inset),Vector2(surface.size)*.5,0)
	if changed:surface.render_target_update_mode=SubViewport.UPDATE_ONCE;paints+=1
	return changed

func texture() -> Texture2D:return surface.get_texture()
func paint_size() -> Vector2:return Vector2(surface.size)
func stop() -> void:
	fraction=-2;last_image=null
	for viewport in [surface,face_surface,back_surface]:viewport.render_target_update_mode=SubViewport.UPDATE_DISABLED
	front.stop()
	for art in ornaments.values():art.stop()
	for overlay in overlays:overlay.stop()
