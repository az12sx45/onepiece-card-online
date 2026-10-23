extends Node
## Decode original images on workers. Only publish complete textures on the main
## thread; consumers keep their current image until the requested one is ready.
signal asset_ready(path: String, texture: Texture2D)
signal asset_failed(path: String, error: int)
var asset_root := ""
var mount_roots: Dictionary = {}
var records: Dictionary = {}
var live_textures: Dictionary = {}
var pending: Dictionary = {}
var failed: Dictionary = {}
var access_order: Array[String] = []
var limit := 48
var byte_limit := 96 * 1024 * 1024
var resident_bytes := 0
var record_bytes: Dictionary = {}
var decode_count := 0
var use_mipmaps := false
var mipmap_prefixes: Array[String] = []
var animation_root := "res://native-animation-assets"
var animation_catalog: Dictionary = {}
var animations: Dictionary = {}
var native_backend: Object
var native_backend_required:=OS.get_name() in ["Android","iOS"]
var native_requests: Dictionary={}
var native_sequence:=0

func _ready() -> void:
	if FileAccess.file_exists("res://mobile/art-ui/mobile-panel-v013.png"):mount_roots["mobile"]="res://mobile"
	if native_backend_required:
		mount_roots["mobile"]="res://mobile"
		if native_backend==null and Engine.has_singleton("PoNativeAssets"):native_backend=Engine.get_singleton("PoNativeAssets")
	if native_backend!=null:native_backend.connect("resolved",_native_resolved)
	var manifest := animation_root.path_join("manifest.json")
	if FileAccess.file_exists(manifest):animation_catalog=JSON.parse_string(FileAccess.get_file_as_string(manifest))
	set_process(false)

func _process(_delta: float) -> void:
	_advance_animations(Time.get_ticks_msec())

func _advance_animations(now: int) -> void:
	for path in animations.keys():
		var animation: Dictionary=animations[path]
		var texture: AtlasTexture=animation.texture.get_ref()
		if texture==null:animations.erase(path);continue
		var elapsed: int=(now-int(animation.started))%int(animation.duration)
		var cursor:=0
		for index in range(animation.durations.size()):
			cursor+=int(animation.durations[index])
			if elapsed<cursor:
				if animation.index!=index:
					texture.atlas=texture.get_meta("source_frames")[index];animation.index=index
				break
	if animations.is_empty():set_process(false)

func _wants_mipmaps(path: String) -> bool:
	if use_mipmaps:return true
	for prefix in mipmap_prefixes:
		if path.begins_with(prefix):return true
	return false

func request(path: String) -> Texture2D:
	if path.is_empty() or path.is_absolute_path() or ":" in path or ".." in path.split("/") or "\\" in path:
		push_error("Invalid native asset path: " + path)
		return null
	if records.has(path):
		access_order.erase(path)
		access_order.append(path)
		return records[path]
	# Evict cache ownership, not the identity of a texture still displayed by a
	# Control. Weak references do not extend its lifetime or defeat the budget.
	if live_textures.has(path):
		var retained: Texture2D=live_textures[path].get_ref()
		if retained!=null:return retained
		live_textures.erase(path)
	if pending.has(path) or failed.has(path): return null
	var full_path := asset_root.path_join(path)
	for prefix in mount_roots:
		if path.begins_with(str(prefix)+"/"):
			full_path = str(mount_roots[prefix]).path_join(path.substr(str(prefix).length()+1))
			break
	# Resolve the root before configuration; resource and user roots are supported.
	if asset_root.is_empty() and not native_backend_required and native_backend==null:
		push_error("Native asset root was not configured")
		return null
	var mipmaps := _wants_mipmaps(path)
	var animation: Dictionary=animation_catalog.get(path,{})
	if not animation.is_empty():
		var folder: String=animation_root
		pending[path]=WorkerThreadPool.add_task(func():
			var frames: Array[Image]=[];var error:=OK
			if int(animation.loop)!=0:error=ERR_UNAVAILABLE
			for frame in animation.frames:
				if error!=OK:break
				var decoded:=Image.new();error=decoded.load(folder.path_join(frame.file))
				if error==OK and (decoded.get_width()!=int(animation.width) or decoded.get_height()!=int(animation.height)):error=ERR_INVALID_DATA
				if error==OK and mipmaps:error=decoded.generate_mipmaps()
				frames.append(decoded)
			call_deferred("_publish_animation",path,frames,animation,error)
		)
		return null
	if (native_backend_required or native_backend!=null) and not path.begins_with("mobile/"):
		if native_backend==null:failed[path]=ERR_UNAVAILABLE;asset_failed.emit(path,ERR_UNAVAILABLE);return null
		native_sequence+=1
		var id:=str(get_instance_id())+"-"+str(native_sequence)
		native_requests[id]=path;pending[path]=-1
		native_backend.call("resolve_image",id,path)
		return null
	var task := WorkerThreadPool.add_task(func():
		var decoded := Image.new()
		var error := decoded.load(full_path) if FileAccess.file_exists(full_path) else ERR_FILE_NOT_FOUND
		if error == OK and mipmaps:error=decoded.generate_mipmaps()
		call_deferred("_publish", path, decoded, error)
	)
	pending[path] = task
	return null

func _native_resolved(id: String,value: String) -> void:
	if not native_requests.has(id):return
	var path: String=native_requests[id];native_requests.erase(id)
	var result: Variant=JSON.parse_string(value)
	if not result is Dictionary or result.get("ok",false)!=true or str(result.get("path",""))!=path:
		pending.erase(path);failed[path]=ERR_FILE_NOT_FOUND;asset_failed.emit(path,ERR_FILE_NOT_FOUND);return
	var filename:=str(result.get("file",""));var expected:=int(result.get("size",-1));var mipmaps:=_wants_mipmaps(path);var expected_sha:=str(result.get("sha256",""))
	if not filename.is_absolute_path() or expected<0 or expected>64*1024*1024 or expected_sha.length()!=64 or not expected_sha.is_valid_hex_number(false):
		pending.erase(path);failed[path]=ERR_INVALID_DATA;asset_failed.emit(path,ERR_INVALID_DATA);return
	pending[path]=WorkerThreadPool.add_task(func():
		var decoded:=Image.new();var error:=ERR_FILE_NOT_FOUND
		if FileAccess.file_exists(filename):
			var bytes:=FileAccess.get_file_as_bytes(filename)
			var hash:=HashingContext.new();hash.start(HashingContext.HASH_SHA256);hash.update(bytes);var actual_sha:=hash.finish().hex_encode()
			if bytes.size()!=expected:error=ERR_INVALID_DATA
			elif actual_sha!=expected_sha:error=ERR_FILE_CORRUPT
			else:
				# Verified cache blobs are SHA names with no file extension.
				match path.get_extension().to_lower():
					"png":error=decoded.load_png_from_buffer(bytes)
					"webp":error=decoded.load_webp_from_buffer(bytes)
					"jpg","jpeg":error=decoded.load_jpg_from_buffer(bytes)
					"svg":error=decoded.load_svg_from_buffer(bytes)
					_:error=ERR_FILE_UNRECOGNIZED
		if error==OK and mipmaps:error=decoded.generate_mipmaps()
		call_deferred("_publish",path,decoded,error)
	)

func _publish(path: String, decoded: Image, error: int) -> void:
	if pending.has(path):
		WorkerThreadPool.wait_for_task_completion(pending[path])
		pending.erase(path)
	if error != OK or decoded.is_empty():
		failed[path] = error
		asset_failed.emit(path, error)
		return
	var started:=Time.get_ticks_usec()
	var texture := ImageTexture.create_from_image(decoded)
	_store_texture(path,texture,decoded.get_data_size())
	var elapsed:=(Time.get_ticks_usec()-started)/1000.0
	if elapsed>=40:print("[PO_PERF] ",JSON.stringify({"area":"texture-publish","ms":elapsed,"asset":path}))

func _publish_animation(path: String, frames: Array[Image], definition: Dictionary, error: int) -> void:
	if pending.has(path):
		WorkerThreadPool.wait_for_task_completion(pending[path]);pending.erase(path)
	if error!=OK or frames.size()!=definition.frames.size():
		failed[path]=error;asset_failed.emit(path,error);return
	var textures: Array[Texture2D]=[];var bytes:=0;var durations: Array[int]=[];var duration:=0
	for index in range(frames.size()):
		textures.append(ImageTexture.create_from_image(frames[index]));bytes+=frames[index].get_data_size()
		var ms:=int(definition.frames[index].durationMs)
		if ms<=0:failed[path]=ERR_INVALID_DATA;asset_failed.emit(path,ERR_INVALID_DATA);return
		durations.append(ms);duration+=ms
	var texture:=AtlasTexture.new();texture.atlas=textures[0];texture.region=Rect2(0,0,definition.width,definition.height)
	# The displayed resource owns all frames. Cache entries keep only weak refs
	# after eviction; the image identity and dimensions remain stable on each tick.
	texture.set_meta("source_frames",textures)
	animations[path]={"texture":weakref(texture),"started":Time.get_ticks_msec(),"index":0,"duration":duration,"durations":durations}
	_store_texture(path,texture,bytes);set_process(true)

func _store_texture(path: String, texture: Texture2D, bytes: int) -> void:
	for key in live_textures.keys():
		if live_textures[key].get_ref()==null:live_textures.erase(key)
	live_textures[path]=weakref(texture)
	_evict(path)
	records[path] = texture
	record_bytes[path] = bytes
	resident_bytes += int(record_bytes[path])
	decode_count += 1
	access_order.append(path)
	# Retain the newest texture even when one original image exceeds the budget;
	# never downscale artwork. Live controls keep their own texture references.
	trim()
	asset_ready.emit(path, texture)

func _evict(path: String) -> void:
	resident_bytes -= int(record_bytes.get(path,0))
	record_bytes.erase(path)
	records.erase(path)
	access_order.erase(path)

func trim() -> void:
	while access_order.size() > 1 and (access_order.size() > maxi(1,limit) or resident_bytes > byte_limit):
		_evict(access_order[0])

func invalidate(path: String) -> void:
	# Called after a verified content update; a failed asset is not retried every
	# render frame. Existing displayed textures remain alive in their controls.
	failed.erase(path)
	live_textures.erase(path)
	_evict(path)

func _exit_tree() -> void:
	if native_backend!=null and native_backend.is_connected("resolved",_native_resolved):native_backend.disconnect("resolved",_native_resolved)
	native_requests.clear()
	for task in pending.values():
		if int(task)>=0:WorkerThreadPool.wait_for_task_completion(task)
	pending.clear()
