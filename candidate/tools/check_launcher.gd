extends SceneTree
var failures: Array[String]=[]
var checks:=0

class FakeBridge extends RefCounted:
	var calls: Array[String]=[]
	var signed_in:=true
	func session_request(method: String,_args: String) -> String:
		calls.append(method)
		return JSON.stringify({"ok":true,"secret":"test-session" if signed_in else "","account":{"userId":123} if signed_in else null})
	func launcher_show(_reload: bool) -> bool:calls.append("show");return true
	func launcher_hide() -> void:calls.append("hide")
	func launcher_requests() -> String:return "[]"

class Host extends "res://ios_host.gd":
	var starts:=0
	func _ready() -> void:pass
	func _start_game() -> void:
		starts+=1
		bridge.call("launcher_hide")
		game=Control.new();add_child(game)

func check(value: bool,label: String) -> void:
	checks+=1
	if not value:failures.append(label)

func _initialize() -> void:run_checks.call_deferred()
func run_checks() -> void:
	var host:=Host.new();var bridge:=FakeBridge.new();host.bridge=bridge;root.add_child(host)
	check(host.starts==0 and host.game==null,"App does not auto-enter game")
	var state:=host._request("getNativeState",{})
	check(state.games.board.status=="installed","Bundled Board available")
	check(state.games.card.status=="unavailable" and state.games.chess.status=="unavailable","No false claim that other games are ported")
	bridge.signed_in=false
	check(host._request("launchGame",{"gameId":"board"}).ok==false,"Unauthenticated launch refused")
	bridge.signed_in=true
	check(host._request("launchGame",{"gameId":"board"}).ok==true,"Authenticated Board launch accepted")
	await process_frame;await process_frame
	check(host.starts==1 and bridge.calls.has("hide"),"Only explicit launch opens game and hides launcher")
	host.return_to_launcher();await process_frame
	check(host.game==null and bridge.calls.has("show"),"Return releases game and restores launcher")
	check(not bridge.calls.has("clearSession"),"Returning does not log user out")
	check(host._request("launchGame",{"gameId":"../unknown"}).ok==false,"Unknown launch target refused")
	host.queue_free();await process_frame
	var report:={"checks":checks,"failures":failures,"passed":failures.is_empty(),"fixtureOnly":true,"iphoneTested":false}
	var args:=OS.get_cmdline_user_args()
	if args.size()==1:
		var file:=FileAccess.open(args[0],FileAccess.WRITE);file.store_string(JSON.stringify(report))
	print("PO_IOS_LAUNCHER_CHECK ",JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
