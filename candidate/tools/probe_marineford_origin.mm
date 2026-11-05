#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
static BOOL Await(BOOL (^condition)(void)) {
    NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:35];
    while(!condition()&&deadline.timeIntervalSinceNow>0)
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.05]];
    return condition();
}
@interface OriginScheme : NSObject <WKURLSchemeHandler>
@property(nonatomic,strong) NSData *socketScript;
@property(nonatomic,strong) NSMutableArray *requests;
@end
@implementation OriginScheme
- (void)webView:(WKWebView *)web startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURL *url=task.request.URL;
    [self.requests addObject:@{@"path":url.path?:@"",@"method":task.request.HTTPMethod?:@""}];
    NSData *bytes=nil;
    NSString *mime=@"application/json";
    if([url.host isEqual:@"marineford"]&&[url.path isEqual:@"/vendor/socket.io.min.js"]) {
        bytes=self.socketScript;mime=@"application/javascript";
    } else if([url.host isEqual:@"marineford"]&&[url.path isEqual:@"/marineford/cards.json"]) {
        bytes=[@"[{\"id\":\"native-fixture\"}]" dataUsingEncoding:NSUTF8StringEncoding];
    }
    if(!bytes){[task didFailWithError:[NSError errorWithDomain:NSURLErrorDomain code:NSURLErrorResourceUnavailable userInfo:nil]];return;}
    NSHTTPURLResponse *response=[[NSHTTPURLResponse alloc] initWithURL:url statusCode:200 HTTPVersion:@"HTTP/1.1"
        headerFields:@{@"Content-Type":mime,@"Content-Length":[NSString stringWithFormat:@"%lu",(unsigned long)bytes.length],
            @"Access-Control-Allow-Origin":@"https://onepiece-card-online.onrender.com"}];
    [task didReceiveResponse:response];[task didReceiveData:bytes];[task didFinish];
}
- (void)webView:(WKWebView *)web stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
@end
@interface OriginProbe : NSObject <WKScriptMessageHandler,WKNavigationDelegate>
@property(nonatomic,strong) NSMutableArray *results;
@property(nonatomic,copy) NSString *error;
@end
@implementation OriginProbe
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    if([message.body isKindOfClass:NSDictionary.class])[self.results addObject:message.body];
}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    self.error=[NSString stringWithFormat:@"%@/%ld",error.domain,(long)error.code];
}
- (void)webView:(WKWebView *)web didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    self.error=[NSString stringWithFormat:@"%@/%ld",error.domain,(long)error.code];
}
@end
int main(int argc,char **argv) {
    @autoreleasepool {
        if(argc!=3)return 2;
        NSString *base=[NSString stringWithUTF8String:argv[1]];
        OriginScheme *scheme=[OriginScheme new];scheme.requests=[NSMutableArray array];
        scheme.socketScript=[NSData dataWithContentsOfFile:[base stringByAppendingPathComponent:@"launcher/socket.io.min.js"]];
        if(!scheme.socketScript.length)return 3;
        [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
        OriginProbe *probe=[OriginProbe new];probe.results=[NSMutableArray array];
        WKWebViewConfiguration *config=[WKWebViewConfiguration new];
        config.websiteDataStore=WKWebsiteDataStore.nonPersistentDataStore;
        config.applicationNameForUserAgent=@"ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)";
        [config setURLSchemeHandler:scheme forURLScheme:@"poasset"];
        [config.userContentController addScriptMessageHandler:probe name:@"probe"];
        NSString *seed=@"if(location.origin==='https://onepiece-card-online.onrender.com'){window.__poSeedOrigin=true;}";
        [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:seed injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
        WKWebView *web=[[WKWebView alloc] initWithFrame:NSMakeRect(0,0,740,360) configuration:config];web.navigationDelegate=probe;
        NSWindow *window=[[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,740,360) styleMask:NSWindowStyleMaskBorderless backing:NSBackingStoreBuffered defer:NO];
        window.contentView=web;[window orderFront:nil];
        NSURL *entry=[NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html?layout=responsive&tabletop_android=1"];
        NSString *html=@"<!doctype html><script src='poasset://marineford/vendor/socket.io.min.js'></script><script>"
            @"(async()=>{const r={stage:1,origin:location.origin,href:location.href,base:document.baseURI,seed:window.__poSeedOrigin===true};"
            @"try{localStorage.setItem('__po_origin_probe','one');r.localStorage=localStorage.getItem('__po_origin_probe')==='one';}catch(e){r.localStorageError=e.name;}"
            @"try{sessionStorage.setItem('__po_origin_probe','one');r.sessionStorage=sessionStorage.getItem('__po_origin_probe')==='one';}catch(e){r.sessionStorageError=e.name;}"
            @"try{document.cookie='__po_origin_probe=one; path=/; Secure; SameSite=Strict';r.cookie=document.cookie.includes('__po_origin_probe=one');}catch(e){r.cookieError=e.name;}"
            @"try{const x=await fetch('cards.json',{cache:'no-store'});r.relativeStatus=x.status;r.relativeFetch=x.ok&&Array.isArray(await x.json());}catch(e){r.relativeFetchError=e.name;}"
            @"try{const x=await fetch('poasset://marineford/marineford/cards.json');r.nativeStatus=x.status;r.nativeFetch=x.ok&&(await x.json())[0].id==='native-fixture';}catch(e){r.nativeFetchError=e.name;}"
            @"try{const s=io({autoConnect:false,reconnection:false});r.defaultSocketURI=s.io.uri;s.disconnect();}catch(e){r.defaultSocketError=e.name;}"
            @"try{r.explicitSocket=await new Promise(resolve=>{const s=io('https://onepiece-card-online.onrender.com',{transports:['websocket'],timeout:12000,reconnection:false});s.on('connect',()=>{s.disconnect();resolve(true)});s.on('connect_error',()=>{s.disconnect();resolve(false)});});}catch(e){r.explicitSocketError=e.name;}"
            @"webkit.messageHandlers.probe.postMessage(r);})().catch(e=>webkit.messageHandlers.probe.postMessage({stage:1,error:e.name}));</script>";
        [web loadHTMLString:html baseURL:entry];
        BOOL first=Await(^BOOL{return probe.results.count>=1||probe.error!=nil;});
        if(first&&!probe.error){
            NSString *again=@"<!doctype html><script>const r={stage:2,origin:location.origin,href:location.href};try{r.localStorage=localStorage.getItem('__po_origin_probe')==='one';r.sessionStorage=sessionStorage.getItem('__po_origin_probe')==='one';r.cookie=document.cookie.includes('__po_origin_probe=one');localStorage.removeItem('__po_origin_probe');sessionStorage.removeItem('__po_origin_probe');document.cookie='__po_origin_probe=; Max-Age=0; path=/';}catch(e){r.storageError=e.name;}webkit.messageHandlers.probe.postMessage(r);</script>";
            [web loadHTMLString:again baseURL:entry];
            Await(^BOOL{return probe.results.count>=2||probe.error!=nil;});
        }
        NSDictionary *result=@{@"probe":@"WKWebView-loadHTMLString-official-base",@"results":probe.results,@"schemeRequests":scheme.requests,@"navigationError":probe.error?:@"",@"physicalIphone":@NO};
        NSData *json=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted|NSJSONWritingSortedKeys error:nil];
        [json writeToFile:[NSString stringWithUTF8String:argv[2]] options:NSDataWritingAtomic error:nil];
        puts([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
        [config.userContentController removeScriptMessageHandlerForName:@"probe"];
        return first&&probe.results.count==2&&!probe.error?0:4;
    }
}
