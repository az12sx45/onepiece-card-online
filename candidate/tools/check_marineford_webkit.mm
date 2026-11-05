#import <Cocoa/Cocoa.h>
#include "po_marineford_store.h"

static BOOL Await(BOOL (^condition)(void)) {
    NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:12];
    while(!condition()&&deadline.timeIntervalSinceNow>0)
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.05]];
    return condition();
}
static NSData *Read(NSString *root,NSString *name) {
    return [NSData dataWithContentsOfFile:[root stringByAppendingPathComponent:name]];
}
@interface FixtureTransport : PODownloader
@property(nonatomic,copy) NSString *fixtures;
@property(nonatomic) NSUInteger version;
@property(nonatomic) BOOL rejectProof;
@property(atomic) BOOL hold;
@property(nonatomic,strong) NSMutableArray *requests;
@end
@implementation FixtureTransport
- (BOOL)copyMetadata:(NSString *)name destination:(NSString *)destination {
    return [Read(self.fixtures,name) writeToFile:destination options:0 error:nil];
}
- (BOOL)beginMarinefordRelease:(NSString *)identifier destination:(NSString *)destination {
    return [self copyMetadata:[NSString stringWithFormat:@"pointer-%lu.json",(unsigned long)self.version] destination:destination];
}
- (BOOL)beginMarinefordProgramManifest:(NSString *)path identifier:(NSString *)identifier destination:(NSString *)destination {
    NSDictionary *pointer=POMarinefordRelease(Read(self.fixtures,[NSString stringWithFormat:@"pointer-%lu.json",(unsigned long)self.version]));
    return [path isEqual:pointer[@"manifestPath"]]&&[self copyMetadata:[NSString stringWithFormat:@"manifest-%lu.json",(unsigned long)self.version] destination:destination];
}
- (BOOL)beginMarinefordProof:(NSString *)identifier destination:(NSString *)destination {
    return !self.rejectProof&&[self copyMetadata:[NSString stringWithFormat:@"proof-%lu.json",(unsigned long)self.version] destination:destination];
}
- (BOOL)begin:(NSString *)identifier digest:(NSString *)digest destination:(NSString *)destination size:(long long)size {
    [self.requests addObject:digest];
    NSData *data=Read([self.fixtures stringByAppendingPathComponent:@"source"],digest);
    return data.length==size&&[data writeToFile:destination options:0 error:nil];
}
- (NSDictionary *)poll:(NSString *)identifier {return @{@"state":self.hold?@"pending":@"complete"};}
- (void)forget:(NSString *)identifier {}
@end

@interface ProgramProbe : NSObject <WKScriptMessageHandler,WKNavigationDelegate>
@property(nonatomic,strong) NSMutableArray *results;
@property(nonatomic) BOOL failed;
@end
@implementation ProgramProbe
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    if([message.body isKindOfClass:NSDictionary.class])[self.results addObject:message.body];
}
- (void)webView:(WKWebView *)web decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    BOOL good=POOfficialGameURL(action.request.URL)&&[action.request.URL.path isEqual:@"/marineford/index.html"];
    handler(good?WKNavigationActionPolicyAllow:WKNavigationActionPolicyCancel);
    if(!good)self.failed=YES;
}
- (void)webView:(WKWebView *)web didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {self.failed=YES;}
@end

static BOOL ProbeProgram(POMarinefordScheme *scheme,NSString *assets) {
    NSString *templateSource=[[NSString alloc] initWithData:Read(assets,@"mobile/marineford-program.js") encoding:NSUTF8StringEncoding];
    NSString *bootstrap=[scheme programBootstrapSource:templateSource],*html=[scheme programHTML];
    NSArray *scripts=[scheme programScripts];
    if(!bootstrap.length||!html.length||scripts.count!=3||[html containsString:@"src=\"marineford.js"])return NO;
    if(![html containsString:@"url(\"poasset://marineford/marineford/art/v2/test-a.webp\")"])return NO;
    [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    WKWebViewConfiguration *config=[WKWebViewConfiguration new];
    config.websiteDataStore=WKWebsiteDataStore.nonPersistentDataStore;
    [config setURLSchemeHandler:scheme forURLScheme:@"poasset"];
    ProgramProbe *probe=[ProgramProbe new];probe.results=[NSMutableArray array];
    [config.userContentController addScriptMessageHandler:probe name:@"result"];
    [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:bootstrap injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    NSString *session=[[NSString alloc] initWithData:Read(assets,@"mobile/session-bootstrap.js") encoding:NSUTF8StringEncoding];
    session=[session stringByAppendingString:@"\nif(location.origin==='https://onepiece-card-online.onrender.com'){window.__tabletopSeedPrivateSession({opSecret:'fixture-secret'});}"];
    [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:session injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
    for(NSString *script in scripts)[config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:script injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:YES]];
    WKWebView *web=[[WKWebView alloc] initWithFrame:NSMakeRect(0,0,740,360) configuration:config];web.navigationDelegate=probe;
    NSWindow *window=[[NSWindow alloc] initWithContentRect:NSMakeRect(0,0,740,360) styleMask:NSWindowStyleMaskBorderless backing:NSBackingStoreBuffered defer:NO];
    window.contentView=web;[window orderFront:nil];
    NSURL *entry=[NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html?layout=responsive&tabletop_android=1"];
    for(NSUInteger pass=0;pass<2;++pass) {
        [web loadHTMLString:html baseURL:entry];
        if(!Await(^BOOL{return probe.results.count>pass||probe.failed;}))return NO;
        NSDictionary *value=probe.results[pass];
        if(probe.failed||value[@"error"]||![value[@"origin"] isEqual:@"https://onepiece-card-online.onrender.com"]||
            ![value[@"version"] isEqual:@1]||![value[@"secret"] boolValue]||![value[@"marker"] boolValue]||
            ![value[@"sound"] boolValue]||![value[@"previous"] isEqual:@(pass)]||
            ![value[@"socket"] isEqual:@"https://onepiece-card-online.onrender.com"]||
            ![value[@"avatar"] isEqual:@"poasset://marineford/images/board/avatars/8.webp"]||
            ![value[@"art"] isEqual:@"poasset://marineford/marineford/art/v2/test-a.webp"])return NO;
    }
    [config.userContentController removeScriptMessageHandlerForName:@"result"];
    return YES;
}
#define CHECK(condition,label) do {if(!(condition)){NSLog(@"FAIL %s",label);return 1;}}while(0)

static int Run(NSString *assets,NSString *fixtures,NSString *canonical,NSString *root) {
    NSDictionary *golden=POMarinefordProgramPackage(Read(canonical,@"marineford-package-v1.json"),Read(canonical,@"marineford-release-v1.json"));
    CHECK(golden&&[golden[@"files"] count]==375,"independent canonical 375-row manifest");
    NSData *reference=Read(fixtures,@"pointer-1.json"),*manifest=Read(fixtures,@"manifest-1.json");
    NSDictionary *package=POMarinefordProgramPackage(manifest,reference);
    CHECK(package&&[package[@"files"] count]==8,"independent small manifest");
    NSMutableData *bad=[manifest mutableCopy];((unsigned char *)bad.mutableBytes)[0]^=1;
    CHECK(!POMarinefordProgramPackage(bad,reference),"manifest digest mismatch");
    CHECK(!POMarinefordRelease([@"{}" dataUsingEncoding:NSUTF8StringEncoding]),"invalid release rejected");
    CHECK(!POMarinefordRuntimeProof(Read(fixtures,@"proof-2.json"),package),"wrong server proof rejected");
    FixtureTransport *transport=[FixtureTransport new];
    transport.fixtures=fixtures;transport.version=1;transport.requests=[NSMutableArray array];
    POMarinefordStore *store=[[POMarinefordStore alloc] initWithRoot:[root stringByAppendingPathComponent:@"cold"] transport:transport];
    [store refresh];
    CHECK(Await(^BOOL{return !store.job;})&&[[store state][@"status"] isEqual:@"missing"],"cold metadata discovery");
    CHECK(![store prepareLaunch:^(POMarinefordScheme *s){}],"cold launch denied");
    CHECK([store install]&&Await(^BOOL{return !store.job;})&&store.healthy&&transport.requests.count==8,"cold downloads all program and media blobs");
    __block POMarinefordScheme *scheme=nil;
    CHECK([store prepareLaunch:^(POMarinefordScheme *s){scheme=s;}]&&Await(^BOOL{return !store.preparingLaunch;})&&scheme,"server proof and verified launch");
    CHECK(ProbeProgram(scheme,assets),"actual WKWebView local program CSS cards avatars storage auth socket and reload");
    CHECK([store install]&&Await(^BOOL{return !store.job;})&&transport.requests.count==8,"warm no content transfer");
    NSDictionary *script=store.installed[@"files"][@"marineford/marineford.js"];
    NSString *scriptFile=POMarinefordBlobFile(store.root,script[@"sha256"]);
    NSMutableData *corrupt=[[NSData dataWithContentsOfFile:scriptFile] mutableCopy];
    ((unsigned char *)corrupt.mutableBytes)[0]^=1;
    CHECK([corrupt writeToFile:scriptFile options:NSDataWritingAtomic error:nil],"same-size program corruption fixture");
    __block BOOL finished=NO;scheme=nil;
    CHECK([store prepareLaunch:^(POMarinefordScheme *s){scheme=s;finished=YES;}]&&Await(^BOOL{return finished;})&&!scheme,"corrupt program blocks launch");
    CHECK([store install]&&Await(^BOOL{return !store.job;})&&transport.requests.count==9&&store.healthy,"repair one corrupted script");
    NSData *saved=[NSData dataWithContentsOfFile:[store.root stringByAppendingPathComponent:@"manifest.json"]];
    transport.version=2;store.lastCheck=nil;[store refresh];
    CHECK(Await(^BOOL{return !store.job;})&&[[store state][@"status"] isEqual:@"update"],"new program data version offered");
    transport.hold=YES;
    CHECK([store install]&&[store cancel]&&Await(^BOOL{return !store.job;})&&
        [saved isEqual:[NSData dataWithContentsOfFile:[store.root stringByAppendingPathComponent:@"manifest.json"]]],"cancel preserves installed receipt");
    transport.hold=NO;
    CHECK([store install]&&Await(^BOOL{return !store.job;})&&transport.requests.count==10,"delta one changed cards payload");
    transport.rejectProof=YES;finished=NO;scheme=nil;
    CHECK([store prepareLaunch:^(POMarinefordScheme *s){scheme=s;finished=YES;}]&&Await(^BOOL{return finished;})&&!scheme,"unavailable server proof blocks execution");
    CHECK([store uninstall]&&Await(^BOOL{return !store.job;})&&[[store state][@"status"] isEqual:@"missing"],"remove game content");
    [store close];

    FixtureTransport *migration=[FixtureTransport new];migration.fixtures=fixtures;migration.version=1;migration.requests=[NSMutableArray array];
    POMarinefordStore *legacy=[[POMarinefordStore alloc] initWithRoot:[root stringByAppendingPathComponent:@"legacy"] transport:migration];
    NSString *shared=[root stringByAppendingPathComponent:@"shared"];legacy.sharedRoot=shared;
    NSFileManager *fm=NSFileManager.defaultManager;
    for(NSString *folder in @[legacy.root,shared])[fm createDirectoryAtPath:[folder stringByAppendingPathComponent:@"blobs"] withIntermediateDirectories:YES attributes:nil error:nil];
    CHECK([Read(fixtures,@"legacy.json") writeToFile:[legacy.root stringByAppendingPathComponent:@"manifest.json"] options:0 error:nil],"legacy receipt fixture");
    for(NSString *path in @[@"marineford/art/v2/test-a.webp",@"images/board/avatars/8.webp"]) {
        NSDictionary *row=package[@"files"][path];
        NSString *target=POMarinefordBlobFile([path hasPrefix:@"images/"]?shared:legacy.root,row[@"sha256"]);
        CHECK([Read([fixtures stringByAppendingPathComponent:@"source"],row[@"sha256"]) writeToFile:target options:0 error:nil],"legacy media and shared avatar fixture");
    }
    [legacy refresh];
    CHECK(Await(^BOOL{return !legacy.job;})&&[[legacy state][@"status"] isEqual:@"update"]&&
        ![legacy prepareLaunch:^(POMarinefordScheme *s){}],"legacy media requires program upgrade");
    CHECK([legacy install]&&Await(^BOOL{return !legacy.job;})&&migration.requests.count==6,"reuse legacy media and shared avatar without requests");
    CHECK([fm fileExistsAtPath:POMarinefordBlobFile(shared,package[@"files"][@"images/board/avatars/8.webp"][@"sha256"])],"shared content preserved");
    [legacy close];
    puts("PASS Marineford iOS program cold warm repair delta migration cancellation proof and native WKWebView execution");
    return 0;
}
int main(int argc,char **argv) {
    @autoreleasepool {
        if(argc!=4)return 2;
        NSString *root=[NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
        int result=Run([NSString stringWithUTF8String:argv[1]],[NSString stringWithUTF8String:argv[2]],[NSString stringWithUTF8String:argv[3]],root);
        [NSFileManager.defaultManager removeItemAtPath:root error:nil];
        return result;
    }
}
