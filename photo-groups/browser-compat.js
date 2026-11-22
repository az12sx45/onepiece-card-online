(() => {
  'use strict';
  const WEBSITE='https://tantan-lily-photo-groups-2026.onrender.com/';
  const FALLBACK=WEBSITE+'?browser_switch=unavailable';
  const CHROME_INTENT='intent://tantan-lily-photo-groups-2026.onrender.com/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(FALLBACK)+';end';
  const $=id=>document.getElementById(id),banner=$('browserCompat'),chrome=$('browserCompatChrome'),copy=$('browserCompatCopy'),stay=$('browserCompatContinue'),manual=$('browserCompatManual'),address=$('browserCompatAddress'),status=$('browserCompatStatus');
  if(!banner||!chrome||!copy||!stay||!manual||!address||!status)return;
  const ua=String(navigator.userAgent||'');let platform='',brands=[];
  try{platform=String(navigator.userAgentData?.platform||'');brands=navigator.userAgentData?.brands||[];}catch{}
  const android=/Android/i.test(ua)||/^Android$/i.test(platform);
  const samsung=/SamsungBrowser/i.test(ua)||(Array.isArray(brands)&&brands.some(item=>/Samsung(?:Browser|\s*Internet)?/i.test(String(item?.brand||''))));
  const fallback=new URLSearchParams(location.search).get('browser_switch')==='unavailable';
  if(!(android&&samsung)&&!fallback)return;
  let dismissed=false,copySequence=0;
  chrome.href=CHROME_INTENT;address.value=WEBSITE;
  $('browserCompatFallback').hidden=!fallback;manual.hidden=!fallback;banner.hidden=false;
  function selectAddress(){try{address.focus();address.select();address.setSelectionRange(0,WEBSITE.length);}catch{}}
  chrome.addEventListener('click',()=>{
    // The trusted anchor click invokes Android's chooser. Its result is unknown.
    copySequence++;copy.disabled=false;
    status.textContent='若出現開啟選單，請選Chrome；未開啟可複製網址';
  });
  copy.addEventListener('click',async()=>{
    const sequence=++copySequence;let supported=false;copy.disabled=true;
    try{
      const clipboard=navigator.clipboard;supported=typeof clipboard?.writeText==='function';
      if(!supported)throw new Error('Clipboard unavailable');
      await clipboard.writeText(WEBSITE);
      if(dismissed||sequence!==copySequence)return;
      status.textContent='已複製網站網址，可在Chrome貼上後繼續。';
    }catch{
      if(dismissed||sequence!==copySequence)return;
      manual.hidden=false;
      status.textContent=(supported?'瀏覽器未允許自動複製。':'此瀏覽器無法自動複製。')+'請點選網址，再長按選取「複製」。';
      selectAddress();
    }finally{if(sequence===copySequence)copy.disabled=false;}
  });
  address.addEventListener('click',()=>{
    // Let the native tap place its caret first, then select the fixed URL for
    // this explicit user action. Do not suppress native long-press selection.
    requestAnimationFrame(()=>{if(!dismissed&&!manual.hidden)selectAddress();});
  });
  stay.addEventListener('click',()=>{
    dismissed=true;copySequence++;copy.disabled=false;banner.hidden=true;
    $('name')?.focus();
  });
})();
