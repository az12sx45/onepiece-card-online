extends RefCounted
## Compact original move facts in the existing bottom strip; never scroll.
static func number(value: Variant) -> String:
	return str(int(value)) if (value is float or value is int) and float(value)==floorf(float(value)) else str(value)
static func heading(move: Dictionary) -> String:
	var kind:="特攻" if move.get("damageClass","")=="special" else "物攻" if move.get("damageClass","")=="physical" else "效果"
	var value:="%s·%s PP%d/%d 威%s 命%s%%" %[move.get("attribute",""),kind,move.currentPP,move.pp,number(move.get("power","—")),number(move.get("accuracy",100))]
	if move.get("priority",0)!=0:value+=" 先制%+d" %int(move.priority)
	return value
static func body(move: Dictionary) -> String:
	var text:=str(move.get("effectText","無追加效果")).strip_edges()
	for pair in [["有機率造成","機率造成"],["的機率","機率"],["造成傷害","傷害"],["回合內","回合"]]:text=text.replace(pair[0],pair[1])
	var damage:=str(move.get("damageText",""))
	if not damage.is_empty() and damage!="效果技" and damage!="威力 "+number(move.get("power","")):text=damage+"。"+text
	return text
static func pages(move: Dictionary,label: RichTextLabel) -> Array[String]:
	var header:=heading(move);var remaining:=body(move);var result: Array[String]=[]
	while not remaining.is_empty():
		var low:=1;var high:=remaining.length();var best:=0
		while low<=high:
			var middle: int=(low+high)/2
			label.text=header+"\n"+remaining.substr(0,middle)+"  ›"
			if label.get_content_height()<=label.size.y:best=middle;low=middle+1
			else:high=middle-1
		best=maxi(1,best);result.append(header+"\n"+remaining.substr(0,best));remaining=remaining.substr(best)
	if result.is_empty():result.append(header)
	if result.size()>1:
		for i in range(result.size()):result[i]+="  ›"
	return result
