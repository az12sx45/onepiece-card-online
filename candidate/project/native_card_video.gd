extends Control
signal completed
signal failed
var plugin: Object
var player: VideoStreamPlayer
var ticket:=""
var serial:=0
var elapsed:=0.0
var playing:=false
var failed_once:=false
var desktop: Node

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_STOP;hide()
	var bg:=ColorRect.new();bg.color=Color.BLACK;bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);add_child(bg)
	player=VideoStreamPlayer.new();player.expand=true;player.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);add_child(player)
	player.finished.connect(func():stop();completed.emit())
	if Engine.has_singleton('PoNativeVideo'):
		plugin=Engine.get_singleton('PoNativeVideo');plugin.connect('media_event',_media)
	elif OS.get_name()=='Windows' and not OS.get_environment('PO_NATIVE_DESKTOP_ENDPOINT').is_empty():
		desktop=preload('res://native_desktop_session.gd').new();add_child(desktop)
	set_process(false)

func start(card: int) -> void:
	stop();serial+=1;ticket='native-card-'+str(serial);elapsed=0;failed_once=false;playing=false;show();set_process(true)
	var path:='videos/enh/'+str(card)+'.mp4'
	if plugin!=null:plugin.call('play',ticket,path,false,false);return
	var source:='res://card-assets/'+path
	if desktop!=null:
		var request_ticket:=ticket
		var response: Dictionary=await desktop.call_rpc('resolveCardAsset',{'path':path})
		if request_ticket!=ticket:return
		if not response.get('ok',false) or response.get('path','')!=path:_fail();return
		source=str(response.get('file',''))
	if not FileAccess.file_exists(source):source='res://../../public/'+path
	if not FileAccess.file_exists(source) or not ClassDB.class_exists('FFmpegVideoStream'):_fail();return
	var stream: VideoStream=ClassDB.instantiate('FFmpegVideoStream');stream.file=ProjectSettings.globalize_path(source)
	player.stream=stream;player.play();playing=true

func _media(id: String,event: String,_value: String) -> void:
	if id!=ticket:return
	if event=='playing':playing=true;elapsed=0
	elif event=='ended':stop();completed.emit()
	elif event=='error':_fail()

func _process(delta: float) -> void:
	elapsed+=delta
	if (not playing and elapsed>30) or elapsed>180:_fail()

func _fail() -> void:
	if failed_once:return
	failed_once=true;stop();failed.emit()

func stop() -> void:
	if plugin!=null and not ticket.is_empty():plugin.call('remove',ticket)
	if player!=null:player.stop();player.stream=null
	ticket='';hide();set_process(false)

func _exit_tree() -> void:
	stop()
	if plugin!=null:plugin.disconnect('media_event',_media)
