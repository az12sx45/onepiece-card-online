'use strict';
const {Node,Callable}=require('godot');require('./native-timers').install();
class NativeCardEntry extends Node {
  _ready(){
    const root=this.get_parent();this.command=Callable.create(root,json=>this.handle(JSON.parse(String(json))));root.connect('command',this.command);
    setTimeout(()=>this.start().catch(()=>{if(!this.closed)root.call('notify_player','原生卡牌連線失敗，請返回啟動器後重試');}),0);
  }
  handle(c){
    const root=this.get_parent();
    if(c.type==='exit'){this.session?.leave();root.call('return_to_launcher');return;}
    if(!this.session){root.call('notify_player','帳號連線尚未完成，請稍候或返回啟動器');return;}
    if(c.type==='join'){if(this.pendingResult)root.call('notify_player','請先同步上次結算再開始新牌局');else this.session.join(c.room,c.cpuCount);}
    else if(c.type==='leave')this.session.leave();
    else if(c.type==='reward_done')this.session.rewardDone(c.roundNo);
    else if(c.type==='reading')this.session.reading(c.value);
    else if(c.type==='save_result')this.saveResult();
    else if(c.type==='save_poster')this.savePoster(Number(c.payload?.player));
    else if(c.type==='finish_room'){this.session.finishRoom();this.session.leave();}
    else this.session.send(c.type,c.payload||{},c.top||{});
  }
  async start(){
    const root=this.get_parent();
    this.account=require('./native-account-service').create({websocketPool:root.get_node('Pool'),sessionNode:root.get_node('Session')});
    await this.account.load();
    if(this.closed)return;
    if(!this.account.snapshot().authenticated){root.call('notify_player','請先在啟動器登入');return;}
    const socket=this.account.getSocket();
    root.call('begin_audio');
    this.results=require('./native-card-results').create({socket,secret:this.account.getSecret(),notify:text=>{if(!this.closed)root.call('notify_player',text);}});
    this.resultTag=String(root.call('account_tag',this.account.getSecret()));
    this.session=require('./native-card-session').create({socket,secret:this.account.getSecret(),profile:this.account.snapshot().account,view:{
      render:value=>{root.call('apply_json',JSON.stringify(value));if(value.state?.final&&!value.busy&&this.resultKey!==String(value.state.final.endedAt??'missing')){this.resultKey=String(value.state.final.endedAt??'missing');this.pendingResult={final:value.state.final,viewer:value.viewer,room:value.room,unlocked:value.state.myDeluxe};this.saveResult();}},present:(id,step)=>root.call('present_json',id,JSON.stringify(step)),
      lobby:value=>root.call('lobby_json',JSON.stringify(value)),rooms:value=>root.call('rooms_json',JSON.stringify(value)),
      notify:text=>root.call('notify_player',text),cancel:()=>root.call('cancel_presentation')
    }});
    this.finished=Callable.create(root,id=>this.session.done(Number(id)));
    root.connect('presentation_done',this.finished);
    const pending=String(root.call('load_pending_result',this.resultTag));if(pending){try{this.pendingResult=JSON.parse(pending);await this.saveResult();}catch{root.call('notify_player','上次結算紀錄讀取失敗，已保留檔案');}}
  }
  async saveResult(){
    if(!this.pendingResult||this.closed)return;const root=this.get_parent(),p=this.pendingResult;
    this.completedResult=p;
    root.call('store_pending_result',this.resultTag,JSON.stringify(p));
    const value=await this.results.save(p.final,p.viewer,p.room,p.unlocked);
    if(value&&!this.closed){root.call('result_json',JSON.stringify(value));if(value.saved){root.call('store_pending_result',this.resultTag,'');this.pendingResult=null;}}
  }
  async savePoster(viewer){
    if(this.pendingResult||!this.completedResult||this.savingPoster||this.closed)return;
    this.savingPoster=true;const root=this.get_parent(),p=this.completedResult;
    try{await this.results.savePoster(p.final,viewer,p.room);if(!this.closed)root.call('poster_status','已存到個人頁面');}
    catch{if(!this.closed)root.call('poster_status','尚未存入，請確認網路後再試');}
    finally{this.savingPoster=false;}
  }
  _exit_tree(){this.closed=true;const root=this.get_parent();if(this.command)root.disconnect('command',this.command);if(this.finished)root.disconnect('presentation_done',this.finished);this.session?.dispose();this.account?.dispose();}
}
exports.default=NativeCardEntry;
