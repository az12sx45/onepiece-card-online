extends Node
## Native transport only. The unmodified Socket.IO client owns its protocol,
## acknowledgements, heartbeats and reconnects; no game events are rewritten.
signal peer_opened(id: int,protocol: String)
signal peer_message(id: int,value: String,binary: bool)
signal peer_closed(id: int,code: int,reason: String)
signal peer_failed(id: int,message: String)
var peers: Dictionary={}
var allow_local_test:=false
const COMPATIBILITY_UA="ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility) PO-Native-Godot/0.1"

func allows_production_url(url: String) -> bool:
	# Socket.IO may spell the default TLS port explicitly. Both forms identify
	# the same fixed production authority; other ports and hosts remain denied.
	return url.begins_with("wss://onepiece-card-online.onrender.com/socket.io/?") or url.begins_with("wss://onepiece-card-online.onrender.com:443/socket.io/?")

func start(id: int,url: String,protocols_json: String) -> int:
	if peers.has(id):return ERR_ALREADY_EXISTS
	var allowed:=allows_production_url(url)
	if allow_local_test:
		var pattern:=RegEx.new();pattern.compile("^ws://127\\.0\\.0\\.1:[0-9]+/socket\\.io/\\?")
		allowed=allowed or pattern.search(url)!=null
	if not allowed:
		print("[PO_NET] endpoint_rejected")
		return ERR_UNAUTHORIZED
	# Match the existing server's 30 MiB message contract plus framing overhead.
	var socket:=WebSocketPeer.new();socket.inbound_buffer_size=32*1024*1024;socket.outbound_buffer_size=32*1024*1024
	socket.handshake_headers=PackedStringArray(["User-Agent: "+COMPATIBILITY_UA]);socket.supported_protocols=PackedStringArray(JSON.parse_string(protocols_json))
	var error:=socket.connect_to_url(url)
	print("[PO_NET] connect_start code=",error)
	if error!=OK:return error
	peers[id]={"socket":socket,"opened":false};return OK

func send(id: int,value: String,binary: bool) -> int:
	if not peers.has(id):return ERR_DOES_NOT_EXIST
	var socket: WebSocketPeer=peers[id].socket
	if socket.get_ready_state()!=WebSocketPeer.STATE_OPEN:return ERR_UNAVAILABLE
	return socket.put_packet(Marshalls.base64_to_raw(value)) if binary else socket.send_text(value)

func close_peer(id: int,code: int,reason: String) -> void:
	if peers.has(id):peers[id].socket.close(code,reason)
func buffered(id: int) -> int:return peers[id].socket.get_current_outbound_buffered_amount() if peers.has(id) else 0
func _process(_delta: float) -> void:
	for id in peers.keys():
		if not peers.has(id):continue
		var entry: Dictionary=peers[id];var socket: WebSocketPeer=entry.socket;socket.poll()
		var state:=socket.get_ready_state()
		if state==WebSocketPeer.STATE_OPEN:
			if not entry.opened:
				entry.opened=true;socket.set_no_delay(true);print("[PO_NET] connected");peer_opened.emit(id,socket.get_selected_protocol())
			var count:=0
			while socket.get_available_packet_count()>0 and count<128:
				var packet:=socket.get_packet();count+=1
				var started:=Time.get_ticks_usec()
				peer_message.emit(id,packet.get_string_from_utf8() if socket.was_string_packet() else Marshalls.raw_to_base64(packet),not socket.was_string_packet())
				var elapsed:=(Time.get_ticks_usec()-started)/1000.0
				if elapsed>=40:print("[PO_PERF] ",JSON.stringify({"area":"network-packet","ms":elapsed,"bytes":packet.size()}))
		elif state==WebSocketPeer.STATE_CLOSED:
			var code:=socket.get_close_code();var reason:=socket.get_close_reason();peers.erase(id)
			print("[PO_NET] closed code=",code," opened=",entry.opened)
			if not entry.opened:peer_failed.emit(id,"websocket_connection_failed")
			peer_closed.emit(id,code,reason)
func _exit_tree() -> void:
	for entry in peers.values():entry.socket.close(-1)
	peers.clear()
