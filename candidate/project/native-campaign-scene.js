'use strict';
// Presentation state only. Every network/save action invokes the original
// board_start event handler attached to the source control model.
const text=node=>node?.textContent.replace(/\s+/g,' ').trim()||'';
exports.project=function(core,ui,actions,inputs){
 const nodes=ui.nodes,refs=ui.refs,state=ui.campaignView??(ui.campaignView={selected:'',manage:false});
 const action=(key,node,handler=null,label=null)=>{if(!node&&!handler)throw Error('Campaign control missing '+key);actions.set(key,handler||(()=>node.click()));return {key,label:label??text(node),disabled:!!node?.disabled,visible:!node?.hidden};};
 const change=fn=>{fn();};
 const submit=form=>{if(!form.checkValidity()){state.validation='請填寫原存檔房號。';return;}state.validation='';form.dispatch('submit');};
 const tabs=[...nodes.values()].filter(n=>n.dataset.campaignView).map(node=>action(node.id,node,()=>{state.selected='';state.manage=false;node.click();}));
 const cards=refs.boardCampaignList.children.map(card=>{
  const id=card.dataset.campaignId,buttons=[];
  for(const kind of ['continue','copy','remove','restore']){const node=card.querySelector('[data-campaign-'+kind+']');if(node)buttons.push(action('campaign:'+kind+':'+id,node));}
  const form=card.querySelector('form'),name=card.querySelector('[data-campaign-name]'),nameKey='campaignName:'+id;inputs.set(nameKey,name);
  const backups=card.querySelectorAll('.campaign-backup-row').map(row=>{const button=row.querySelector('[data-backup-revision]');return {text:text(row.querySelector('span')),action:action('campaign:backup:'+id+':'+button.dataset.backupRevision,button)};});
  const legacy=card.querySelector('[data-legacy-branch]');
  const details=card.querySelector('details');
  const manage=action('campaign:manage:'+id,null,()=>change(()=>{state.selected=id;state.manage=true;details.open=true;}),text(details.querySelector('summary')));
  const select=action('campaign:select:'+id,null,()=>change(()=>{state.selected=id;state.manage=false;}),'查看紀錄');
  return {id,title:text(card.querySelector('.campaign-save-title')),meta:text(card.querySelector('.campaign-save-meta')),summary:text(card.querySelector('.campaign-personal-summary')),members:card.querySelectorAll('.campaign-member-chip').map(node=>({name:text(node.querySelector('span')),portrait:node.querySelector('img')?.src||'',location:node.title})),buttons,select,manage,managementVisible:!details.hidden,name:{key:nameKey,value:name.value},rename:action('campaign:rename:'+id,form.querySelector('button'),()=>form.dispatch('submit')),backups,legacy:legacy?action('campaign:legacy:'+id,legacy):null,notes:card.querySelectorAll('.campaign-record-note').map(text)};
 });
 const selected=cards.find(card=>card.id===state.selected)||null;if(!selected){state.selected='';state.manage=false;}
 const dialog=nodes.get('campaignRemoveDialog'),importPanel=nodes.get('campaignImportPanel');
 let mode=dialog.open?'remove':importPanel.open?'import':selected?(state.manage?'manage':'detail'):'list';
 const back=mode==='list'?action('backFromCampaignsBtn',nodes.get('backFromCampaignsBtn')):action('campaign:back',null,()=>{if(dialog.open)nodes.get('campaignRemoveCancel').click();else if(importPanel.open){importPanel.open=false;importPanel.dispatch('toggle');}else if(state.manage){state.manage=false;const card=refs.boardCampaignList.children.find(n=>n.dataset.campaignId===state.selected);if(card)card.querySelector('details').open=false;}else state.selected='';},mode==='manage'?'返回紀錄內容':'返回紀錄清單');
 const importAction=action('campaign:import',null,()=>{importPanel.open=true;importPanel.dispatch('toggle');},text(importPanel.querySelector('summary')));
 const select=nodes.get('campaignLocalSave'),legacyForm=nodes.get('importLegacyRoomForm');inputs.set('campaignLocalSave',select);inputs.set('campaignLegacyRoom',nodes.get('campaignLegacyRoom'));
 return {mode,cards,selected,tabs,back,heading:text(nodes.get('boardCampaignPanel').querySelector('h3')),empty:refs.boardCampaignEmpty.textContent,hint:refs.campaignAccountHint.textContent,refresh:action('refreshCampaignsBtn',nodes.get('refreshCampaignsBtn')),importAction,
  removal:{name:text(nodes.get('campaignRemoveName')),scope:text(nodes.get('campaignRemoveScope')),actions:['campaignRemoveCancel','campaignRemoveConfirm'].map(key=>action(key,nodes.get(key)))},
  importing:{validation:state.validation||'',notes:importPanel.querySelectorAll('.campaign-record-note').map(text),options:select.options.map(option=>({value:option.value,label:option.textContent})),value:select.value,local:action('importLocalCampaignBtn',nodes.get('importLocalCampaignBtn')),legacyValue:nodes.get('campaignLegacyRoom').value,legacy:action('campaign:importLegacy',legacyForm.querySelector('button'),()=>submit(legacyForm))}
 };
};
