extends "res://native_encounter_modal.gd"
func _init() -> void:frame_path="images/board/spar_ui/spar_character_detail_overlay_frame_v1.webp"
func _ready() -> void:
	super._ready()
	var regions=[Rect2(789,99,612,127),Rect2(75,89,629,761),Rect2(789,99,612,127),Rect2(789,99,612,127),Rect2(746,535,680,266),Rect2(746,535,680,266)]
	for i in range(6):parts[i].set_meta("region",regions[i])
	for i in range(6):parts[6+i].set_meta("region",Rect2(750+(i%2)*345,236+(i/2)*99,331,95))
func _layout() -> void:
	super._layout()
	if busy or model.is_empty():return
	var x:=size.x*.31+16;var width:=size.x-x-8;var top:=157.0;var bottom:=size.y-54
	# Original passive and all six move descriptions share a scrolling reading
	# area; the original close button remains outside the scrolling content.
	parts[4].hide();message.hide();_place(parts[5],Rect2(x,top,width,bottom-top));detail.position=Vector2(x+10,top+8);detail.size=Vector2(width-20,bottom-top-16);detail.text=model.message+"\n\n"+model.detailText
func test_layout_json() -> String:
	var bounded:=true
	for node in [heading,caption,context,detail]+stats+actions:if node.visible:bounded=bounded and get_global_rect().encloses(node.get_global_rect())
	return JSON.stringify({"bounded":bounded,"readingClear":detail.position.y+detail.size.y<size.y-47})
