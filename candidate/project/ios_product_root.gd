extends "res://native_product_root.gd"

func show_failure(kind: String) -> void:
	if kind in ["sign-in","session-changed"]:
		return_requested.emit.call_deferred()
	else:super.show_failure(kind)
