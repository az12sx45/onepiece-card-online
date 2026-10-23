'use strict';
exports.create=function({root,account,http,randomValues,openFriends}){
 const storage=require('./native-storage').create(root.get_node('Storage'),account),sessionStorage=require('./native-storage').session();let router,disposed=false;
 const context=require('./native-player-context').create({account,storage,sessionStorage,randomValues,navigate:url=>router.navigate(url),notify:text=>root.call('notify_player',text),openFriends});
 try{router=require('./native-player-router').create({context,shell:require('./native-player-shell').create(root),fetch:http.fetch});}
 catch(error){context.dispose();throw error;}
 return {context,router,enter:()=>router.navigate('board_start.html'),async dispose(){if(disposed)return;disposed=true;try{await router.dispose();}finally{context.dispose();}}};
};
