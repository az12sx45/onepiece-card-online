extends Control
var game: Control

func _ready() -> void:
	var backdrop := ColorRect.new()
	backdrop.color=Color("061722"); backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(backdrop); backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	game=preload("res://native-product.tscn").instantiate()
	add_child(game); game.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	resized.connect(_layout); _layout()

func _layout() -> void:
	if not is_instance_valid(game): return
	var area := Rect2(Vector2.ZERO,size)
	if OS.get_name()=="iOS":
		var safe := DisplayServer.get_display_safe_area()
		var inverse := get_viewport().get_final_transform().affine_inverse()
		if safe.size.x>0 and safe.size.y>0:
			area = (inverse * Rect2(safe)).intersection(area)
	game.position=area.position; game.size=area.size
