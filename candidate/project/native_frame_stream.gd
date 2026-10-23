extends Node
## Lossless animation with one stable GPU texture and at most two decoded or
## decoding frames. Source time controls the requested frame; late work never
## clears the displayed texture or rewinds a newly opened scene.
signal frame_ready(index: int)
signal stream_failed(error: int)
var texture: ImageTexture
var root := ""
var definition: Dictionary = {}
var generation := 0
var current := -1
var desired := 0
var duration := 0
var starts: Array[int] = []
var decoded: Dictionary = {}
var jobs: Dictionary = {}
var sequence := 0
var running := false
var enabled := false
var started := 0
var peak_slots := 0
var peak_bytes := 0
var updates := 0
var late_ticks := 0
var skipped := 0
var failure := OK

func _ready() -> void:set_process(false)

func configure(folder: String, manifest: Dictionary) -> bool:
	stop()
	if manifest.get("frames",[]).is_empty() or int(manifest.get("loop",-1))!=0:return false
	root=folder;definition=manifest.duplicate(true);starts.clear();duration=0
	for frame in definition.frames:
		var file:=str(frame.file)
		if file.get_file()!=file or file.contains("..") or int(frame.durationMs)<=0:return false
		starts.append(duration);duration+=int(frame.durationMs)
	if int(definition.width)<=0 or int(definition.height)<=0:return false
	current=-1;desired=0;texture=null;failure=OK;updates=0;late_ticks=0;skipped=0;peak_slots=0;peak_bytes=0;enabled=true
	_fill();return true

func stop() -> void:
	generation+=1;running=false;enabled=false;set_process(false);decoded.clear()
	# Workers finish naturally. Their generation is checked before publication.
	# They still count against the two-slot bound until completion.

func start() -> bool:
	if not enabled or current!=0 or failure!=OK:return false
	started=Time.get_ticks_msec();running=true;set_process(true);return true

func frame_at(elapsed: int) -> int:
	var time:=posmod(elapsed,maxi(1,duration))
	for i in range(starts.size()-1,-1,-1):
		if time>=starts[i]:return i
	return 0

func seek_elapsed(elapsed: int) -> void:
	if not enabled or definition.is_empty() or failure!=OK:return
	desired=frame_at(elapsed)
	for index in decoded.keys():
		if index!=desired and index!=(desired+1)%starts.size():decoded.erase(index)
	if desired!=current:
		if decoded.has(desired):_publish_frame(desired)
		else:late_ticks+=1
	_fill()

func _process(_delta: float) -> void:
	if running:seek_elapsed(Time.get_ticks_msec()-started)

func _fill() -> void:
	if not enabled or definition.is_empty() or failure!=OK:return
	for index in [desired,(desired+1)%starts.size(),(desired+2)%starts.size()]:
		if decoded.size()+jobs.size()>=2:break
		if index==current or decoded.has(index):continue
		var already:=false
		for job in jobs.values():
			if job.generation==generation and job.index==index:already=true
		if already:continue
		sequence+=1;var key:=sequence;var ticket:=generation
		var path:=root.path_join(str(definition.frames[index].file))
		var expected:=str(definition.frames[index].get("rgbaSha256",""))
		var width:=int(definition.width);var height:=int(definition.height)
		var task:=WorkerThreadPool.add_task(func():
			var image:=Image.new();var error:=image.load(path)
			if error==OK:
				image.convert(Image.FORMAT_RGBA8)
				if image.get_width()!=width or image.get_height()!=height:error=ERR_INVALID_DATA
				if error==OK and not expected.is_empty():
					var hash:=HashingContext.new();hash.start(HashingContext.HASH_SHA256);hash.update(image.get_data())
					if hash.finish().hex_encode()!=expected:error=ERR_FILE_CORRUPT
			call_deferred("_decoded",key,ticket,index,image,error)
		)
		jobs[key]={"task":task,"generation":ticket,"index":index};_measure()

func _decoded(key: int,ticket: int,index: int,image: Image,error: int) -> void:
	if jobs.has(key):WorkerThreadPool.wait_for_task_completion(jobs[key].task);jobs.erase(key)
	if ticket!=generation:_fill();return
	if error!=OK:failure=error;running=false;set_process(false);stream_failed.emit(error);return
	if index==desired or index==(desired+1)%starts.size() or index==(desired+2)%starts.size():decoded[index]=image
	_measure()
	if decoded.has(desired) and desired!=current:_publish_frame(desired)
	_fill()

func _publish_frame(index: int) -> void:
	var image: Image=decoded[index]
	if texture==null:texture=ImageTexture.create_from_image(image)
	else:texture.update(image)
	if current>=0 and index!=(current+1)%starts.size():skipped+=posmod(index-current-1,starts.size())
	current=index;decoded.erase(index);updates+=1;_measure();frame_ready.emit(index)

func _measure() -> void:
	peak_slots=maxi(peak_slots,decoded.size()+jobs.size())
	peak_bytes=maxi(peak_bytes,(decoded.size()+jobs.size()+(1 if texture!=null else 0))*int(definition.get("width",0))*int(definition.get("height",0))*4)

func metrics_json() -> String:
	return JSON.stringify({"peakSlots":peak_slots,"peakDecodedAndTextureBytes":peak_bytes,"updates":updates,"lateTicks":late_ticks,"skipped":skipped,"current":current,"failure":failure})

func _exit_tree() -> void:
	generation+=1;running=false
	for job in jobs.values():WorkerThreadPool.wait_for_task_completion(job.task)
	jobs.clear();decoded.clear()
