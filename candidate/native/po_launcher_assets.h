#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>

static NSString *POCanonicalAssetPath(NSString *path) {
    return path.stringByStandardizingPath.stringByResolvingSymlinksInPath;
}
static NSString *POResolveLauncherAsset(NSString *root, NSURL *url) {
    if(![url.scheme isEqualToString:@"poapp"]||![url.host isEqualToString:@"app"])return nil;
    NSString *relative=url.path;
    if(![relative hasPrefix:@"/"]||[relative containsString:@"\\"])return nil;
    NSArray *parts=[relative componentsSeparatedByString:@"/"];
    if([parts containsObject:@".."]||[parts containsObject:@"."])return nil;
    if(!([relative hasPrefix:@"/launcher/"]||[relative hasPrefix:@"/launcher-assets/"]||[relative hasPrefix:@"/mobile/"]))return nil;
    NSString *canonical=POCanonicalAssetPath(root);
    NSString *file=POCanonicalAssetPath([canonical stringByAppendingPathComponent:[relative substringFromIndex:1]]);
    return [file hasPrefix:[canonical stringByAppendingString:@"/"]]?file:nil;
}

@interface POAssetSchemeHandler : NSObject <WKURLSchemeHandler>
@property(nonatomic,copy) NSString *root;
@end
@implementation POAssetSchemeHandler
- (void)webView:(WKWebView *)web startURLSchemeTask:(id<WKURLSchemeTask>)task {
    NSURL *url=task.request.URL;
    NSString *file=POResolveLauncherAsset(_root,url);
    NSError *error=nil;
    NSData *data=file?[NSData dataWithContentsOfFile:file options:NSDataReadingMappedIfSafe error:&error]:nil;
    if(!data){
        NSLog(@"PO_LAUNCHER asset failure path=%@ code=%ld",url.path,(long)(error?error.code:403));
        [task didFailWithError:error?:[NSError errorWithDomain:@"POAssets" code:403 userInfo:nil]];return;
    }
    NSDictionary *types=@{@"html":@"text/html",@"js":@"application/javascript",@"css":@"text/css",@"json":@"application/json",@"png":@"image/png",@"webp":@"image/webp",@"svg":@"image/svg+xml",@"jpg":@"image/jpeg",@"jpeg":@"image/jpeg",@"gif":@"image/gif",@"mp3":@"audio/mpeg",@"ogg":@"audio/ogg",@"wav":@"audio/wav",@"mp4":@"video/mp4",@"webm":@"video/webm",@"ttf":@"font/ttf",@"otf":@"font/otf"};
    NSString *mime=types[file.pathExtension.lowercaseString]?:@"application/octet-stream";
    BOOL text=[mime hasPrefix:@"text/"]||[mime isEqualToString:@"application/javascript"]||[mime isEqualToString:@"application/json"]||[mime isEqualToString:@"image/svg+xml"];
    NSURLResponse *response=[[NSURLResponse alloc] initWithURL:url MIMEType:mime expectedContentLength:data.length textEncodingName:text?@"utf-8":nil];
    [task didReceiveResponse:response];[task didReceiveData:data];[task didFinish];
}
- (void)webView:(WKWebView *)web stopURLSchemeTask:(id<WKURLSchemeTask>)task {}
@end
