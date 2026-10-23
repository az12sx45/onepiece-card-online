'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
    const image=(body,pattern,label)=>asset(field(body,pattern,label));
    if(html.includes('id="spectatorModalCloseBtn"')){
        let index=0;html=html.replace(/<button([^>]*class="tavern-candidate-card[^>]*)(>)/g,(_,attrs,end)=>'<button'+attrs+' data-tavern-candidate="spectator-'+index+++'"'+end);
        html=html.replace(/<button([^>]*\bdisabled\b[^>]*)(>)/g,(_,attrs,end)=>/\bid="|\bdata-tavern-candidate="/.test(attrs)?'<button'+attrs+end:'<button'+attrs+' id="tavern-spectator-disabled-'+index+++'"'+end);
    }
    const actions=()=>[...html.matchAll(/<button([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{bridge.control(m[2]);return {key:m[2],label:decode(m[3]),disabled:/\bdisabled\b/.test(m[1])};});
    if(html.includes('class="tavern-game-shell tavern-nautical-ui"')){
        const rows=[...html.matchAll(/<button([^>]*\bdata-tavern-candidate="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
            const key='tavern:'+m[2],body=m[3],control=bridge.control(key,{tavernCandidate:m[2]});
            control.closest=selector=>selector==='.tavern-candidate-list'?bridge.query(selector)[0]:null;
            return {key,selected:/\bselected\b/.test(m[1]),disabled:/\bdisabled\b/.test(m[1]),image:image(body,/<span class="tavern-card-art">\s*<img src="([^"]+)"/,'candidate portrait'),name:field(body,/<span class="tavern-card-name">([^<]*)<\/span>/,'candidate name'),grade:field(body,/<span class="tavern-grade-badge">([^<]*)<\/span>/,'candidate grade'),meta:field(body,/<span class="tavern-card-meta">([\s\S]*?)<\/span>\s*<span class="tavern-card-bottom">/,'candidate attribute'),bottom:field(body,/<span class="tavern-card-bottom">([\s\S]*)<\/span>\s*$/,'candidate probability').replace(/\s+/g,' ')};
        });
        const body=field(html,/<aside class="tavern-detail-panel">([\s\S]*?)<\/aside>/,'tavern detail');
        const detailHtml=html.match(/<aside class="tavern-detail-panel">([\s\S]*?)<\/aside>/)?.[1]||'';
        const stats=[...detailHtml.matchAll(/<small>([^<]*)<\/small><strong>([^<]*)<\/strong>/g)].map(m=>decode(m[1])+' '+decode(m[2]));
        const rules=[...detailHtml.matchAll(/<div><span>([^<]*)<\/span><strong>([^<]*)<\/strong><\/div>/g)].map(m=>decode(m[1])+'：'+decode(m[2]));
        const hero=detailHtml.match(/<div class="tavern-detail-hero">\s*<img src="([^"]+)"/)?.[1]||'';
        const name=detailHtml.match(/<div class="tavern-detail-name">([^<]*)<\/div>/)?.[1]||body;
        const passive=detailHtml.match(/<div class="tavern-passive-copy">\s*<strong>([^<]*)<\/strong>\s*<p>([\s\S]*?)<\/p>/);
        return {kind:'tavern',title:field(html,/<h3[^>]*id="tavernUiTitle"[^>]*>([^<]*)<\/h3>/,'tavern title'),subtitle:field(html,/<div class="modal-sub">([^<]*)<\/div>/,'tavern subtitle'),money:field(html,/<div class="tavern-money-box">\s*<span>[^<]*<\/span>\s*<strong>([^<]*)<\/strong>/,'tavern coins'),keeper:image(html,/<div class="tavern-keeper-stage">\s*<img[^>]*src="([^"]+)"/,'tavern keeper'),keeperText:field(html,/<div class="tavern-keeper-text">([\s\S]*?)<\/div>/,'keeper line'),listHeading:field(html,/<div class="tavern-board-head">([\s\S]*?)<\/div>/,'candidate heading').replace(/\s+/g,' '),rows,detail:{image:asset(hero),name:decode(name),meta:decode(detailHtml.match(/<div class="tavern-detail-meta">([\s\S]*?)<\/div>/)?.[1]||'').replace(/\s+/g,' '),text:[stats.join('　'),...rules,passive?decode(passive[1])+'\n'+decode(passive[2]):''].filter(Boolean).join('\n\n')},actions:actions()};
    }
    if(!html.includes('class="tavern-result-ui'))return null;
    const replacements=[...html.matchAll(/<button([^>]*\bdata-replace-crew="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
        const key='replace:'+m[2],body=m[3];bridge.control(key,{replaceCrew:m[2]});
        return {key,name:field(body,/<span class="tavern-replacement-name">([^<]*)<\/span>/,'replacement name'),image:image(body,/<span class="tavern-replacement-art"><img src="([^"]+)"/,'replacement portrait'),detail:['hp','pp','meta','action'].map(kind=>field(body,new RegExp('<span class="tavern-replacement-'+kind+'">([\\s\\S]*?)<\\/span>'),'replacement '+kind)).join('\n')};
    });
    const flags=html.match(/<section class="tavern-result-ui([^>]*)>/)?.[1]||'';
    const dataset=Object.fromEntries([...flags.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(m=>[m[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),decode(m[2])]));
    const content=html.match(/<div class="tavern-result-content">([\s\S]*?)<div class="tavern-result-actions/ )?.[1]||'';
    bridge.controls.set('tavern-result-role',{textContent:field(html,/<div class="tavern-result-meta-grid">\s*<span>[\s\S]*?<\/span>\s*<span><small>[^<]*<\/small><strong>([^<]*)<\/strong>/,'recruit role')});
    return {kind:'tavern-result',dataset,full:flags.includes('is-full-crew'),title:field(html,/<h3 id="tavernResultTitle">([^<]*)<\/h3>/,'recruit title'),subtitle:field(html,/<div class="tavern-result-subtitle">([^<]*)<\/div>/,'recruit subtitle'),image:image(html,/<div class="tavern-result-art">\s*<img src="([^"]+)"/,'recruit portrait'),name:field(html,/<div class="tavern-result-name">([^<]*)<\/div>/,'recruit name'),meta:[...html.matchAll(/<span><small>([^<]*)<\/small><strong>([^<]*)<\/strong><\/span>/g)].slice(0,4).map(m=>decode(m[1])+' '+decode(m[2])).join('　'),detail:decode(content.replace(/<\/(?:div|p)>/g,'\n')).replace(/\n\s*\n/g,'\n').trim(),replacements,actions:actions()};
};
