extends Node

signal reply(request_id: String, result_json: String)
var _plugin: Object

func _ready() -> void:
	if Engine.has_singleton("PoNativeSession"):
		_plugin = Engine.get_singleton("PoNativeSession")
		_plugin.connect("reply", _on_reply)

func available() -> bool:
	return is_instance_valid(_plugin)

func request(request_id: String, method: String, arguments_json: String) -> void:
	if not available():
		_on_reply.call_deferred(request_id, JSON.stringify({"ok": false, "error": "Secure session service unavailable"}))
		return
	_plugin.call("request", request_id, method, arguments_json)

func _on_reply(request_id: String, result_json: String) -> void:
	reply.emit(request_id, result_json)

func _exit_tree() -> void:
	if available() and _plugin.is_connected("reply", _on_reply):
		_plugin.disconnect("reply", _on_reply)
