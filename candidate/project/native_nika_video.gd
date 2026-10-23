extends Control
## Original MP4 and source-owned controller. Windows uses FFmpeg; Android
## requires the registered native MediaPlayer plugin and verified blob resolver.
signal media_event(event: String)
const Motion=preload("res://native_evolution_motion.gd")
const Fonts=preload("res://native_fonts.gd")
var asset_root:=ProjectSettings.globalize_path("res://../../public")
var player: VideoStreamPlayer
var backdrop: ColorRect
var video_group: CanvasGroup
var frame_background: ColorRect
var fallback: Label
var track: Array=[]
var began:=0
var fade_began:=0
var finished_playback:=false
var prepared:=false
var duration:=0.0
var last_position:=0.0
var decoded_size:=Vector2.ZERO
var source:=""
var muted_for_test:=false
var event_history: Array=[]
var profile:="nika"
var android_plugin: Object
var android_ticket:=""
var android_sequence:=0
var android_media: Dictionary={}
var last_plugin_opacity:=-1.0
var playing_emitted:=false
var playback_volume:=1.0
var start_position:=0.0
var cinematic_title:=""

func _ready() -> void:
	hide();mouse_filter=Control.MOUSE_FILTER_STOP;z_index=1000
	backdrop=ColorRect.new();backdrop.color=Color.BLACK;backdrop.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(backdrop)
	video_group=CanvasGroup.new();add_child(video_group)
	frame_background=ColorRect.new();frame_background.color=Color.BLACK;frame_background.mouse_filter=Control.MOUSE_FILTER_IGNORE;video_group.add_child(frame_background)
	player=VideoStreamPlayer.new();player.expand=true;player.mouse_filter=Control.MOUSE_FILTER_IGNORE;video_group.add_child(player)
	fallback=Label.new();fallback.add_theme_font_override("font",Fonts.weighted(900));fallback.add_theme_font_size_override("font_size",18);fallback.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;fallback.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;fallback.hide();add_child(fallback)
	player.finished.connect(func():finished_playback=true;last_position=duration;_emit("ended"))
	resized.connect(_layout)
	if OS.get_name() in ["Android","iOS"] and Engine.has_singleton("PoNativeVideo"):
		android_plugin=Engine.get_singleton("PoNativeVideo");android_plugin.connect("media_event",_android_event)

func _android_event(ticket: String,event: String,value: String) -> void:
	if ticket!=android_ticket or not visible:return
	android_media=JSON.parse_string(value)
	duration=float(android_media.get("duration",0));last_position=float(android_media.get("currentTime",0));prepared=int(android_media.get("readyState",0))>0;finished_playback=bool(android_media.get("ended",false))
	decoded_size=Vector2(float(android_media.get("width",0)),float(android_media.get("height",0)))
	if event=="playing":playing_emitted=true
	if event in ["loadedmetadata","playing","ended","error"]:_emit(event)

func _emit(event: String) -> void:
	event_history.append({"type":event,"timeMs":Time.get_ticks_msec()-began,"position":last_position});media_event.emit(event)

func start_video(value: String) -> void:
	var config: Dictionary=JSON.parse_string(value)
	source=str(config.src).split("?")[0];track=config.get("opacityTrack",[]);profile=str(config.get("profile","nika"))
	assert(profile in ["nika","marineford","katakuri"],"Unknown source video presentation")
	if profile!="nika":track=[{"time":0.0,"value":1.0},{"time":1.0,"value":1.0}]
	playback_volume=clampf(float(config.get("volume",1.0)),0,1);start_position=maxf(0,float(config.get("startTime",0)));cinematic_title=str(config.get("title",""))
	assert(track.size()>1,"Source video-cut keyframes required")
	assert(not source.is_absolute_path() and not source.contains(".."),"Invalid cinematic asset path")
	began=Time.get_ticks_msec();fade_began=0;modulate.a=1;finished_playback=false;playing_emitted=false;prepared=false;last_position=0;duration=0;decoded_size=Vector2.ZERO;fallback.hide();event_history.clear();show();_layout()
	backdrop.color=Color("020308") if profile=="marineford" else Color.BLACK
	_start.call_deferred(bool(config.get("muted",false)))

func _start(muted: bool) -> void:
	if not visible:return
	if OS.get_name() in ["Android","iOS"]:
		if android_plugin==null:_emit("error");return
		android_sequence+=1;android_ticket="video-"+str(get_instance_id())+"-"+str(android_sequence);android_media={};last_plugin_opacity=-1
		backdrop.hide();video_group.hide()
		if profile=="katakuri":android_plugin.call("playKatakuri",android_ticket,source,cinematic_title,start_position,muted or muted_for_test)
		else:android_plugin.call("play",android_ticket,source,muted or muted_for_test,profile=="marineford")
		if OS.get_name()=="iOS":android_plugin.call("volume",android_ticket,playback_volume)
		return
	backdrop.show();video_group.show()
	if OS.get_name()!="Windows":_emit("error");return
	var status:=GDExtensionManager.load_extension("res://addons/ffmpeg/ffmpeg.gdextension")
	if status not in [GDExtensionManager.LOAD_STATUS_OK,GDExtensionManager.LOAD_STATUS_ALREADY_LOADED] or not ClassDB.class_exists("FFmpegVideoStream"):_emit("error");return
	if not FileAccess.file_exists(asset_root.path_join(source)):_emit("error");return
	var stream: VideoStream=ClassDB.instantiate("FFmpegVideoStream");stream.file=asset_root.path_join(source)
	player.stream=stream;duration=player.get_stream_length();player.volume=0.0 if muted or muted_for_test else playback_volume;player.paused=false;player.play()
	if start_position>0:player.stream_position=minf(start_position,maxf(0,duration-.1))
	prepared=true;_emit("loadedmetadata")

func _layout() -> void:
	backdrop.size=size;frame_background.size=size
	if decoded_size.x>0 and decoded_size.y>0:
		player.size=decoded_size*(maxf(size.x/decoded_size.x,size.y/decoded_size.y) if profile!="nika" else minf(size.x/decoded_size.x,size.y/decoded_size.y));player.position=(size-player.size)*.5
	fallback.position=Vector2(size.x*.05,size.y*.92-64);fallback.size=Vector2(size.x*.9,60)

func pause_video() -> void:
	if OS.get_name() in ["Android","iOS"] and android_plugin!=null:android_plugin.call("pause",android_ticket)
	else:player.paused=true
func fade_out() -> void:fade_began=Time.get_ticks_msec()
func remove_video() -> void:
	if OS.get_name() in ["Android","iOS"] and android_plugin!=null:android_plugin.call("remove",android_ticket);android_ticket=""
	player.stop();player.stream=null;prepared=false;hide()
func show_fallback(text: String) -> void:fallback.text=text;fallback.show()
func media_state_json() -> String:
	if OS.get_name() in ["Android","iOS"]:return JSON.stringify({"duration":duration,"currentTime":last_position,"paused":android_media.get("paused",true),"ended":finished_playback,"readyState":android_media.get("readyState",0)})
	return JSON.stringify({"duration":duration,"currentTime":last_position,"paused":player.paused,"ended":finished_playback,"readyState":4 if prepared and decoded_size.x>0 else 1 if prepared else 0})

func _process(_delta: float) -> void:
	if not visible:return
	if OS.get_name() not in ["Android","iOS"] and prepared and not finished_playback:last_position=player.stream_position
	var texture:=player.get_video_texture()
	if texture!=null and texture.get_size()!=decoded_size:decoded_size=texture.get_size();_layout()
	if OS.get_name() not in ["Android","iOS"] and prepared and not playing_emitted and texture!=null and texture.get_width()>0 and player.is_playing():playing_emitted=true;_emit("playing")
	var time:=clampf((Time.get_ticks_msec()-began)/30000.0,0,1)
	var sample:=Motion.segment(track,time,[0.0,0.0,1.0,1.0]);var opacity:=lerpf(float(sample[0]),float(sample[1]),float(sample[2]))
	if profile=="marineford":opacity=preload("res://native_marineford_motion.gd").sample("conquerorVideoIn",float(Time.get_ticks_msec()-began)/1000,size).opacity
	video_group.self_modulate.a=opacity;backdrop.modulate.a=opacity
	if fade_began>0:modulate.a=1.0-Motion._ease(clampf((Time.get_ticks_msec()-fade_began)/550.0,0,1),[.25,.1,.25,1.0])
	if profile=="marineford" and fade_began>0:modulate.a=preload("res://native_marineford_motion.gd").sample("conquerorVideoOut",float(Time.get_ticks_msec()-fade_began)/1000,size).opacity
	if OS.get_name() in ["Android","iOS"] and android_plugin!=null and absf(last_plugin_opacity-opacity*modulate.a)>.001:
		last_plugin_opacity=opacity*modulate.a;android_plugin.call("opacity",android_ticket,last_plugin_opacity)

func _exit_tree() -> void:
	if android_plugin!=null:
		android_plugin.call("remove",android_ticket)
		if android_plugin.is_connected("media_event",_android_event):android_plugin.disconnect("media_event",_android_event)

func test_state_json() -> String:
	return JSON.stringify({"media":JSON.parse_string(media_state_json()),"decodedSize":[decoded_size.x,decoded_size.y],"videoRect":[player.position.x,player.position.y,player.size.x,player.size.y],"surfaceSize":[size.x,size.y],"opacity":video_group.self_modulate.a,"events":event_history,"fallbackVisible":fallback.visible,"visible":visible})
