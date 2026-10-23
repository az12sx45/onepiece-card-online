extends "res://native_backpack_modal.gd"
## Nested original target / fixed-step screens share the persistent phone shell.
var source_model: Dictionary={}
var target_height:=116
func apply_json(value: String) -> void:
	source_model=JSON.parse_string(value)
	var next: Dictionary={"kind":source_model.kind,"title":source_model.title,"owner":source_model.subtitle,"categories":[],"active":source_model.kind,"entries":[],"empty":"","preview":{"name":source_model.name,"tier":"","meta":source_model.description+"\n\n"+(source_model.subtitle if source_model.kind=="sea-train" else source_model.hint),"icon":_icon(source_model.image,"")},"action":{"key":"","label":"","hidden":true,"disabled":true},"close":{"key":"closeItemModalBtn","label":source_model.close.label},"contentVisible":true}
	for i in range(5):next.categories.append({"key":"","label":"","count":"","selected":false})
	for entry in source_model.entries:
		next.entries.append({"key":entry.key,"name":entry.step if source_model.kind=="fixed-step" else entry.name,"tier":entry.label if source_model.kind=="fixed-step" else entry.tier+"\n"+entry.meta,"count":"","selected":false,"disabled":entry.disabled,"label":entry.label,"icon":_icon(source_model.image,"") if source_model.kind=="fixed-step" else _icon(entry.image,entry.fallback)})
	if source_model.get("mark")!=null:next.action={"key":"backpackPreviewAction","label":source_model.mark.label,"hidden":false,"disabled":source_model.mark.disabled}
	super.apply_json(JSON.stringify(next))
func _icon(image: String,fallback: String) -> Dictionary:return {"kind":"item","image":image,"portrait":"","fallback":fallback,"rank":""}
func _layout() -> void:
	if tabs.size()!=5:return
	super._layout()
	for tab in tabs:tab.hide()
	owner_label.hide();title.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;title.add_theme_font_size_override("font_size",18);title.size=Vector2(size.x-40,48)
	var left: float=floor((size.x-52)*.46);detail_frame.position.y=72;detail_frame.size.y=(size.y-131)/.0625;detail_scroll.position.y=82;detail_scroll.size.y=size.y-151
	spacer.custom_minimum_size=Vector2(size.x-left-66, _list_height());spacer.size=spacer.custom_minimum_size;list_scroll.position.y=72;list_scroll.size=Vector2(size.x-left-52,size.y-131);empty.hide();use_button.hide();close_button.position=Vector2(20,size.y-51);close_button.size=Vector2(size.x-40,38);_rows()
	if source_model.get("kind","")=="sea-train" and source_model.get("mark")!=null:
		use_button.show();use_button.text=source_model.mark.label;use_button.position=Vector2(20,size.y-51);use_button.size=Vector2((size.x-52)/2,38);close_button.position.x=32+use_button.size.x;close_button.size.x=use_button.size.x

func _list_height() -> int:return 2*92 if model.get("kind","")=="fixed-step" else model.get("entries",[]).size()*target_height
func _new_row() -> void:
	super._new_row()
	var row: Dictionary=rows[-1];row.info.clip_text=false;row.info.text_overrun_behavior=TextServer.OVERRUN_NO_TRIMMING;row.info.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	var label:=Label.new();label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT;label.add_theme_color_override("font_color",Color("ffe3a5"));label.add_theme_font_size_override("font_size",12);label.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;row.button.add_child(label);row["action_label"]=label;row.info.minimum_size_changed.connect(func():call_deferred("_rows"));label.minimum_size_changed.connect(func():call_deferred("_rows"))
func _rows() -> void:
	if model.is_empty() or not visible:return
	if model.kind!="fixed-step":_target_rows();return
	while rows.size()<model.entries.size():_new_row()
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.button.visible=i<model.entries.size()
		if not row.button.visible:row.icon.present({},{});row.index=-1;continue
		var entry: Dictionary=model.entries[i];row.index=i;row.button.disabled=entry.disabled;row.button.set_meta("key",entry.key);row.button.modulate=Color.WHITE;row.name.text=entry.name;row.info.text=entry.tier;row.icon.hide();row.action_label.hide()
		var width:=spacer.size.x/3;row.button.position=Vector2((i%3)*width,(i/3)*92);row.button.size=Vector2(width-5,86);row.name.position=Vector2(6,10);row.name.size=Vector2(width-17,34);row.name.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;row.name.add_theme_font_size_override("font_size",27);row.info.position=Vector2(6,49);row.info.size=Vector2(width-17,28);row.info.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	images_pending=false;set_process(false)
func _target_rows() -> void:
	while rows.size()<model.entries.size():_new_row()
	var offset:=0.0
	for i in range(rows.size()):
		var row: Dictionary=rows[i];row.button.visible=i<model.entries.size()
		if not row.button.visible:row.icon.present({},{});row.index=-1;continue
		var entry: Dictionary=model.entries[i]
		if row.index!=i or row.icon.model!=entry.icon:row.icon.present({}, {})
		row.index=i;row.button.disabled=entry.disabled;row.button.set_meta("key",entry.key);row.button.modulate=Color(.65,.65,.65) if entry.disabled else Color.WHITE;row.name.text=entry.name;row.info.text=entry.tier;row.action_label.text=entry.label;row.icon.show();row.action_label.show()
		row.icon.position=Vector2(8,8);row.icon.size=Vector2(52,64);row.name.position=Vector2(68,7);row.name.size=Vector2(spacer.size.x-78,23);row.name.horizontal_alignment=HORIZONTAL_ALIGNMENT_LEFT;row.name.add_theme_font_size_override("font_size",14);row.info.position=Vector2(68,32);row.info.size=Vector2(spacer.size.x-78,55);row.info.horizontal_alignment=HORIZONTAL_ALIGNMENT_LEFT
		var info_height: float=maxf(55,row.info.get_combined_minimum_size().y);row.info.size.y=info_height;row.action_label.position=Vector2(8,38+info_height);row.action_label.size=Vector2(spacer.size.x-18,20)
		var height: float=maxf(target_height,38+info_height+maxf(20,row.action_label.get_combined_minimum_size().y)+10);row.button.position=Vector2(0,offset);row.button.size=Vector2(spacer.size.x,height-5);offset+=height
	spacer.custom_minimum_size.y=offset;spacer.size.y=offset;images_pending=true;_images();set_process(images_pending)
func _images() -> void:
	if model.get("kind","")=="fixed-step":images_pending=false;set_process(false);return
	super._images()
func _press(key: String) -> void:
	if not visible or busy:return
	if key=="closeItemModalBtn":command_requested.emit(source_model.close.key);return
	if key=="backpackPreviewAction" and source_model.get("mark")!=null:command_requested.emit(source_model.mark.key);return
	for entry in source_model.entries:
		if entry.key==key and not entry.disabled:command_requested.emit(key);return
func scroll_to_key(key: String) -> void:
	if busy:scroll_target=key;return
	scroll_target=""
	if model.kind=="fixed-step":return
	for i in range(model.entries.size()):
		if model.entries[i].key==key:list_scroll.scroll_vertical=int(rows[i].button.position.y);_rows();return
func test_press(key: String) -> bool:
	if not test_ready():return false
	if key==source_model.close.key and close_button.visible and not close_button.disabled:close_button.pressed.emit();return true
	if source_model.get("mark")!=null and key==source_model.mark.key and use_button.visible and not use_button.disabled:use_button.pressed.emit();return true
	for entry in source_model.entries:
		if entry.key==key and not entry.disabled:
			scroll_to_key(key)
			for row in rows:
				if row.button.get_meta("key","")==key and row.button.visible and not row.button.disabled:row.button.pressed.emit();return true
	return false
func test_layout() -> bool:
	if not super.test_layout():return false
	for row in rows:
		if not row.button.visible:continue
		for label in [row.name,row.info,row.action_label]:
			if label.visible and not row.button.get_global_rect().encloses(label.get_global_rect()):return false
	return true
