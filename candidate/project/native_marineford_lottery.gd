extends Control
const FRAME="images/board/marineford_ui/marineford_player_lottery_reel_frame.webp"
const REEL=preload("res://native_marineford_reel.gd")
var reels: Array[Dictionary]=[]
var model: Array=[]
var prepared: Dictionary={}
var viewport_width:=740.0
func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE;resized.connect(_layout);set_process(false)
func _label() -> Label:
	var n:=Label.new();n.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;n.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;n.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS;n.mouse_filter=Control.MOUSE_FILTER_IGNORE;n.add_theme_color_override("font_color",Color("f0d79d"));add_child(n);return n
func apply(next: Array,assets: Dictionary,width: float) -> void:
	model=next;prepared=assets;viewport_width=width
	while reels.size()<model.size():
		var lane:=REEL.new();add_child(lane)
		var frame:=TextureRect.new();frame.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;frame.stretch_mode=TextureRect.STRETCH_SCALE;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(frame)
		var results: Array=[_label(),_label(),_label()]
		for result in results:result.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
		reels.append({"lane":lane,"frame":frame,"owner":_label(),"results":results,"signature":"","running":false,"started":0,"target":0.0})
	for i in range(reels.size()):
		var row: Dictionary=reels[i];var active:=i<model.size()
		for key in ["lane","frame","owner"]:row[key].visible=active
		for result in row.results:result.visible=active
		if not active:row.running=false;continue
		var data: Dictionary=model[i];var signature: String=str(data.get("uid",JSON.stringify(data.tokens)))
		if signature!=row.signature:row.signature=signature;row.running=false;row.lane.offset=0;row.started=0
		var moving: bool=str(data.trackClasses).split(" ").has("is-running")
		if moving and not row.running:row.started=Time.get_ticks_msec()
		row.running=moving;row.target=float(str(data.target).trim_suffix("px")) if not str(data.target).is_empty() else 0.0
		row.lane.tokens=data.tokens;row.lane.textures=prepared;row.lane.single=model.size()==1
		row.frame.texture=prepared.get(FRAME);row.owner.text=str(data.owner)
		for j in range(3):row.results[j].text=str(data.resultParts[j]) if j<data.resultParts.size() else ""
	_layout();_process(0)
func _layout() -> void:
	if model.is_empty():return
	var columns:=1 if model.size()==1 else 2;var rows:=1 if model.size()<=2 else 2
	var cell:=Vector2((size.x-8*(columns-1))/columns,(size.y-8*(rows-1))/rows)
	for i in range(model.size()):
		var row: Dictionary=reels[i];var art:=Vector2(minf(cell.x,cell.y*2.16),minf(cell.y,cell.x/2.16))
		var origin:=Vector2((i%columns)*(cell.x+8),floori(float(i)/columns)*(cell.y+8))+(cell-art)/2
		row.frame.position=origin;row.frame.size=art
		row.lane.position=origin+art*Vector2(.09,.25);row.lane.size=art*Vector2(.82,.49)
		row.lane.token_width=clampf(viewport_width*(.076 if model.size()==1 else .055),82 if model.size()==1 else 54,110 if model.size()==1 else 78)
		row.owner.position=origin+art*Vector2(.33,.07);row.owner.size=art*Vector2(.34,.16);row.owner.add_theme_font_size_override("font_size",14 if model.size()==1 else 10)
		var start:=.10
		for j in range(3):
			var width: float=[.224,.352,.224][j];var label: Label=row.results[j]
			label.position=origin+art*Vector2(start,.78)+Vector2(4,0);label.size=art*Vector2(width,.15)-Vector2(8,0)
			label.add_theme_font_size_override("font_size",(14 if j==1 else 10) if model.size()==1 else (9 if j==1 else 7));start+=width
		row.lane.queue_redraw()
func _process(_delta: float) -> void:
	var moving:=false
	for row in reels:
		if not row.lane.visible or not row.running:continue
		var progress:=clampf(float(Time.get_ticks_msec()-int(row.started))/2600,0,1)
		row.lane.offset=float(row.target)*REEL.easing(progress) if progress<1 else float(row.target)
		row.lane.queue_redraw();moving=moving or progress<1
	set_process(moving)
func geometry(kind: String,index: int) -> Dictionary:
	if index<0 or index>=model.size():return {}
	var lane: Control=reels[index].lane;var box:=lane.get_global_rect()
	if kind=="lottery-token":box.size.x=reels[index].lane.token_width
	return {"left":box.position.x,"top":box.position.y,"width":box.size.x,"height":box.size.y,"gap":6}
func reset() -> void:
	model=[];set_process(false);hide()
	for row in reels:row.signature="";row.running=false
