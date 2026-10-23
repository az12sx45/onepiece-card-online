extends RefCounted
## One original font resource, shared by all native screens and weight variants.
static var source_font: FontFile
static var dice_font: FontFile
static var variants: Dictionary={}
static var file_reads:=0

static func battle_dice() -> FontFile:
	if dice_font==null:
		dice_font=FontFile.new()
		var font_path:="res://assets/BattomGlory.otf"
		if not FileAccess.file_exists(font_path) and OS.get_name()!="Android":font_path="res://../../public/fonts/board/battom-glory.otf"
		dice_font.data=FileAccess.get_file_as_bytes(font_path)
		file_reads+=1
	return dice_font

static func base() -> FontFile:
	if source_font==null:
		source_font=FontFile.new()
		var font_path:="res://assets/NotoSansTC.ttf"
		if not FileAccess.file_exists(font_path) and OS.get_name()!="Android":font_path="res://../assets/NotoSansTC.ttf"
		source_font.data=FileAccess.get_file_as_bytes(font_path)
		# The original shop uses U+0E3F; Noto Sans TC has no Thai currency glyph.
		# Keep the original text and use the OS font only for missing glyphs.
		var symbols:=SystemFont.new()
		symbols.font_names=PackedStringArray(["Noto Sans Thai","Segoe UI"])
		source_font.fallbacks=[symbols]
		file_reads+=1
	return source_font

static func weighted(weight: float) -> FontVariation:
	if not variants.has(weight):
		var font:=FontVariation.new()
		font.base_font=base();font.variation_opentype={2003265652:weight}
		variants[weight]=font
	return variants[weight]
