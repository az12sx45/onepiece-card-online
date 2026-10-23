extends Node
signal reply(request_id: String, result_json: String)
var bridge: Object

func request(request_id: String, method: String, arguments_json: String) -> void:
	var result := '{"ok":false,"error":"secure_storage_unavailable"}'
	if bridge != null and arguments_json.length() <= 131072 and method in ["getNativeState","saveSession","clearSession"]:
		result = bridge.call("session_request", method, arguments_json)
	reply.emit.call_deferred(request_id, result)
