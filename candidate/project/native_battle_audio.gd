extends Node
## Optional original battle effects. Android reads verified GameCache audio;
## effect selection, volume and timing remain in the original presentation.
var asset_root := ""
var muted := true # Evaluation scene stays silent; production must bind settings.
var streams: Dictionary = {}
var failed: Dictionary = {}
var pending: Dictionary = {}
var order: Array[String] = []
var players: Array[AudioStreamPlayer] = []
var play_count := 0
var load_count := 0
var loader: Node
var native_required:=OS.get_name() in ["Android","iOS"]
var backend: Object
var closed:=false
var effects_silenced:=false

func _ready() -> void:
	loader=preload("res://native_audio_transport.gd").new()
	loader.asset_root=asset_root;loader.native_required=native_required;loader.backend=backend
	loader.audio_event.connect(_loaded);add_child(loader)

func warm(path: String) -> void:
	if closed or path.is_empty() or streams.has(path) or pending.has(path) or failed.has(path): return
	if not path.begins_with("audio/") or path.is_absolute_path() or ":" in path or ".." in path.split("/") or "\\" in path:
		failed[path]="Invalid audio path";return
	pending[path]=true;loader.load_audio(path,path)

func _loaded(path: String,kind: String,_value: String) -> void:
	if closed or not pending.has(path):return
	if kind=="loadedmetadata":
		var stream: AudioStream=loader.tracks[path].player.stream
		loader.release_audio(path);_publish(path,stream)
	elif kind=="error":loader.release_audio(path);_publish(path,null)

func _publish(path: String, stream: AudioStream) -> void:
	pending.erase(path)
	if stream == null: failed[path]="Audio asset could not be decoded";return
	streams[path]=stream
	load_count += 1
	order.append(path)
	while order.size() > 24: streams.erase(order.pop_front())

func play_effect(path: String, volume: float, allow_during_special:=false) -> void:
	if closed or path.is_empty() or (effects_silenced and not allow_during_special): return
	if not streams.has(path): warm(path);return
	var player: AudioStreamPlayer
	for candidate in players:
		if not candidate.playing: player=candidate;break
	if player == null:
		if players.size() >= 12: return
		player=AudioStreamPlayer.new();add_child(player);players.append(player)
		player.finished.connect(func():player.stream=null)
	player.stream=streams[path]
	player.set_meta('source_path',path)
	player.volume_linear=0.0 if muted else clampf(volume,0,1)
	player.play()
	play_count += 1

func silence_effects(value: bool) -> void:
	effects_silenced=value
	if value:
		for player in players:player.stop();player.stream=null
func stop_path(path: String) -> void:
	for player in players:
		if player.get_meta('source_path','')==path:player.stop();player.stream=null

func close_audio() -> void:
	if closed:return
	closed=true
	if is_instance_valid(loader):loader.close_audio()
	for player in players:player.stop();player.stream=null;player.queue_free()
	players.clear();pending.clear();streams.clear();order.clear()
func _exit_tree() -> void:close_audio()
