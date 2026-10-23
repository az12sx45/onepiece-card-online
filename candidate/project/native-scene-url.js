'use strict';
// Internal HTTP(S) scene URLs used by the original iframe controllers. Reject
// credentials, fragments and non-web schemes; navigation still validates routes.
const form=v=>encodeURIComponent(String(v)).replace(/[!'()~]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g,'+');
class Params{
 constructor(search=''){this.entries=[];for(const part of search.replace(/^\?/,'').split('&'))if(part){const at=part.indexOf('='),decode=v=>decodeURIComponent(v.replace(/\+/g,' '));this.entries.push([decode(at<0?part:part.slice(0,at)),decode(at<0?'':part.slice(at+1))]);}}
 get(key){return this.entries.find(e=>e[0]===String(key))?.[1]??null;}
 has(key){return this.entries.some(e=>e[0]===String(key));}
 set(key,value){key=String(key);value=String(value);const index=this.entries.findIndex(e=>e[0]===key);if(index<0)this.entries.push([key,value]);else{this.entries[index][1]=value;this.entries=this.entries.filter((e,i)=>e[0]!==key||i===index);}this.changed?.();}
 toString(){return this.entries.map(([k,v])=>form(k)+'='+form(v)).join('&');}
}
class SceneURL{
 constructor(value,base){value=String(value);if(/[\s\\#]/.test(value)||value.startsWith('//'))throw Error('Unsupported native scene URL');let full=value;
  if(!/^https?:\/\//.test(value)){if(/^[a-z][a-z0-9+.-]*:/i.test(value))throw Error('Unsupported native scene scheme');const b=String(base||'').match(/^(https?:\/\/[^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?$/);if(!b)throw Error('Native scene URL requires HTTP base');full=b[1]+(value.startsWith('/')?value:(b[2]||'/').replace(/[^/]*$/,'')+value);}
  const m=full.match(/^(https?):\/\/([a-z0-9.-]+)(:\d+)?(\/[^?#]*)?(\?[^#]*)?$/i);if(!m)throw Error('Invalid native scene URL');this.protocol=m[1].toLowerCase()+':';let port=m[3]||'';if(port===(this.protocol==='https:'?':443':':80'))port='';this.origin=this.protocol+'//'+m[2].toLowerCase()+port;const parts=[];for(const p of (m[4]||'/').split('/')){if(p==='..')parts.pop();else if(p!=='.'&&p!=='')parts.push(p);}this.pathname='/'+parts.join('/')+((m[4]||'').endsWith('/')&&parts.length?'/':'');this.search=m[5]||'';this.searchParams=new Params(this.search);this.searchParams.changed=()=>{const s=this.searchParams.toString();this.search=s?'?'+s:'';};
 }
 get href(){return this.origin+this.pathname+this.search;}toString(){return this.href;}
}
exports.URL=SceneURL;exports.URLSearchParams=Params;
