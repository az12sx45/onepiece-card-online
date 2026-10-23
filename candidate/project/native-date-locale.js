'use strict';
// Exact formatter used by original formatSaveTime. Date's local getters retain
// the device time zone; this is not a general Intl.DateTimeFormat replacement.
exports.install=function(){
 const original=Date.prototype.toLocaleString;
 Object.defineProperty(Date.prototype,'toLocaleString',{configurable:true,writable:true,value:function(locale,options){
  if(locale!=='zh-TW')return original.call(this,locale,options);
  if(!options||options.hour12!==false||Object.keys(options).some(k=>k!=='hour12'))throw Error('Native date format not implemented');
  if(!Number.isFinite(this.getTime()))return 'Invalid Date';
  const pad=value=>String(value).padStart(2,'0');
  return this.getFullYear()+'/'+(this.getMonth()+1)+'/'+this.getDate()+' '+pad(this.getHours())+':'+pad(this.getMinutes())+':'+pad(this.getSeconds());
 }});
};
