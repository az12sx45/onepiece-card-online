extends "res://native_desktop_session.gd"
signal resolved(ticket: String,value: String)
func resolve_audio(ticket: String,path: String) -> void:
	var value:=await call_rpc('resolveCardAsset',{'path':path})
	if not closed:resolved.emit(ticket,JSON.stringify(value))
