extends Button
signal source_event(uid: String,type: String,transfer: String)
var source_uid:=""
var source_data: Dictionary={}
func _ready() -> void:pressed.connect(func():source_event.emit(source_uid,"click",""))
func _get_drag_data(_position: Vector2) -> Variant:
	if disabled or not source_data.has("totCrewIndex"):return null
	var index:=str(source_data.totCrewIndex)
	source_event.emit(source_uid,"dragstart",index)
	var preview:=Label.new();preview.text=tooltip_text;set_drag_preview(preview)
	return {"kind":"po-boss-team","index":index}
func _can_drop_data(_position: Vector2,data: Variant) -> bool:
	var valid: bool=not disabled and source_data.has("totTeamWorld") and data is Dictionary and data.get("kind","")=="po-boss-team"
	if valid:source_event.emit(source_uid,"dragover",str(data.index))
	return valid
func _drop_data(_position: Vector2,data: Variant) -> void:
	if _can_drop_data(_position,data):source_event.emit(source_uid,"drop",str(data.index))
