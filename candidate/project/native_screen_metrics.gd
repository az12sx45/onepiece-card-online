extends RefCounted
## Convert native logical coordinates to the original UI's CSS pixel units.
## Android reports densityDpi (verified in the packaged GodotIO class).
## A physical pixel is smaller than a touch/UI pixel on a high-density phone.
static func css_factor(viewport: Viewport) -> float:
	var density:=maxf(1.0,float(DisplayServer.screen_get_dpi())/160.0) if OS.get_name()=="Android" else 1.0
	if OS.get_name()=="iOS" and Engine.has_singleton("PoNativeSession"):
		var bridge: Object=Engine.get_singleton("PoNativeSession").get("bridge")
		if bridge!=null:density=maxf(1.0,float(bridge.call("display_scale")))
	return maxf(.01,viewport.get_final_transform().get_scale().x/density)
