extends Node
## HTML Audio transport only; the original JS manager owns cue/loop/fade policy.
signal audio_event(id: String,kind: String,value: String)
var asset_root:=""
var native_required:=OS.get_name() in ["Android","iOS"]
var backend: Object
var requests: Dictionary={}
var sequence:=0
var tracks: Dictionary={}
var streams: Dictionary={}
var order: Array[String]=[]
var resident_bytes:=0
var tasks: Array[int]=[]
var elapsed:=0.0
var closed:=false

func _ready() -> void:
	if native_required and backend==null and Engine.has_singleton("PoNativeAssets"):backend=Engine.get_singleton("PoNativeAssets")
	if backend!=null:backend.connect("resolved",_resolved)
	set_process(false)

func _valid(path: String) -> bool:
	return path.begins_with("audio/") and not path.is_absolute_path() and not ":" in path and not "\\" in path and not ".." in path.split("/") and path.get_extension().to_lower() in ["mp3","ogg","wav"]

func load_audio(id: String,path: String) -> void:
	if closed:return
	release_audio(id)
	if not _valid(path) or tracks.size()>=12:
		audio_event.emit(id,"error","{}");return
	sequence+=1
	var player:=AudioStreamPlayer.new();add_child(player)
	var generation:=sequence
	tracks[id]={"path":path,"generation":generation,"player":player,"ready":false,"position":0.0}
	player.finished.connect(func():
		if tracks.has(id) and tracks[id].generation==generation:
			tracks[id].position=player.stream.get_length();audio_event.emit(id,"ended","{}")
	)
	if streams.has(path):
		order.erase(path);order.append(path);_ready_track(id,generation,streams[path].stream);return
	if native_required or backend!=null:
		if backend==null:audio_event.emit(id,"error","{}");return
		var ticket:=str(get_instance_id())+"-"+str(sequence)
		requests[ticket]={"id":id,"generation":generation,"path":path}
		backend.call("resolve_audio",ticket,path)
	else:_decode(id,generation,path,asset_root.path_join(path))

func _resolved(ticket: String,value: String) -> void:
	if closed or not requests.has(ticket):return
	var request: Dictionary=requests[ticket];requests.erase(ticket)
	if not tracks.has(request.id) or tracks[request.id].generation!=request.generation:return
	var reply=JSON.parse_string(value)
	if not reply is Dictionary or not reply.get("ok",false) or reply.get("path","")!=request.path or int(reply.get("size",0))<=0 or int(reply.get("size",0))>64*1024*1024:
		audio_event.emit(request.id,"error","{}");return
	var file:=str(reply.get("file",""));var sha:=str(reply.get("sha256",""))
	if sha.length()!=64 or file.get_file()!=sha or not FileAccess.file_exists(file):audio_event.emit(request.id,"error","{}");return
	_decode(request.id,request.generation,request.path,file)

func _decode(id: String,generation: int,path: String,file: String) -> void:
	# Parsing stays on a worker. Active players retain their stream even when the
	# cache evicts its ownership; unrelated music never stops during a new load.
	var task:=WorkerThreadPool.add_task(func():
		var stream: AudioStream
		var bytes:=PackedByteArray()
		var handle:=FileAccess.open(file,FileAccess.READ)
		if handle and handle.get_length()>0 and handle.get_length()<=64*1024*1024:bytes=handle.get_buffer(handle.get_length())
		if not bytes.is_empty():
			match path.get_extension().to_lower():
				"mp3":stream=AudioStreamMP3.load_from_buffer(bytes)
				"ogg":stream=AudioStreamOggVorbis.load_from_buffer(bytes)
				"wav":stream=AudioStreamWAV.load_from_buffer(bytes)
		call_deferred("_decoded",id,generation,path,stream,bytes.size())
	)
	tasks.append(task)

func _decoded(id: String,generation: int,path: String,stream: AudioStream,bytes: int) -> void:
	if closed:return
	for task in tasks.duplicate():
		if WorkerThreadPool.is_task_completed(task):WorkerThreadPool.wait_for_task_completion(task);tasks.erase(task)
	if not tracks.has(id) or tracks[id].generation!=generation:return
	if stream==null:audio_event.emit(id,"error","{}");return
	if not streams.has(path):streams[path]={"stream":stream,"bytes":bytes};resident_bytes+=bytes;order.append(path)
	while order.size()>4 or resident_bytes>64*1024*1024:
		var oldest: String=order.pop_front();resident_bytes-=int(streams[oldest].bytes);streams.erase(oldest)
	_ready_track(id,generation,stream)

func _ready_track(id: String,generation: int,stream: AudioStream) -> void:
	if not tracks.has(id) or tracks[id].generation!=generation:return
	tracks[id].player.stream=stream;tracks[id].ready=true
	audio_event.emit(id,"loadedmetadata",JSON.stringify({"duration":stream.get_length()}))

func play_audio(id: String) -> bool:
	if not tracks.has(id) or not tracks[id].ready:return false
	var track: Dictionary=tracks[id]
	if track.player.playing:track.player.stream_paused=false
	else:track.player.play(track.position)
	set_process(true);return true
func pause_audio(id: String) -> void:
	if tracks.has(id):tracks[id].position=current_time(id);tracks[id].player.stream_paused=true
func seek_audio(id: String,seconds: float) -> void:
	if tracks.has(id):
		tracks[id].position=maxf(0,seconds)
		if tracks[id].player.playing:tracks[id].player.seek(maxf(0,seconds))
func volume_audio(id: String,value: float) -> void:
	if tracks.has(id):tracks[id].player.volume_linear=clampf(value,0,1)
func current_time(id: String) -> float:
	if not tracks.has(id):return 0
	var track: Dictionary=tracks[id]
	return track.player.get_playback_position() if track.player.playing else track.position
func release_audio(id: String) -> void:
	for ticket in requests.keys():
		if requests[ticket].id==id:requests.erase(ticket)
	if not tracks.has(id):return
	tracks[id].player.stop();tracks[id].player.stream=null;tracks[id].player.queue_free();tracks.erase(id)
func _process(delta: float) -> void:
	elapsed+=delta
	if elapsed<.1:return
	elapsed=0
	var playing:=false
	for id in tracks.keys():
		var player: AudioStreamPlayer=tracks[id].player
		if player.playing and not player.stream_paused:playing=true;audio_event.emit(id,"timeupdate",JSON.stringify({"time":current_time(id)}))
	if not playing:set_process(false)
func close_audio() -> void:
	if closed:return
	closed=true
	if backend!=null and backend.is_connected("resolved",_resolved):backend.disconnect("resolved",_resolved)
	requests.clear()
	for id in tracks.keys():release_audio(id)
	for task in tasks:WorkerThreadPool.wait_for_task_completion(task)
	tasks.clear();streams.clear();order.clear();resident_bytes=0;set_process(false)
func _exit_tree() -> void:close_audio()
