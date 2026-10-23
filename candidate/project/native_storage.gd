extends Node
## Single-writer native localStorage. Original keys and string values are intact.
## The temporary file is verified before replacing the current generation;
## the preceding verified generation remains available for explicit recovery.
var store_path:="user://pirate-odyssey/game-storage-v1.json"
var values: Dictionary={}
var opened:=false
var generation:=0
var last_error:=""

func _read(path: String) -> Dictionary:
	var file:=FileAccess.open(path,FileAccess.READ)
	if file==null:return {"ok":false,"error":"storage_read_failed"}
	var raw:=file.get_as_text();file.close()
	var parser:=JSON.new()
	if parser.parse(raw)!=OK or not parser.data is Dictionary:return {"ok":false,"error":"storage_corrupt"}
	var data: Dictionary=parser.data
	if data.get("version")!=1 or not data.get("payload") is String or not data.get("sha256") is String:return {"ok":false,"error":"storage_schema"}
	if str(data.payload).sha256_text()!=data.sha256:return {"ok":false,"error":"storage_checksum"}
	if parser.parse(data.payload)!=OK or not parser.data is Dictionary:return {"ok":false,"error":"storage_payload"}
	var entries: Dictionary=parser.data
	for key in entries:if not key is String or not entries[key] is String:return {"ok":false,"error":"storage_value_type"}
	return {"ok":true,"values":entries,"generation":int(data.get("generation",0))}

func open_json() -> String:
	if opened:return JSON.stringify({"ok":true,"generation":generation})
	if not store_path.begins_with("user://") or store_path.contains("..") or store_path.get_file().is_empty():return JSON.stringify({"ok":false,"error":"storage_path"})
	if FileAccess.file_exists(store_path):
		var result:=_read(store_path)
		if not result.ok:last_error=result.error;return JSON.stringify({"ok":false,"error":last_error,"backupAvailable":FileAccess.file_exists(store_path+".previous")})
		values=result.values;generation=result.generation
	elif FileAccess.file_exists(store_path+".previous"):
		return JSON.stringify({"ok":false,"error":"storage_current_missing","backupAvailable":true})
	opened=true;last_error="";return JSON.stringify({"ok":true,"generation":generation})

func _commit(next: Dictionary) -> Dictionary:
	if not opened:return {"ok":false,"error":"storage_not_open"}
	var parent:=store_path.get_base_dir()
	if DirAccess.make_dir_recursive_absolute(parent)!=OK:return {"ok":false,"error":"storage_directory"}
	var payload:=JSON.stringify(next)
	var envelope:=JSON.stringify({"version":1,"generation":generation+1,"payload":payload,"sha256":payload.sha256_text()})
	var pending:=store_path+".pending"
	var file:=FileAccess.open(pending,FileAccess.WRITE)
	if file==null:return {"ok":false,"error":"storage_write_failed"}
	file.store_string(envelope);file.flush();var error:=file.get_error();file.close()
	if error!=OK:return {"ok":false,"error":"storage_flush_failed"}
	var checked:=_read(pending)
	if not checked.ok or checked.values!=next:return {"ok":false,"error":"storage_write_verification"}
	if FileAccess.file_exists(store_path):
		# A second process must not silently overwrite a newer save.
		var current:=_read(store_path)
		if not current.ok or current.generation!=generation:return {"ok":false,"error":"storage_concurrent_change"}
		if DirAccess.copy_absolute(store_path,store_path+".previous")!=OK:return {"ok":false,"error":"storage_backup_failed"}
	if DirAccess.rename_absolute(pending,store_path)!=OK:return {"ok":false,"error":"storage_replace_failed"}
	values=next;generation+=1;return {"ok":true,"generation":generation}

func request_json(input: String) -> String:
	var request: Dictionary=JSON.parse_string(input)
	if not opened:return JSON.stringify({"ok":false,"error":"storage_not_open"})
	var key:=str(request.get("key",""));var operation:=str(request.get("operation",""))
	# Credentials belong to the platform credential service, never this file.
	if key in ["op_secret","opSecret"]:return JSON.stringify({"ok":false,"error":"credential_store_required"})
	if operation=="get":return JSON.stringify({"ok":true,"value":values.get(key,null)})
	if operation=="keys":return JSON.stringify({"ok":true,"keys":values.keys()})
	var next:=values.duplicate()
	if operation=="set":
		if not request.get("value") is String:return JSON.stringify({"ok":false,"error":"storage_value_type"})
		if values.get(key,null)==request.value:return JSON.stringify({"ok":true,"generation":generation})
		next[key]=request.value
	elif operation=="remove":
		if not next.has(key):return JSON.stringify({"ok":true,"generation":generation})
		next.erase(key)
	elif operation=="clear":next.clear()
	else:return JSON.stringify({"ok":false,"error":"storage_operation"})
	var result:=_commit(next);last_error="" if result.ok else str(result.error);return JSON.stringify(result)
