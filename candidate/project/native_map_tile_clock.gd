extends Node
const Tiles=preload("res://native_map_tile.gd")
func _process(_delta: float) -> void:
	if get_parent().is_visible_in_tree():Tiles.advance(Time.get_ticks_msec())
