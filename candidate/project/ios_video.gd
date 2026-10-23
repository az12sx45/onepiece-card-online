extends Node
signal media_event(ticket: String, event: String, value: String)
var bridge: Object
var assets: Node
var current := ""
var configuration: Dictionary = {}
var elapsed := 0.0
var previous: Dictionary = {}
var alpha := 1.0
var gain := 1.0

func _ready() -> void:
	assets.resolved.connect(_resolved)
	set_process(false)

func play(ticket: String, path: String, muted: bool, cover: bool) -> void:
	_start(ticket, path, {"muted":muted,"cover":cover,"start":0.0,"title":""})

func playKatakuri(ticket: String, path: String, title: String, start: float, muted: bool) -> void:
	_start(ticket, path, {"muted":muted,"cover":true,"start":start,"title":title,"futureSight":true})

func _start(ticket: String, path: String, options: Dictionary) -> void:
	remove(current)
	current = ticket; configuration = options; previous = {}; alpha = 1.0
	assets.resolve_video(ticket, path)

func _resolved(ticket: String, result_json: String) -> void:
	if ticket != current: return
	var result: Variant = JSON.parse_string(result_json)
	if bridge == null or not result is Dictionary or not result.get("ok",false):
		media_event.emit(ticket,"error",'{}'); return
	configuration.file = result.file
	if not bridge.call("video_play", JSON.stringify(configuration)):
		media_event.emit(ticket,"error",'{}'); return
	bridge.call("video_opacity", alpha)
	bridge.call("video_volume", gain)
	set_process(true)

func pause(ticket: String) -> void:
	if ticket == current and bridge != null: bridge.call("video_pause")
func remove(ticket: String) -> void:
	if ticket != current: return
	if bridge != null: bridge.call("video_remove")
	current = ""; previous = {}; set_process(false)
func opacity(ticket: String, value: float) -> void:
	if ticket == current:
		alpha = clampf(value,0.0,1.0)
		if bridge != null: bridge.call("video_opacity",alpha)
func volume(ticket: String, value: float) -> void:
	if ticket == current:
		gain=clampf(value,0.0,1.0)
		if bridge != null:bridge.call("video_volume",gain)

func _process(delta: float) -> void:
	elapsed += delta
	if elapsed < 0.1 or current.is_empty(): return
	elapsed = 0.0
	var value: String = bridge.call("video_state")
	var state: Variant = JSON.parse_string(value)
	if not state is Dictionary: return
	if state.get("failed",false): media_event.emit(current,"error",value); set_process(false); return
	if int(state.get("readyState",0)) > 0 and int(previous.get("readyState",0)) == 0: media_event.emit(current,"loadedmetadata",value)
	if state.get("started",false) and not previous.get("started",false): media_event.emit(current,"playing",value)
	media_event.emit(current,"timeupdate",value)
	if state.get("ended",false) and not previous.get("ended",false): media_event.emit(current,"ended",value); set_process(false)
	previous = state

func _exit_tree() -> void: remove(current)
