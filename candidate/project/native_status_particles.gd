extends Node2D
## Original fixed particle layout and rise/fall parameters, drawn only in this
## small isolated overlay. No gameplay RNG, image reload or parent repaint.
var tuning: Dictionary = {}
var color := Color.WHITE
var bounds := Vector2.ZERO
var down := false
var started := 0
var duration_ms := 3000

func _ready() -> void: set_process(false)

func play(packet: Dictionary, dimensions: Vector2) -> void:
	tuning=packet.tuning
	var rgb: Array=packet.color
	color=Color(rgb[0],rgb[1],rgb[2])
	bounds=dimensions
	down=packet.direction == "down"
	started=Time.get_ticks_msec()
	show()
	set_process(true)
	queue_redraw()

func _process(_delta: float) -> void:
	if Time.get_ticks_msec()-started >= duration_ms:
		hide();set_process(false)
	queue_redraw()

func _draw() -> void:
	if tuning.is_empty(): return
	var elapsed:=Time.get_ticks_msec()-started
	for index in range(int(tuning.particleCount)):
		var delay: float=fmod(index*97,maxf(360,tuning.duration*0.72))+floorf(index/6.0)*48
		var duration: float=maxf(260,(tuning.duration*(0.72+((index*7)%36)/100.0))/tuning.particleSpeed)
		var t:=clampf((elapsed-delay)/duration,0,1)
		if t <= 0 or t >= 1: continue
		var x: float=50+(10+(index*23)%80-50)*tuning.spread
		var y: float=-18-(index*17)%42 if down else 104+(index*17)%42
		var distance: float=maxf(52,tuning.distance*(1.75+((index*5)%48)/100.0))
		var eased:=1-pow(1-t,2)
		var offset: float=lerpf(-10 if down else 10,distance if down else -distance,eased)
		var point:=Vector2(bounds.x*x/100.0,bounds.y*y/100.0+offset)
		var radius: float=(3.8+(index%5))*tuning.particleSize*lerpf(0.76,0.58,t)/2
		var alpha: float=minf(1,tuning.strength*(0.86+(index%5)*0.05))
		alpha *= clampf(t/0.18,0,1)*clampf((1-t)/0.26,0,1)
		for layer in [3,2,1]:
			var tint:=color
			tint.a=alpha*(0.08 if layer > 1 else 0.7)
			draw_circle(point,radius*layer,tint)
