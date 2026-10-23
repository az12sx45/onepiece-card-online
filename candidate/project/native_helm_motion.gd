extends RefCounted
## Polar motion translated from the existing phone wheel. Angle is never snapped.
var angle := 0.0
var angular_delta := 0.0
var preview_base := 0.0
var polar: Variant = null
var drag_radius := 48.0
var last_motion_time := 0.0
var last_sample_time := 0.0
var motion_sign := 0.0
var samples: Array = []
var previewed := false
var velocity := 0.0
var inertia := false
var coast_start := 0.0
var coast_angle := 0.0

func begin(point: Vector2, now: float) -> bool:
	var stopped := inertia
	inertia=false
	preview_base=angle;angular_delta=0;polar=null;drag_radius=48;last_motion_time=0;motion_sign=0
	last_sample_time=now;samples=[{"time":now,"angle":0.0}];previewed=false
	sample(point,now)
	return stopped

func sample(point: Vector2, now: float) -> void:
	var radius := point.length()
	if radius < 48:
		preview_base=angle-angular_delta
		polar=null;last_motion_time=0;motion_sign=0;last_sample_time=now
		samples=[{"time":now,"angle":angular_delta}]
		return
	var bearing := rad_to_deg(atan2(point.y,point.x))
	if polar == null:polar=bearing;drag_radius=radius
	else:
		var delta := fposmod(bearing-float(polar)+540.0,360.0)-180.0
		polar=bearing;angular_delta+=delta
		if absf(delta)>0.02:
			var direction := signf(delta)
			if motion_sign != 0 and direction != motion_sign:samples=[{"time":last_sample_time,"angle":angular_delta-delta}]
			motion_sign=direction;last_motion_time=now
	last_sample_time=now
	samples.append({"time":now,"angle":angular_delta})
	while samples.size()>2 and samples[1].time<now-100:samples.pop_front()
	while samples.size()>32:samples.pop_front()
	var arc := absf(angular_delta)*PI/180.0*drag_radius
	if previewed or arc>10:previewed=true;angle=preview_base+angular_delta

func released_velocity(now: float) -> float:
	if last_motion_time == 0 or now-last_motion_time>100 or samples.size()<2:return 0.0
	var end: Dictionary=samples[-1]
	var first: Dictionary=samples[0]
	var cutoff := now-100
	if first.time<cutoff and samples[1].time>first.time:
		var next: Dictionary=samples[1]
		var fraction := minf(1.0,(cutoff-first.time)/(next.time-first.time))
		first={"time":cutoff,"angle":first.angle+(next.angle-first.angle)*fraction}
	var duration: float=end.time-first.time
	if duration<8:return 0.0
	return clampf((end.angle-first.angle)/duration,-0.8,0.8)

func release(now: float) -> void:
	velocity=released_velocity(now)
	inertia=absf(velocity)>=0.025
	coast_start=now;coast_angle=angle

func coast_pose(elapsed: float) -> float:
	return coast_angle+velocity*280.0*(1.0-exp(-elapsed/280.0))

func advance(now: float) -> void:
	if not inertia:return
	var elapsed := maxf(0.0,now-coast_start)
	angle=coast_pose(elapsed)
	if absf(velocity*exp(-elapsed/280.0))<0.012 or elapsed>=1400:inertia=false

func selected(count: int) -> int:
	return posmod(int(floor(angle/45.0+0.5)),maxi(1,count))
