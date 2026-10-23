extends Control
## Original 22-token strip, original target offset and original CSS easing.
## This presentation never chooses a reward.
var tokens: Array=[]
var textures: Dictionary={}
var offset:=0.0
var token_width:=54.0
var single:=false
var font: Font
func _ready() -> void:
	clip_contents=true;mouse_filter=Control.MOUSE_FILTER_IGNORE;font=preload("res://native_fonts.gd").weighted(550)
func _draw() -> void:
	var h:=size.y*.78 if single else size.y-10
	var y:=(size.y-h)/2
	var font_size:=10 if single else 7
	for i in range(tokens.size()):
		var x:=4+i*(token_width+6)+offset
		if x+token_width<0 or x>size.x:continue
		var item: Dictionary=tokens[i]
		var box:=Rect2(x,y,token_width,h)
		draw_rect(box,Color("241b0de6") if str(item.classes).contains("hit") else Color("050c14d1"))
		var image: Texture2D=textures.get(str(item.image))
		var picture:=Rect2(x+3,y+2,token_width-6,maxf(1,h-font_size-6))
		if image:
			var source_size:=image.get_size();var factor:=maxf(picture.size.x/source_size.x,picture.size.y/source_size.y)
			var crop:=picture.size/factor
			draw_texture_rect_region(image,picture,Rect2(Vector2((source_size.x-crop.x)/2,0),crop),Color(1.12,1.12,1.12) if str(item.classes).contains("hit") else Color.WHITE)
		var text_width:=font.get_string_size(str(item.name),HORIZONTAL_ALIGNMENT_LEFT,-1,font_size).x
		draw_string(font,Vector2(x+maxf(2,(token_width-text_width)/2),y+h-2),str(item.name),HORIZONTAL_ALIGNMENT_LEFT,token_width-4,font_size,Color("f1e4c5"))

static func easing(progress: float) -> float:
	# CSS cubic-bezier(.12,.76,.08,1), solved on x before evaluating y.
	var lo:=0.0;var hi:=1.0
	for i in range(24):
		var t:=(lo+hi)/2;var x:=3*(1-t)*(1-t)*t*.12+3*(1-t)*t*t*.08+t*t*t
		if x<progress:lo=t
		else:hi=t
	var t:=(lo+hi)/2
	return 3*(1-t)*(1-t)*t*.76+3*(1-t)*t*t+t*t*t
