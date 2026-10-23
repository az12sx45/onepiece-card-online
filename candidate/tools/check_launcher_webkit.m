#import <Cocoa/Cocoa.h>
#include "po_launcher_assets.h"

@interface Probe : NSObject <WKScriptMessageHandler,WKNavigationDelegate>
@property(nonatomic,strong) WKWebView *web;
@property(nonatomic) BOOL failed;
@property(nonatomic) BOOL loaded;
@property(nonatomic) BOOL ready;
@end
@implementation Probe
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    NSDictionary *request=[NSJSONSerialization JSONObjectWithData:[message.body dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSString *method=request[@"method"];
    if([method isEqualToString:@"launchGame"]){_failed=YES;return;}
    NSDictionary *result=[method isEqualToString:@"getNativeState"]?@{@"ok":@YES,@"deviceId":@"fixture",@"secret":@"",@"games":@{}}:@{@"ok":@YES,@"state":@{@"status":@"unavailable"}};
    NSData *data=[NSJSONSerialization dataWithJSONObject:@[request[@"id"],result] options:0 error:nil];
    NSString *args=[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    [_web evaluateJavaScript:[NSString stringWithFormat:@"window.__tabletopNativeResolve.apply(null,%@)",args] completionHandler:nil];
}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {NSLog(@"probe navigation error %@",error);_failed=YES;}
- (void)webView:(WKWebView *)web didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {NSLog(@"probe document error %@",error);_failed=YES;}
- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {_loaded=YES;}
@end

int main(int argc,const char **argv){@autoreleasepool{
    if(argc!=2)return 2;
    // Real Foundation /private alias regression, with the same production resolver.
    NSString *folder=[@"/private/tmp" stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    NSFileManager *fm=NSFileManager.defaultManager;
    [fm createDirectoryAtPath:folder withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *root=[folder stringByAppendingPathComponent:@"launcher-web"];
    NSString *source=[NSString stringWithUTF8String:argv[1]];
    if(![fm createSymbolicLinkAtPath:root withDestinationPath:source error:nil])return 3;
    NSURL *url=[NSURL URLWithString:@"poapp://app/launcher/index.html"];
    NSString *legacy=[[root stringByAppendingPathComponent:@"launcher/index.html"] stringByStandardizingPath];
    if([legacy hasPrefix:[root stringByAppendingString:@"/"]]){NSLog(@"Legacy defect was not reproduced");return 4;}
    NSString *file=POResolveLauncherAsset(root,url);
    if(!file||![fm fileExistsAtPath:file])return 5;
    for(NSString *bad in @[@"poapp://foreign/launcher/index.html",@"https://app/launcher/index.html",@"poapp://app/secrets/file",@"poapp://app/launcher/%2e%2e/secrets"])
        if(POResolveLauncherAsset(root,[NSURL URLWithString:bad]))return 6;
    NSLog(@"PASS private-path regression and path rejection");
    [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSWindow *window=[[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,896,414) styleMask:NSWindowStyleMaskBorderless backing:NSBackingStoreBuffered defer:NO];
    POAssetSchemeHandler *handler=[POAssetSchemeHandler new];handler.root=root;
    Probe *probe=[Probe new];WKWebViewConfiguration *config=[WKWebViewConfiguration new];
    [config setURLSchemeHandler:handler forURLScheme:@"poapp"];
    [config.userContentController addScriptMessageHandler:probe name:@"tabletop"];
    probe.web=[[WKWebView alloc] initWithFrame:NSMakeRect(0,0,896,414) configuration:config];probe.web.navigationDelegate=probe;
    window.contentView=probe.web;[window orderFront:nil];
    [probe.web loadRequest:[NSURLRequest requestWithURL:url]];
    NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:40];
    while(!probe.failed&&!probe.ready&&deadline.timeIntervalSinceNow>0){
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.2]];
        if(probe.loaded)[probe.web evaluateJavaScript:@"document.body.dataset.stage==='auth' && document.getElementById('authTitle').textContent==='航海者登入' && document.querySelector('.auth-logo').naturalWidth>0 && !!window.onePieceDesktop" completionHandler:^(id value,NSError *error){if(error){NSLog(@"probe JS failure %@",error);probe.failed=YES;}else if([value boolValue])probe.ready=YES;}];
    }
    NSLog(@"WebKit auth document result loaded=%d ready=%d failed=%d",probe.loaded,probe.ready,probe.failed);
    [config.userContentController removeScriptMessageHandlerForName:@"tabletop"];
    [fm removeItemAtPath:root error:nil];[fm removeItemAtPath:folder error:nil];
    if(!probe.ready||probe.failed)return 7;
    puts("PASS actual WebKit custom origin, launcher JavaScript, Chinese title, logo and login entry; not an iPhone acceptance test");return 0;
}}
