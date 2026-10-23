extends Control
const Layer=preload("res://native_sea_splash_layer.gd")
var layers: Dictionary={}
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;z_index=145;hide()
	resized.connect(func():for layer in layers.values():layer.size=size)
func add_layer_json(value: String) -> void:
	var model: Dictionary=JSON.parse_string(value);var layer:=Layer.new();layer.model=model;layer.size=size;add_child(layer);layers[model.id]=layer;show()
func show_layer(id: String) -> void:
	if layers.has(id):layers[id].start()
func close_layer(id: String) -> void:
	if layers.has(id):layers[id].begin_close()
func remove_layer(id: String) -> void:
	if not layers.has(id):return
	layers[id].queue_free();layers.erase(id)
	if layers.is_empty():hide()
