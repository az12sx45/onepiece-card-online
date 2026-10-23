extends Node
## Only pinned media is downloaded. Game scripts and save data never enter this cache.
signal resolved(ticket: String, result_json: String)
const BASE = "https://game-assets.rihdi.tw/desktop/blobs/sha256/"
const CLIENT_UA = "ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility) PO-Native-Godot/0.1"
var catalog: Dictionary = {}
var queue: Array[Dictionary] = []
var active: Dictionary = {}
var sequence := 0
var tasks: Array[int] = []
var closed := false
var cache_root := "user://po-ios-media/blobs"
var native_download_backend: Object
var poll_elapsed := 0.0
var network_requests := 0

func _ready() -> void:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://ios-media.json"))
	if data is Dictionary: catalog = data
	DirAccess.make_dir_recursive_absolute(cache_root)

func resolve_image(ticket: String, path: String) -> void: _resolve(ticket, path, "image")
func resolve_audio(ticket: String, path: String) -> void: _resolve(ticket, path, "audio")
func resolve_video(ticket: String, path: String) -> void: _resolve(ticket, path, "video")

func _resolve(ticket: String, path: String, kind: String) -> void:
	var entry: Variant = catalog.get(path)
	if closed: return
	if not entry is Dictionary or entry.get("kind") != kind or queue.size() >= 512:
		_reply.call_deferred(ticket, {"ok":false,"error":"media_unavailable"}); return
	var digest := str(entry.get("sha256", ""))
	var limit := 512*1024*1024 if kind == "video" else 64*1024*1024
	if digest.length() != 64 or not digest.is_valid_hex_number(false) or int(entry.get("size", 0)) <= 0 or int(entry.size) > limit:
		_reply.call_deferred(ticket, {"ok":false,"error":"invalid_media"}); return
	queue.append({"ticket":ticket,"path":path,"sha256":digest,"size":int(entry.size)})
	_pump()

func _pump() -> void:
	while not closed and active.size() < 4 and not queue.is_empty():
		var item: Dictionary = queue.pop_front()
		sequence += 1
		var id := sequence
		item.file = cache_root.path_join(item.sha256)
		active[id] = item
		var task := WorkerThreadPool.add_task(func():
			var valid := false
			var handle := FileAccess.open(item.file, FileAccess.READ)
			if handle:
				valid = handle.get_length() == item.size
				handle.close()
			if valid: valid = FileAccess.get_sha256(item.file) == item.sha256
			_cached.call_deferred(id, valid)
		)
		tasks.append(task)

func _cached(id: int, valid: bool) -> void:
	if closed or not active.has(id): return
	if valid: _finish(id, true); return
	var item: Dictionary = active[id]
	if native_download_backend==null and Engine.has_singleton("PoNativeSession"):
		native_download_backend=Engine.get_singleton("PoNativeSession").get("bridge")
	if native_download_backend!=null:
		item.partial=str(item.file)+".part-"+str(get_instance_id())+"-"+str(id)
		if FileAccess.file_exists(item.partial):DirAccess.remove_absolute(item.partial)
		item.native_id=str(get_instance_id())+"-"+str(id)
		if native_download_backend.call("download_begin",item.native_id,item.sha256,ProjectSettings.globalize_path(item.partial),item.size): network_requests+=1
		else: _finish(id,false)
		return
	if OS.get_name()=="iOS": _finish(id,false); return
	var request := HTTPRequest.new()
	request.use_threads = true
	request.timeout = 120
	request.max_redirects = 0
	request.body_size_limit = int(item.size)
	request.download_file = str(item.file) + ".part-" + str(id)
	item.request = request
	add_child(request)
	request.request_completed.connect(func(result: int, code: int, _headers: PackedStringArray, _body: PackedByteArray):
		if closed or not active.has(id): return
		if result != HTTPRequest.RESULT_SUCCESS or code != 200: _finish(id, false); return
		_verify_download(id,request.download_file)
	)
	network_requests+=1
	if request.request(BASE + str(item.sha256).left(2) + "/" + str(item.sha256),PackedStringArray(["User-Agent: "+CLIENT_UA])) != OK: _finish(id, false)

func _process(delta: float) -> void:
	poll_elapsed+=delta
	if poll_elapsed<0.1 or native_download_backend==null:return
	poll_elapsed=0
	for id in active.keys():
		if not active.has(id):continue
		var item: Dictionary=active[id]
		if not item.has("native_id") or item.get("verifying",false):continue
		var result: Variant=JSON.parse_string(native_download_backend.call("download_poll",item.native_id))
		if not result is Dictionary or result.get("state")=="failed":_finish(id,false)
		elif result.get("state")=="complete":
			item.verifying=true
			native_download_backend.call("download_forget",item.native_id)
			_verify_download(id,item.partial)

func _verify_download(id: int, filename: String) -> void:
	var item: Dictionary=active[id]
	item.partial=filename
	var task := WorkerThreadPool.add_task(func():
		var handle := FileAccess.open(filename, FileAccess.READ)
		var matches := handle != null and handle.get_length() == int(item.size)
		if handle: handle.close()
		if matches: matches = FileAccess.get_sha256(filename) == item.sha256
		_downloaded.call_deferred(id, matches)
	)
	tasks.append(task)

func _downloaded(id: int, valid: bool) -> void:
	if closed or not active.has(id): return
	var item: Dictionary = active[id]
	if valid:
		# Only replace a cache blob after exact size and SHA verification.
		valid = DirAccess.rename_absolute(item.partial, item.file) == OK
	_finish(id, valid)

func _finish(id: int, success: bool) -> void:
	var item: Dictionary = active[id]
	active.erase(id)
	if item.has("native_id"):native_download_backend.call("download_forget",item.native_id)
	if item.has("partial") and FileAccess.file_exists(item.partial):DirAccess.remove_absolute(item.partial)
	if item.has("request"):
		var request: HTTPRequest = item.request
		request.cancel_request()
		if FileAccess.file_exists(request.download_file): DirAccess.remove_absolute(request.download_file)
		request.queue_free()
	_reply(item.ticket, {"ok":true,"path":item.path,"file":ProjectSettings.globalize_path(item.file),"size":item.size,"sha256":item.sha256} if success else {"ok":false,"error":"media_download_failed"})
	for task in tasks.duplicate():
		if WorkerThreadPool.is_task_completed(task): WorkerThreadPool.wait_for_task_completion(task); tasks.erase(task)
	_pump()

func _reply(ticket: String, result: Dictionary) -> void:
	if not closed: resolved.emit(ticket, JSON.stringify(result))

func _exit_tree() -> void:
	closed = true
	for item in active.values():
		if item.has("request"): item.request.cancel_request()
		if item.has("native_id"):native_download_backend.call("download_forget",item.native_id)
	for task in tasks: WorkerThreadPool.wait_for_task_completion(task)
	queue.clear(); active.clear(); tasks.clear()
