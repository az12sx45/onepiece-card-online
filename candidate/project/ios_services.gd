extends Node
var bridge: Object
var assets: Node
var session: Node
var video: Node

func _ready() -> void:
	if ClassDB.class_exists("PoIOSBridge"): bridge = ClassDB.instantiate("PoIOSBridge")
	assets = preload("res://ios_assets.gd").new(); add_child(assets)
	session = preload("res://ios_session.gd").new(); session.bridge = bridge; add_child(session)
	video = preload("res://ios_video.gd").new(); video.bridge = bridge; video.assets = assets; add_child(video)
	Engine.register_singleton("PoNativeAssets", assets)
	Engine.register_singleton("PoNativeSession", session)
	Engine.register_singleton("PoNativeVideo", video)

func _exit_tree() -> void:
	for key in ["PoNativeAssets","PoNativeSession","PoNativeVideo"]:
		if Engine.has_singleton(key): Engine.unregister_singleton(key)
