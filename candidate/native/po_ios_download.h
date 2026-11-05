// Included only from the Objective-C++ bridge. NSURLSession keeps standard ATS
// and system certificate validation; no trust-challenge override is installed.
@interface PODownloader : NSObject <NSURLSessionDownloadDelegate>
@property(nonatomic,strong) NSURLSession *session;
@property(nonatomic,strong) NSMutableDictionary *jobs;
- (BOOL)beginURL:(NSString *)address identifier:(NSString *)identifier destination:(NSString *)destination limit:(long long)limit exact:(BOOL)exact;
- (BOOL)begin:(NSString *)identifier digest:(NSString *)digest destination:(NSString *)destination size:(long long)size;
- (BOOL)beginMarinefordManifest:(NSString *)identifier destination:(NSString *)destination;
- (BOOL)beginMarinefordRelease:(NSString *)identifier destination:(NSString *)destination;
- (BOOL)beginMarinefordProgramManifest:(NSString *)path identifier:(NSString *)identifier destination:(NSString *)destination;
- (BOOL)beginMarinefordProof:(NSString *)identifier destination:(NSString *)destination;
- (NSDictionary *)poll:(NSString *)identifier;
- (void)forget:(NSString *)identifier;
- (void)close;
@end
@implementation PODownloader
- (instancetype)init {
    if((self=[super init])){
        _jobs=[NSMutableDictionary dictionary];
        NSURLSessionConfiguration *configuration=[NSURLSessionConfiguration ephemeralSessionConfiguration];
        configuration.timeoutIntervalForRequest=60;configuration.timeoutIntervalForResource=180;
        configuration.HTTPMaximumConnectionsPerHost=4;
        configuration.HTTPAdditionalHeaders=@{@"User-Agent":@"ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility) PO-Native-Godot/0.1"};
        _session=[NSURLSession sessionWithConfiguration:configuration delegate:self delegateQueue:nil];
    }
    return self;
}
- (BOOL)begin:(NSString *)identifier digest:(NSString *)digest destination:(NSString *)destination size:(long long)size {
    NSCharacterSet *invalid=[[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet];
    if(digest.length!=64||[digest rangeOfCharacterFromSet:invalid].location!=NSNotFound)return NO;
    NSString *address=[NSString stringWithFormat:@"https://game-assets.rihdi.tw/desktop/blobs/sha256/%@/%@",[digest substringToIndex:2],digest];
    return [self beginURL:address identifier:identifier destination:destination limit:size exact:YES];
}
- (BOOL)beginMarinefordManifest:(NSString *)identifier destination:(NSString *)destination {
    return [self beginURL:@"https://onepiece-card-online.onrender.com/desktop/marineford-media-v1.json"
        identifier:identifier destination:destination limit:512*1024 exact:NO];
}
- (BOOL)beginMarinefordRelease:(NSString *)identifier destination:(NSString *)destination {
    return [self beginURL:@"https://onepiece-card-online.onrender.com/desktop/marineford-release-v1.json"
        identifier:identifier destination:destination limit:65536 exact:NO];
}
- (BOOL)beginMarinefordProgramManifest:(NSString *)path identifier:(NSString *)identifier destination:(NSString *)destination {
    if([path rangeOfString:@"^desktop/manifests/marineford-package-[0-9a-f]{16}\\.json\\z"
        options:NSRegularExpressionSearch].location==NSNotFound)return NO;
    return [self beginURL:[@"https://onepiece-card-online.onrender.com/" stringByAppendingString:path]
        identifier:identifier destination:destination limit:8*1024*1024 exact:NO];
}
- (BOOL)beginMarinefordProof:(NSString *)identifier destination:(NSString *)destination {
    return [self beginURL:@"https://onepiece-card-online.onrender.com/api/desktop-runtime-package/marineford"
        identifier:identifier destination:destination limit:65536 exact:NO];
}
- (BOOL)beginURL:(NSString *)address identifier:(NSString *)identifier destination:(NSString *)destination limit:(long long)limit exact:(BOOL)exact {
    NSString *clean=[destination stringByStandardizingPath];
    if(!identifier.length||identifier.length>64||limit<=0||limit>512LL*1024*1024||![clean hasPrefix:[NSHomeDirectory().stringByStandardizingPath stringByAppendingString:@"/"]])return NO;
    @synchronized(self.jobs){
        if(self.jobs[identifier]||self.jobs.count>=4)return NO;
        NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:[NSURL URLWithString:address]];
        if(!exact)request.cachePolicy=NSURLRequestReloadIgnoringLocalCacheData;
        NSURLSessionDownloadTask *task=[self.session downloadTaskWithRequest:request];
        task.taskDescription=identifier;
        self.jobs[identifier]=[@{@"state":@"pending",@"file":clean,@"size":@(limit),@"exact":@(exact),@"task":task} mutableCopy];
        [task resume];return YES;
    }
}
- (NSDictionary *)poll:(NSString *)identifier {
    @synchronized(self.jobs){NSDictionary *job=self.jobs[identifier];return @{@"state":job[@"state"]?:@"failed"};}
}
- (void)forget:(NSString *)identifier {
    @synchronized(self.jobs){NSURLSessionTask *task=self.jobs[identifier][@"task"];[task cancel];[self.jobs removeObjectForKey:identifier];}
}
- (void)close {
    [self.session invalidateAndCancel];
    @synchronized(self.jobs){[self.jobs removeAllObjects];}
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request completionHandler:(void (^)(NSURLRequest *))completionHandler {
    completionHandler(nil);
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)task didWriteData:(int64_t)bytesWritten totalBytesWritten:(int64_t)totalWritten totalBytesExpectedToWrite:(int64_t)expected {
    @synchronized(self.jobs){NSMutableDictionary *job=self.jobs[task.taskDescription];if(job&&totalWritten>[job[@"size"] longLongValue]){job[@"state"]=@"failed";[task cancel];}}
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)task didFinishDownloadingToURL:(NSURL *)location {
    @synchronized(self.jobs){
        NSMutableDictionary *job=self.jobs[task.taskDescription];if(!job)return;
        NSHTTPURLResponse *response=(NSHTTPURLResponse *)task.response;
        NSDictionary *attributes=[[NSFileManager defaultManager] attributesOfItemAtPath:location.path error:nullptr];
        long long size=[attributes[NSFileSize] longLongValue], limit=[job[@"size"] longLongValue];
        BOOL valid=[response isKindOfClass:NSHTTPURLResponse.class]&&response.statusCode==200&&size>0&&
            ([job[@"exact"] boolValue]?size==limit:size<=limit);
        if(valid)valid=[[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:job[@"file"]] error:nullptr];
        job[@"state"]=valid?@"complete":@"failed";
    }
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    if(error)@synchronized(self.jobs){NSMutableDictionary *job=self.jobs[task.taskDescription];if(job)job[@"state"]=@"failed";}
}
@end
