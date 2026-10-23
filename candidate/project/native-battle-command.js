'use strict';
// Desktop sendBattleCommand assigns an envelope id before the original core's
// duplicate-command guard. Native signals are intents; envelope them at the same
// application boundary. Do not consume gameplay randomness to generate an id.
exports.create=function(core){
 if(typeof core?.functions?.processBattlePageCommand!=='function')throw Error('Original battle command dispatcher required');
 let sequence=0;
 return function dispatch(intent){
  if(!intent||typeof intent.type!=='string'||!intent.type)throw Error('Native battle command type missing');
  const command={...intent,id:intent.id===undefined?'native-battle-'+(++sequence):intent.id};
  if(typeof command.id!=='string'||!command.id)throw Error('Native battle command id missing');
  core.functions.processBattlePageCommand(command);return command;
 };
};
