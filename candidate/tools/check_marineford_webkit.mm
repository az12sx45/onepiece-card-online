#import <Cocoa/Cocoa.h>
#include "po_marineford_store.h"
#include "po_web_game_policy.h"

static BOOL Await(BOOL (^condition)(void)) {
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:12];
    while (!condition() && deadline.timeIntervalSinceNow > 0)
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.05]];
    return condition();
}

static NSDictionary *Row(NSString *path, NSData *bytes) {
    return @{@"path":path, @"kind":@"image", @"mime":@"image/webp",
        @"size":@(bytes.length), @"sha256":POMarinefordSHA256(bytes)};
}

static NSData *Manifest(NSArray *rows) {
    return [NSJSONSerialization dataWithJSONObject:@{@"schema":@1,@"gameId":@"marineford",@"assets":rows}
        options:0 error:nil];
}

@interface FixtureTransport : PODownloader
@property(nonatomic,copy) NSData *manifest;
@property(nonatomic,copy) NSDictionary *source;
@property(nonatomic,strong) NSMutableArray *requests;
@end

@implementation FixtureTransport
- (BOOL)beginMarinefordManifest:(NSString *)identifier destination:(NSString *)destination {
    return [self.manifest writeToFile:destination options:0 error:nil];
}
- (BOOL)begin:(NSString *)identifier digest:(NSString *)digest destination:(NSString *)destination size:(long long)size {
    [self.requests addObject:digest];
    NSData *data = self.source[digest];
    return data.length == size && [data writeToFile:destination options:0 error:nil];
}
- (NSDictionary *)poll:(NSString *)identifier { return @{@"state":@"complete"}; }
- (void)forget:(NSString *)identifier {}
@end

@interface MediaProbe : NSObject <WKScriptMessageHandler>
@property(nonatomic,strong) NSArray *result;
@end

@implementation MediaProbe
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    if ([message.body isKindOfClass:NSArray.class]) self.result = message.body;
}
@end

static BOOL ProbeWebKit(POMarinefordScheme *scheme) {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    NSWindow *window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,400,300)
        styleMask:NSWindowStyleMaskBorderless backing:NSBackingStoreBuffered defer:NO];
    WKWebViewConfiguration *config = [WKWebViewConfiguration new];
    [config setURLSchemeHandler:scheme forURLScheme:@"poasset"];
    MediaProbe *probe = [MediaProbe new];
    [config.userContentController addScriptMessageHandler:probe name:@"result"];
    WKWebView *web = [[WKWebView alloc] initWithFrame:window.contentView.bounds configuration:config];
    window.contentView = web;
    [window orderFront:nil];
    NSString *html = @"<!doctype html><script>"
        @"const image=u=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);i.src=u;});"
        @"Promise.all([image('poasset://marineford/marineford/art/a.webp'),image('poasset://marineford/marineford/art/missing.webp'),image('poasset://foreign/marineford/art/a.webp')]).then(result=>webkit.messageHandlers.result.postMessage(result));"
        @"</script>";
    NSURL *entry = [NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html"];
    if (!POOfficialGameURL(entry)) return NO;
    [web loadHTMLString:html baseURL:entry];
    BOOL ok = Await(^BOOL{ return probe.result != nil; }) && [probe.result isEqual:@[@YES,@NO,@NO]];
    [config.userContentController removeScriptMessageHandlerForName:@"result"];
    return ok;
}

#define CHECK(condition, label) do { if (!(condition)) { NSLog(@"FAIL %s", label); return 1; } } while (0)
static int Run(NSString *assetRoot, NSString *root) {
    NSData *a = [NSData dataWithContentsOfFile:[assetRoot stringByAppendingPathComponent:
        @"launcher-assets/images/game_launcher/launcher_marineford_cover_v2.webp"]];
    NSData *b = [NSData dataWithContentsOfFile:[assetRoot stringByAppendingPathComponent:
        @"launcher-assets/images/game_launcher/launcher_marineford_box_v3.webp"]];
    CHECK(a.length && b.length, "v064 fixture media");
    NSDictionary *cover = Row(POMarinefordCover, [@"cover" dataUsingEncoding:NSUTF8StringEncoding]);
    NSDictionary *first = Row(@"marineford/art/a.webp", a), *second = Row(@"marineford/art/b.webp", b);
    NSData *initial = Manifest(@[cover,first]);
    CHECK(!POMarinefordPackage(Manifest(@[cover,first,first])), "duplicate logical path");
    CHECK(!POMarinefordPackage(Manifest(@[cover,Row(@"marineford/art/../a.webp", a)])), "path escape");
    CHECK(!POMarinefordPackage(Manifest(@[first,second])), "required cover row");

    FixtureTransport *transport = [FixtureTransport new];
    transport.requests = [NSMutableArray array];
    transport.manifest = initial;
    transport.source = @{first[@"sha256"]:a, second[@"sha256"]:b};
    POMarinefordStore *store = [[POMarinefordStore alloc] initWithRoot:root transport:transport];
    [store refresh];
    CHECK(Await(^BOOL{ return !store.job; }) && [[store state][@"status"] isEqual:@"missing"] && !transport.requests.count,
        "cold discovery");
    CHECK(![store prepareLaunch:^(POMarinefordScheme *scheme){}], "cold launch gate");
    CHECK([store install] && Await(^BOOL{ return !store.job; }) && [[store state][@"status"] isEqual:@"installed"],
        "cold install");
    CHECK([transport.requests isEqual:@[first[@"sha256"]]], "only art blob fetched");
    __block POMarinefordScheme *resolved = nil;
    CHECK([store prepareLaunch:^(POMarinefordScheme *scheme){ resolved = scheme; }] &&
        Await(^BOOL{ return resolved != nil; }), "launch with verified manifest");
    CHECK(ProbeWebKit(resolved), "actual WebKit custom scheme images and allowlist");
    CHECK([store install] && Await(^BOOL{ return !store.job; }) && transport.requests.count == 1,
        "warm install reuses cache");
    NSString *cached = POMarinefordBlobFile(root, first[@"sha256"]);
    NSMutableData *corruption = [a mutableCopy];
    ((unsigned char *)corruption.mutableBytes)[0] ^= 0x01;
    CHECK([corruption writeToFile:cached options:NSDataWritingAtomic error:nil], "same-size corruption fixture");
    __block BOOL checked = NO, rejected = NO;
    CHECK([store prepareLaunch:^(POMarinefordScheme *scheme){ checked = YES; rejected = scheme == nil; }] &&
        Await(^BOOL{ return checked; }) && rejected && [[store state][@"status"] isEqual:@"repair"], "corruption blocks launch");
    CHECK([store install] && Await(^BOOL{ return !store.job; }) &&
        [transport.requests.lastObject isEqual:first[@"sha256"]] && transport.requests.count == 2 &&
        [[store state][@"status"] isEqual:@"installed"], "repair fetches only corrupt hash");

    transport.manifest = Manifest(@[cover,first,second]);
    store.lastCheck = nil;
    [store refresh];
    CHECK(Await(^BOOL{ return !store.job; }) && [[store state][@"status"] isEqual:@"update"] &&
        ![store prepareLaunch:^(POMarinefordScheme *scheme){}], "changed version requires update");
    CHECK([store install] && Await(^BOOL{ return !store.job; }) &&
        [transport.requests.lastObject isEqual:second[@"sha256"]] && transport.requests.count == 3 &&
        [[store state][@"status"] isEqual:@"installed"], "delta fetches only new hash");
    CHECK([store uninstall] && Await(^BOOL{ return !store.job; }) && [[store state][@"status"] isEqual:@"missing"],
        "remove local game package");
    [store close];
    puts("PASS Marineford native cache cold, warm, repair, delta, removal and actual WKWebView media scheme");
    return 0;
}

int main(int argc, char **argv) {
    @autoreleasepool {
        if (argc != 2) return 2;
        NSString *root = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
        int result = Run([NSString stringWithUTF8String:argv[1]], root);
        [NSFileManager.defaultManager removeItemAtPath:root error:nil];
        return result;
    }
}
