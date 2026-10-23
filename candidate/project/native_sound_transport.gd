extends Node
## Persistent cue buffers and short native voices. Selection/priority/throttling
## remain in the original BoardAudio controller, not this transport.
signal buffer_ready(key: String,ok: bool)
signal voice_ended(id: String)
var asset_root:=""
var loader: Node
var buffers: Dictionary={}
var voices: Dictionary={}
var requested: Dictionary={}
var closed:=false
var tasks: Array[int]=[]
func _ready() -> void:
	for kind in ['tap','select','confirm','cancel','draw','reward','heal','danger','victory','defeat']:
		var stream:=AudioStreamWAV.load_from_buffer(FileAccess.get_file_as_bytes('res://board-cue-'+kind+'.wav'))
		if stream!=null:buffers['fallback:'+kind]=stream
	loader=preload("res://native_audio_transport.gd").new();loader.asset_root=asset_root
	loader.audio_event.connect(_loaded);add_child(loader)
func has_buffer(key: String) -> bool:return buffers.has(key)
func test_normalized_assets() -> bool:
	var count:=0
	for key in buffers:
		if not str(key).begins_with('asset:'):continue
		var stream: AudioStreamWAV=buffers[key]
		if not stream.stereo or stream.get_length()>2:return false
		var bytes:=stream.data;var peak:=0
		for i in range(0,bytes.size(),2):peak=maxi(peak,absi(bytes.decode_s16(i)))
		if absi(peak-roundi(.65*32767))>1:return false
		count+=1
	return count==8
func preload_asset(key: String,path: String) -> void:
	if closed or requested.has(key):return
	if not path.begins_with("audio/board_game/sfx/") or requested.size()>=16:buffer_ready.emit(key,false);return
	requested[key]=path;loader.load_audio(key,path)
func _loaded(key: String,kind: String,_value: String) -> void:
	if closed or not requested.has(key):return
	if kind=="loadedmetadata":
		var source: AudioStream=loader.tracks[key].player.stream
		loader.release_audio(key)
		if source.get_length()>2 or source.get_length()<=0:buffer_ready.emit(key,false);return
		var rate:=int(AudioServer.get_mix_rate())
		tasks.append(WorkerThreadPool.add_task(func():
			var playback:=source.instantiate_playback();playback.start()
			var frames:=playback.mix_audio(1.0,ceili(source.get_length()*rate));playback.stop()
			var peak:=0.0
			for frame in frames:peak=maxf(peak,maxf(absf(frame.x),absf(frame.y)))
			var normalized: AudioStreamWAV
			if peak>0:
				var bytes:=PackedByteArray();bytes.resize(frames.size()*4)
				for i in range(frames.size()):
					bytes.encode_s16(i*4,roundi(frames[i].x*.65/peak*32767));bytes.encode_s16(i*4+2,roundi(frames[i].y*.65/peak*32767))
				normalized=AudioStreamWAV.new();normalized.format=AudioStreamWAV.FORMAT_16_BITS;normalized.stereo=true;normalized.mix_rate=rate;normalized.data=bytes
			call_deferred('_normalized',key,normalized)
		))
	elif kind=="error":loader.release_audio(key);buffer_ready.emit(key,false)
func _normalized(key: String,stream: AudioStreamWAV) -> void:
	for task in tasks.duplicate():
		if WorkerThreadPool.is_task_completed(task):WorkerThreadPool.wait_for_task_completion(task);tasks.erase(task)
	if closed:return
	if stream!=null:buffers[key]=stream
	buffer_ready.emit(key,stream!=null)
func prepare_pcm(key: String,value: String,rate: int) -> bool:
	if closed:return false
	if buffers.has(key):return true
	var samples=JSON.parse_string(value)
	if not samples is Array or rate<8000 or rate>96000 or samples.size()>rate*2:return false
	var bytes:=PackedByteArray();bytes.resize(samples.size()*2)
	for i in range(samples.size()):bytes.encode_s16(i*2,roundi(clampf(float(samples[i]),-1,1)*32767))
	var stream:=AudioStreamWAV.new();stream.format=AudioStreamWAV.FORMAT_16_BITS;stream.mix_rate=rate;stream.stereo=false;stream.data=bytes;buffers[key]=stream;return true
func play_voice(id: String,key: String,volume: float) -> bool:
	if closed or not buffers.has(key) or voices.size()>=4:return false
	stop_voice(id)
	var player:=AudioStreamPlayer.new();player.stream=buffers[key];player.volume_linear=clampf(volume,0,1);voices[id]=player;add_child(player)
	player.finished.connect(func():stop_voice(id))
	player.play();return true
func stop_voice(id: String) -> void:
	if not voices.has(id):return
	var player: AudioStreamPlayer=voices[id];voices.erase(id);player.stop();player.stream=null;player.queue_free();voice_ended.emit(id)
func volume_voice(id: String,value: float) -> void:
	if voices.has(id):voices[id].volume_linear=clampf(value,0,1)
func close_sound() -> void:
	if closed:return
	closed=true
	for id in voices.keys():stop_voice(id)
	if is_instance_valid(loader):loader.close_audio()
	for task in tasks:WorkerThreadPool.wait_for_task_completion(task)
	tasks.clear()
	buffers.clear();requested.clear()
func _exit_tree() -> void:close_sound()
