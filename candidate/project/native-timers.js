'use strict';
const {Time}=require('godot');
// GodotJS may process a timer against the preceding long frame's elapsed time.
// Guard every callback with its actual monotonic creation deadline. This keeps
// the original delays intact even when source initialization blocks a frame.
const rawSetTimeout=globalThis.setTimeout,rawClearTimeout=globalThis.clearTimeout;
const pending=new Map();let nextId=0,installed=false;
function delayOf(value){value=Number(value);return Number.isFinite(value)?Math.min(2147483647,Math.max(0,value)):0;}
function create(callback,delay,args,repeat){
    if(typeof callback!=='function')throw TypeError('Native timers require a function');
    const period=repeat?Math.max(1,delayOf(delay)):delayOf(delay),id=++nextId;
    const entry={id,callback,args,period,repeat,due:Time.get_ticks_msec()+period,native:null};pending.set(id,entry);
    function schedule(ms){entry.native=rawSetTimeout(()=>{
        if(pending.get(id)!==entry)return;
        const remaining=entry.due-Time.get_ticks_msec();
        if(remaining>0){schedule(remaining);return;}
        if(repeat){const now=Time.get_ticks_msec();entry.due+=period;if(entry.due<=now)entry.due=now+period;schedule(entry.due-now);}else pending.delete(id);
        callback(...args);
    },ms);}
    schedule(period);return id;
}
function cancel(id){const entry=pending.get(Number(id));if(!entry)return;pending.delete(entry.id);rawClearTimeout(entry.native);}
exports.install=function(){
    if(installed)return;installed=true;
    globalThis.setTimeout=(callback,delay,...args)=>create(callback,delay,args,false);
    globalThis.clearTimeout=cancel;
    globalThis.setInterval=(callback,delay,...args)=>create(callback,delay,args,true);
    globalThis.clearInterval=cancel;
};
exports.pendingCount=()=>pending.size;
