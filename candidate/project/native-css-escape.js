'use strict';
// CSSOM identifier serialization for selectors used by original rule handlers.
// This does not interpret CSS or draw a browser surface.
exports.escape=function(value){
 const text=String(value),first=text.charCodeAt(0);let result='';
 for(let i=0;i<text.length;i++){
  const code=text.charCodeAt(i),character=text.charAt(i);
  if(code===0){result+='\ufffd';continue;}
  if(code>=1&&code<=31||code===127||i===0&&code>=48&&code<=57||i===1&&code>=48&&code<=57&&first===45){result+='\\'+code.toString(16)+' ';continue;}
  if(i===0&&code===45&&text.length===1){result+='\\-';continue;}
  if(code>=128||code===45||code===95||code>=48&&code<=57||code>=65&&code<=90||code>=97&&code<=122)result+=character;
  else result+='\\'+character;
 }
 return result;
};
