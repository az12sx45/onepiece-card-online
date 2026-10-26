extends Control
signal skip_requested
var cache: Node
var map_view: Control
var model: Dictionary={}
var textures: Dictionary={}
var background:=TextureRect.new()
var boss:=TextureRect.new()
var title:=Label.new()
var copy:=Label.new()
var skip:=Button.new()
var started:=0.0
const CARD="images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp"
const DECODER="images/board/postgame_clue_puzzle_ui/york_coordinate_decoder_t3.webp"
func _ready() -> void:
 mouse_filter=Control.MOUSE_FILTER_STOP
 for img in [background,boss]:img.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;img.mouse_filter=Control.MOUSE_FILTER_IGNORE;add_child(img)
 background.show_behind_parent=true;background.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_COVERED;boss.stretch_mode=TextureRect.STRETCH_KEEP_ASPECT_CENTERED
 for label in [title,copy]:label.mouse_filter=Control.MOUSE_FILTER_IGNORE;label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER;label.add_theme_font_override("font",preload("res://native_fonts.gd").weighted(700));label.add_theme_color_override("font_shadow_color",Color.BLACK);label.add_theme_constant_override("shadow_outline_size",5);add_child(label)
 title.add_theme_font_size_override("font_size",22);title.add_theme_color_override("font_color",Color("fff0b9"));copy.add_theme_font_size_override("font_size",13);copy.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
 skip.text="略過動畫";add_child(skip);skip.pressed.connect(func():skip_requested.emit());resized.connect(_layout);hide();set_process(false)
func apply_json(json: String) -> void:
 var next: Dictionary=JSON.parse_string(json)
 if not visible or next.mode!=model.get("mode",""):started=Time.get_ticks_msec()/1000.0
 model=next;show();set_process(true);title.text=model.title;copy.text=model.text;_layout();_process(0)
func _layout() -> void:
 if not is_node_ready():return
 background.size=size;boss.position=Vector2(size.x*.69,size.y*.12);boss.size=Vector2(size.x*.27,size.y*.88)
 title.position=Vector2(20,size.y-95);title.size=Vector2(size.x-40,35);copy.position=Vector2(30,size.y-56);copy.size=Vector2(size.x-60,48)
 skip.position=Vector2(size.x-110,10);skip.size=Vector2(100,35)
func _process(_delta: float) -> void:
 if model.is_empty():return
 for path in [CARD,DECODER,model.background,model.boss]:
  if str(path).is_empty() or textures.has(path):continue
  var texture: Texture2D=cache.request(path)
  if texture:textures[path]=texture
 background.visible=model.mode=="cinematic";background.texture=textures.get(model.background);background.modulate=Color(.55,.55,.55,1)
 boss.visible=model.mode=="cinematic" and str(model.classes).contains("stage-revealed");boss.texture=textures.get(model.boss);queue_redraw()
func _n(key: String) -> float:return float(str(model.style.get(key,"0")).trim_suffix("px").trim_suffix("rad"))
func _draw() -> void:
 if model.is_empty():return
 var elapsed:=Time.get_ticks_msec()/1000.0-started
 if model.mode=="cinematic":
  var center:=Vector2(size.x*.46,size.y*.39);var radius:=minf(size.y*.23,size.x*.13)
  for i in range(13):
   var angle:=TAU*i/13.0+elapsed*.18;var point:=center+Vector2(cos(angle),sin(angle))*radius
   if textures.has(CARD):draw_texture_rect(textures[CARD],Rect2(point-Vector2(17,22),Vector2(34,44)),false)
  if textures.has(DECODER):draw_texture_rect(textures[DECODER],Rect2(center-Vector2(32,32),Vector2(64,64)),false)
 else:
  var world_transform: Transform2D=map_view.world.get_global_transform();var a: Vector2=world_transform*Vector2(_n("--egghead-anchor-x"),_n("--egghead-anchor-y"));var b: Vector2=world_transform*Vector2(_n("--egghead-target-x"),_n("--egghead-target-y"));var ratio:=clampf(elapsed/3.35,0,1)
  draw_line(a,a.lerp(b,ratio),Color("64f4ed"),4,true)
  for i in range(3):draw_arc(b,18+fmod(elapsed*18+i*15,55),0,TAU,64,Color(0.3,1,0.9,.7),2,true)
  if textures.has(model.boss):draw_texture_rect(textures[model.boss],Rect2(b+Vector2(14,-90),Vector2(60,90)),false)
func close_surface() -> void:model={};hide();set_process(false);textures.clear()
