'use strict';
// Exact source-catalog collation, not a general replacement for Intl.Collator.
// Fail on unregistered dynamic non-ASCII text instead of changing game order.
const data=require('./source-collation.json');
const ranks=new Map(),primary=new Map(),full=new Map();
data.groups.forEach((group,index)=>group.forEach(text=>ranks.set(text,index)));
data.asciiPrimary.forEach((group,index)=>group.forEach(char=>primary.set(char,index)));
data.asciiFull.forEach((group,index)=>group.forEach(char=>full.set(char,index)));
function compareAscii(a,b){
 const clean=text=>[...text].filter(char=>primary.has(char));const left=clean(a),right=clean(b);
 for(let i=0;i<Math.min(left.length,right.length);i++){const delta=primary.get(left[i])-primary.get(right[i]);if(delta)return Math.sign(delta);}
 if(left.length!==right.length)return Math.sign(left.length-right.length);
 for(let i=0;i<left.length;i++){const delta=full.get(left[i])-full.get(right[i]);if(delta)return Math.sign(delta);}
 return 0;
}
function compare(a,b,locales,options){
 a=String(a).normalize('NFC');b=String(b).normalize('NFC');if(a===b)return 0;
 const locale=Array.isArray(locales)?locales[0]:locales;
 if(options&&Object.keys(options).length)throw Error('Native text collation options require full Intl');
 if(locale!==undefined&&!['zh-Hant','zh-TW','zh-Hant-TW','en-US'].includes(locale))throw Error('Native text locale not implemented: '+locale);
 if(/^[\x00-\x7f]*$/.test(a)&&/^[\x00-\x7f]*$/.test(b))return compareAscii(a,b);
 if(locale===undefined||locale==='en-US')throw Error('Native non-ASCII default/en-US collation requires full Intl');
 if(!ranks.has(a)||!ranks.has(b))throw Error('Native source collation text missing: '+JSON.stringify(!ranks.has(a)?a:b));
 return Math.sign(ranks.get(a)-ranks.get(b));
}
exports.compare=compare;
let installed=false;
exports.install=function(){
 if(installed)return false;
 if('八'.localeCompare('三','zh-Hant')<0&&'a'.localeCompare('A')<0)return false;
 Object.defineProperty(String.prototype,'localeCompare',{configurable:true,writable:true,value:function(other,locales,options){return compare(String(this),other,locales,options);}});installed=true;return true;
};
