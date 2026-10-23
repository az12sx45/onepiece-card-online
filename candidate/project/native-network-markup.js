'use strict';
// The four original connection/restore messages share a full-screen native
// frame. Keep the source link and wording; never offer a fake offline game.
exports.project=function(html,bridge,{decode}){
 const match=html.match(/<div style="font-size:clamp\([^>]*>([^<]+)<\/div>\s*<p[^>]*>([\s\S]*?)<\/p>/);
 if(!match)return null;
 const title=decode(match[1]);
 if(!['正在讀取航海錄','正在連接航海房','帳號尚未登入','航海錄載入失敗'].includes(title))return null;
 const link=html.match(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/),actions=[];
 if(link){
  if(link[1]!=='board_start.html?view=campaigns')throw Error('Unreviewed original restore destination');
  if(typeof bridge.navigate!=='function')throw Error('Native restore navigation is not bound');
  const key='nativeRestoreReturn';bridge.control(key).addEventListener('click',()=>bridge.navigate(link[1]));actions.push({key,label:decode(link[2])});
 }
 if((title==='帳號尚未登入'||title==='航海錄載入失敗')!==!!link)throw Error('Original restore action missing');
 return {kind:'network-status',title,subtitle:'',body:decode(match[2]),actions};
};
