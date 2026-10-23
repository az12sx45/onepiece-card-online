'use strict';
// Explicit native counterparts for the original cinematic controller's known
// controls. The original session still owns beat indices, locks and callbacks.
class NativeStoryBridge{
    constructor(application,controls,html,helpers){
        this.application=application;this.controls=controls;this.helpers=helpers;this.disposed=false;this.pending=false;
        this.opening=html.includes('ending-opening ');this.effectSerial=0;this.sceneSerial=0;this.sceneStarted=0;this.sceneTransitions=[];
        const sourceScene=helpers.field(html,/<div class="(final-ending-screen[^"]*)"/,'story screen class');
        if(!sourceScene.includes('scene-feature-island-')&&!this.opening&&!require('./native-cinematic-scenes').supports(sourceScene))throw Error('Unverified native cinematic scene '+sourceScene);
        // The original cinematic CSS hides the legacy glyph row for all catalog
        // scenes. Its presence in HTML is not proof that it is a visible layer.
        this.nodes=new Map();this.model={kind:'feature-story',speaker:'',text:'',portrait:'',portraitScale:1,portraitY:0,background:'',foreground:'',accent:'',foregroundOpacity:0,accentOpacity:0,foregroundInset:'8% 12% 30%',accentInset:'6% 8% 24%',buttons:[],speedOptions:[]};
        const {field,decode}=helpers;
        this.screen=this.node('story-screen');this.dialogue=this.node('story-dialogue');this.playback=this.node('story-playback');
        if(this.opening)this.node('opening-title');
        this.screen.className=field(html,/<div class="(final-ending-screen[^"]*)"/,'story screen class');
        this.screen.setAttribute('style',field(html,/<div class="final-ending-screen[^>]*style="([^"]*)"/,'story style'));
        for(const id of ['finalEndingAutoBtn','finalEndingSkipBtn']){
            const body=html.match(new RegExp('<button([^>]*id="'+id+'"[^>]*)>([\\s\\S]*?)<\\/button>'));
            if(!body)throw Error('Original story control missing '+id);this.node(id).textContent=decode(body[2]);
        }
        const select=this.node('finalEndingSpeedSelect');
        this.model.speedOptions=[...html.matchAll(/<option([^>]*value="([^"]+)"[^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[2],label:decode(m[3]),selected:/\bselected\b/.test(m[1])}));
        select.value=this.model.speedOptions.find(o=>o.selected)?.value||'1';
        const dialogueMarkup=html.match(/<section class="final-ending-dialogue[^>]*>([\s\S]*?)<\/section>/)?.[1];
        if(dialogueMarkup===undefined)throw Error('Original dialogue markup missing');
        this.dialogue.innerHTML=dialogueMarkup;
        this.flush();
    }
    node(id){
        if(this.nodes.has(id))return this.nodes.get(id);
        const bridge=this;let text='',disabled=false,hidden=false,value='',classes=new Set(),markup='';
        const listeners=new Map(),node={id,dataset:{},listeners,
            addEventListener(type,callback){if(!['click','change'].includes(type))throw Error('Unsupported story event '+type);listeners.set(type,callback);},
            closest(selector){return selector==='#'+id||selector==='[data-final-ending-choice]'&&this.dataset.finalEndingChoice?this:null;},
            querySelector(selector){if(selector==='.opening-story-title-card')return bridge.opening?bridge.node('opening-title'):null;throw Error('Unsupported story child '+selector);},
            setAttribute(name,input){
                if(name==='aria-pressed')return;
                if(name==='aria-label'&&id==='story-screen'){node.ariaLabel=String(input);return;}
                if(name!=='style'||id!=='story-screen')throw Error('Unsupported story attribute '+name);
                for(const part of String(input).split(';')){
                    const colon=part.indexOf(':');if(colon<0)continue;const key=part.slice(0,colon).trim(),v=part.slice(colon+1).trim();
                    const images={'--ending-bg':'background','--ending-foreground':'foreground','--ending-accent':'accent'};
                    if(images[key])bridge.model[images[key]]=v.match(/^url\((.*?)\)$/)?.[1]||'';
                    if(key==='--ending-foreground-opacity')bridge.model.foregroundOpacity=Number(v)||0;
                    if(key==='--ending-accent-opacity')bridge.model.accentOpacity=Number(v)||0;
                    if(key==='--ending-foreground-inset')bridge.model.foregroundInset=v;
                    if(key==='--ending-accent-inset')bridge.model.accentInset=v;
                }
                bridge.flush();
            },
            get textContent(){return text;},set textContent(v){text=String(v??'');bridge.flush();},
            get disabled(){return disabled;},set disabled(v){disabled=!!v;bridge.flush();},
            get hidden(){return hidden;},set hidden(v){hidden=!!v;bridge.flush();},
            get value(){return value;},set value(v){value=String(v);bridge.flush();},
            get className(){return [...classes].join(' ');},set className(v){classes=new Set(String(v).split(/\s+/));if(id==='story-screen'&&classes.has('scene-switching')){bridge.sceneSerial++;bridge.sceneStarted=require('godot').Time.get_ticks_msec();bridge.sceneTransitions.push(String(v));}bridge.flush();},
            get innerHTML(){return markup;},set innerHTML(v){markup=String(v);if(id!=='story-dialogue')throw Error('Unsupported story markup assignment');bridge.dialogueMarkup(markup);},
            classList:{contains:key=>classes.has(key),add(...keys){keys.forEach(k=>classes.add(k));bridge.flush();},remove(...keys){keys.forEach(k=>classes.delete(k));bridge.flush();},toggle(key,force){const enabled=force===undefined?!classes.has(key):!!force;if(enabled)classes.add(key);else classes.delete(key);bridge.flush();return enabled;}},
        };
        if(id==='story-screen')node.dataset=new Proxy({}, {set(target,key,value){target[key]=value;bridge.effectSerial++;bridge.flush();return true;},deleteProperty(target,key){delete target[key];bridge.effectSerial++;bridge.flush();return true;}});
        this.nodes.set(id,node);this.controls.set(id,node);return node;
    }
    dialogueMarkup(html){
        const {decode}=this.helpers;
        for(const [id,node] of this.nodes)if(id==='finalEndingNextBtn'||id==='finalEndingPrevBtn'||node.dataset.finalEndingChoice){this.nodes.delete(id);this.controls.delete(id);}
        this.model.speaker=decode(html.match(/<div class="final-ending-speaker">([\s\S]*?)<\/div>/)?.[1]||'');
        this.model.text=decode(html.match(/<span class="final-ending-line current">([\s\S]*?)<\/span>/)?.[1]||'');
        const portrait=html.match(/<div class="final-ending-speaker-portrait([^>]*)>[\s\S]*?<img src="([^"]+)"/);
        this.model.portrait=portrait?.[2]||'';this.model.portraitScale=Number(portrait?.[1]?.match(/--final-ending-speaker-scale:([^;]+)/)?.[1]||1);this.model.portraitY=parseFloat(portrait?.[1]?.match(/--final-ending-speaker-y:([^;]+)/)?.[1]||0)/100;
        for(const match of html.matchAll(/<button([^>]*id="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)){
            const node=this.node(match[2]);node.textContent=decode(match[3]);node.disabled=/\bdisabled\b/.test(match[1]);
            const choice=match[1].match(/data-final-ending-choice="([^"]+)"/);if(choice)node.dataset.finalEndingChoice=choice[1];
        }
        this.flush();
    }
    query(selector){
        if(selector==='.final-ending-dialogue')return [this.dialogue];
        if(selector==='.final-ending-playback-controls')return [this.playback];
        if(selector==='[data-final-ending-choice]')return [...this.nodes.values()].filter(n=>n.dataset.finalEndingChoice);
        if(selector.startsWith('.final-ending-screen'))return selector.slice(1).split('.').every(c=>this.screen.classList.contains(c))?[this.screen]:[];
        throw Error('Unsupported native story selector '+selector);
    }
    handle(key){
        if(this.disposed)return false;
        let target=this.nodes.get(key),type='click';
        if(key.startsWith('story-speed:')){target=this.nodes.get('finalEndingSpeedSelect');target.value=key.slice(12);type='change';}
        if(!target)return false;
        const event={target,stopPropagation(){}};
        if(target.disabled||target.hidden)return true;
        const listener=target.listeners.get(type);
        if(listener)listener(event);
        else if(key==='finalEndingNextBtn'||key==='finalEndingPrevBtn'||target.dataset.finalEndingChoice)this.dialogue.listeners.get('click')?.(event);
        else throw Error('Native story action has no original listener '+key);
        return true;
    }
    flush(){
        if(this.pending||this.disposed)return;this.pending=true;
        setTimeout(()=>{
            this.pending=false;if(this.disposed)return;
            this.model.buttons=[...this.nodes.values()].filter(n=>n.id.startsWith('finalEnding')||n.dataset.finalEndingChoice).map(n=>({key:n.id,label:n.textContent,disabled:n.disabled,hidden:n.hidden,choice:!!n.dataset.finalEndingChoice}));
            this.model.speed=this.nodes.get('finalEndingSpeedSelect')?.value||'1';
            this.model.opening=this.opening;this.model.sceneClass=this.screen.className;this.model.openingEffect=this.screen.dataset.openingEffect||'';this.model.effectSerial=this.effectSerial;this.model.titleCard=this.nodes.get('opening-title')?.textContent||'';this.model.titleVisible=this.nodes.get('opening-title')?.classList.contains('is-visible')||false;
            this.model.sceneSerial=this.sceneSerial;this.model.sceneStarted=this.sceneStarted;
            this.application.call('show_story_modal',JSON.stringify(this.model));
        },0);
    }
    dispose(){this.disposed=true;}
}
exports.NativeStoryBridge=NativeStoryBridge;

