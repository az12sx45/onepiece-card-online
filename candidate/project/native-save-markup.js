'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('class="save-load-ui"'))return null;
 const actions=[...html.matchAll(/<button[^>]*class="save-load-action [^"]+"[^>]*id="([^"]+)"[^>]*>\s*<img src="([^"]+)"[^>]*>\s*<span>([\s\S]*?)<\/span>\s*<\/button>/g)].map(m=>({key:m[1],image:asset(m[2]),label:decode(m[3])}));
 if(!actions.length)throw Error('Original save actions missing');for(const action of actions)bridge.control(action.key);
 const body=html.match(/<div class="save-load-body">([\s\S]*?)<div class="save-load-actions /)?.[1];if(body===undefined)throw Error('Original save body missing');
 return {kind:'save-load',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'save title'),subtitle:field(html,/<h3>[\s\S]*?<\/h3>\s*<span>([\s\S]*?)<\/span>/,'save subtitle'),body:decode(body.replace(/<\/(?:p|strong|div)>/g,'\n\n')).replace(/[ \t]*\n[ \t]*/g,'\n').replace(/\n{3,}/g,'\n\n'),actions};
};
