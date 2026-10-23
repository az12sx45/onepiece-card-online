#import <WebKit/WebKit.h>

// Only bundled launcher pages may send native commands. Network pages never
// receive the bridge or the secure session reply.
@interface POLauncher : NSObject <WKURLSchemeHandler,WKScriptMessageHandler,WKNavigationDelegate,WKUIDelegate>
@property(nonatomic,strong) WKWebView *web;
@property(nonatomic,strong) NSMutableArray *requests;
@property(nonatomic,copy) NSString *root;
- (BOOL)show:(BOOL)reload;
- (void)hide;
- (void)close;
- (NSArray *)takeRequests;
- (void)reply:(NSString *)identifier result:(NSDictionary *)result;
@end

@implementation POLauncher
- (instancetype)init {
    if((self=[super init])){_requests=[NSMutableArray array];_root=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"launcher-web"];}
    return self;
}
- (void)webView:(WKWebView *)web startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURL *url=task.request.URL;
    NSString *relative=[url.path stringByRemovingPercentEncoding];
    if(![relative hasPrefix:@"/"]){[task didFailWithError:[NSError errorWithDomain:@"POAssets" code:403 userInfo:nil]];return;}
    NSString *file=[[_root stringByAppendingPathComponent:[relative substringFromIndex:1]] stringByStandardizingPath];
    if(![url.host isEqualToString:@"app"]||![file hasPrefix:[_root stringByAppendingString:@"/"]]||
       !([relative hasPrefix:@"/launcher/"]||[relative hasPrefix:@"/launcher-assets/"]||[relative hasPrefix:@"/mobile/"])){
        [task didFailWithError:[NSError errorWithDomain:@"POAssets" code:403 userInfo:nil]];return;
    }
    NSData *data=[NSData dataWithContentsOfFile:file options:NSDataReadingMappedIfSafe error:nil];
    if(!data){[task didFailWithError:[NSError errorWithDomain:@"POAssets" code:404 userInfo:nil]];return;}
    NSDictionary *types=@{@"html":@"text/html",@"js":@"application/javascript",@"css":@"text/css",@"json":@"application/json",@"png":@"image/png",@"webp":@"image/webp",@"svg":@"image/svg+xml",@"jpg":@"image/jpeg",@"jpeg":@"image/jpeg",@"gif":@"image/gif",@"mp3":@"audio/mpeg",@"ogg":@"audio/ogg",@"wav":@"audio/wav",@"mp4":@"video/mp4",@"webm":@"video/webm",@"ttf":@"font/ttf",@"otf":@"font/otf"};
    NSURLResponse *response=[[NSURLResponse alloc] initWithURL:url MIMEType:types[file.pathExtension.lowercaseString]?:@"application/octet-stream" expectedContentLength:data.length textEncodingName:@"utf-8"];
    [task didReceiveResponse:response];[task didReceiveData:data];[task didFinish];
}
- (void)webView:(WKWebView *)web stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    NSURL *url=message.frameInfo.request.URL;
    if(!message.frameInfo.isMainFrame||![url.scheme isEqualToString:@"poapp"]||![url.host isEqualToString:@"app"]||![url.path hasPrefix:@"/launcher/"]||![message.body isKindOfClass:NSString.class])return;
    NSString *body=message.body;if(body.length>131072||_requests.count>=64)return;
    NSDictionary *request=[NSJSONSerialization JSONObjectWithData:[body dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if(![request isKindOfClass:NSDictionary.class]||![request[@"id"] isKindOfClass:NSString.class]||[request[@"id"] length]>128||![request[@"method"] isKindOfClass:NSString.class])return;
    [_requests addObject:request];
}
- (void)webView:(WKWebView *)web decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    NSURL *url=action.request.URL;
    BOOL local=[url.scheme isEqualToString:@"poapp"]&&[url.host isEqualToString:@"app"]&&[url.path hasPrefix:@"/launcher/"];
    handler(local?WKNavigationActionPolicyAllow:WKNavigationActionPolicyCancel);
}
- (BOOL)show:(BOOL)reload {
    UIWindow *window=nil;
    for(UIScene *scene in UIApplication.sharedApplication.connectedScenes){
        if([scene isKindOfClass:UIWindowScene.class]&&scene.activationState==UISceneActivationStateForegroundActive)
            for(UIWindow *candidate in ((UIWindowScene *)scene).windows)if(candidate.isKeyWindow)window=candidate;
    }
    if(!window)return NO;
    if(!_web){
        WKWebViewConfiguration *config=[WKWebViewConfiguration new];
        config.applicationNameForUserAgent=@"ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)";
        [config setURLSchemeHandler:self forURLScheme:@"poapp"];
        [config.userContentController addScriptMessageHandler:self name:@"tabletop"];
        config.allowsInlineMediaPlayback=YES;config.mediaTypesRequiringUserActionForPlayback=WKAudiovisualMediaTypeNone;
        _web=[[WKWebView alloc] initWithFrame:window.bounds configuration:config];
        _web.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
        _web.navigationDelegate=self;_web.UIDelegate=self;_web.opaque=YES;_web.backgroundColor=[UIColor colorWithRed:0.02 green:0.06 blue:0.09 alpha:1];
        _web.scrollView.contentInsetAdjustmentBehavior=UIScrollViewContentInsetAdjustmentNever;
        reload=YES;
    }
    [window addSubview:_web];_web.hidden=NO;
    if(reload)[_web loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"poapp://app/launcher/index.html"]]];
    return YES;
}
- (void)hide {[_web evaluateJavaScript:@"window.__poLauncherPause&&window.__poLauncherPause()" completionHandler:nil];_web.hidden=YES;}
- (void)close {[_web.configuration.userContentController removeScriptMessageHandlerForName:@"tabletop"];[_web removeFromSuperview];_web=nil;[_requests removeAllObjects];}
- (NSArray *)takeRequests {NSArray *result=[_requests copy];[_requests removeAllObjects];return result;}
- (void)reply:(NSString *)identifier result:(NSDictionary *)result {
    if(![_web.URL.scheme isEqualToString:@"poapp"]||![_web.URL.host isEqualToString:@"app"])return;
    NSData *data=[NSJSONSerialization dataWithJSONObject:@[identifier,result] options:0 error:nil];
    NSString *arguments=[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if(arguments)[_web evaluateJavaScript:[NSString stringWithFormat:@"window.__tabletopNativeResolve&&window.__tabletopNativeResolve.apply(null,%@)",arguments] completionHandler:nil];
}
@end
