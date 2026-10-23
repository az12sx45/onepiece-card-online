extends PanelContainer
## Resize the original wood/fabric spans while preserving the compass and
## corner ornaments at a uniform scale. No flattened or regenerated artwork.
var artwork: Texture2D
func _ready() -> void:
	var spacing:=StyleBoxEmpty.new();spacing.content_margin_left=32;spacing.content_margin_right=32;spacing.content_margin_top=25;spacing.content_margin_bottom=28
	add_theme_stylebox_override("panel",spacing);resized.connect(queue_redraw)
func set_artwork(texture: Texture2D) -> void:artwork=texture;queue_redraw()
func _draw() -> void:
	if artwork==null:return
	const SOURCE_X=[0.0,260.0,920.0,1128.0,1788.0,2048.0]
	const SOURCE_Y=[0.0,180.0,523.0,743.0]
	var x: Array[float]=[0.0,32.5,size.x/2.0-13.0,size.x/2.0+13.0,size.x-32.5,size.x]
	var y: Array[float]=[0.0,22.5,size.y-27.5,size.y]
	for row in range(3):
		for column in range(5):
			var source:=Rect2(SOURCE_X[column],SOURCE_Y[row],SOURCE_X[column+1]-SOURCE_X[column],SOURCE_Y[row+1]-SOURCE_Y[row])
			var target:=Rect2(x[column],y[row],x[column+1]-x[column],y[row+1]-y[row])
			draw_texture_rect_region(artwork,target,source)
