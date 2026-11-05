#import <CommonCrypto/CommonDigest.h>
#import <WebKit/WebKit.h>

static const long long POMarinefordManifestLimit = 512 * 1024;
static NSString *const POMarinefordCover = @"images/game_launcher/launcher_marineford_cover_v2.webp";
static NSString *const POMarinefordArtPrefix = @"marineford/art/";

static NSString *POMarinefordSHA256(NSData *data) {
    unsigned char digest[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
    NSMutableString *text = [NSMutableString stringWithCapacity:CC_SHA256_DIGEST_LENGTH * 2];
    for (NSUInteger i = 0; i < sizeof(digest); ++i) [text appendFormat:@"%02x", (unsigned int)digest[i]];
    return text;
}

static BOOL POMarinefordMediaPath(NSString *path) {
    return [path hasPrefix:POMarinefordArtPrefix] && path.length <= 256 &&
        [path rangeOfString:@"^marineford/art/([a-z0-9_-]+/)*[a-z0-9_-]+\\.webp\\z"
                    options:NSRegularExpressionSearch].location != NSNotFound;
}

static NSDictionary *POMarinefordPackage(NSData *data) {
    if (!data.length || data.length > POMarinefordManifestLimit) return nil;
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![json isKindOfClass:NSDictionary.class]) return nil;
    NSNumber *schema = json[@"schema"];
    if (![schema isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)schema) == CFBooleanGetTypeID() ||
        ![schema isEqual:@1] || ![json[@"gameId"] isEqual:@"marineford"] || ![json[@"assets"] isKindOfClass:NSArray.class]) return nil;
    NSArray *rows = json[@"assets"];
    if (rows.count < 2 || rows.count > 2048) return nil;
    NSMutableDictionary *files = [NSMutableDictionary dictionary];
    NSMutableDictionary *blobs = [NSMutableDictionary dictionary];
    BOOL sawCover = NO;
    long long bytes = 0;
    NSCharacterSet *invalidHex = [[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet];
    for (id row in rows) {
        if (![row isKindOfClass:NSDictionary.class]) return nil;
        NSString *path = row[@"path"], *sha = row[@"sha256"];
        NSNumber *size = row[@"size"];
        if (![path isKindOfClass:NSString.class] || ![sha isKindOfClass:NSString.class] ||
            sha.length != 64 || [sha rangeOfCharacterFromSet:invalidHex].location != NSNotFound ||
            ![size isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)size) == CFBooleanGetTypeID() ||
            size.longLongValue <= 0 || size.longLongValue > 32LL * 1024 * 1024 ||
            ![size isEqual:@(size.longLongValue)] || ![row[@"kind"] isEqual:@"image"] ||
            ![row[@"mime"] isEqual:@"image/webp"]) return nil;
        if ([path isEqual:POMarinefordCover]) {
            if (sawCover) return nil;
            sawCover = YES;
            continue;
        }
        if (!POMarinefordMediaPath(path) || files[path]) return nil;
        NSDictionary *blob = @{@"sha256":sha, @"size":@(size.longLongValue)};
        if (blobs[sha] && ![blobs[sha] isEqual:blob]) return nil;
        if (!blobs[sha]) bytes += size.longLongValue;
        files[path] = blob;
        blobs[sha] = blob;
    }
    if (!sawCover || !files.count || bytes > 512LL * 1024 * 1024) return nil;
    NSData *identity = [NSJSONSerialization dataWithJSONObject:files options:NSJSONWritingSortedKeys error:nil];
    if (!identity) return nil;
    return @{@"revision":POMarinefordSHA256(identity), @"files":files, @"blobs":blobs,
             @"bytes":@(bytes), @"manifest":data};
}

static NSString *POMarinefordBlobFile(NSString *root, NSString *digest) {
    return [[root stringByAppendingPathComponent:@"blobs"] stringByAppendingPathComponent:digest];
}

static NSData *POReadMarinefordBlob(NSString *file, NSDictionary *record) {
    NSDictionary *info = [NSFileManager.defaultManager attributesOfItemAtPath:file error:nil];
    if (![info[NSFileType] isEqual:NSFileTypeRegular] || ![info[NSFileSize] isEqual:record[@"size"]]) return nil;
    NSData *data = [NSData dataWithContentsOfFile:file options:NSDataReadingMappedIfSafe error:nil];
    return data.length == [record[@"size"] unsignedLongLongValue] &&
        [POMarinefordSHA256(data) isEqual:record[@"sha256"]] ? data : nil;
}

@interface POMarinefordScheme : NSObject <WKURLSchemeHandler>
@property(nonatomic,copy) NSString *root;
@property(nonatomic,copy) NSDictionary *files;
@property(nonatomic,copy) NSString *sharedRoot;
@property(nonatomic,copy) NSDictionary *package;
- (NSData *)dataForPath:(NSString *)path;
@end

@implementation POMarinefordScheme
- (NSData *)dataForPath:(NSString *)path {
    NSDictionary *record=self.files[path];
    if(!record)return nil;
    NSData *data=POReadMarinefordBlob(POMarinefordBlobFile(self.root,record[@"sha256"]),record);
    if(!data&&self.sharedRoot.length)data=POReadMarinefordBlob(POMarinefordBlobFile(self.sharedRoot,record[@"sha256"]),record);
    return data;
}
- (void)webView:(WKWebView *)web startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURLRequest *request=task.request;NSURL *url=request.URL;
    NSString *path=url.path;
    if([path hasPrefix:@"/"])path=[path substringFromIndex:1];
    NSDictionary *record=[request.HTTPMethod isEqual:@"GET"]&&[url.scheme isEqual:@"poasset"]&&
        [url.host isEqual:@"marineford"]&&!url.port&&!url.user&&!url.password&&!url.query&&!url.fragment?self.files[path]:nil;
    NSData *bytes=record?[self dataForPath:path]:nil;
    if(!bytes){
        [task didFailWithError:[NSError errorWithDomain:NSURLErrorDomain code:NSURLErrorResourceUnavailable userInfo:nil]];
        return;
    }
    NSString *mime=record[@"mime"]?:@"image/webp";
    NSURLResponse *response=[[NSURLResponse alloc] initWithURL:url MIMEType:mime expectedContentLength:bytes.length
        textEncodingName:[mime hasPrefix:@"text/"]||[mime isEqual:@"application/json"]?@"utf-8":nil];
    [task didReceiveResponse:response];[task didReceiveData:bytes];[task didFinish];
}
- (void)webView:(WKWebView *)web stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
@end
