'use strict';
// UTF-8 and base64 browser boundaries used by the unchanged battle wire codec.
// No payload fields, chunk sizes, checksum or ordering are changed here.
class Utf8Encoder {
 get encoding(){return 'utf-8';}
 encode(input=''){
  const text=String(input),out=new Uint8Array(text.length*3);let n=0;
  for(let i=0;i<text.length;i++){
   let c=text.charCodeAt(i);
   if(c>=0xd800&&c<=0xdbff){const low=text.charCodeAt(i+1);if(low>=0xdc00&&low<=0xdfff){c=0x10000+((c-0xd800)<<10)+(low-0xdc00);i++;}else c=0xfffd;}
   else if(c>=0xdc00&&c<=0xdfff)c=0xfffd;
   if(c<128)out[n++]=c;
   else if(c<2048){out[n++]=0xc0|(c>>6);out[n++]=0x80|(c&63);}
   else if(c<65536){out[n++]=0xe0|(c>>12);out[n++]=0x80|((c>>6)&63);out[n++]=0x80|(c&63);}
   else {out[n++]=0xf0|(c>>18);out[n++]=0x80|((c>>12)&63);out[n++]=0x80|((c>>6)&63);out[n++]=0x80|(c&63);}
  }
  return out.slice(0,n);
 }
}
class Utf8Decoder {
 constructor(label='utf-8',options={}){
  if(!['utf-8','utf8','unicode-1-1-utf-8'].includes(String(label).trim().toLowerCase()))throw RangeError('Native wire requires UTF-8');
  this.fatal=!!options.fatal;this.ignoreBOM=!!options.ignoreBOM;
 }
 get encoding(){return 'utf-8';}
 decode(input=new Uint8Array(),options={}){
  if(options.stream)throw TypeError('Native wire requires a complete byte message');
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):null;
  if(!bytes)throw TypeError('Expected byte buffer');
  const chunks=[];let units=[],i=0;
  const emit=c=>{if(c>65535){c-=65536;units.push(0xd800+(c>>10),0xdc00+(c&1023));}else units.push(c);if(units.length>=4096){chunks.push(String.fromCharCode(...units));units=[];}};
  const bad=()=>{if(this.fatal)throw TypeError('Invalid UTF-8');emit(0xfffd);};
  while(i<bytes.length){
   const start=i,b=bytes[i++];let c=b,count=0,lo=0x80,hi=0xbf;
   if(b<128){emit(b);continue;}
   if(b>=0xc2&&b<=0xdf){c=b&31;count=1;}
   else if(b>=0xe0&&b<=0xef){c=b&15;count=2;if(b===0xe0)lo=0xa0;if(b===0xed)hi=0x9f;}
   else if(b>=0xf0&&b<=0xf4){c=b&7;count=3;if(b===0xf0)lo=0x90;if(b===0xf4)hi=0x8f;}
   else {bad();continue;}
   let valid=true;
   for(let j=0;j<count;j++){
    if(i>=bytes.length||bytes[i]<(j===0?lo:0x80)||bytes[i]>(j===0?hi:0xbf)){valid=false;break;}
    c=(c<<6)|(bytes[i++]&63);
   }
   if(!valid){bad();continue;}
   if(c===0xfeff&&start===0&&!this.ignoreBOM)continue;
   emit(c);
  }
  if(units.length)chunks.push(String.fromCharCode(...units));return chunks.join('');
 }
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function btoa(input){
 const s=String(input),out=[];
 for(let i=0;i<s.length;i+=3){const a=s.charCodeAt(i),b=s.charCodeAt(i+1),c=s.charCodeAt(i+2);if(a>255||b>255||c>255)throw TypeError('Invalid binary string');out.push(alphabet[a>>2]+alphabet[((a&3)<<4)|((b||0)>>4)]+(i+1<s.length?alphabet[((b&15)<<2)|((c||0)>>6)]:'=')+(i+2<s.length?alphabet[c&63]:'='));}
 return out.join('');
}
function atob(input){
 let s=String(input).replace(/[\t\n\f\r ]/g,'');if(s.length%4===0)s=s.replace(/==?$/,'');
 if(s.length%4===1||/[^A-Za-z0-9+/]/.test(s))throw TypeError('Invalid base64');
 const out=[];let bits=0,value=0;
 for(const ch of s){value=(value<<6)|alphabet.indexOf(ch);bits+=6;if(bits>=8){bits-=8;out.push(String.fromCharCode((value>>bits)&255));}}
 return out.join('');
}
exports.Utf8Encoder=Utf8Encoder;exports.Utf8Decoder=Utf8Decoder;exports.btoa=btoa;exports.atob=atob;
exports.install=function(){for(const [name,value]of Object.entries({TextEncoder:Utf8Encoder,TextDecoder:Utf8Decoder,btoa,atob}))if(typeof globalThis[name]==='undefined')globalThis[name]=value;};
