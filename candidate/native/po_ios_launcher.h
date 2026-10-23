#import <WebKit/WebKit.h>
#include "po_launcher_assets.h"

// Only bundled launcher pages may send native commands. Network pages never
// receive the bridge or the secure session reply.
@interface POLauncher : NSObject <WKScriptMessageHandler,WKNavigationDelegate,WKUIDelegate>
@property(nonatomic,strong) WKWebView *web;
@property(nonatomic,strong) NSMutableArray *requests;
@property(nonatomic,copy) NSString *root;
@property(nonatomic,strong) POAssetSchemeHandler *assets;
@property(nonatomic,strong) UIButton *status;
@property(nonatomic) NSUInteger loadGeneration;
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
- (void)setStatus:(NSString *)message enabled:(BOOL)enabled {
    [_status setTitle:message forState:UIControlStateNormal];_status.enabled=enabled;_status.hidden=NO;
}
- (void)retry { [self show:YES]; }
- (void)navigationFailed:(NSError *)error {
    NSLog(@"PO_LAUNCHER navigation failure domain=%@ code=%ld",error.domain,(long)error.code);
    [self setStatus:[NSString stringWithFormat:@"啟動器載入失敗（%ld）\n點此重新載入",(long)error.code] enabled:YES];
}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error { [self navigationFailed:error]; }
- (void)webView:(WKWebView *)web didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error { [self navigationFailed:error]; }
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)web { [self navigationFailed:[NSError errorWithDomain:@"POWebContent" code:1 userInfo:nil]]; }
- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {
    NSLog(@"PO_LAUNCHER document loaded");
    [web evaluateJavaScript:@"!!document.getElementById('authScreen') && !!window.onePieceDesktop" completionHandler:^(id value,NSError *error){
        if(!error&&[value boolValue]){self.status.hidden=YES;NSLog(@"PO_LAUNCHER renderer ready");}
        else [self navigationFailed:error?:[NSError errorWithDomain:@"PORenderer" code:2 userInfo:nil]];
    }];
}
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
        _assets=[POAssetSchemeHandler new];_assets.root=_root;
        [config setURLSchemeHandler:_assets forURLScheme:@"poapp"];
        [config.userContentController addScriptMessageHandler:self name:@"tabletop"];
        config.allowsInlineMediaPlayback=YES;config.mediaTypesRequiringUserActionForPlayback=WKAudiovisualMediaTypeNone;
        _web=[[WKWebView alloc] initWithFrame:window.bounds configuration:config];
        _web.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
        _web.navigationDelegate=self;_web.UIDelegate=self;_web.opaque=NO;_web.backgroundColor=[UIColor colorWithRed:0.02 green:0.06 blue:0.09 alpha:1];
        _web.scrollView.backgroundColor=_web.backgroundColor;
        _web.scrollView.contentInsetAdjustmentBehavior=UIScrollViewContentInsetAdjustmentNever;
        _status=[UIButton buttonWithType:UIButtonTypeSystem];_status.frame=window.bounds;
        _status.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
        _status.backgroundColor=_web.backgroundColor;[_status setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];
        _status.titleLabel.numberOfLines=0;_status.titleLabel.textAlignment=NSTextAlignmentCenter;
        [_status addTarget:self action:@selector(retry) forControlEvents:UIControlEventTouchUpInside];
        [_web addSubview:_status];
        reload=YES;
    }
    [window addSubview:_web];_web.hidden=NO;
    if(reload){
        [self setStatus:@"正在開啟啟動器…" enabled:NO];NSUInteger generation=++_loadGeneration;
        [_web loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"poapp://app/launcher/index.html"]]];
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW,20*NSEC_PER_SEC),dispatch_get_main_queue(),^{
            if(self.loadGeneration==generation&&!self.status.hidden&&!self.status.enabled)
                [self navigationFailed:[NSError errorWithDomain:@"POLoadTimeout" code:3 userInfo:nil]];
        });
    }
    return YES;
}
- (void)hide {[_web evaluateJavaScript:@"window.__poLauncherPause&&window.__poLauncherPause()" completionHandler:nil];_web.hidden=YES;}
- (void)close {++_loadGeneration;[_web.configuration.userContentController removeScriptMessageHandlerForName:@"tabletop"];[_web removeFromSuperview];_web=nil;_status=nil;_assets=nil;[_requests removeAllObjects];}
- (NSArray *)takeRequests {NSArray *result=[_requests copy];[_requests removeAllObjects];return result;}
- (void)reply:(NSString *)identifier result:(NSDictionary *)result {
    if(![_web.URL.scheme isEqualToString:@"poapp"]||![_web.URL.host isEqualToString:@"app"])return;
    NSData *data=[NSJSONSerialization dataWithJSONObject:@[identifier,result] options:0 error:nil];
    NSString *arguments=[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if(arguments)[_web evaluateJavaScript:[NSString stringWithFormat:@"window.__tabletopNativeResolve&&window.__tabletopNativeResolve.apply(null,%@)",arguments] completionHandler:nil];
}
@end
