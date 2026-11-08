extends Node
## Trusted transport for the fixed iOS Board program channel.

const ORIGIN := "https://game-assets.rihdi.tw/"
const SIGNATURE_DOMAIN := "PO-IOS-BOARD-PROGRAM-V1\n"
const MANIFEST_LIMIT := 4096
const ENVELOPE_LIMIT := 8192
const BASE64_ALPHABET := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BLOB_LIMITS := {
	"native-turn-control-sync.js": 256 * 1024,
	"native_battle_stage.gdc": 2 * 1024 * 1024,
	"original-core.js": 16 * 1024 * 1024,
}

class Transfer:
	signal finished(response: Dictionary)
	var request: HTTPRequest

var _key: CryptoKey
var _manifest_url := ""
var _blob_base_url := ""
var _host_build := 0
var _base := ""
var _active: Transfer


func configure(config: Dictionary) -> bool:
	if _key != null:
		return false
	var manifest_url: String = str(config.get("manifestUrl", ""))
	var blob_base_url: String = str(config.get("blobBaseUrl", ""))
	var base: String = str(config.get("base", ""))
	var key_text: String = str(config.get("publicKey", ""))
	var build: Variant = config.get("hostBuild")
	if not _whole_number(build, 1, 2147483647) or base.is_empty():
		return false
	if not _channel_url(manifest_url) or manifest_url.ends_with("/"):
		return false
	if not _channel_url(blob_base_url) or not blob_base_url.ends_with("/"):
		return false
	if not key_text.begins_with("-----BEGIN PUBLIC KEY-----") or key_text.length() > 2048:
		return false
	var key := CryptoKey.new()
	if key.load_from_string(key_text, true) != OK or not key.is_public_only():
		return false
	_key = key
	_manifest_url = manifest_url
	_blob_base_url = blob_base_url
	_host_build = int(build)
	_base = base
	return true


func verify_envelope(raw: PackedByteArray) -> Dictionary:
	if _key == null or raw.is_empty() or raw.size() > ENVELOPE_LIMIT:
		return {"error": "invalid_envelope"}
	var envelope: Variant = _parse_json(raw)
	if not envelope is Dictionary or not _exact_fields(envelope, ["manifest", "signature"]):
		return {"error": "invalid_envelope"}
	var manifest_bytes := _decode_base64(envelope.manifest, MANIFEST_LIMIT)
	var signature := _decode_base64(envelope.signature, 512)
	if manifest_bytes.is_empty() or not signature.size() in [256, 384, 512]:
		return {"error": "invalid_envelope"}
	var signed_bytes := SIGNATURE_DOMAIN.to_utf8_buffer()
	signed_bytes.append_array(manifest_bytes)
	var hash := HashingContext.new()
	if hash.start(HashingContext.HASH_SHA256) != OK or hash.update(signed_bytes) != OK:
		return {"error": "invalid_signature"}
	if not Crypto.new().verify(HashingContext.HASH_SHA256, hash.finish(), signature, _key):
		return {"error": "invalid_signature"}
	var manifest: Variant = _parse_json(manifest_bytes)
	if not manifest is Dictionary or not _valid_manifest(manifest):
		return {"error": "invalid_manifest"}
	manifest.schema = int(manifest.schema)
	manifest.hostBuild = int(manifest.hostBuild)
	manifest.sequence = int(manifest.sequence)
	for row in manifest.files:
		row.bytes = int(row.bytes)
	return {"manifest": manifest, "envelope": raw}


func fetch_manifest() -> Dictionary:
	if _key == null:
		return {"error": "channel_unavailable"}
	var response := await _request(_manifest_url, ENVELOPE_LIMIT, 20.0)
	if response.has("error"):
		return response
	return verify_envelope(response.body)


func download_blob(row: Dictionary, destination: String) -> Dictionary:
	if _key == null or not _valid_row(row):
		return {"error": "invalid_blob"}
	if not destination.begins_with("user://") or destination.simplify_path() != destination:
		return {"error": "invalid_destination"}
	var digest: String = row.sha256
	if destination.get_file() != digest:
		return {"error": "invalid_destination"}
	var folder := DirAccess.open(destination.get_base_dir())
	if folder == null or folder.is_link(digest) or folder.is_link(digest + ".part"):
		return {"error": "invalid_destination"}
	if _active != null:
		return {"error": "request_in_progress"}
	if _matches_file(destination, int(row.bytes), digest):
		return {"ok": true, "bytes": 0}
	var temporary := destination + ".part"
	if FileAccess.file_exists(temporary) and DirAccess.remove_absolute(temporary) != OK:
		return {"error": "storage_unavailable"}
	var response := await _request(_blob_base_url + digest, int(row.bytes), 120.0, temporary)
	if not response.has("error"):
		if not _matches_file(temporary, int(row.bytes), digest):
			response = {"error": "blob_integrity"}
		elif DirAccess.rename_absolute(temporary, destination) != OK:
			response = {"error": "storage_unavailable"}
	if response.has("error"):
		if FileAccess.file_exists(temporary):
			DirAccess.remove_absolute(temporary)
		return response
	return {"ok": true, "bytes": int(row.bytes)}


func cancel() -> void:
	if _active == null:
		return
	var transfer := _active
	transfer.request.cancel_request()
	_finish(transfer, {"error": "cancelled"})


func _request(url: String, max_bytes: int, timeout: float, file_path := "") -> Dictionary:
	if _active != null:
		return {"error": "request_in_progress"}
	if not _channel_url(url):
		return {"error": "invalid_url"}
	var transfer := Transfer.new()
	var request := HTTPRequest.new()
	transfer.request = request
	_active = transfer
	request.timeout = timeout
	request.max_redirects = 0
	request.accept_gzip = false
	request.body_size_limit = max_bytes
	request.download_file = file_path
	request.request_completed.connect(_received.bind(transfer), CONNECT_ONE_SHOT)
	add_child(request)
	var error := request.request(url, PackedStringArray(["Accept-Encoding: identity"]))
	if error != OK:
		_active = null
		request.queue_free()
		return {"error": "request_failed"}
	return await transfer.finished


func _received(result: int, status: int, headers: PackedStringArray, body: PackedByteArray, transfer: Transfer) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or status != 200:
		_finish(transfer, {"error": "http_failure", "status": status, "result": result})
		return
	for header in headers:
		if header.to_lower().begins_with("content-encoding:") and header.get_slice(":", 1).strip_edges().to_lower() != "identity":
			_finish(transfer, {"error": "unexpected_encoding"})
			return
	_finish(transfer, {"body": body})


func _finish(transfer: Transfer, response: Dictionary) -> void:
	if _active != transfer:
		return
	_active = null
	transfer.request.queue_free()
	transfer.finished.emit(response)


func _valid_manifest(manifest: Dictionary) -> bool:
	if not _exact_fields(manifest, ["schema", "game", "platform", "hostBuild", "base", "sequence", "version", "files"]):
		return false
	if not _whole_number(manifest.schema, 1, 1) or not manifest.game is String or not manifest.platform is String:
		return false
	if manifest.game != "board" or manifest.platform != "ios" or not manifest.base is String:
		return false
	if not _whole_number(manifest.hostBuild, _host_build, _host_build) or manifest.base != _base:
		return false
	if not _whole_number(manifest.sequence, 1, 2147483647) or not _safe_version(manifest.version):
		return false
	if not manifest.files is Array or manifest.files.size() != BLOB_LIMITS.size():
		return false
	var previous := ""
	for row in manifest.files:
		if not row is Dictionary or not _valid_row(row) or row.path <= previous:
			return false
		previous = row.path
	return true


func _valid_row(row: Dictionary) -> bool:
	return (
		_exact_fields(row, ["path", "sha256", "bytes"])
		and row.path is String and BLOB_LIMITS.has(row.path)
		and _whole_number(row.bytes, 1, BLOB_LIMITS[row.path])
		and row.sha256 is String and row.sha256.length() == 64
		and _has_only(row.sha256, "0123456789abcdef")
	)


func _exact_fields(data: Dictionary, fields: Array) -> bool:
	return data.size() == fields.size() and data.has_all(fields)


func _whole_number(value: Variant, low: int, high: int) -> bool:
	return (value is int or value is float) and value >= low and value <= high and value == int(value)


func _safe_version(value: Variant) -> bool:
	return value is String and value.length() <= 48 and not value.is_empty() and value.strip_edges() == value and _has_only(value, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._- ")


func _parse_json(raw: PackedByteArray) -> Variant:
	for byte in raw:
		if (byte < 32 or byte > 126) and not byte in [9, 10, 13]:
			return null
	var parser := JSON.new()
	return parser.data if parser.parse(raw.get_string_from_utf8()) == OK else null


func _decode_base64(value: Variant, max_bytes: int) -> PackedByteArray:
	if not value is String or value.is_empty() or value.length() % 4 != 0 or value.length() > ((max_bytes + 2) / 3) * 4:
		return PackedByteArray()
	var unpadded: String = value.trim_suffix("=").trim_suffix("=")
	if not _has_only(unpadded, BASE64_ALPHABET):
		return PackedByteArray()
	var bytes := Marshalls.base64_to_raw(value)
	return bytes if not bytes.is_empty() and bytes.size() <= max_bytes and Marshalls.raw_to_base64(bytes) == value else PackedByteArray()


func _matches_file(path: String, bytes: int, digest: String) -> bool:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var correct_size := file.get_length() == bytes
	file.close()
	return correct_size and FileAccess.get_sha256(path) == digest


func _channel_url(url: String) -> bool:
	var origin := _origin()
	if not url.begins_with(origin) or url.length() > 512:
		return false
	var path := url.trim_prefix(origin).trim_suffix("/")
	if path.is_empty() or not _has_only(path, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-/"):
		return false
	for part in path.split("/"):
		if part.is_empty() or part == "." or part == "..":
			return false
	return true


func _origin() -> String:
	return ORIGIN


func _has_only(value: String, alphabet: String) -> bool:
	for index in range(value.length()):
		if not alphabet.contains(value[index]):
			return false
	return true
