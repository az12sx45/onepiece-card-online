#import <WebKit/WebKit.h>
#include "po_web_game_policy.h"

// Card and Chess retain their published web engines. This view deliberately has
// no native message handler; credentials exist only in official-page memory.
@interface POWebGame : NSObject <WKNavigationDelegate,WKUIDelegate>
@property(nonatomic,strong) UIView *surface;
@property(nonatomic,strong) WKWebView *web;
@property(nonatomic,strong) UILabel *status;
@property(nonatomic,copy) NSString *gameId;
@property(nonatomic,copy) NSString *programHTML;
@property(nonatomic) BOOL programLoadPending;
- (void)loadProgram;
@property(nonatomic,copy) void (^returnToLauncher)(void);
@property(nonatomic,copy) void (^revalidateProgram)(void (^completion)(BOOL));
- (BOOL)open:(NSString *)gameId session:(NSDictionary *)session device:(NSString *)device marinefordAssets:(POMarinefordScheme *)assets;
- (void)hide;
- (void)close;
@end

@implementation POWebGame
- (UIViewController *)presenter {
    UIViewController *vc=_surface.window.rootViewController;
    while(vc.presentedViewController)vc=vc.presentedViewController;
    return vc;
}
- (void)confirm:(NSString *)message action:(void (^)(void))action {
    UIAlertController *dialog=[UIAlertController alertControllerWithTitle:@"遊戲選項" message:message preferredStyle:UIAlertControllerStyleAlert];
    [dialog addAction:[UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:nil]];
    [dialog addAction:[UIAlertAction actionWithTitle:@"確定" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){action();}]];
    [[self presenter] presentViewController:dialog animated:YES completion:nil];
}
- (void)home { [self hide];if(_returnToLauncher)_returnToLauncher(); }
- (void)loadProgram {
    self.programLoadPending=YES;
    NSURL *base=[NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html?layout=responsive&tabletop_android=1"];
    [_web loadHTMLString:self.programHTML baseURL:base];
}
- (void)reload {
    [self confirm:@"重新連線？請先儲存目前進度。" action:^{
        if(!self.programHTML){[self.web reload];return;}
        if(!self.revalidateProgram)return;
        self.status.hidden=NO;self.status.text=@"正在核對遊戲版本…";
        __weak POWebGame *weakSelf=self;
        self.revalidateProgram(^(BOOL valid){
            POWebGame *view=weakSelf;
            if(!view.web)return;
            if(valid)[view loadProgram];
            else view.status.text=@"無法核對遊戲版本，請結束遊戲並回到啟動器更新後再試。";
        });
    }];
}
- (void)finish { [self confirm:@"結束遊戲？請先儲存進度或離開對戰房間。" action:^{[self close];if(self.returnToLauncher)self.returnToLauncher();}]; }
- (void)options {
    if([[self presenter] isKindOfClass:UIAlertController.class])return;
    UIAlertController *d=[UIAlertController alertControllerWithTitle:@"遊戲選項" message:nil preferredStyle:UIAlertControllerStyleAlert];
    [d addAction:[UIAlertAction actionWithTitle:@"返回啟動器" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){[self home];}]];
    [d addAction:[UIAlertAction actionWithTitle:@"重新連線" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){[self reload];}]];
    [d addAction:[UIAlertAction actionWithTitle:@"結束遊戲" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){[self finish];}]];
    [d addAction:[UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:nil]];
    [[self presenter] presentViewController:d animated:YES completion:nil];
}
- (void)optionsGesture:(UILongPressGestureRecognizer *)gesture {if(gesture.state==UIGestureRecognizerStateBegan)[self options];}
- (BOOL)open:(NSString *)gameId session:(NSDictionary *)session device:(NSString *)device marinefordAssets:(POMarinefordScheme *)assets {
    if(![@[@"card",@"chess",@"marineford"] containsObject:gameId]||![session[@"secret"] isKindOfClass:NSString.class]||![session[@"secret"] length])return NO;
    if(_web){if(![_gameId isEqualToString:gameId])return NO;_surface.hidden=NO;return YES;}
    if([gameId isEqual:@"marineford"]&&!assets)return NO;
    UIWindow *window=nil;
    for(UIScene *scene in UIApplication.sharedApplication.connectedScenes)if([scene isKindOfClass:UIWindowScene.class]&&scene.activationState==UISceneActivationStateForegroundActive)
        for(UIWindow *candidate in ((UIWindowScene *)scene).windows)if(candidate.isKeyWindow)window=candidate;
    if(!window)return NO;
    NSString *root=[NSBundle.mainBundle.resourcePath stringByAppendingPathComponent:@"launcher-web/mobile"];
    NSString *bootstrap=[NSString stringWithContentsOfFile:[root stringByAppendingPathComponent:@"session-bootstrap.js"] encoding:NSUTF8StringEncoding error:nil];
    NSString *mobile=[NSString stringWithContentsOfFile:[root stringByAppendingPathComponent:@"game-mobile.js"] encoding:NSUTF8StringEncoding error:nil];
    NSString *css=[NSString stringWithContentsOfFile:[root stringByAppendingPathComponent:@"game-mobile.css"] encoding:NSUTF8StringEncoding error:nil];
    if(!bootstrap.length||!mobile.length||!css.length)return NO;
    if([gameId isEqualToString:@"marineford"]){mobile=@"";css=@"";}
    NSString *programHTML=nil,*programBootstrap=nil;
    NSArray *programScripts=nil;
    if(assets){
        NSString *templateSource=[NSString stringWithContentsOfFile:[root stringByAppendingPathComponent:@"marineford-program.js"] encoding:NSUTF8StringEncoding error:nil];
        programHTML=[assets programHTML];programBootstrap=[assets programBootstrapSource:templateSource];programScripts=[assets programScripts];
        if(!programHTML.length||!programBootstrap.length||programScripts.count!=3)return NO;
    }
    NSDictionary *account=session[@"account"]?:@{};
    NSDictionary *values=@{@"opSecret":session[@"secret"],@"op_secret":session[@"secret"],@"op_device_id":device?:@"",
        @"op_user_id":account[@"userId"]?:@"",@"op_board_user_id":account[@"userId"]?:@"",
        @"op_name":account[@"name"]?:@"",@"op_player_name":account[@"name"]?:@"",@"op_avatar":account[@"avatar"]?:@8,@"op_player_avatar":account[@"avatar"]?:@8};
    NSString *seed=[[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:values options:0 error:nil] encoding:NSUTF8StringEncoding];
    NSString *style=[[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:@[css] options:0 error:nil] encoding:NSUTF8StringEncoding];
    WKWebViewConfiguration *config=[WKWebViewConfiguration new];
    config.applicationNameForUserAgent=@"ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)";
    if(assets){
        [config setURLSchemeHandler:assets forURLScheme:@"poasset"];
        [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:programBootstrap
            injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    }
    config.allowsInlineMediaPlayback=YES;config.mediaTypesRequiringUserActionForPlayback=WKAudiovisualMediaTypeNone;
    NSString *start=[NSString stringWithFormat:@"%@\nif(location.origin==='https://onepiece-card-online.onrender.com'){window.__tabletopSeedPrivateSession(%@);}\n%@",bootstrap,seed,mobile];
    [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:start injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:NO]];
    NSString *end=[NSString stringWithFormat:@"if(location.origin==='https://onepiece-card-online.onrender.com'){let s=document.createElement('style');s.textContent=(%@)[0];document.head.append(s);}",style];
    [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:end injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:NO]];
    for(NSString *script in programScripts)
        [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:script
            injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:YES]];
    _programHTML=programHTML;
    _gameId=gameId;_surface=[[UIView alloc] initWithFrame:window.bounds];_surface.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
    _surface.backgroundColor=[UIColor colorWithRed:.02 green:.08 blue:.12 alpha:1];[window addSubview:_surface];
    _web=[[WKWebView alloc] initWithFrame:CGRectZero configuration:config];_web.navigationDelegate=self;_web.UIDelegate=self;_web.translatesAutoresizingMaskIntoConstraints=NO;
    _web.scrollView.contentInsetAdjustmentBehavior=UIScrollViewContentInsetAdjustmentNever;[_surface addSubview:_web];
    BOOL fullscreenCard=[gameId isEqualToString:@"card"]||[gameId isEqualToString:@"marineford"];
    UIStackView *bar=[UIStackView new];bar.translatesAutoresizingMaskIntoConstraints=NO;bar.spacing=10;bar.axis=UILayoutConstraintAxisHorizontal;bar.distribution=UIStackViewDistributionFillEqually;
    NSArray *titles=@[@"啟動器",@"重新連線",@"結束遊戲"];SEL actions[]={@selector(home),@selector(reload),@selector(finish)};
    for(NSUInteger i=0;i<titles.count;i++){UIButton *b=[UIButton buttonWithType:UIButtonTypeSystem];[b setTitle:titles[i] forState:UIControlStateNormal];[b setTitleColor:UIColor.whiteColor forState:UIControlStateNormal];[b addTarget:self action:actions[i] forControlEvents:UIControlEventTouchUpInside];[bar addArrangedSubview:b];}
    bar.hidden=fullscreenCard;[_surface addSubview:bar];UILayoutGuide *safe=_surface.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[[bar.topAnchor constraintEqualToAnchor:safe.topAnchor],[bar.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-8],[bar.widthAnchor constraintEqualToConstant:300],[bar.heightAnchor constraintEqualToConstant:44],[_web.topAnchor constraintEqualToAnchor:fullscreenCard?_surface.topAnchor:bar.bottomAnchor],[_web.leadingAnchor constraintEqualToAnchor:fullscreenCard?_surface.leadingAnchor:safe.leadingAnchor],[_web.trailingAnchor constraintEqualToAnchor:fullscreenCard?_surface.trailingAnchor:safe.trailingAnchor],[_web.bottomAnchor constraintEqualToAnchor:fullscreenCard?_surface.bottomAnchor:safe.bottomAnchor]]];
    if(fullscreenCard){UILongPressGestureRecognizer *gesture=[[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(optionsGesture:)];gesture.numberOfTouchesRequired=2;gesture.minimumPressDuration=.8;gesture.cancelsTouchesInView=NO;[_surface addGestureRecognizer:gesture];}
    _status=[UILabel new];_status.text=@"正在開啟遊戲…";_status.textColor=UIColor.whiteColor;_status.backgroundColor=_surface.backgroundColor;_status.textAlignment=NSTextAlignmentCenter;_status.numberOfLines=0;_status.translatesAutoresizingMaskIntoConstraints=NO;[_surface addSubview:_status];
    [NSLayoutConstraint activateConstraints:@[[_status.centerXAnchor constraintEqualToAnchor:safe.centerXAnchor],[_status.centerYAnchor constraintEqualToAnchor:safe.centerYAnchor],[_status.widthAnchor constraintLessThanOrEqualToAnchor:safe.widthAnchor multiplier:.9]]];
    NSString *entry=[gameId isEqualToString:@"marineford"]?@"marineford/index.html":([gameId isEqualToString:@"card"]?@"start.html":@"chess/index.html");
    if(_programHTML)[self loadProgram];
    else [_web loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:[@"https://onepiece-card-online.onrender.com/" stringByAppendingFormat:@"%@?layout=responsive&tabletop_android=1",entry]]]];
    return YES;
}
- (void)hide { _surface.hidden=YES;[_web evaluateJavaScript:@"document.querySelectorAll('audio,video').forEach(m=>m.pause())" completionHandler:nil]; }
- (void)close { [_web stopLoading];[_web.configuration.userContentController removeAllUserScripts];[_surface removeFromSuperview];_surface=nil;_web=nil;_status=nil;_gameId=nil;_programHTML=nil;_programLoadPending=NO;_revalidateProgram=nil; }
- (void)webView:(WKWebView *)web decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {if(action.targetFrame.isMainFrame&&POOfficialGameURL(action.request.URL)&&[action.request.URL.path isEqualToString:@"/__mobile_game_options__"]){handler(WKNavigationActionPolicyCancel);[self options];return;}BOOL allowed=POOfficialGameURL(action.request.URL);
    if(_programHTML)allowed=action.targetFrame.isMainFrame&&
        ((allowed&&[action.request.URL.path isEqual:@"/marineford/index.html"])||
         (_programLoadPending&&[action.request.URL.absoluteString isEqual:@"about:blank"]));
    handler(allowed?WKNavigationActionPolicyAllow:WKNavigationActionPolicyCancel);}
- (void)webView:(WKWebView *)web didFinishNavigation:(WKNavigation *)navigation {_programLoadPending=NO;_status.hidden=YES;}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)nav withError:(NSError *)error {if(error.code==NSURLErrorCancelled)return;_status.hidden=NO;_status.text=([_gameId isEqualToString:@"card"]||[_gameId isEqualToString:@"marineford"])?@"網路連線失敗，請用兩指長按畫面開啟遊戲選項，選擇重新連線。":@"網路連線失敗，請點右上「重新連線」。";}
- (void)webView:(WKWebView *)web didFailNavigation:(WKNavigation *)nav withError:(NSError *)error {[self webView:web didFailProvisionalNavigation:nav withError:error];}
- (void)webViewWebContentProcessDidTerminate:(WKWebView *)web {_status.hidden=NO;_status.text=([_gameId isEqualToString:@"card"]||[_gameId isEqualToString:@"marineford"])?@"遊戲頁面已暫停，請用兩指長按畫面開啟遊戲選項，選擇重新連線。":@"遊戲頁面已暫停，請點右上「重新連線」。";}
- (void)webView:(WKWebView *)web runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completion {
    UIAlertController *d=[UIAlertController alertControllerWithTitle:nil message:message preferredStyle:UIAlertControllerStyleAlert];[d addAction:[UIAlertAction actionWithTitle:@"確定" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){completion();}]];[[self presenter] presentViewController:d animated:YES completion:nil];
}
- (void)webView:(WKWebView *)web runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL))completion {
    UIAlertController *d=[UIAlertController alertControllerWithTitle:nil message:message preferredStyle:UIAlertControllerStyleAlert];[d addAction:[UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:^(UIAlertAction *a){completion(NO);}]];[d addAction:[UIAlertAction actionWithTitle:@"確定" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){completion(YES);}]];[[self presenter] presentViewController:d animated:YES completion:nil];
}
- (void)webView:(WKWebView *)web runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt defaultText:(NSString *)text initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSString *))completion {
    UIAlertController *d=[UIAlertController alertControllerWithTitle:nil message:prompt preferredStyle:UIAlertControllerStyleAlert];[d addTextFieldWithConfigurationHandler:^(UITextField *f){f.text=text;}];[d addAction:[UIAlertAction actionWithTitle:@"取消" style:UIAlertActionStyleCancel handler:^(UIAlertAction *a){completion(nil);}]];[d addAction:[UIAlertAction actionWithTitle:@"確定" style:UIAlertActionStyleDefault handler:^(UIAlertAction *a){completion(d.textFields.firstObject.text);}]];[[self presenter] presentViewController:d animated:YES completion:nil];
}
@end
