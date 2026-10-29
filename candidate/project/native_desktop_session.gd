extends Node
signal reply(request_id: String, result_json: String)
var endpoint:=""
var token:=""
var closed:=false

func _ready() -> void:
	endpoint=OS.get_environment('PO_NATIVE_DESKTOP_ENDPOINT');token=OS.get_environment('PO_NATIVE_DESKTOP_TOKEN')
	var pattern:=RegEx.new();pattern.compile('^http://127\\.0\\.0\\.1:[0-9]{1,5}/rpc$')
	if OS.get_name()!='Windows' or pattern.search(endpoint)==null or token.length()!=64:endpoint='';token=''

func available() -> bool:return not closed and not endpoint.is_empty()

func call_rpc(method: String,args: Dictionary={}) -> Dictionary:
	if not available():return {'ok':false,'error':'Desktop launcher bridge unavailable'}
	var client:=HTTPRequest.new();client.timeout=15;client.max_redirects=0;client.body_size_limit=65536;add_child(client)
	var error:=client.request(endpoint,PackedStringArray(['Content-Type: application/json','X-Po-Native: '+token]),HTTPClient.METHOD_POST,JSON.stringify({'method':method,'args':args}))
	if error!=OK:client.queue_free();return {'ok':false,'error':'Desktop bridge request failed'}
	var response: Array=await client.request_completed
	client.queue_free()
	if closed or int(response[0])!=HTTPRequest.RESULT_SUCCESS or int(response[1])!=200:return {'ok':false,'error':'Desktop session unavailable'}
	var value=JSON.parse_string(response[3].get_string_from_utf8())
	return value if value is Dictionary else {'ok':false,'error':'Invalid desktop response'}

func request(request_id: String,method: String,arguments_json: String) -> void:
	if method not in ['getNativeState','saveSession','clearSession']:reply.emit(request_id,JSON.stringify({'ok':false}));return
	var args=JSON.parse_string(arguments_json)
	if not args is Dictionary:reply.emit(request_id,JSON.stringify({'ok':false}));return
	var value:=await call_rpc(method,args)
	if not closed:reply.emit(request_id,JSON.stringify(value))

func _exit_tree() -> void:closed=true;token='';endpoint=''
