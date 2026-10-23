'use strict';
// QuickJS builds without Intl omit grouping. Match the two numeric locales used
// by the original game, with default decimal formatting; reject unsupported
// options instead of quietly inventing currency/date behavior.
function formatDefault(value,locales,options){
    const locale=Array.isArray(locales)?locales[0]:locales;
    if(locale!==undefined&&!['en-US','zh-TW','en','zh-Hant-TW'].includes(locale))throw Error('Native numeric locale not implemented: '+locale);
    if(options&&Object.keys(options).length)throw Error('Native number format options require Intl');
    const number=Number(value);
    if(Number.isNaN(number))return locale==='zh-TW'||locale==='zh-Hant-TW'?'非數值':'NaN';
    const negative=number<0||Object.is(number,-0);
    if(!Number.isFinite(number))return (negative?'-':'')+'∞';
    const [mantissa,exponentText='0']=String(Math.abs(number)).split('e');
    const [whole,fraction='']=mantissa.split('.');
    const digits=whole+fraction,point=whole.length+Number(exponentText);
    let integer=point<=0?'0':point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point);
    let decimal=point<=0?'0'.repeat(-point)+digits:point>=digits.length?'':digits.slice(point);
    // Intl decimal defaults to maximumFractionDigits=3 and halfExpand.
    let thousandths=BigInt(integer)*1000n+BigInt((decimal+'000').slice(0,3));
    if(decimal.length>3&&decimal[3]>='5')thousandths++;
    integer=String(thousandths/1000n);
    decimal=String(thousandths%1000n).padStart(3,'0').replace(/0+$/,'');
    return (negative?'-':'')+integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimal?'.'+decimal:'');
}
exports.formatDefault=formatDefault;
exports.install=function(){
    if((12345.67).toLocaleString('zh-TW')==='12,345.67')return false;
    Object.defineProperty(Number.prototype,'toLocaleString',{configurable:true,writable:true,value:function(locales,options){return formatDefault(Number.prototype.valueOf.call(this),locales,options);}});
    return true;
};
