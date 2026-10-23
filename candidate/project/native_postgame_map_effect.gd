extends Node
const Motion=preload("res://native_final_ritual_motion.gd")
const Filtered=preload("res://native_css_ordered_image.gd")
var map: Control
var active:=false
var started:=0.0
var images: Dictionary={}
var touched: Dictionary={}
func _ready() -> void:set_process(false)
func set_active(value: bool) -> void:
	if not value:
		active=false;set_process(false);map.routes.set_reveal(-1)
		for key in touched:
			if not map.entries.has(key):continue
			var entry: Dictionary=map.entries[key];entry.button.scale=Vector2.ONE;entry.button.rotation=0;entry.button.modulate=Color.WHITE;entry.button.position=touched[key];entry.postgame_effect=false
		for image in images.values():if is_instance_valid(image):image.stop();image.queue_free()
		images.clear();touched.clear();map._camera_changed();return
	if active:return
	active=true;started=Time.get_ticks_msec()/1000.0;set_process(true);_process(0)
func _process(_delta: float) -> void:
	if not active or map.model.is_empty():return
	var elapsed:=Time.get_ticks_msec()/1000.0-started;map.routes.set_reveal(elapsed)
	for kind in ["tiles","islands"]:
		for item in map.model[kind]:
			if not item.postgame:continue
			var key: String=("tile:" if kind=="tiles" else "island:")+str(item.id)
			if not map.entries.has(key):continue
			var entry: Dictionary=map.entries[key];var button: Control=entry.button;var anchor:=Vector2(item.x,item.y);touched[key]=anchor-button.size*.5
			var delay:=.5+float(item.postgameOrder)*.1 if kind=="islands" else 0.0;var t:=elapsed-delay;var sample:=Motion.sample("postgameIslandReveal" if kind=="islands" else "postgameTileReveal",maxf(0,t),button.size);var transform: Transform2D=sample.transform;var origin:=button.size*.5
			button.position=anchor+transform.origin-transform.basis_xform(origin);button.rotation=transform.get_rotation();button.scale=transform.get_scale();button.modulate.a=sample.opacity if t>=0 else 0.0
			if kind!="islands":continue
			var shown: bool=entry.get("in_view",entry.picture.visible);entry.postgame_effect=true;entry.picture.hide()
			if not shown:
				if images.has(key):images[key].hide()
				continue
			var texture: Texture2D=map.cache.request(entry.path)
			if texture==null:continue
			map._assign_picture(entry,texture)
			if not images.has(key) or not is_instance_valid(images[key]):var image=Filtered.new();button.add_child(image);images[key]=image
			var image: Control=images[key];image.configure(texture,entry.picture.size);image.position=entry.picture.position;image.apply_filters(sample.filters);image.show()
	if elapsed>3.5:set_process(false)
