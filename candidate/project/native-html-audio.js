'use strict';
const {Callable}=require('godot');
// The source BgmManager sees its original Audio interface. Godot owns decoding,
// playback and resource lifetime; no native replacement for music-selection rules.
exports.create=function(node){
 let sequence=0,closed=false;const instances=new Map();
 class NativeAudio{
  constructor(src=''){this.id='audio-'+(++sequence);this._src='';this._volume=1;this._position=0;this._generation=0;this._wanted=false;this._ready=null;this._resolve=null;this._reject=null;this.readyState=0;this.duration=NaN;this.paused=true;this.preload='auto';this.loop=false;this.listeners=new Map();instances.set(this.id,this);if(src)this.src=src;}
  get src(){return this._src;}
  set src(value){
   const next=String(value||'');if(next===this._src)return;
   this._generation++;this._wanted=false;this.paused=true;node.call('release_audio',this.id);this._reject?.(Error('Audio source changed'));this._ready=null;this._resolve=null;this._reject=null;this.readyState=0;this.duration=NaN;this._position=0;this._src=next;
   if(next)instances.set(this.id,this);else instances.delete(this.id);
  }
  get volume(){return this._volume;}
  set volume(value){const next=Number(value);if(!Number.isFinite(next)||next<0||next>1)throw RangeError('Audio volume out of range');if(next===this._volume)return;this._volume=next;if(!closed)node.call('volume_audio',this.id,next);}
  get currentTime(){return this.readyState&&!closed?Number(node.call('current_time',this.id)):this._position;}
  set currentTime(value){const next=Number(value);if(!Number.isFinite(next)||next<0)throw RangeError('Audio seek out of range');this._position=next;if(this.readyState&&!closed)node.call('seek_audio',this.id,next);}
  addEventListener(kind,callback){const values=this.listeners.get(kind)||new Set();values.add(callback);this.listeners.set(kind,values);}
  removeEventListener(kind,callback){this.listeners.get(kind)?.delete(callback);}
  removeAttribute(name){if(name==='src')this.src='';}
  _dispatch(kind){for(const fn of [...this.listeners.get(kind)||[]])fn({type:kind,target:this});}
  load(){
   if(closed||this._ready||!this._src)return;
   this._ready=new Promise((resolve,reject)=>{this._resolve=resolve;this._reject=reject;});this._ready.catch(()=>{});
   let path;try{path=decodeURIComponent(this._src);}catch{this._failure();return;}
   node.call('load_audio',this.id,path);
  }
  _failure(){this.readyState=0;this._wanted=false;this.paused=true;this._reject?.(Error('Native audio unavailable'));this._resolve=null;this._reject=null;this._dispatch('error');}
  async play(){
   if(closed||!this._src)throw Error('Audio source unavailable');
   const generation=this._generation;this._wanted=true;this.load();await this._ready;
   if(closed||generation!==this._generation||!this._wanted)throw Error('Audio playback cancelled');
   node.call('volume_audio',this.id,this._volume);
   if(!node.call('play_audio',this.id))throw Error('Native audio not ready');
   this.paused=false;
  }
  pause(){this._wanted=false;this.paused=true;if(!closed)node.call('pause_audio',this.id);}
 }
 let callback=Callable.create(node,(id,kind,value)=>{
  if(closed)return;const audio=instances.get(String(id));if(!audio)return;kind=String(kind);const data=JSON.parse(String(value));
  if(kind==='loadedmetadata'){audio.duration=Number(data.duration);audio.readyState=4;node.call('seek_audio',audio.id,audio._position);node.call('volume_audio',audio.id,audio._volume);audio._resolve?.();audio._resolve=null;audio._reject=null;audio._dispatch(kind);audio._dispatch('canplay');}
  else if(kind==='error')audio._failure();
  else if(kind==='ended'){audio.paused=true;audio._dispatch(kind);}
  else if(kind==='timeupdate')audio._dispatch(kind);
 });
 node.connect('audio_event',callback);
 return {Audio:NativeAudio,dispose(){if(closed)return;for(const audio of instances.values()){audio.src='';audio.listeners.clear();}closed=true;node.disconnect('audio_event',callback);callback=null;node.call('close_audio');instances.clear();}};
};
