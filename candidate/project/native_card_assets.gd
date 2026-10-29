extends Node
## Preserve texture identity while decoding off the render thread. Bundled files
## are verified by the product catalog before platform packaging.
signal failed(key: String)
var catalog: Dictionary={}
var records: Dictionary={}
var live: Dictionary={}
var pending: Dictionary={}
var sizes: Dictionary={}
var errors: Dictionary={}
var order: Array=[]
var resident:=0
var budget:=64*1024*1024
var decoded:=0

func request(key: String) -> Texture2D:
	if key.is_empty():return null
	if records.has(key):order.erase(key);order.append(key);return records[key]
	if live.has(key):
		var retained: Texture2D=live[key].get_ref()
		if retained!=null:return retained
		live.erase(key)
	if not catalog.has(key) or key.is_absolute_path() or '..' in key.split('/') or '\\' in key:return null
	var texture:=ImageTexture.create_from_image(Image.create(1,1,false,Image.FORMAT_RGBA8))
	records[key]=texture;live[key]=weakref(texture);order.append(key)
	var source:='res://card-assets/'+key
	if not FileAccess.file_exists(source):source='res://../../'+str(catalog[key].source)
	pending[key]=WorkerThreadPool.add_task(func():
		var image:=Image.new();var result:=image.load(source)
		if result==OK:result=image.generate_mipmaps()
		call_deferred('_publish',key,image,result)
	)
	return texture

func _publish(key: String,image: Image,result: int) -> void:
	if pending.has(key):WorkerThreadPool.wait_for_task_completion(pending[key]);pending.erase(key)
	if result!=OK:errors[key]=result;failed.emit(key);return
	var texture: ImageTexture=live[key].get_ref()
	if texture==null:return
	texture.set_image(image);decoded+=1;sizes[key]=image.get_data_size();resident+=sizes[key]
	while resident>budget and order.size()>1:
		var oldest: String=order.pop_front()
		if pending.has(oldest):order.append(oldest);break
		resident-=int(sizes.get(oldest,0));sizes.erase(oldest);records.erase(oldest)

func _exit_tree() -> void:
	for task in pending.values():WorkerThreadPool.wait_for_task_completion(task)
	pending.clear()
