'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
    if(!html.includes('class="hospital-ui"'))return null;
    const crew=[...html.matchAll(/<article class="hospital-crew-card([^>]*)>([\s\S]*?)<\/article>/g)].map(match=>{
        const body=match[2];if(match[1].includes('is-empty'))return {empty:true};
        const image=field(body,/<div class="hospital-crew-portrait">\s*<img src="([^"]*)"/,'hospital portrait');
        const meter=kind=>{const m=body.match(new RegExp('<div class="hospital-crew-meter '+kind+'">\\s*<span>([^<]*)<\\/span>\\s*<i><b style="width:([0-9.]+)%"'));if(!m)throw Error('Hospital meter missing '+kind);return {text:decode(m[1]),value:Number(m[2])};};
        return {empty:false,image:asset(image),fallback:asset(field(body,/data-fallback-src="([^"]*)"/,'portrait fallback')),name:field(body,/<strong>([^<]*)<\/strong>/,'crew name'),level:field(body,/<div class="hospital-crew-name">[\s\S]*?<span>([^<]*)<\/span>/,'crew level'),hp:meter('hp'),pp:meter('pp'),status:field(body,/<div class="hospital-crew-status">([^<]*)<\/div>/,'crew status')};
    });
    if(crew.length!==6)throw Error('Original hospital slot count changed');
    const actions=[...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
        const id=match[1].match(/id="([^"]+)"/)?.[1],service=match[1].match(/data-hospital-service="([^"]+)"/)?.[1];
        const key=id||service&&'hospital:'+service||(/\bdisabled\b/.test(match[1])&&html.includes('id="spectatorModalCloseBtn"')?'hospital:spectator-wait':'');
        if(!key)throw Error('Hospital action needs explicit spectator binding');
        bridge.control(key,service?{hospitalService:service}:{});
        return {key,label:field(match[2],/<span>([^<]*)<\/span>/,'hospital action'),disabled:/\bdisabled\b/.test(match[1])};
    });
    const copy=html.match(/<div class="hospital-service-copy">([\s\S]*?)<\/div>/)?.[1]||'';
    return {kind:'hospital',title:field(html,/<h3>([^<]*)<\/h3>/,'hospital title'),subtitle:field(html,/<div class="hospital-subtitle">([^<]*)<\/div>/,'hospital subtitle'),image:asset(field(html,/<div class="hospital-service-visual">\s*<img src="([^"]+)"/,'hospital island')),cost:field(copy,/<span>([^<]*)<\/span>/,'hospital cost'),name:field(copy,/<strong>([^<]*)<\/strong>/,'hospital service'),description:field(copy,/<p>([^<]*)<\/p>/,'hospital description'),crew,actions};
};
