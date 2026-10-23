extends Node2D
## Persistent native scene for original VFX coordinates and GPU filter groups.
## Sampled render comparisons do not establish full game or device acceptance.
const Paint=preload("res://native_tavern_vfx_paint.gd")
const FilterGroup=preload("res://native_tavern_filter_group.gd")
var assets: Dictionary={}
var items: Dictionary={}
var additive:=CanvasItemMaterial.new()
var frames:=0
var item_creations:=0
var filters_pending:=false
func _ready() -> void:
	additive.blend_mode=CanvasItemMaterial.BLEND_MODE_ADD
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR
	for key in ["halo","seam","dot","spark","longSpark","star","shard"]:
		# Imported lossless resource survives PCK export. Import settings disable
		# alpha-border recoloring; tavern-texture-probe compares every RGBA byte.
		var texture:=load("res://tavern-vfx-textures/"+key+".png") as Texture2D
		assert(texture!=null,"Original tavern procedural texture missing")
		assets[key]=texture
	hide()
func apply_frame_json(value: String) -> void:
	var frame: Dictionary=JSON.parse_string(value)
	for entry in frame.nodes:
		var id:=int(entry.id)
		if not items.has(id):
			var item: Node2D=FilterGroup.new() if entry.get("canFilter",false) else Paint.new();items[id]=item;var parent: Node=items[int(entry.parent)] if int(entry.parent)!=0 else self
			if parent.has_method("children_root"):parent=parent.children_root()
			parent.add_child(item);item_creations+=1
		if items[id].has_method("resize_surface"):items[id].resize_surface(Vector2i(roundi(frame.geometry.width),roundi(frame.geometry.height)))
		items[id].configure(entry,assets,additive)
	var motion: Array=frame.get("motion",[])
	assert(motion.size()%9==0,"Invalid native VFX transform packet")
	for offset in range(0,motion.size(),9):
		var id:=int(motion[offset]);assert(items.has(id),"VFX transform precedes item creation")
		items[id].apply_motion(motion,offset+1)
	frames+=1;show()
func reset() -> void:
	hide()
	for child in get_children():child.queue_free()
	items.clear();frames=0;item_creations=0
func stats_json() -> String:return JSON.stringify({"frames":frames,"items":items.size(),"creations":item_creations,"textures":assets.size(),"filtersPending":filters_pending})
