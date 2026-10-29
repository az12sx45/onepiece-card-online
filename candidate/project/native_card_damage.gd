extends RefCounted
const Burn=preload('res://native_card_damage.gdshader')
const CATALOG=[
	['fire-fist','火拳','burn'],['ice-sphere','冰球','ice'],['triple-slash','三刀斬','slash'],['thunderbolt','雷擊','bolt'],
	['magma-fist','熔岩拳','melt'],['sandstorm','沙嵐','sand'],['dark-vortex','暗穴','vortex'],['quake-ring','震空','quake'],
	['paw-cannon','熊掌衝擊','push'],['light-beam','光束','pierce'],['meteor','隕石','crush'],['dragon-breath','熱息','burn-wave'],
	['phoenix-flame','不死鳥炎','rise'],['poison-dragon','毒龍','poison'],['rubber-barrage','拳槍連打','barrage'],
	['flame-kick','炎腳','bisect'],['water-dragon','水龍','wash'],['mochi-drill','糯團鑽','drill'],['string-cage','線牢','grid'],['thunder-orb','雷球','orb']
]
static var bag: Array=[]
static func pick() -> Array:
	if bag.is_empty():bag=CATALOG.duplicate(true);bag.shuffle()
	return bag.pop_back()

static func _tween(host: Control) -> Tween:
	var value:=host.create_tween();var tracked: Array=host.get_meta('damage_tweens',[])
	tracked=tracked.filter(func(t):return t.is_valid() and t.is_running());tracked.append(value);host.set_meta('damage_tweens',tracked);return value

static func animate(host: Control,target: TextureRect,kind: String) -> void:
	target.pivot_offset=target.size*.5
	if kind in ['burn','pierce','drill','burn-wave','melt','poison','wash','sand']:
		var material:=ShaderMaterial.new();material.shader=Burn;material.set_shader_parameter('damage_mode',1 if kind in ['melt','wash'] else 2 if kind in ['poison','sand'] else 0);target.material=material
		var t:=_tween(host);t.set_parallel(true);t.tween_method(func(value):material.set_shader_parameter('progress',value),0.0,1.0,1.3)
		if kind=='drill':t.tween_property(target,'rotation',TAU,1.3)
		if kind=='burn-wave':t.tween_property(target,'position:y',target.position.y-45,1.3)
		await t.finished
	elif kind in ['ice','slash','bisect','grid','quake','bolt','orb','barrage']:
		var columns:=2 if kind in ['slash','bisect'] else 4
		var rows:=1 if kind in ['slash','bisect'] else 5
		if kind=='ice':target.modulate=Color(.45,.8,1.3);await host.get_tree().create_timer(.3).timeout
		if not is_instance_valid(target):return
		if kind=='barrage':
			var shake:=_tween(host);var start:=target.position
			for i in range(8):shake.tween_property(target,'position',start+Vector2(-8 if i%2 else 8,0),.07)
			await shake.finished
		var pieces: Array=[];var source_size:=target.texture.get_size();var tween:=_tween(host);tween.set_parallel(true)
		for y in range(rows):
			for x in range(columns):
				var atlas:=AtlasTexture.new();atlas.atlas=target.texture;atlas.region=Rect2(Vector2(x,y)*source_size/Vector2(columns,rows),source_size/Vector2(columns,rows))
				var piece:=TextureRect.new();piece.texture=atlas;piece.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;piece.size=target.size/Vector2(columns,rows);piece.position=target.position+Vector2(x,y)*piece.size;piece.pivot_offset=piece.size*.5;piece.modulate=target.modulate;piece.mouse_filter=Control.MOUSE_FILTER_IGNORE;host.add_child(piece);pieces.append(piece)
				var direction:=Vector2((float(x)+.5)/columns-.5,(float(y)+.5)/rows-.5)
				var distance:=140.0 if kind in ['ice','quake','bolt'] else 75.0
				tween.tween_property(piece,'position',piece.position+direction*distance+Vector2(0,65 if kind!='orb' else -65),1.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
				tween.tween_property(piece,'rotation',direction.x*2.0,1.1);tween.tween_property(piece,'modulate:a',0.0,1.1)
		target.hide();await tween.finished
		for piece in pieces:piece.queue_free()
	else:
		var t:=_tween(host);t.set_parallel(true)
		if kind=='vortex':t.tween_property(target,'rotation',TAU*2,1.2);t.tween_property(target,'scale',Vector2.ZERO,1.2)
		elif kind=='crush':t.tween_property(target,'scale',Vector2(1.3,.02),1.0)
		elif kind=='push':t.tween_property(target,'scale',Vector2(.05,.05),1.2);t.tween_property(target,'position:y',target.position.y-110,1.2)
		elif kind=='rise':t.tween_property(target,'position:y',target.position.y-180,1.2)
		t.tween_property(target,'modulate:a',0.0,1.2);await t.finished
