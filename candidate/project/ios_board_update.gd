extends Node
## An overlay is selected at most once per process, before loading any Board resource.
signal changed

const MAX_STATE_BYTES := 512 * 1024
const STATE_SCHEMA := 1
const BUNDLED := ""
const QA_MANIFEST_LIMIT := 24 * 1024
const QA_MANIFEST_FILE := "qa-envelope.json"
const UNUSED_CACHE_SECONDS := 7 * 24 * 60 * 60

var _transport: Node
var _identity: String
var _directory: String
var _bundled_version: String
var _qa_version: String
var _files := PackedStringArray()
var _base_files: Dictionary = {}
var _disk: Dictionary = {"highWater": 0, "active": BUNDLED, "previous": BUNDLED, "pending": BUNDLED, "trial": false}
var _boot_pending: String = BUNDLED
var _prepared := false
var _mounted: String = BUNDLED
var _mounted_trial := false
var _blocked_until_restart := false
var _ready_to_update := false
var _checking := false
var _remote: Dictionary = {}
var _operation := 0
var _installing := false
var _next_check_ms := 0
var _message := ""
var _received := 0
var _reused := 0
var _total := 0

func setup(config: Dictionary) -> void:
	_bundled_version = str(config.get("bundledVersion", "內建"))
	_identity = str(config.get("base", ""))
	_qa_version = str(config.get("qaVersion", ""))
	var build := int(config.get("hostBuild", 0))
	var platform := str(config.get("platform", ""))
	_directory = str(config.get("storeRoot", "user://po-%s-board-program/host-%d" % [platform, build]))
	if not _private_directory(_directory) or _identity.is_empty():
		return
	var transport_script := load("res://ios_board_transport.gd") as GDScript
	if transport_script == null:
		return
	_transport = transport_script.new()
	add_child(_transport)
	if not _transport.configure(config):
		return
	_files = _transport.resource_paths()
	for name: String in _files:
		var path := "res://" + name
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			_message = "找不到內建遊戲更新基準。"
			return
		_base_files[name] = {"bytes": file.get_length(), "sha256": FileAccess.get_sha256(path)}
		file.close()
	if DirAccess.make_dir_recursive_absolute(_directory.path_join("cas")) != OK or not _read_state():
		_message = "遊戲更新紀錄無法讀取，仍可使用內建版本。"
		return
	# A previous process mounted this trial but did not complete Board startup.
	if _disk.trial:
		var next := _disk.duplicate()
		next.pending = BUNDLED
		next.trial = false
		if not _save(next):
			_message = "無法保留回退紀錄，仍可使用內建版本。"
			return
		_message = "上次試用未完成，已回到可用版本。"
	_boot_pending = _disk.pending
	_ready_to_update = true
	_prune_cache()
	check_remote.call_deferred()

func state() -> Dictionary:
	var current: String = _mounted if _prepared else (_disk.active if _ready_to_update else BUNDLED)
	var pending: String = _disk.pending
	var current_manifest := _manifest(current)
	var version := str(current_manifest.get("version", _bundled_version))
	var remote_version := _version(pending) if pending != BUNDLED else version
	var staged := pending != BUNDLED and not _mounted_trial
	var pending_launch := staged and pending == _boot_pending and not _prepared
	var status := "installed"
	var message := _message
	if _installing:
		status = "downloading"
	elif staged:
		message = "更新已下載，啟動遊戲時套用。" if pending_launch else "更新已下載，請完全關閉並重新開啟 App 套用。"
	elif _offers_update():
		status = "update"
		remote_version = str(_remote.manifest.version)
	if _blocked_until_restart:
		status = "installed"
		message = "請完全關閉並重新開啟 App，載入上次可用版本。"
	return {"status": status, "hasInstalled": true, "removable": false,
		"installedVersion": version, "remoteVersion": remote_version, "message": message,
		"boardRevision": int(current_manifest.get("sequence", 0)),
		"pendingRestart": staged and not pending_launch, "pendingLaunch": pending_launch,
		"restartRequired": _blocked_until_restart, "canRollback": current != BUNDLED or pending != BUNDLED,
		"fetchedBytes": _received if _installing else int(_disk.get("fetchedBytes", 0)),
		"reusedBytes": _reused if _installing else int(_disk.get("reusedBytes", 0)),
		"downloadedBytes": _received + _reused, "totalBytes": _total}

func check_remote() -> void:
	if not _ready_to_update or _checking or _installing or Time.get_ticks_msec() < _next_check_ms:
		return
	_checking = true
	_next_check_ms = Time.get_ticks_msec() + 60000
	var result: Dictionary = await _transport.fetch_manifest()
	_checking = false
	if not _valid_manifest(result) or int(result.manifest.sequence) < 2:
		result = _read_local_qa_manifest()
	if _valid_manifest(result):
		_remote = result
	else:
		_remote = {}
	changed.emit()

func _read_local_qa_manifest() -> Dictionary:
	if int(_disk.highWater) != 0:
		return {}
	var folder := DirAccess.open(_directory)
	if folder == null or folder.is_link(QA_MANIFEST_FILE):
		return {}
	var file := FileAccess.open(_directory.path_join(QA_MANIFEST_FILE), FileAccess.READ)
	if file == null or file.get_length() > QA_MANIFEST_LIMIT:
		return {}
	var result: Dictionary = _transport.verify_envelope(file.get_buffer(file.get_length()))
	file.close()
	if _valid_manifest(result) and int(result.manifest.sequence) == 1 and result.manifest.version == _qa_version:
		return result
	return {}

func install() -> bool:
	if not _ready_to_update or _installing or _checking or _disk.pending != BUNDLED or _blocked_until_restart or not _offers_update():
		return false
	_installing = true
	_operation += 1
	_message = ""
	_received = 0
	_reused = 0
	_total = 0
	for row in _remote.manifest.files:
		_total += int(row.bytes)
	changed.emit()
	_install.call_deferred(_remote, _operation)
	return true

func cancel() -> bool:
	if not _installing:
		return false
	_operation += 1
	_installing = false
	_message = "已暫停遊戲更新。"
	_transport.cancel()
	changed.emit()
	return true

func prepare_board() -> bool:
	if _blocked_until_restart:
		return false
	if _prepared or not _ready_to_update:
		return true
	_prepared = true
	if _boot_pending != BUNDLED and _boot_pending == _disk.pending:
		var result := _prepare_overlay(_boot_pending, true)
		if result != ERR_INVALID_DATA:
			return result == OK
		var next := _disk.duplicate()
		next.pending = BUNDLED
		_save(next)
		_message = "更新檔案驗證失敗，已保留舊版。"
	if _disk.active != BUNDLED:
		var result := _prepare_overlay(_disk.active, false)
		if result != ERR_INVALID_DATA:
			return result == OK
		var next := _disk.duplicate()
		next.active = next.previous
		next.previous = BUNDLED
		if not _save(next):
			return true
		_message = "目前套件驗證失敗，已回到可用版本。"
		if _disk.active != BUNDLED:
			result = _prepare_overlay(_disk.active, false)
			if result != ERR_INVALID_DATA:
				return result == OK
			next = _disk.duplicate()
			next.active = BUNDLED
			_save(next)
	changed.emit()
	return true

func confirm_board() -> void:
	if not _mounted_trial or _disk.pending != _mounted:
		return
	var next := _disk.duplicate()
	next.previous = next.active
	next.active = next.pending
	next.pending = BUNDLED
	next.trial = false
	if _save(next):
		_mounted_trial = false
		_message = ""
	else:
		_message = "無法保存啟用紀錄，下次開啟會保留舊版。"
	changed.emit()

func needs_full_preflight() -> bool:
	return _mounted_trial

func fail_board() -> void:
	if _mounted == BUNDLED:
		return
	var next := _disk.duplicate()
	if not _mounted_trial and next.active == _mounted:
		next.active = next.previous
		next.previous = BUNDLED
	next.pending = BUNDLED
	next.trial = false
	_save(next)
	_blocked_until_restart = true
	changed.emit()

func rollback() -> bool:
	if not _ready_to_update or _installing or _blocked_until_restart:
		return false
	var next := _disk.duplicate()
	if next.pending != BUNDLED:
		next.pending = BUNDLED
		next.trial = false
	elif next.active != BUNDLED:
		next.active = next.previous
		next.previous = BUNDLED
	else:
		return false
	if not _save(next):
		return false
	if _mounted != BUNDLED and _mounted != next.active:
		_blocked_until_restart = true
	changed.emit()
	return true

func _install(result: Dictionary, operation: int) -> void:
	if operation != _operation:
		return
	for row in result.manifest.files:
		var size := int(row.bytes)
		var destination := _cas_path(row.sha256)
		if _matches_base(row) or _file_matches(destination, row):
			_reused += size
		else:
			var transfer: Dictionary = await _transport.download_blob(row, destination)
			if operation != _operation:
				return
			if transfer.get("ok") != true or not _file_matches(destination, row):
				_finish_install("遊戲更新下載失敗，已保留舊版。")
				return
			_received += int(transfer.get("bytes", size))
		changed.emit()
	var next := _disk.duplicate()
	next.highWater = int(result.manifest.sequence)
	next.pending = Marshalls.raw_to_base64(result.envelope)
	next.fetchedBytes = _received
	next.reusedBytes = _reused
	if not _save(next):
		_finish_install("無法保存遊戲更新，已保留舊版。")
		return
	_finish_install("")

func _finish_install(message: String) -> void:
	_installing = false
	_message = message
	changed.emit()

func _prepare_overlay(encoded: String, trial: bool) -> Error:
	var result: Dictionary = _transport.verify_envelope(Marshalls.base64_to_raw(encoded))
	if not _valid_manifest(result):
		return ERR_INVALID_DATA
	var sequence := int(result.manifest.sequence)
	if sequence > int(_disk.highWater) or (trial and sequence != int(_disk.highWater)):
		return ERR_INVALID_DATA
	var needed: Array = []
	for row in result.manifest.files:
		if _matches_base(row):
			continue
		if not _file_matches(_cas_path(row.sha256), row):
			return ERR_INVALID_DATA
		needed.append(row)
	var pack_path := _directory.path_join("boot.pck")
	if not needed.is_empty() and not _make_pack(needed, pack_path):
		return ERR_INVALID_DATA
	if trial:
		var next := _disk.duplicate()
		next.trial = true
		if not _save(next):
			return ERR_INVALID_DATA
	_mounted = encoded
	_mounted_trial = trial
	if not needed.is_empty() and not ProjectSettings.load_resource_pack(pack_path, true):
		# Any attempted mount can have touched the engine's resource index.
		fail_board()
		return ERR_CANT_OPEN
	changed.emit()
	return OK

func _make_pack(rows: Array, destination: String) -> bool:
	var temporary := destination + ".tmp"
	var pack := PCKPacker.new()
	if pack.pck_start(temporary) != OK:
		return false
	for row in rows:
		if pack.add_file("res://" + row.path, _cas_path(row.sha256)) != OK:
			return false
	return pack.flush() == OK and DirAccess.rename_absolute(temporary, destination) == OK

func _read_state() -> bool:
	var path := _directory.path_join("state.json")
	if not FileAccess.file_exists(path):
		return true
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > MAX_STATE_BYTES:
		return false
	var value: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not value is Dictionary or value.get("schema") != STATE_SCHEMA or value.get("base") != _identity:
		return false
	var high_water: Variant = value.get("highWater")
	if not (high_water is int or high_water is float) or high_water < 0 or high_water > 9007199254740991 or high_water != int(high_water):
		return false
	for key in ["active", "previous", "pending"]:
		if not value.get(key) is String:
			return false
	if not value.get("trial") is bool or (value.trial and value.pending == BUNDLED):
		return false
	_disk = {"highWater": int(high_water), "active": value.active, "previous": value.previous,
		"pending": value.pending, "trial": value.trial}
	for key in ["fetchedBytes", "reusedBytes"]:
		var count: Variant = value.get(key, 0)
		if (count is int or count is float) and count >= 0 and count <= 32 * 1024 * 1024 and count == int(count):
			_disk[key] = int(count)
	return true

func _save(next: Dictionary) -> bool:
	var path := _directory.path_join("state.json")
	var temporary := path + ".tmp"
	var value := next.duplicate()
	value.schema = STATE_SCHEMA
	value.base = _identity
	var data := JSON.stringify(value).to_utf8_buffer()
	if data.size() > MAX_STATE_BYTES:
		return false
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	file.store_buffer(data)
	file.flush()
	var error := file.get_error()
	file.close()
	if error != OK or DirAccess.rename_absolute(temporary, path) != OK:
		return false
	_disk = next
	return true

func _valid_manifest(result: Dictionary) -> bool:
	if not result.get("manifest") is Dictionary or not result.get("envelope") is PackedByteArray:
		return false
	var manifest: Dictionary = result.manifest
	if manifest.get("base") != _identity or not manifest.get("files") is Array or manifest.files.size() != _files.size():
		return false
	for index in _files.size():
		var row: Variant = manifest.files[index]
		if not row is Dictionary or row.get("path") != _files[index] or not _digest(row.get("sha256")):
			return false
	return true

func _offers_update() -> bool:
	return _remote.has("manifest") and int(_remote.manifest.sequence) > int(_disk.highWater)

func _version(encoded: String) -> String:
	return str(_manifest(encoded).get("version", _bundled_version))

func _manifest(encoded: String) -> Dictionary:
	if encoded == BUNDLED or _transport == null:
		return {}
	var result: Dictionary = _transport.verify_envelope(Marshalls.base64_to_raw(encoded))
	return result.manifest if _valid_manifest(result) else {}

func _matches_base(row: Dictionary) -> bool:
	var original: Dictionary = _base_files[row.path]
	return original.bytes == int(row.bytes) and original.sha256 == row.sha256

func _file_matches(path: String, row: Dictionary) -> bool:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var size := file.get_length()
	file.close()
	return size == int(row.bytes) and FileAccess.get_sha256(path) == row.sha256

func _cas_path(digest: String) -> String:
	return _directory.path_join("cas").path_join(digest)

func _prune_cache() -> void:
	var folder := DirAccess.open(_directory.path_join("cas"))
	if folder == null:
		return
	var keep := {}
	for encoded: String in [_disk.active, _disk.previous, _disk.pending]:
		if encoded == BUNDLED:
			continue
		var manifest := _manifest(encoded)
		if manifest.is_empty():
			return
		for row in manifest.files:
			keep[row.sha256] = true
	for name in folder.get_files():
		var digest := name.trim_suffix(".part")
		if not _digest(digest) or folder.is_link(name):
			continue
		var modified := FileAccess.get_modified_time(_directory.path_join("cas").path_join(name))
		var expired := modified > 0 and Time.get_unix_time_from_system() - modified > UNUSED_CACHE_SECONDS
		if name.ends_with(".part") or (expired and not keep.has(digest)):
			folder.remove(name)

func _digest(value: Variant) -> bool:
	if not value is String or value.length() != 64:
		return false
	for character in value:
		if not character in "0123456789abcdef":
			return false
	return true

func _private_directory(value: String) -> bool:
	if not value.begins_with("user://") or value.contains("\\"):
		return false
	for component in value.trim_prefix("user://").split("/"):
		if component.is_empty() or component == "." or component == ".." or component.contains(":"):
			return false
	return true
