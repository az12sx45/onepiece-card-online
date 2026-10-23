extends Node
## Bounded native GET for the original room-runtime capability endpoint.
signal completed(id: int,code: int,text: String,error: String)
var allow_local_test:=false
var requests: Dictionary={}

func read_runtime(id: int,url: String) -> void:
	var allowed:=url=="https://onepiece-card-online.onrender.com/api/board-runtime"
	if allow_local_test:
		var pattern:=RegEx.new();pattern.compile("^http://127\\.0\\.0\\.1:[0-9]+/api/board-runtime$");allowed=allowed or pattern.search(url)!=null
	if not allowed:completed.emit(id,0,"","runtime_origin_rejected");return
	if requests.has(id) or requests.size()>=4:completed.emit(id,0,"","runtime_queue_full");return
	var request:=HTTPRequest.new();request.timeout=8;request.max_redirects=0;request.body_size_limit=65536;add_child(request);requests[id]=request
	request.request_completed.connect(func(result: int,code: int,_headers: PackedStringArray,body: PackedByteArray):
		if not requests.has(id):return
		requests.erase(id);request.queue_free()
		completed.emit(id,code,body.get_string_from_utf8() if result==HTTPRequest.RESULT_SUCCESS else "","" if result==HTTPRequest.RESULT_SUCCESS else "runtime_http_failed")
	)
	var error:=request.request(url,PackedStringArray(["User-Agent: "+preload("res://native_websocket_pool.gd").COMPATIBILITY_UA,"Cache-Control: no-cache"]))
	if error!=OK:requests.erase(id);request.queue_free();completed.emit(id,0,"","runtime_request_failed")

func cancel(id: int) -> void:
	if not requests.has(id):return
	var request: HTTPRequest=requests[id];requests.erase(id);request.cancel_request();request.queue_free()

func _exit_tree() -> void:
	for id in requests.keys():cancel(id)
