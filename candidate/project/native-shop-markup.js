'use strict';
// Read-only projection of original shop markup; pricing and actions stay in JS.
exports.project=function(html,bridge,helpers){
    const {decode,field,asset}=helpers;
    const readonly=html.includes('id="spectatorModalCloseBtn"');
    if(readonly){let index=0;html=html.replace(/<button([^>]*class="shop-item-row[^>]*)(>)/g,(_,attrs,end)=>'<button'+attrs+' data-shop-select="spectator-'+index+++'"'+end).replace(/(<button[^>]*class="modal-btn primary shop-buy-btn")/, '$1 id="shopBuyBtn"');}
    const image=body=>asset(body.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1]||'');
    const action=id=>{
        const match=html.match(new RegExp('<button([^>]*id="'+id+'"[^>]*)>([\\s\\S]*?)<\\/button>'));
        if(!match)throw Error('Original shop action missing '+id);
        bridge.control(id);return {key:id,label:decode(match[2]),disabled:/\bdisabled\b/.test(match[1])};
    };
    if(html.includes('class="shop-quantity-box"')){
        const item=html.match(/<div class="shop-quantity-item">([\s\S]*?)<\/div>/)?.[1]||'';
        const quantity=field(html,/<strong id="shopQtyValue">([^<]*)<\/strong>/,'quantity');
        const total=field(html,/<strong id="shopQtyTotal">([^<]*)<\/strong>/,'total');
        bridge.control('shopQtyValue',{},quantity);bridge.control('shopQtyTotal',{},total);
        return {kind:'shop-quantity',title:field(html,/<h3 class="shop-quantity-title">([^<]*)<\/h3>/,'quantity title'),image:image(html),
            name:field(item,/<span>([\s\S]*?)<\/span>/,'item name'),price:field(item,/<strong>([\s\S]*?)<\/strong>/,'item cost'),quantity,total,
            maximum:field(html,/<div class="shop-quantity-total">\s*<span>([\s\S]*?)<\/span>/,'maximum'),
            minus:action('shopQtyMinus'),plus:action('shopQtyPlus'),actions:[action('shopQtyConfirm'),action('shopQtyCancel')]};
    }
    if(!html.includes('class="shop-shell"'))return null;
    const rows=[...html.matchAll(/<button([^>]*\bdata-shop-select="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
        const id=decode(match[2]),body=match[3],key='shop:'+id;bridge.control(key,{shopSelect:id});
        return {key,...(readonly?{disabled:true}:{}),itemId:id,image:image(body),selected:match[1].includes('is-selected'),locked:match[1].includes('is-locked'),name:field(body,/<span class="shop-item-name">([\s\S]*?)<\/span>/,'row name'),price:field(body,/<span class="shop-item-price">([\s\S]*?)<\/span>/,'row cost')};
    });
    bridge.control('leaveShopListBtn');
    const detail=html.match(/<div class="shop-desc-text">([\s\S]*?)<\/div>/)?.[1];
    if(detail===undefined)throw Error('Original shop description missing');
    const selected=rows.find(row=>row.selected);
    return {kind:'shop',title:field(html,/<h3 class="shop-title">([\s\S]*?)<\/h3>/,'shop title'),
        money:field(html,/<div class="shop-money-box">[\s\S]*?<strong>([\s\S]*?)<\/strong>/,'money'),rows,
        selected:{image:selected?.image||'',name:field(detail,/<strong>([\s\S]*?)<\/strong>/,'selection name'),description:field(detail,/<span>([\s\S]*?)<\/span>/,'selection description'),notices:[...detail.matchAll(/<em>([\s\S]*?)<\/em>/g)].map(m=>decode(m[1]))},
        buy:action('shopBuyBtn'),leave:action(readonly?'spectatorModalCloseBtn':'leaveShopBtn')};
};
