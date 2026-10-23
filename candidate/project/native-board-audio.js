'use strict';
const {Callable,Time}=require('godot');
exports.create=function({node,window}){
 let closed=false,serial=0,bufferSerial=0,context=null;const voices=new Map(),pending=new Map();
 class Gain{
  constructor(){this._value=1;this.epoch=0;this.gain={get value(){return this.owner._value;},set value(value){this.owner.epoch++;this.owner.update(Number(value));},owner:this,setTargetAtTime(value,start,timeConstant){this.owner.target(Number(value),Number(start),Number(timeConstant));}};}
  update(value){this._value=Math.max(0,Math.min(1,value));for(const voice of voices.values())if(voice.gain===this)node.call('volume_voice',voice.id,this._value);}
  target(value,start,constant){const epoch=++this.epoch,from=this._value,to=Math.max(0,Math.min(1,value)),tick=()=>{if(closed||epoch!==this.epoch)return;const elapsed=Math.max(0,Time.get_ticks_msec()/1000-start);this.update(constant>0?to+(from-to)*Math.exp(-elapsed/constant):to);if(constant>0&&elapsed<constant*12)window.requestAnimationFrame(tick);};tick();}
  connect(){}
 }
 class SoundContext{
  constructor(){this.sampleRate=48000;this.state='running';this.destination={};context=this;}
  get currentTime(){return Time.get_ticks_msec()/1000;}
  createGain(){return new Gain();}
  createBuffer(channels,length,rate){if(channels!==1||length<0||length>rate*2)throw Error('Unsupported source cue buffer');const samples=new Float32Array(length);return {key:'pcm-'+(++bufferSerial),samples,sampleRate:rate,getChannelData(index){if(index!==0)throw Error('Cue channel unavailable');return samples;}};}
  createBufferSource(){
   const id='voice-'+(++serial),voice={id,buffer:null,gain:null,onended:null,connect(gain){this.gain=gain;},disconnect(){},start(){
    if(closed||!this.buffer||!this.gain)throw Error('Sound source unavailable');
    const buffer=this.buffer;
    if(buffer.samples&&!buffer.prepared){if(!node.call('prepare_pcm',buffer.key,JSON.stringify(Array.from(buffer.samples)),buffer.sampleRate))throw Error('Original synthesized cue unavailable');buffer.prepared=true;}
    voices.set(id,this);if(!node.call('play_voice',id,buffer.key,this.gain._value)){voices.delete(id);throw Error('Native voice unavailable');}
   },stop(){node.call('stop_voice',id);}};return voice;
  }
  async resume(){this.state='running';}
  async suspend(){for(const voice of [...voices.values()])voice.stop();this.state='suspended';}
 }
 let bufferCallback=Callable.create(node,(key,ok)=>{const job=pending.get(String(key));if(!job||closed)return;pending.delete(String(key));if(ok)job.state.assetBuffers.set(job.filename,{key:String(key)});});
 let endedCallback=Callable.create(node,id=>{const voice=voices.get(String(id));if(!voice)return;voices.delete(String(id));voice.onended?.();});
 node.connect('buffer_ready',bufferCallback);node.connect('voice_ended',endedCallback);
 window.AudioContext=SoundContext;window.BOARD_AUDIO_AUTO_MOUNT=false;
 const api=require('./original-board-audio').install(window,(state,assets)=>{
  if(!state.context||closed)return;
  for(const kind of Object.keys(assets)){const key='fallback:'+kind;if(!state.buffers.has(kind)&&node.call('has_buffer',key))state.buffers.set(kind,{key});}
  for(const filename of new Set(Object.values(assets))){if(state.requestedAssets.has(filename))continue;state.requestedAssets.add(filename);const key='asset:'+filename;pending.set(key,{state,filename});node.call('preload_asset',key,'audio/board_game/sfx/game01/game01/'+filename);}
 });
 return {api,control(value){if(closed||value.disabled)return;const attributes={'data-board-sfx':value.cue,'aria-label':value.label||''};const control={id:value.id||'',textContent:value.text||'',value:'',closest:()=>value.cue?control:null,getAttribute:key=>attributes[key]??null,matches:()=>!!value.select};api.unlock();const cue=require('./original-board-audio').cueFor(control);if(cue)api.playCue(cue);},dispose(){if(closed)return;for(const voice of [...voices.values()])voice.stop();closed=true;pending.clear();node.disconnect('buffer_ready',bufferCallback);node.disconnect('voice_ended',endedCallback);bufferCallback=null;endedCallback=null;node.call('close_sound');voices.clear();if(context)context.state='closed';}};
};
