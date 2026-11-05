#include "po_ios_download.h"
#include "po_marineford_assets.h"
#include "po_marineford_program.h"
#include <stdio.h>

@interface POMarinefordJob : NSObject
@property(atomic) BOOL cancelled;
@property(nonatomic) BOOL installing;
@end
@implementation POMarinefordJob
@end

static NSString *POMarinefordVersion(NSDictionary *package) {
    NSString *revision = package[@"revision"];
    if([package[@"program"] boolValue])return revision?:@"";
    return revision.length ? [@"素材 " stringByAppendingString:[revision substringToIndex:8]] : @"";
}

static NSArray *POMarinefordMissing(NSString *root, NSDictionary *package, NSString *sharedRoot = nil) {
    NSDictionary *blobs = package[@"blobs"];
    NSMutableArray *missing = [NSMutableArray array];
    for (NSString *digest in blobs) {
        @autoreleasepool {
            BOOL present=POReadMarinefordBlob(POMarinefordBlobFile(root,digest),blobs[digest])!=nil;
            if(!present&&sharedRoot.length)present=POReadMarinefordBlob(POMarinefordBlobFile(sharedRoot,digest),blobs[digest])!=nil;
            if(!present)[missing addObject:blobs[digest]];
        }
    }
    return missing;
}

// Main queue owns launcher state. The serial I/O queue owns all cache changes;
// only verified CAS blobs and an atomically published manifest survive a retry.
@interface POMarinefordStore : NSObject
@property(nonatomic,copy) NSString *root;
@property(nonatomic,copy) NSString *sharedRoot;
@property(nonatomic,copy) void (^changed)(void);
@property(nonatomic,strong) PODownloader *transport;
@property(nonatomic,strong) dispatch_queue_t io;
@property(nonatomic,strong) POMarinefordJob *job;
@property(nonatomic,strong) NSDictionary *installed;
@property(nonatomic,strong) NSDictionary *remote;
@property(nonatomic,strong) NSDictionary *latestReference;
@property(nonatomic,strong) NSDate *lastCheck;
@property(nonatomic,strong) NSDictionary *activity;
@property(nonatomic) BOOL healthy;
@property(nonatomic) BOOL preparingLaunch;
@property(nonatomic,copy) NSString *failure;
- (instancetype)initWithRoot:(NSString *)root transport:(PODownloader *)transport;
- (NSDictionary *)state;
- (NSString *)latestFile;
- (void)refresh;
- (void)start:(BOOL)installing;
- (BOOL)install;
- (BOOL)cancel;
- (BOOL)uninstall;
- (BOOL)prepareLaunch:(void (^)(POMarinefordScheme *))completion;
- (BOOL)prepareLaunchPackage:(NSDictionary *)package completion:(void (^)(POMarinefordScheme *))completion;
- (void)close;
@end

@implementation POMarinefordStore
- (instancetype)initWithRoot:(NSString *)root transport:(PODownloader *)transport {
    if ((self = [super init])) {
        _root = [root copy];
        _io = dispatch_queue_create("tw.rihdi.po.marineford-cache", DISPATCH_QUEUE_SERIAL);
        _transport = transport;
    }
    return self;
}

- (NSString *)manifestFile {
    return [self.root stringByAppendingPathComponent:@"manifest.json"];
}
- (NSString *)latestFile {return [self.root stringByAppendingPathComponent:@"latest-reference.json"];}

- (void)emit {
    if (self.changed) self.changed();
}

- (NSDictionary *)state {
    BOOL program=[self.installed[@"program"] boolValue];
    NSString *latest=self.remote[@"revision"]?:self.latestReference[@"releaseId"];
    BOOL update=self.installed&&(!program||(latest&&![self.installed[@"revision"] isEqual:latest]));
    NSString *status = @"missing";
    if (self.installed) status = !self.healthy ? @"repair" : (update ? @"update" : @"installed");
    else if (!self.lastCheck) status = @"checking";
    if (self.failure.length) status = self.healthy ? @"error" : (self.installed ? @"repair" : @"error");
    // A pending or failed update never replaces a verified installed receipt.
    // Its launch still needs an online proof explicitly accepting that identity.
    NSMutableDictionary *value = [@{@"status":status, @"hasInstalled":@(program && self.healthy),
        @"removable":@(self.installed != nil || self.failure.length || [self.activity[@"status"] isEqual:@"paused"]),
        @"installedVersion":POMarinefordVersion(self.installed), @"remoteVersion":self.remote?POMarinefordVersion(self.remote):(self.latestReference[@"releaseId"]?:@""),
        @"totalBytes":self.remote[@"bytes"] ?: self.installed[@"bytes"] ?: @0} mutableCopy];
    if (self.failure.length) value[@"message"] = self.failure;
    if (self.activity) [value addEntriesFromDictionary:self.activity];
    return value;
}

- (void)postActivity:(NSDictionary *)activity forJob:(POMarinefordJob *)job {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.job != job || job.cancelled) return;
        self.activity = activity;
        [self emit];
    });
}

- (void)refresh {
    if (self.job || self.preparingLaunch || (self.lastCheck && [self.lastCheck timeIntervalSinceNow] > -60)) return;
    [self start:NO];
}

- (BOOL)install {
    if (self.preparingLaunch || self.job) return NO;
    [self start:YES];
    return YES;
}

- (BOOL)cancel {
    if (!self.job.installing) return NO;
    self.job.cancelled = YES;
    return YES;
}

- (NSData *)fetchMetadata:(NSString *)kind path:(NSString *)path package:(NSDictionary *)package job:(POMarinefordJob *)job {
    NSString *key=NSUUID.UUID.UUIDString;
    NSString *temporary=[self.root stringByAppendingPathComponent:@"metadata.part"];
    NSFileManager *fm=NSFileManager.defaultManager;
    [fm removeItemAtPath:temporary error:nil];
    BOOL began=NO;
    if(!job.cancelled) {
        if([kind isEqual:@"release"])began=[self.transport beginMarinefordRelease:key destination:temporary];
        else if([kind isEqual:@"manifest"])began=[self.transport beginMarinefordProgramManifest:path identifier:key destination:temporary];
        else if([kind isEqual:@"proof"])began=[self.transport beginMarinefordProof:key
            release:package[@"reference"][@"releaseId"] digest:package[@"reference"][@"manifestSha256"] destination:temporary];
    }
    NSData *data=nil;
    if(began) {
        while(!job.cancelled) {
            NSString *state=[self.transport poll:key][@"state"];
            if([state isEqual:@"complete"]){data=[NSData dataWithContentsOfFile:temporary options:NSDataReadingMappedIfSafe error:nil];break;}
            if(![state isEqual:@"pending"])break;
            [NSThread sleepForTimeInterval:.1];
        }
        [self.transport forget:key];
    }
    [fm removeItemAtPath:temporary error:nil];
    return data;
}
- (NSDictionary *)fetchProgram:(POMarinefordJob *)job {
    NSData *reference=[self fetchMetadata:@"release" path:nil package:nil job:job];
    NSDictionary *pointer=POMarinefordRelease(reference);
    if(!pointer)return nil;
    NSData *manifest=[self fetchMetadata:@"manifest" path:pointer[@"manifestPath"] package:nil job:job];
    return POMarinefordProgramPackage(manifest,reference);
}
- (BOOL)download:(NSArray *)missing package:(NSDictionary *)package job:(POMarinefordJob *)job {
    NSFileManager *fm = NSFileManager.defaultManager;
    NSDictionary *blobs = package[@"blobs"];
    long long bytes = [package[@"bytes"] longLongValue];
    for (NSDictionary *blob in missing) bytes -= [blob[@"size"] longLongValue];
    NSUInteger next = 0, completed = blobs.count - missing.count, published = NSUIntegerMax;
    NSMutableDictionary *active = [NSMutableDictionary dictionary];
    BOOL ok = YES;
    while (ok && !job.cancelled && completed < blobs.count) {
        if (published != completed) {
            published = completed;
            [self postActivity:@{@"status":@"downloading", @"downloadedBytes":@(bytes), @"totalBytes":package[@"bytes"],
                @"totalFiles":@(blobs.count), @"completedFiles":@(completed)} forJob:job];
        }
        while (active.count < 4 && next < missing.count && !job.cancelled) {
            NSDictionary *record = missing[next++];
            NSString *key = NSUUID.UUID.UUIDString;
            NSString *file = POMarinefordBlobFile(self.root, record[@"sha256"]);
            NSString *temporary = [file stringByAppendingString:@".part"];
            [fm removeItemAtPath:temporary error:nil];
            if (![self.transport begin:key digest:record[@"sha256"] destination:temporary size:[record[@"size"] longLongValue]]) {
                ok = NO;
                break;
            }
            active[key] = record;
        }
        BOOL advanced = NO;
        for (NSString *key in active.allKeys) {
            @autoreleasepool {
                NSString *state = [self.transport poll:key][@"state"];
                if ([state isEqual:@"pending"]) continue;
                NSDictionary *record = active[key];
                NSString *file = POMarinefordBlobFile(self.root, record[@"sha256"]);
                NSString *temporary = [file stringByAppendingString:@".part"];
                [self.transport forget:key];
                [active removeObjectForKey:key];
                if (![state isEqual:@"complete"] || !POReadMarinefordBlob(temporary, record) ||
                    rename(temporary.fileSystemRepresentation, file.fileSystemRepresentation) != 0) {
                    [fm removeItemAtPath:temporary error:nil];
                    ok = NO;
                    break;
                }
                bytes += [record[@"size"] longLongValue];
                ++completed;
                advanced = YES;
            }
        }
        if (!advanced && ok) [NSThread sleepForTimeInterval:.1];
    }
    for (NSString *key in active) {
        [self.transport forget:key];
        NSString *file = POMarinefordBlobFile(self.root, active[key][@"sha256"]);
        [fm removeItemAtPath:[file stringByAppendingString:@".part"] error:nil];
    }
    return ok && !job.cancelled && completed == blobs.count;
}

- (void)start:(BOOL)installing {
    POMarinefordJob *job = [POMarinefordJob new];
    job.installing = installing;
    self.job = job;
    self.failure = nil;
    self.lastCheck = NSDate.date;
    self.activity = installing ? @{@"status":@"preparing"} : (self.installed ? nil : @{@"status":@"checking"});
    [self emit];
    dispatch_async(self.io, ^{
        NSFileManager *fm = NSFileManager.defaultManager;
        NSString *blobs = [self.root stringByAppendingPathComponent:@"blobs"];
        BOOL ready = self.root.length && [fm createDirectoryAtPath:blobs withIntermediateDirectories:YES attributes:nil error:nil];
        if (ready) [[NSURL fileURLWithPath:self.root isDirectory:YES] setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
        NSData *installedData = [NSData dataWithContentsOfFile:[self manifestFile] options:NSDataReadingMappedIfSafe error:nil];
        NSDictionary *installed = POMarinefordStoredPackage(installedData);
        NSArray *installedMissing = installed ? POMarinefordMissing(self.root, installed, self.sharedRoot) : nil;
        BOOL healthy = installed && installedMissing.count == 0;
        BOOL seeded=YES;
        if([installed[@"program"] boolValue]&&![fm fileExistsAtPath:[self latestFile]])
            seeded=POMarinefordRememberLatest(installed,[self latestFile]);
        NSDictionary *remote = ready ? [self fetchProgram:job] : nil;
        NSString *metadataFailure=nil;
        if(!seeded||(remote&&!POMarinefordRememberLatest(remote,[self latestFile]))) {
            remote=nil;metadataFailure=@"無法驗證最新遊戲版本，已保留現有版本，請重試。";
        }
        NSDictionary *latestReference=POMarinefordLatestReference([self latestFile]);
        BOOL success = NO;
        if (remote && installing && !job.cancelled) {
            NSArray *missing = [installed[@"revision"] isEqual:remote[@"revision"]] ?
                installedMissing : POMarinefordMissing(self.root, remote, self.sharedRoot);
            if ([self download:missing package:remote job:job]) {
                [self postActivity:@{@"status":@"verifying"} forJob:job];
                success = !job.cancelled && [POMarinefordReceipt(remote) writeToFile:[self manifestFile] options:NSDataWritingAtomic error:nil];
                if (success) {
                    // After promotion, discard old/unreferenced CAS files. Partial
                    // verified downloads are retained until a successful install.
                    NSDictionary *keep = remote[@"blobs"];
                    for (NSString *name in [fm contentsOfDirectoryAtPath:blobs error:nil]) {
                        if (!keep[name]) [fm removeItemAtPath:[blobs stringByAppendingPathComponent:name] error:nil];
                    }
                }
            }
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.job != job) return;
            self.job = nil;
            self.installed = success ? remote : installed;
            self.healthy = success || healthy;
            self.latestReference=latestReference;
            if (remote) self.remote = remote;
            self.activity = nil;
            if (!success && job.cancelled) self.activity = @{@"status":@"paused"};
            else if(metadataFailure)self.failure=metadataFailure;
            else if (installing && !success) self.failure = @"遊戲下載或驗證失敗，請重試。";
            else if (!remote && !self.healthy) self.failure = @"無法讀取遊戲版本，請重試。";
            [self emit];
        });
    });
}

- (BOOL)prepareLaunch:(void (^)(POMarinefordScheme *))completion {
    return [self prepareLaunchPackage:self.installed completion:completion];
}
- (BOOL)prepareLaunchPackage:(NSDictionary *)package completion:(void (^)(POMarinefordScheme *))completion {
    if (self.job || self.preparingLaunch || !self.healthy || ![package[@"program"] boolValue] ||
        ![package[@"revision"] isEqual:self.installed[@"revision"]]||
        ![package[@"reference"][@"manifestSha256"] isEqual:self.installed[@"reference"][@"manifestSha256"]]) return NO;
    self.preparingLaunch = YES;
    dispatch_async(self.io, ^{
        BOOL valid=POMarinefordMissing(self.root,package,self.sharedRoot).count==0;
        POMarinefordJob *proofJob=[POMarinefordJob new];
        BOOL proved=valid&&POMarinefordRuntimeProof([self fetchMetadata:@"proof" path:nil package:package job:proofJob],package);
        dispatch_async(dispatch_get_main_queue(), ^{
            self.preparingLaunch = NO;
            self.healthy = valid;
            if(!valid)self.failure=@"遊戲檔案受損，請先修復遊戲。";
            else if(!proved)self.failure=@"無法核對伺服器的遊戲版本，請確認連線並更新遊戲。";
            else self.failure=nil;
            POMarinefordScheme *scheme = nil;
            if (proved) {
                scheme = [POMarinefordScheme new];
                scheme.root = self.root;
                scheme.sharedRoot=self.sharedRoot;
                scheme.files = package[@"files"];
                scheme.package=package;
            }
            [self emit];
            completion(scheme);
        });
    });
    return YES;
}

- (BOOL)uninstall {
    if (self.job || self.preparingLaunch) return NO;
    POMarinefordJob *job = [POMarinefordJob new];
    self.job = job;
    self.activity = @{@"status":@"removing"};
    [self emit];
    dispatch_async(self.io, ^{
        NSFileManager *fm = NSFileManager.defaultManager;
        BOOL removed=YES;
        for(NSString *file in @[[self.root stringByAppendingPathComponent:@"blobs"],[self manifestFile]])
            if([fm fileExistsAtPath:file]&&![fm removeItemAtPath:file error:nil])removed=NO;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (self.job != job) return;
            self.job = nil;
            self.activity = nil;
            self.installed = nil;
            self.healthy = NO;
            self.failure = removed ? nil : @"無法移除遊戲素材，請重試。";
            [self emit];
        });
    });
    return YES;
}

- (void)close {
    self.job.cancelled = YES;
    self.job = nil;
    self.changed = nil;
    [self.transport close];
}
@end
