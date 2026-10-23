'use strict';
// Specific drawing model for the original extraction controls; no generic HTML
// rendering, synthesized rewards, replacement grading or gameplay decisions.
const text=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
const image=node=>node?.src?.split('?')[0]||'';
const event=node=>node?{uid:node.uid,disabled:node.disabled,label:text(node),image:image(node.querySelector('img')),action:node.dataset?.lineageAction||'',classes:node.className}:null;
exports.project=function(api){
 const s=api.state,ui=api.functions.refs(),root=ui.root,target=ui.enemyWrap?.querySelector('.lineage-target-layer'),source=target?.querySelector('.lineage-osu-target')||target?.querySelector('.lineage-lock-target')||target?.querySelector('.lineage-seal-target');
 const targetImage=kind=>image(source?.querySelector('.'+kind));
 const panel=s.mode==='offer'||s.mode==='result'||s.mode==='unavailable'||s.mode==='waiting'?ui.actionCopy:ui.panel;
 const bodyCopy=panel?.querySelectorAll('.lineage-hint-line').map(text).join('\n')||'';const preview=target?.querySelector('.lineage-target-preview');
 return{kind:'lineage-extraction',visible:root.classList.contains('is-open'),mode:s.mode,classes:root.className.split(/\s+/),stageClasses:ui.stage.className.split(/\s+/),title:text(root.querySelector('[data-lineage-title]')),rank:text(root.querySelector('[data-lineage-rank]')),theme:{...root.styles},enemy:s.extraction?.enemy||null,
  infoTitle:text(ui.infoTitle),info:text(ui.infoCopy),actionTitle:text(ui.actionTitle),copy:bodyCopy,resultGrade:text(panel?.querySelector('.lineage-stage-grade')),resultStats:panel?.querySelectorAll('.lineage-stat').map(n=>({label:n.children.filter(c=>c.tag==='text').map(text).join(''),value:text(n.querySelector('strong'))}))||[],waitingSummary:text(panel?.querySelector('.lineage-waiting-summary')),participants:panel?.querySelectorAll('.lineage-waiting-player').map(n=>({image:image(n.querySelector('img')),name:text(n.querySelector('strong')),status:text(n.querySelector('small')),terminal:text(n.querySelector('em')),classes:n.className}))||[],actions:panel?.querySelectorAll('button').map(event)||[],
  selectedName:text(ui.selectedName),selectedDetail:text(ui.selectedDetail),instruction:text(ui.cylinderInstruction),rotator:{...ui.rotator.styles},rotatorUid:ui.rotator.uid,slots:s.slots.map((slot,i)=>({index:i,item:slot,visual:api.constants.EXTRACTOR_VISUALS[slot?.id]||api.constants.EXTRACTOR_VISUALS.lineage_extractor_standard})),selectedIndex:api.functions.selectedSlotIndex(),lock:event(root.querySelector('[data-lineage-lock]')),cylinderUid:ui.cylinder.uid,
  phase:s.phase,phaseTitle:text(ui.phaseTitle),phaseHint:text(ui.phaseHint),stats:ui.statLabels.map((label,i)=>({label:text(label),value:text(ui.statValues[i])})),grades:s.grades,
  target:source?{uid:source.uid,kind:source.className,styles:{...source.styles},number:text(source.querySelector('.lineage-target-number')),start:event(source.querySelector('.lineage-phase-start-control')),images:{approach:targetImage('approach'),hit:targetImage('hit'),track:targetImage('track'),left:targetImage('left'),right:targetImage('right'),fixed:targetImage('fixed'),pulse:targetImage('pulse')},preview:preview?{styles:{...preview.styles},number:text(preview.querySelector('.lineage-target-number'))}:null}:null,
  flashes:ui.enemyWrap?.querySelectorAll('.lineage-grade-flash').map(n=>({uid:n.uid,label:text(n),classes:n.className}))||[],
  outcome:{status:text(ui.outcomeStatus),next:ui.outcomeNext?.hidden?null:event(ui.outcomeNext),track:{...ui.trackBeam?.styles},beam:{...ui.targetBeam?.styles},classes:ui.outcome.className.split(/\s+/)},
 };
};
