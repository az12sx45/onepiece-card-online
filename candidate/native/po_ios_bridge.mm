#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#include <cmath>
#include <functional>
#include <godot_cpp/godot.hpp>
#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/string.hpp>
#include "po_ios_download.h"
#include "po_ios_launcher.h"
#include "po_ios_web_game.h"

using namespace godot;
static NSString *ns(const String &value) { return [NSString stringWithUTF8String:value.utf8().get_data()]; }
static String gs(NSString *value) { return String(value.UTF8String ?: ""); }
static String json(id value) {
    NSData *data=[NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    return gs(data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{\"ok\":false}");
}
static void ui(const std::function<void()> &fn) {
    if ([NSThread isMainThread]) fn(); else dispatch_sync(dispatch_get_main_queue(), ^{fn();});
}
static NSMutableDictionary *key_query(NSString *account) {
    return [@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,
              (__bridge id)kSecAttrService:@"tw.rihdi.po.native.session.v1",
              (__bridge id)kSecAttrAccount:account} mutableCopy];
}
static NSDictionary *read_key(NSString *key, bool &ok) {
    NSMutableDictionary *query=key_query(key);
    query[(__bridge id)kSecReturnData]=@YES;
    query[(__bridge id)kSecMatchLimit]=(__bridge id)kSecMatchLimitOne;
    CFTypeRef raw=nullptr;
    OSStatus status=SecItemCopyMatching((__bridge CFDictionaryRef)query,&raw);
    ok=status==errSecSuccess||status==errSecItemNotFound;
    if(status==errSecItemNotFound)return @{};
    if(status!=errSecSuccess)return nil;
    NSData *data=CFBridgingRelease(raw);
    id result=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    ok=[result isKindOfClass:[NSDictionary class]];
    return ok ? result : nil;
}
static bool save_key(NSString *key, NSDictionary *value) {
    NSData *data=[NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
    if(!data)return false;
    NSMutableDictionary *query=key_query(key);
    NSDictionary *attributes=@{(__bridge id)kSecValueData:data,
        (__bridge id)kSecAttrAccessible:(__bridge id)kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly};
    OSStatus status=SecItemUpdate((__bridge CFDictionaryRef)query,(__bridge CFDictionaryRef)attributes);
    if(status==errSecItemNotFound){[query addEntriesFromDictionary:attributes];status=SecItemAdd((__bridge CFDictionaryRef)query,nullptr);}
    return status==errSecSuccess;
}

@interface POVideoSurface : UIView
@property(nonatomic,strong) AVPlayer *player;
@property(nonatomic,strong) AVPlayerLayer *video;
@property(nonatomic,strong) UILabel *caption;
@property(nonatomic,strong) UILabel *kicker;
@property(nonatomic,strong) CAGradientLayer *shade;
@property(nonatomic,strong) CAGradientLayer *vignette;
@property(nonatomic) BOOL futureSight;
@property(nonatomic) BOOL started;
@property(nonatomic) BOOL ended;
@property(nonatomic) BOOL seeking;
@property(nonatomic) double startSeconds;
@end
@implementation POVideoSurface
- (void)finished:(NSNotification *)notification { if(notification.object==self.player.currentItem)self.ended=YES; }
- (void)dealloc { [[NSNotificationCenter defaultCenter] removeObserver:self]; }
- (void)layoutSubviews {
    [super layoutSubviews]; self.video.frame=self.bounds;
    CGFloat scale=MIN(self.bounds.size.width/960.0,self.bounds.size.height/432.0);
    self.shade.frame=self.bounds;self.vignette.frame=self.bounds;
    self.caption.frame=CGRectMake(24*scale,self.bounds.size.height-84*scale,self.bounds.size.width-48*scale,60*scale);
    self.kicker.frame=CGRectMake(24*scale,self.bounds.size.height-113*scale,self.bounds.size.width-48*scale,24*scale);
    if(self.futureSight){
        NSShadow *shadow=[[NSShadow alloc] init];shadow.shadowColor=UIColor.blackColor;shadow.shadowBlurRadius=14*scale;shadow.shadowOffset=CGSizeMake(0,3*scale);
        NSString *title=self.caption.text?:@"";
        self.caption.attributedText=[[NSAttributedString alloc] initWithString:title attributes:@{NSFontAttributeName:[UIFont boldSystemFontOfSize:42*scale],NSKernAttributeName:@(5.04*scale),NSShadowAttributeName:shadow}];
        self.kicker.attributedText=[[NSAttributedString alloc] initWithString:@"見聞色霸氣" attributes:@{NSFontAttributeName:[UIFont boldSystemFontOfSize:16*scale],NSKernAttributeName:@(5.12*scale),NSShadowAttributeName:shadow}];
    }
}
@end

class PoIOSBridge : public RefCounted {
    GDCLASS(PoIOSBridge,RefCounted);
    __strong POVideoSurface *surface=nil;
    __strong PODownloader *downloader=nil;
    __strong POLauncher *launcher=nil;
    __strong POWebGame *webGame=nil;
protected:
    static void _bind_methods() {
        ClassDB::bind_method(D_METHOD("session_request","method","arguments"),&PoIOSBridge::session_request);
        ClassDB::bind_method(D_METHOD("display_scale"),&PoIOSBridge::display_scale);
        ClassDB::bind_method(D_METHOD("video_play","configuration"),&PoIOSBridge::video_play);
        ClassDB::bind_method(D_METHOD("video_pause"),&PoIOSBridge::video_pause);
        ClassDB::bind_method(D_METHOD("video_remove"),&PoIOSBridge::video_remove);
        ClassDB::bind_method(D_METHOD("video_opacity","value"),&PoIOSBridge::video_opacity);
        ClassDB::bind_method(D_METHOD("video_volume","value"),&PoIOSBridge::video_volume);
        ClassDB::bind_method(D_METHOD("video_state"),&PoIOSBridge::video_state);
        ClassDB::bind_method(D_METHOD("download_begin","identifier","digest","destination","size"),&PoIOSBridge::download_begin);
        ClassDB::bind_method(D_METHOD("download_poll","identifier"),&PoIOSBridge::download_poll);
        ClassDB::bind_method(D_METHOD("download_forget","identifier"),&PoIOSBridge::download_forget);
        ClassDB::bind_method(D_METHOD("launcher_show","reload"),&PoIOSBridge::launcher_show);
        ClassDB::bind_method(D_METHOD("launcher_hide"),&PoIOSBridge::launcher_hide);
        ClassDB::bind_method(D_METHOD("launcher_requests"),&PoIOSBridge::launcher_requests);
        ClassDB::bind_method(D_METHOD("launcher_reply","identifier","result"),&PoIOSBridge::launcher_reply);
        ClassDB::bind_method(D_METHOD("web_game_open","game_id"),&PoIOSBridge::web_game_open);
        ClassDB::bind_method(D_METHOD("web_game_active"),&PoIOSBridge::web_game_active);
        ClassDB::bind_method(D_METHOD("open_settings"),&PoIOSBridge::open_settings);
    }
public:
    ~PoIOSBridge() override { [downloader close]; video_remove(); ui([&]{[webGame close];webGame=nil;[launcher close];launcher=nil;}); }
    String web_game_active(){String value;ui([&]{value=gs(webGame.gameId);});return value;}
    bool web_game_open(const String &game_id){
        bool ok=false;NSDictionary *session=read_key(@"session",ok);if(!ok)return false;
        NSDictionary *device=read_key(@"device",ok);if(!ok)return false;
        bool opened=false;ui([&]{
            if(!webGame){webGame=[POWebGame new];__weak POLauncher *retainedLauncher=launcher;webGame.returnToLauncher=^{[retainedLauncher show:NO];};}
            opened=[webGame open:ns(game_id) session:session device:device[@"deviceId"]];if(opened)[launcher hide];
        });return opened;
    }
    bool open_settings(){bool available=false;ui([&]{NSURL *url=[NSURL URLWithString:UIApplicationOpenSettingsURLString];available=[UIApplication.sharedApplication canOpenURL:url];if(available)[UIApplication.sharedApplication openURL:url options:@{} completionHandler:nil];});return available;}
    bool launcher_show(bool reload){bool ok=false;ui([&]{if(!launcher)launcher=[POLauncher new];ok=[launcher show:reload];});return ok;}
    void launcher_hide(){ui([&]{[launcher hide];});}
    String launcher_requests(){String value;ui([&]{value=json([launcher takeRequests]?:@[]);});return value;}
    void launcher_reply(const String &identifier,const String &result){
        id parsed=[NSJSONSerialization JSONObjectWithData:[ns(result) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        if(![parsed isKindOfClass:NSDictionary.class])return;
        ui([&]{[launcher reply:ns(identifier) result:parsed];});
    }
    bool download_begin(const String &identifier,const String &digest,const String &destination,int64_t size){
        if(!downloader)downloader=[[PODownloader alloc] init];
        return [downloader begin:ns(identifier) digest:ns(digest) destination:ns(destination) size:size];
    }
    String download_poll(const String &identifier){return json([downloader poll:ns(identifier)]?:@{@"state":@"failed"});}
    void download_forget(const String &identifier){[downloader forget:ns(identifier)];}
    String session_request(const String &method,const String &arguments) {
        NSDictionary *failure=@{@"ok":@NO,@"error":@"secure_storage_unavailable"};
        if(arguments.length()>131072)return json(failure);
        id input=[NSJSONSerialization JSONObjectWithData:[ns(arguments) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        if(![input isKindOfClass:[NSDictionary class]])return json(failure);
        bool ok=false;
        if(method=="getNativeState") {
            NSDictionary *device=read_key(@"device",ok);if(!ok)return json(failure);
            if(!device[@"deviceId"]){device=@{@"deviceId":[@"ios-" stringByAppendingString:NSUUID.UUID.UUIDString]};if(!save_key(@"device",device))return json(failure);}
            NSDictionary *session=read_key(@"session",ok);if(!ok)return json(failure);
            return json(@{@"ok":@YES,@"account":session[@"account"]?:NSNull.null,@"secret":session[@"secret"]?:@"",
                @"appVersion":[@"iOS " stringByAppendingString:[NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleVersion"]?:@""],
                @"deviceId":device[@"deviceId"],@"preferences":@{@"gameDisplayMode":@"fullscreen",@"minimizeToTrayOnGameLaunch":@NO}});
        }
        if(method=="saveSession") {
            NSDictionary *account=input[@"account"];NSString *secret=input[@"secret"];
            if(![account isKindOfClass:NSDictionary.class]||![secret isKindOfClass:NSString.class]||secret.length==0||secret.length>8192)return json(failure);
            NSMutableDictionary *clean=[NSMutableDictionary dictionary];
            for(NSString *field in @[@"username",@"userId",@"name",@"avatar",@"launcherAvatar",@"title",@"coins",@"needsDisplayName"]){if(account[field])clean[field]=account[field];}
            return json(save_key(@"session",@{@"account":clean,@"secret":secret})?@{@"ok":@YES}:failure);
        }
        if(method=="clearSession") {
            ui([&]{[webGame close];});
            OSStatus result=SecItemDelete((__bridge CFDictionaryRef)key_query(@"session"));
            return json(result==errSecSuccess||result==errSecItemNotFound ? @{@"ok":@YES}:failure);
        }
        return json(failure);
    }
    double display_scale() { double value=1;ui([&]{value=UIScreen.mainScreen.scale;});return value; }
    bool video_play(const String &configuration) {
        id config=[NSJSONSerialization JSONObjectWithData:[ns(configuration) dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        if(![config isKindOfClass:NSDictionary.class]||![config[@"file"] isKindOfClass:NSString.class])return false;
        NSString *path=[config[@"file"] stringByStandardizingPath];
        if(![path hasPrefix:[NSHomeDirectory() stringByAppendingString:@"/"]]||![[NSFileManager defaultManager] fileExistsAtPath:path])return false;
        bool success=false;
        ui([&]{
            UIWindow *window=nil;
            for(UIScene *scene in UIApplication.sharedApplication.connectedScenes){
                if([scene isKindOfClass:UIWindowScene.class] && scene.activationState==UISceneActivationStateForegroundActive){
                    for(UIWindow *candidate in ((UIWindowScene *)scene).windows)if(candidate.isKeyWindow){window=candidate;break;}
                }
            }
            if(!window)return;
            [surface.player pause];[surface removeFromSuperview];
            surface=[[POVideoSurface alloc] initWithFrame:window.bounds];
            surface.userInteractionEnabled=NO;surface.backgroundColor=UIColor.blackColor;
            surface.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
            surface.player=[AVPlayer playerWithURL:[NSURL fileURLWithPath:path]];
            [[NSNotificationCenter defaultCenter] addObserver:surface selector:@selector(finished:) name:AVPlayerItemDidPlayToEndTimeNotification object:surface.player.currentItem];
            surface.player.muted=[config[@"muted"] boolValue];
            surface.video=[AVPlayerLayer playerLayerWithPlayer:surface.player];
            surface.video.videoGravity=[config[@"cover"] boolValue]?AVLayerVideoGravityResizeAspectFill:AVLayerVideoGravityResizeAspect;
            [surface.layer addSublayer:surface.video];
            surface.futureSight=[config[@"futureSight"] boolValue];
            if(surface.futureSight){
                surface.shade=[CAGradientLayer layer];
                surface.shade.colors=@[(id)[UIColor colorWithWhite:0 alpha:87.0/255].CGColor,(id)UIColor.clearColor.CGColor,(id)UIColor.clearColor.CGColor,(id)[UIColor colorWithWhite:0 alpha:209.0/255].CGColor];
                surface.shade.locations=@[@0,@0.26,@0.68,@1];[surface.layer addSublayer:surface.shade];
                surface.vignette=[CAGradientLayer layer];surface.vignette.type=kCAGradientLayerRadial;
                surface.vignette.startPoint=CGPointMake(0.5,0.44);surface.vignette.endPoint=CGPointMake(1,1);
                surface.vignette.colors=@[(id)UIColor.clearColor.CGColor,(id)UIColor.clearColor.CGColor,(id)[UIColor colorWithRed:38.0/255 green:0 blue:16.0/255 alpha:0.2].CGColor,(id)[UIColor colorWithRed:2.0/255 green:0 blue:7.0/255 alpha:209.0/255].CGColor];
                surface.vignette.locations=@[@0,@0.36,@0.68,@1];[surface.layer addSublayer:surface.vignette];
            }
            surface.caption=[[UILabel alloc] initWithFrame:CGRectZero];
            surface.caption.text=[config[@"title"] isKindOfClass:NSString.class]?config[@"title"]:@"";
            surface.caption.textColor=UIColor.whiteColor;surface.caption.textAlignment=NSTextAlignmentCenter;
            surface.caption.font=[UIFont boldSystemFontOfSize:20];surface.caption.numberOfLines=2;
            [surface addSubview:surface.caption];
            surface.kicker=[[UILabel alloc] initWithFrame:CGRectZero];surface.kicker.textAlignment=NSTextAlignmentCenter;
            surface.kicker.textColor=[UIColor colorWithRed:1 green:142.0/255 blue:168.0/255 alpha:1];
            [surface addSubview:surface.kicker];
            surface.startSeconds=MAX(0,[config[@"start"] doubleValue]);surface.seeking=YES;
            [window addSubview:surface];[surface setNeedsLayout];success=true;
        });
        return success;
    }
    void video_pause(){ui([&]{[surface.player pause];});}
    void video_remove(){ui([&]{[surface.player pause];[surface removeFromSuperview];surface=nil;});}
    void video_opacity(double value){ui([&]{surface.alpha=MAX(0,MIN(1,value));});}
    void video_volume(double value){ui([&]{surface.player.volume=MAX(0,MIN(1,value));});}
    String video_state(){
        NSDictionary *state=@{@"readyState":@0};
        ui([&]{
            if(!surface)return;
            AVPlayer *player=surface.player;AVPlayerItem *item=player.currentItem;
            bool ready=item.status==AVPlayerItemStatusReadyToPlay;
            double duration=CMTimeGetSeconds(item.duration);if(!std::isfinite(duration))duration=0;
            if(ready&&surface.seeking){surface.seeking=NO;[player seekToTime:CMTimeMakeWithSeconds(MIN(surface.startSeconds,MAX(0,duration-0.1)),600)];[player play];}
            double position=CMTimeGetSeconds(player.currentTime);if(!std::isfinite(position))position=0;
            if(player.timeControlStatus==AVPlayerTimeControlStatusPlaying)surface.started=YES;
            bool ended=surface.ended;
            state=@{@"duration":@(duration),@"currentTime":@(position),@"width":@(item.presentationSize.width),@"height":@(item.presentationSize.height),
                @"readyState":@(ready?4:0),@"paused":@(player.rate==0),@"started":@(surface.started),@"ended":@(ended),@"failed":@(item.status==AVPlayerItemStatusFailed)};
        });
        return json(state);
    }
};

static void initialize(ModuleInitializationLevel level){if(level==MODULE_INITIALIZATION_LEVEL_SCENE)ClassDB::register_class<PoIOSBridge>();}
static void terminate(ModuleInitializationLevel){}
extern "C" GDExtensionBool GDE_EXPORT po_ios_bridge_init(GDExtensionInterfaceGetProcAddress get_proc,GDExtensionClassLibraryPtr library,GDExtensionInitialization *initialization){
    GDExtensionBinding::InitObject init(get_proc,library,initialization);
    init.register_initializer(initialize);init.register_terminator(terminate);init.set_minimum_library_initialization_level(MODULE_INITIALIZATION_LEVEL_SCENE);return init.init();
}
