// Included only from the Objective-C++ bridge. NSURLSession keeps standard ATS
// and system certificate validation; no trust-challenge override is installed.
@interface PODownloader : NSObject <NSURLSessionDownloadDelegate>
@property(nonatomic,strong) NSURLSession *session;
@property(nonatomic,strong) NSMutableDictionary *jobs;
- (BOOL)begin:(NSString *)identifier digest:(NSString *)digest destination:(NSString *)destination size:(long long)size;
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
    NSString *clean=[destination stringByStandardizingPath];
    if(identifier.length>64||digest.length!=64||[digest rangeOfCharacterFromSet:invalid].location!=NSNotFound||size<=0||size>512LL*1024*1024||![clean hasPrefix:[NSHomeDirectory() stringByAppendingString:@"/"]])return NO;
    @synchronized(self.jobs){
        if(self.jobs[identifier]||self.jobs.count>=4)return NO;
        NSString *address=[NSString stringWithFormat:@"https://game-assets.rihdi.tw/desktop/blobs/sha256/%@/%@",[digest substringToIndex:2],digest];
        NSURLSessionDownloadTask *task=[self.session downloadTaskWithURL:[NSURL URLWithString:address]];
        task.taskDescription=identifier;
        self.jobs[identifier]=[@{@"state":@"pending",@"file":clean,@"size":@(size),@"task":task} mutableCopy];
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
        BOOL valid=[response isKindOfClass:NSHTTPURLResponse.class]&&response.statusCode==200&&[attributes[NSFileSize] longLongValue]==[job[@"size"] longLongValue];
        if(valid)valid=[[NSFileManager defaultManager] moveItemAtURL:location toURL:[NSURL fileURLWithPath:job[@"file"]] error:nullptr];
        job[@"state"]=valid?@"complete":@"failed";
    }
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    if(error)@synchronized(self.jobs){NSMutableDictionary *job=self.jobs[task.taskDescription];if(job)job[@"state"]=@"failed";}
}
@end
