extends Node
## Let Godot's ScrollContainer receive drag gestures over rows. Its built-in
## scroll notifications cancel the child button press once a drag begins.
## Only event propagation changes; no custom scroll physics or game commands.
var scope: Node
static func install(target: Node) -> void:
	var ancestor: Node=target
	while ancestor!=null:
		if ancestor.has_meta("native_scroll_input"):return
		ancestor=ancestor.get_parent()
	target.set_meta("native_scroll_input",true)
	var helper: Node=load("res://native_scroll_input.gd").new()
	helper.scope=target
	target.add_child(helper)
func _ready() -> void:
	get_tree().node_added.connect(_added)
	_visit(scope)
func _visit(node: Node) -> void:
	_added(node)
	for child in node.get_children():_visit(child)
func _added(node: Node) -> void:
	if node is Control and scope.is_ancestor_of(node):_configure.call_deferred(weakref(node))
func _configure(reference: WeakRef) -> void:
	var node: Control=reference.get_ref()
	if node==null or not scope.is_ancestor_of(node) or node.mouse_filter!=Control.MOUSE_FILTER_STOP:return
	# Preserve controls with their own gestures, editors, selectors, scrollbars
	# and interactive rich text. Layout-only wrappers must also pass events.
	var eligible: bool=(node is BaseButton and not node is OptionButton) or (node.get_class()=="Control" and node.get_script()==null) or (node is RichTextLabel and not node.scroll_active and not node.selection_enabled)
	if not eligible:return
	var ancestor:=node.get_parent()
	while ancestor!=null and ancestor!=scope:
		if ancestor is ScrollContainer:
			node.mouse_filter=Control.MOUSE_FILTER_PASS
			return
		ancestor=ancestor.get_parent()
