extends Control
## Reusable labels, original hit lanes, colors and motion keyframes. Each label
## changes only its own transform; the battle surface is never reconstructed.
var view: Control
var pool: Array[Label] = []
var active: Array[Dictionary] = []
var emitted := 0
const NORMAL = [[0.0,26.0,0.62,0.0],[0.12,-12.0,1.2,1.0],[0.28,-28.0,0.98,1.0],[0.72,-58.0,1.0,1.0],[1.0,-116.0,0.84,0.0]]
const CRITICAL = [[0.0,20.0,0.64,0.0],[0.06,-10.0,1.18,1.0],[0.13,-10.0,1.18,1.0],[0.22,-17.0,0.96,1.0],[0.32,-26.0,1.035,1.0],[0.7,-56.0,1.0,1.0],[1.0,-108.0,0.92,0.0]]

func _ready() -> void:
	mouse_filter=Control.MOUSE_FILTER_IGNORE
	set_process(false)

func spawn(amount: float, side: String, options: Dictionary = {}) -> void:
	var label: Label
	for candidate in pool:
		if not candidate.visible: label=candidate;break
	if label == null:
		if pool.size() >= 24: return
		label=Label.new()
		label.mouse_filter=Control.MOUSE_FILTER_IGNORE
		label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment=VERTICAL_ALIGNMENT_CENTER
		label.add_theme_constant_override("outline_size",4)
		label.add_theme_constant_override("shadow_offset_y",4)
		label.add_theme_color_override("font_shadow_color",Color("8d2510"))
		add_child(label)
		pool.append(label)
	var value:=maxi(0,roundi(amount))
	var blocked: bool=options.get("blocked",false)
	var heal: bool=options.get("heal",false)
	var miss: bool=not blocked and (options.get("miss",false) or (not heal and value <= 0))
	var critical: bool=options.get("critical",false) and not miss and not blocked
	var color:=Color("fff7a9")
	var outline:=Color("5d160a")
	if miss: color=Color("d6edff");outline=Color("17364d")
	elif heal: color=Color("dffff0");outline=Color("064b2c")
	label.add_theme_color_override("font_color",color)
	label.add_theme_color_override("font_outline_color",outline)
	label.add_theme_font_size_override("font_size",int(clampf(view.size.x*(0.038 if miss else 0.047),32 if miss else 38,62 if miss else 78)))
	label.text=str(options.get("blockedLabel","GUARD")) if blocked else ("MISS" if miss else ("+" if heal else "-")+str(value))
	if critical: label.text="爆擊\n"+label.text
	label.size=label.get_minimum_size()
	label.pivot_offset=label.size*Vector2(0.5,1)
	var index:=int(options.get("hitIndex",0))
	var card: Control=view.portraits[side]
	var anchor: Vector2=options.get("anchor",card.position+card.size*Vector2(0.5,0.38))
	anchor.x=clampf(anchor.x+[-34,34,-62,62,-14,14][index%6],24,view.size.x-24)
	anchor.y=clampf(anchor.y+int(index/6)*18,42,view.size.y-42)
	label.rotation=deg_to_rad([-4,3,-2,5,-3,2][index%6])
	label.show()
	active.append({"label":label,"start":Time.get_ticks_msec(),"duration":620.0 if blocked else (1450.0 if critical else 1550.0),"anchor":anchor,"frames":CRITICAL if critical else NORMAL})
	emitted += 1
	set_process(true)
	_process(0)

func _process(_delta: float) -> void:
	for i in range(active.size()-1,-1,-1):
		var job: Dictionary=active[i]
		var t:=float(Time.get_ticks_msec()-job.start)/float(job.duration)
		var label: Label=job.label
		if t >= 1:
			label.hide();active.remove_at(i);continue
		var frames: Array=job.frames
		for k in range(1,frames.size()):
			if t > frames[k][0]: continue
			var a: Array=frames[k-1]
			var b: Array=frames[k]
			var u:=clampf((t-a[0])/(b[0]-a[0]),0,1)
			label.position=job.anchor-label.size/2+Vector2(0,lerpf(a[1],b[1],u))
			label.scale=Vector2.ONE*lerpf(a[2],b[2],u)
			label.modulate.a=lerpf(a[3],b[3],u)
			break
	if active.is_empty(): set_process(false)
