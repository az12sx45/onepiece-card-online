extends SceneTree
var failures: Array[String] = []
var checks := 0
var answers: Dictionary = {}
var requests_started := 0
var assets: Node

class FakeVideo extends RefCounted:
	var played := 0
	var removed := 0
	var state := {"readyState":0}
	func video_play(_value: String) -> bool: played+=1; return true
	func video_opacity(_value: float) -> void: pass
	func video_volume(_value: float) -> void: pass
	func video_pause() -> void: pass
	func video_remove() -> void: removed+=1
	func video_state() -> String: return JSON.stringify(state)

class FakeAssets extends Node:
	signal resolved(ticket: String, value: String)
	func resolve_video(_ticket: String, _path: String) -> void: pass

class FakeDownloader extends RefCounted:
	var bytes := PackedByteArray()
	var calls := 0
	func download_begin(_id: String,_sha: String,file: String,_size: int) -> bool:
		calls+=1
		var target:=FileAccess.open(file,FileAccess.WRITE)
		if not target:return false
		target.store_buffer(bytes);target.close();return true
	func download_poll(_id: String) -> String:return '{"state":"complete"}'
	func download_forget(_id: String) -> void:pass

func check(value: bool, message: String) -> void:
	checks+=1
	if not value: failures.append(message)

func _initialize() -> void: _run.call_deferred()

func _await_reply(ticket: String) -> Dictionary:
	var start := Time.get_ticks_msec()
	while not answers.has(ticket) and Time.get_ticks_msec()-start<45000: await process_frame
	return answers.get(ticket,{"ok":false,"error":"test_timeout"})

func _run() -> void:
	assets=load("res://ios_assets.gd").new()
	assets.cache_root="user://po-ios-qa-"+str(Time.get_ticks_usec())+"/blobs"
	root.add_child(assets)
	assets.child_entered_tree.connect(func(node: Node):
		if node is HTTPRequest: requests_started+=1
	)
	assets.resolved.connect(func(ticket: String,value: String): answers[ticket]=JSON.parse_string(value))
	var path := "images/board/cursors/board_cursor_nami_chart_pen_default_v1.png"
	assets.resolve_image("cold",path)
	var cold: Dictionary = await _await_reply("cold")
	check(cold.get("ok",false),"HTTPS pinned image download")
	if cold.get("ok",false):
		check(FileAccess.get_sha256(cold.file)==cold.sha256,"Actual downloaded SHA")
		var cache: Node=load("res://native_asset_cache.gd").new()
		cache.native_backend=assets
		root.add_child(cache)
		var textures: Array=[]
		cache.asset_ready.connect(func(_path: String,texture: Texture2D):textures.append(texture))
		cache.request(path)
		var began:=Time.get_ticks_msec()
		while textures.is_empty() and Time.get_ticks_msec()-began<10000:await process_frame
		check(not textures.is_empty(),"Original image pipeline decodes SHA-named cache file")
		var before := requests_started
		assets.resolve_image("warm",path)
		var warm: Dictionary = await _await_reply("warm")
		check(warm.get("ok",false) and requests_started==before,"Verified cache reuse starts no second HTTP")
		var corrupt := FileAccess.open(cold.file,FileAccess.WRITE)
		corrupt.store_buffer(PackedByteArray([1,2,3]));corrupt.close()
		assets.resolve_image("repair",path)
		var repaired: Dictionary = await _await_reply("repair")
		check(repaired.get("ok",false) and requests_started==before+1,"Corrupt cache is redownloaded")
		if not textures.is_empty():check(cache.request(path)==textures[0],"Displayed texture identity survives cache repair")
		cache.queue_free();await process_frame
		var fake:=FakeDownloader.new();fake.bytes=FileAccess.get_file_as_bytes(cold.file)
		assets.native_download_backend=fake
		assets.cache_root="user://po-ios-native-bridge-qa-"+str(Time.get_ticks_usec())+"/blobs"
		DirAccess.make_dir_recursive_absolute(assets.cache_root)
		assets.resolve_image("native",path)
		var native_reply: Dictionary=await _await_reply("native")
		check(native_reply.get("ok",false) and fake.calls==1,"Native download bridge result reaches original verified cache")
		if native_reply.get("ok",false):
			var damaged:=FileAccess.open(native_reply.file,FileAccess.WRITE);damaged.store_8(0);damaged.close()
			fake.bytes[0]=fake.bytes[0]^1
			assets.resolve_image("native-corrupt",path)
			var rejected: Dictionary=await _await_reply("native-corrupt")
			check(not rejected.get("ok",false),"Native download with correct length but bad SHA is rejected")
	assets.queue_free();await process_frame
	var media := FakeAssets.new(); root.add_child(media)
	var bridge := FakeVideo.new()
	var video: Node = load("res://ios_video.gd").new();video.bridge=bridge;video.assets=media;root.add_child(video)
	var events: Array[String]=[]
	video.media_event.connect(func(_ticket: String,event: String,_value: String):events.append(event))
	video.play("cancelled","videos/fixture.mp4",false,false)
	video.remove("cancelled")
	media.resolved.emit("cancelled",'{"ok":true,"file":"/fixture"}')
	check(bridge.played==0,"Cancelled late video resolution cannot reopen overlay")
	video.play("active","videos/fixture.mp4",false,false)
	media.resolved.emit("active",'{"ok":true,"file":"/fixture"}')
	check(bridge.played==1,"Active video resolved exactly once")
	bridge.state={"readyState":4,"started":true,"ended":false}
	video._process(0.2)
	bridge.state={"readyState":4,"started":true,"ended":true}
	video._process(0.2)
	check(events==["loadedmetadata","playing","timeupdate","timeupdate","ended"],"Original media events preserve completion order")
	check(not video.is_processing(),"Finished video stops polling")
	video.queue_free();media.queue_free();await process_frame
	var result := {"checks":checks,"failures":failures,"passed":failures.is_empty(),"httpRequests":requests_started,"actualVideoPlaybackTested":false,"appleNativeServicesTested":false,"iphoneTested":false}
	var args:=OS.get_cmdline_user_args()
	if args.size()==1:
		var output:=FileAccess.open(args[0],FileAccess.WRITE)
		if output:output.store_string(JSON.stringify(result));output.close()
	print("PO_IOS_MEDIA_CHECK ",JSON.stringify(result));quit(0 if failures.is_empty() else 1)
