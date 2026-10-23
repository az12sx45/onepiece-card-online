'use strict';
exports.create=function(catalog,options={}){
 const ui=require('./native-marineford-controls').create(catalog,{...options,extraTags:['nav','figure','figcaption']});
 const css=new Map();ui.document.documentElement={style:{setProperty(key,value){css.set(String(key),String(value));options.changed?.();},getPropertyValue(key){return css.get(key)||'';}}};
 return {...ui,css};
};
