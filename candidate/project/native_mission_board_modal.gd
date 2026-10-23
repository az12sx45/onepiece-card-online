extends "res://native_mission_journal_modal.gd"
## Same phone wall/detail arrangement; original board handlers own all rules.
var original_model: Dictionary={}
var broker_open:=TextureRect.new()
var broker_blink:=TextureRect.new()
var guidance:=RichTextLabel.new()
var tier:=Label.new()
var refresh:=Button.new()
var broker_epoch:=0
var blink_start:=0
var refresh_framed:=false

func _ready() -> void:
	super._ready()
	for picture in [broker_open,broker_blink]:_picture(picture);add_child(picture)
	guidance.bbcode_enabled=false;guidance.scroll_active=true;guidance.add_theme_font_size_override("normal_font_size",12);guidance.add_theme_color_override("default_color",Color("bde2de"));add_child(guidance)
	tier.mouse_filter=Control.MOUSE_FILTER_IGNORE;tier.add_theme_font_size_override("font_size",13);add_child(tier)
	refresh.flat=true;refresh.add_theme_font_size_override("font_size",13);refresh.pressed.connect(func():_press("refreshMissionBoardBtn"));add_child(refresh)
	name_label.add_theme_font_size_override("font_size",18)

func apply_json(value: String) -> void:
	var next: Dictionary=JSON.parse_string(value)
	if next==original_model and visible and not busy:surface_ready.emit();return
	broker_epoch+=1;busy=true;_load_board(next,broker_epoch)

func _load_board(next: Dictionary, token: int) -> void:
	var loaded: Dictionary={};var deadline:=Time.get_ticks_msec()+20000
	while token==broker_epoch:
		for path in [next.broker.open,next.broker.blink]:
			if loaded.has(path):continue
			if cache.failed.has(path):push_error("Original mission broker failed: "+str(path));return
			var live: bool=cache.live_textures.has(path) and cache.live_textures[path].get_ref()!=null
			if not cache.records.has(path) and not live and cache.pending.size()>=2:continue
			var texture: Texture2D=cache.request(path)
			if texture:loaded[path]=texture
		if loaded.size()==2:break
		if Time.get_ticks_msec()>deadline:push_error("Mission broker timeout");return
		await get_tree().process_frame
	if token!=broker_epoch:return
	original_model=next;broker_open.texture=loaded[next.broker.open];broker_blink.texture=loaded[next.broker.blink];blink_start=Time.get_ticks_msec();broker_blink.modulate.a=0;guidance.text=next.broker.guidance;tier.text=next.tier;refresh.text=next.refresh.label;refresh.disabled=next.refresh.disabled
	var projected: Dictionary={"kind":"mission-board","title":next.title,"subtitle":"　".join(next.wallet),"entries":[],"empty":next.empty,"detail":{},"actions":next.actions.duplicate(true)}
	for entry in next.entries:
		projected.entries.append({"key":entry.key,"id":entry.id,"disabled":entry.get("disabled",false),"selected":entry.selected,"main":false,"image":entry.image,"title":entry.title,"subtitle":" · ".join(entry.tags)+"\n"+entry.condition+"\n"+"　".join(entry.rewards),"status":" · ".join(entry.stamps)})
	var rewards: Array[String]=[]
	for item in next.detail.rewards:rewards.append(item.label+"　"+item.value)
	projected.detail={"image":next.detail.image,"title":next.detail.title,"subtitle":" · ".join(next.detail.tags),"conditionTitle":"","condition":next.detail.condition if not next.detail.condition.is_empty() else next.detail.empty,"progressLabel":"","progress":"","progressPercent":0,"rewardTitle":"","reward":"\n".join(rewards),"note":next.detail.shared}
	while projected.actions.size()<3:projected.actions.append({"key":"mission-unused","label":"","disabled":true})
	if projected.actions.size()>3:push_error("Original mission actions exceed reviewed phone layout");return
	super.apply_json(JSON.stringify(projected))

func _layout() -> void:
	if actions.size()!=3:return
	panel.size=size/.125;title.position=Vector2(18,12);title.size=Vector2(150,30);title.horizontal_alignment=HORIZONTAL_ALIGNMENT_LEFT;subtitle.position=Vector2(170,16);subtitle.size=Vector2(size.x-188,24);subtitle.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	var left: float=floor((size.x-46)*.48);tier.position=Vector2(18,58);tier.size=Vector2(left-108,36);refresh.position=Vector2(left-78,54);refresh.size=Vector2(96,40)
	list_scroll.position=Vector2(18,100);list_scroll.size=Vector2(left,size.y-148)
	detail_frame.position=Vector2(left+28,54);detail_frame.size=Vector2(size.x-left-46,size.y-150)/.0625;detail_scroll.position=detail_frame.position+Vector2(10,8);detail_scroll.size=Vector2(size.x-left-66,size.y-166)
	progress_box.hide();condition_title.hide();reward_title.hide()
	var count: int=original_model.get("actions",[]).size()
	for index in range(actions.size()):
		var button: Button=actions[index].button;button.visible=index<count
		if button.visible:button.position=Vector2(left+28+index*(size.x-left-40)/count,size.y-88);button.size=Vector2((size.x-left-40)/count-6,40)
	for picture in [broker_open,broker_blink]:picture.position=Vector2(18,size.y-40);picture.size=Vector2(40,26)
	guidance.position=Vector2(64,size.y-42);guidance.size=Vector2(size.x-82,28)
	if not refresh_framed and row_texture!=null:_frame(refresh);refresh_framed=true
	queue_redraw();call_deferred("_fit_rows")

func _new_row() -> void:
	super._new_row()
	var row: Dictionary=rows[-1];row.title.add_theme_font_size_override("font_size",16);row.subtitle.add_theme_font_size_override("font_size",12)

func _process(_delta: float) -> void:
	if not visible:return
	broker_blink.modulate.a=_blink_alpha(Time.get_ticks_msec()-blink_start)

func _blink_alpha(milliseconds: float) -> float:
	var fraction: float=fmod(milliseconds/6400.0,1.0)
	var alpha:=0.0
	if fraction>=.88 and fraction<.893:alpha=_css_ease((fraction-.88)/.013)
	elif fraction>=.893 and fraction<.915:alpha=1.0
	elif fraction>=.915 and fraction<.93:alpha=1.0-_css_ease((fraction-.915)/.015)
	return alpha

func test_blink_alpha(milliseconds: float) -> float:return _blink_alpha(milliseconds)
func test_quiet_animation_window() -> bool:return fmod(float(Time.get_ticks_msec()-blink_start)/6400.0,1.0)<.75

func _css_ease(value: float) -> float:
	var low:=0.0;var high:=1.0
	for iteration in range(24):
		var t: float=(low+high)*.5;var u: float=1.0-t
		if 3*u*u*t*.25+3*u*t*t*.25+t*t*t<value:low=t
		else:high=t
	var t: float=(low+high)*.5;var u: float=1.0-t
	return 3*u*u*t*.1+3*u*t*t+t*t*t

func close_surface() -> void:broker_epoch+=1;super.close_surface()
func test_press(key: String) -> bool:
	if key=="refreshMissionBoardBtn":
		if not test_ready() or refresh.disabled:return false
		refresh.pressed.emit();return true
	return super.test_press(key)
func test_layout() -> bool:
	if not super.test_layout():return false
	var bounds:=Rect2(Vector2.ZERO,size)
	for node in [tier,refresh,broker_open,broker_blink,guidance]:
		if not bounds.encloses(Rect2(node.position,node.size)):return false
	return true
