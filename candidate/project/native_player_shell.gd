extends Control
## Mount ownership for the real controllers; this shell contains no account,
## lobby, game-state fixtures or automatic navigation.
const Lobby=preload("res://native_lobby_stage.gd")
const Game=preload("res://native-game-stage.tscn")
var cache: Node
var active: Control
var curtain:=Control.new()
var shade:=ColorRect.new()
var frame:=NinePatchRect.new()
var message:=Label.new()
var asset_root:=ProjectSettings.globalize_path("res://../../public")
var mobile_root:=ProjectSettings.globalize_path("res://../../android/web")

func _ready() -> void:
	preload("res://native_scroll_input.gd").install(self)
	cache=preload("res://native_asset_cache.gd").new();cache.asset_root=asset_root;cache.mount_roots={"mobile":mobile_root};cache.use_mipmaps=true;add_child(cache)
	curtain.z_index=1000;curtain.mouse_filter=Control.MOUSE_FILTER_STOP;add_child(curtain)
	shade.color=Color("061722");shade.mouse_filter=Control.MOUSE_FILTER_IGNORE;curtain.add_child(shade)
	frame.scale=Vector2.ONE*.125;frame.mouse_filter=Control.MOUSE_FILTER_IGNORE
	for side in [SIDE_LEFT,SIDE_TOP,SIDE_RIGHT,SIDE_BOTTOM]:frame.set_patch_margin(side,224)
	curtain.add_child(frame)
	message.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(650));message.add_theme_font_size_override("font_size",18);message.add_theme_color_override("font_color",Color("ffe4a9"));message.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;message.vertical_alignment=VERTICAL_ALIGNMENT_CENTER;message.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART;message.mouse_filter=Control.MOUSE_FILTER_IGNORE;curtain.add_child(message)
	resized.connect(_layout);_layout();show_loading()

func _process(_delta: float) -> void:
	if frame.texture==null:frame.texture=cache.request("mobile/art-ui/mobile-panel-v013.png")
	else:set_process(false)

func _layout() -> void:
	curtain.size=size;shade.size=size;frame.size=size/.125;message.position=Vector2(36,24);message.size=size-Vector2(72,48)
	if is_instance_valid(active):active.size=size

func mount_lobby() -> Control:
	assert(not is_instance_valid(active),"Previous native scene not unmounted")
	var page:=Lobby.new();page.cache=cache;page.size=size;add_child(page);active=page;return page

func mount_game() -> Control:
	assert(not is_instance_valid(active),"Previous native scene not unmounted")
	# The packed game already anchors to all four parent edges. Setting its size
	# before parenting adds that size as offsets, doubling the mounted viewport.
	var page: Control=Game.instantiate();add_child(page);active=page;return page

func unmount(page: Control) -> void:
	if not is_instance_valid(page):return
	assert(page==active,"Unrelated native scene release refused")
	active=null;page.hide();page.queue_free()

func show_loading() -> void:message.text="正在載入航海錄…";curtain.show()
func show_ready(page: Control) -> void:
	assert(page==active,"Unrelated native scene activation refused")
	curtain.hide()
func show_error(value: String) -> void:message.text="無法進入航海錄\n"+value;curtain.show()
