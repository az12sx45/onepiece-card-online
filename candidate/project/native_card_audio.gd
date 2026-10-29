extends Node
## Original media and private local combo selection; no hidden opponents' card.
var transport: Node
var volume:=.6
var music:=.25
var pending_voice:=''
var voice_done:=true
var track:=1
func _ready() -> void:
	transport=preload('res://native_audio_transport.gd').new();transport.asset_root=ProjectSettings.globalize_path('res://../../public')
	if OS.get_name()=='Windows' and not OS.get_environment('PO_NATIVE_DESKTOP_ENDPOINT').is_empty():
		var backend:=preload('res://native_desktop_assets.gd').new();add_child(backend);transport.backend=backend;transport.native_required=true
	add_child(transport);transport.audio_event.connect(_event)
func begin_music() -> void:transport.load_audio('music','audio/bgm/track%02d.mp3'%track)
func cue(path: String) -> void:
	voice_done=false;pending_voice=path;transport.load_audio('voice',path)
func sfx(path: String) -> void:transport.load_audio('sfx',path)
func _event(id: String,kind: String,_data: String) -> void:
	if kind=='loadedmetadata':transport.volume_audio(id,music if id=='music' else volume);transport.play_audio(id)
	elif kind=='ended':
		if id=='music':track=(track%20)+1;begin_music()
		if id=='voice':voice_done=true
	elif kind=='error' and id=='voice':voice_done=true
func set_volume(value: float,is_music: bool) -> void:
	if is_music:music=value;transport.volume_audio('music',music)
	else:volume=value;transport.volume_audio('voice',volume);transport.volume_audio('sfx',volume)
func stop_voice() -> void:transport.release_audio('voice');voice_done=true
func _exit_tree() -> void:transport.close_audio()
