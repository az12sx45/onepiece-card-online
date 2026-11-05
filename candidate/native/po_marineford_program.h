#pragma once
#include "po_web_game_policy.h"
#import <Foundation/Foundation.h>

static NSString *POMarinefordText(NSData *data) {
    return data?[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]:nil;
}
static BOOL POMarinefordInteger(id value, long long minimum, long long maximum) {
    return [value isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)value)!=CFBooleanGetTypeID() &&
        [value isEqual:@([value longLongValue])] && [value longLongValue]>=minimum && [value longLongValue]<=maximum;
}
static BOOL POMarinefordHash(id value) {
    return [value isKindOfClass:NSString.class] && [value rangeOfString:@"^[0-9a-f]{64}\\z" options:NSRegularExpressionSearch].location!=NSNotFound;
}
static NSDictionary *POMarinefordProgramTypes(void) {
    return @{@"marineford/index.html":@[@"document",@"text/html"],
        @"marineford/marineford.js":@[@"script",@"text/javascript"],
        @"marineford/marineford.css":@[@"style",@"text/css"],
        @"marineford/sound.js":@[@"script",@"text/javascript"],
        @"marineford/cards.json":@[@"data",@"application/json"],
        @"vendor/socket.io-client/4.8.1/socket.io.min.js":@[@"script",@"text/javascript"]};
}
static BOOL POMarinefordImagePath(NSString *path) {
    if(POMarinefordMediaPath(path)||[path isEqual:POMarinefordCover])return YES;
    NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"^images/board/avatars/([1-9][0-9]{0,2})\\.webp\\z" options:0 error:nil];
    NSTextCheckingResult *match=[pattern firstMatchInString:path options:0 range:NSMakeRange(0,path.length)];
    return match && [[path substringWithRange:[match rangeAtIndex:1]] integerValue]<=222;
}
static BOOL POMarinefordTimestamp(id value) {
    if(![value isKindOfClass:NSString.class])return NO;
    NSISO8601DateFormatter *time=[NSISO8601DateFormatter new];
    time.formatOptions=NSISO8601DateFormatWithInternetDateTime|NSISO8601DateFormatWithFractionalSeconds;
    if([time dateFromString:value])return YES;
    time.formatOptions=NSISO8601DateFormatWithInternetDateTime;
    return [time dateFromString:value]!=nil;
}
static NSDictionary *POMarinefordRelease(NSData *data) {
    if(!data.length||data.length>65536)return nil;
    id pointer=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if(![pointer isKindOfClass:NSDictionary.class]||[pointer count]!=10)return nil;
    NSString *release=pointer[@"releaseId"];
    if(!POMarinefordInteger(pointer[@"schema"],1,1)||![pointer[@"gameId"] isEqual:@"marineford"]||
        ![pointer[@"assetBlobBaseUrl"] isEqual:@"https://game-assets.rihdi.tw/desktop/blobs/sha256"]||
        ![release isKindOfClass:NSString.class]||
        [release rangeOfString:@"^package-[0-9a-f]{16}\\z" options:NSRegularExpressionSearch].location==NSNotFound||
        ![pointer[@"manifestPath"] isEqual:[NSString stringWithFormat:@"desktop/manifests/marineford-%@.json",release]]||
        !POMarinefordHash(pointer[@"manifestSha256"])||![pointer[@"entryPath"] isEqual:@"marineford/index.html"]||
        !POMarinefordInteger(pointer[@"totalFiles"],6,20000)||!POMarinefordInteger(pointer[@"totalBytes"],1,512LL*1024*1024)||
        !POMarinefordTimestamp(pointer[@"createdAt"]))return nil;
    return pointer;
}
static NSDictionary *POMarinefordProgramPackage(NSData *data, NSData *reference) {
    NSDictionary *pointer=POMarinefordRelease(reference);
    if(!pointer||!data.length||data.length>8*1024*1024||![POMarinefordSHA256(data) isEqual:pointer[@"manifestSha256"]])return nil;
    id json=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if(![json isKindOfClass:NSDictionary.class]||!POMarinefordInteger(json[@"schema"],3,3)||
        ![json[@"gameId"] isEqual:@"marineford"]||![json[@"releaseId"] isEqual:pointer[@"releaseId"]]||
        ![json[@"createdAt"] isEqual:pointer[@"createdAt"]]||![json[@"entryPath"] isEqual:pointer[@"entryPath"]]||
        ![json[@"totalFiles"] isEqual:pointer[@"totalFiles"]]||![json[@"totalBytes"] isEqual:pointer[@"totalBytes"]]||
        !POMarinefordHash(json[@"assetSetSha256"])||![json[@"assets"] isKindOfClass:NSArray.class]||
        [json[@"assets"] count]!=[pointer[@"totalFiles"] unsignedLongLongValue]||![json[@"byKind"] isKindOfClass:NSDictionary.class])return nil;
    NSDictionary *programs=POMarinefordProgramTypes();
    NSArray *kinds=@[@"document",@"style",@"script",@"data",@"wasm",@"image",@"audio",@"video",@"font"];
    NSMutableDictionary *files=[NSMutableDictionary dictionary],*blobs=[NSMutableDictionary dictionary],*totals=[NSMutableDictionary dictionary];
    for(NSString *kind in kinds)totals[kind]=[@{@"files":@0,@"bytes":@0} mutableCopy];
    NSMutableArray *canonical=[NSMutableArray array];
    NSString *previous=@"";
    long long bytes=0,unique=0;
    for(id row in json[@"assets"]) {
        if(![row isKindOfClass:NSDictionary.class]||[row count]!=5)return nil;
        NSString *path=row[@"path"],*kind=row[@"kind"],*mime=row[@"mime"],*digest=row[@"sha256"];
        NSNumber *size=row[@"size"];
        if(![path isKindOfClass:NSString.class]||path.length>256||[path compare:previous options:NSLiteralSearch]!=NSOrderedDescending||
            !POMarinefordHash(digest)||!POMarinefordInteger(size,1,32LL*1024*1024))return nil;
        NSArray *type=programs[path];
        if(type) {
            if(![kind isEqual:type[0]]||![mime isEqual:type[1]])return nil;
        } else if(!POMarinefordImagePath(path)||![kind isEqual:@"image"]||![mime isEqual:@"image/webp"])return nil;
        if(files[path]||!totals[kind]||(blobs[digest]&&![blobs[digest][@"size"] isEqual:size]))return nil;
        files[path]=row;
        if(!blobs[digest]){blobs[digest]=row;unique+=size.longLongValue;}
        bytes+=size.longLongValue;previous=path;
        totals[kind][@"files"]=@([totals[kind][@"files"] longLongValue]+1);
        totals[kind][@"bytes"]=@([totals[kind][@"bytes"] longLongValue]+size.longLongValue);
        [canonical addObject:[NSString stringWithFormat:@"{\"path\":\"%@\",\"kind\":\"%@\",\"mime\":\"%@\",\"size\":%lld,\"sha256\":\"%@\"}",path,kind,mime,size.longLongValue,digest]];
    }
    NSString *identity=[NSString stringWithFormat:@"[%@]",[canonical componentsJoinedByString:@","]];
    NSString *setHash=POMarinefordSHA256([identity dataUsingEncoding:NSUTF8StringEncoding]);
    if(![setHash isEqual:json[@"assetSetSha256"]]||
        ![pointer[@"releaseId"] isEqual:[@"package-" stringByAppendingString:[setHash substringToIndex:16]]]||
        bytes!=[pointer[@"totalBytes"] longLongValue]||![totals isEqual:json[@"byKind"]])return nil;
    for(NSString *path in programs)if(!files[path])return nil;
    return @{@"revision":pointer[@"releaseId"],@"files":files,@"blobs":blobs,@"bytes":@(unique),
        @"manifest":data,@"pointer":reference,@"reference":pointer,@"program":@YES};
}
static NSData *POMarinefordReceipt(NSDictionary *package) {
    return [NSJSONSerialization dataWithJSONObject:@{@"storageSchema":@2,
        @"manifest":[package[@"manifest"] base64EncodedStringWithOptions:0],
        @"pointer":[package[@"pointer"] base64EncodedStringWithOptions:0]} options:0 error:nil];
}
static NSDictionary *POMarinefordStoredPackage(NSData *data) {
    id value=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
    if([value isKindOfClass:NSDictionary.class]&&[value[@"storageSchema"] isEqual:@2]&&
        [value[@"manifest"] isKindOfClass:NSString.class]&&[value[@"pointer"] isKindOfClass:NSString.class]) {
        return POMarinefordProgramPackage([[NSData alloc] initWithBase64EncodedString:value[@"manifest"] options:0],
            [[NSData alloc] initWithBase64EncodedString:value[@"pointer"] options:0]);
    }
    return POMarinefordPackage(data);
}
static BOOL POMarinefordRuntimeProof(NSData *data, NSDictionary *package) {
    id proof=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
    NSDictionary *reference=package[@"reference"];
    return [proof isKindOfClass:NSDictionary.class]&&[proof[@"ok"] isEqual:@YES]&&
        POMarinefordInteger(proof[@"schema"],1,1)&&[proof[@"gameId"] isEqual:@"marineford"]&&
        [proof[@"releaseId"] isEqual:reference[@"releaseId"]]&&[proof[@"entryPath"] isEqual:@"marineford/index.html"]&&
        [proof[@"manifestSha256"] isEqual:reference[@"manifestSha256"]];
}

@interface POMarinefordScheme (Program)
- (NSString *)programHTML;
- (NSString *)programBootstrapSource:(NSString *)templateSource;
- (NSArray *)programScripts;
@end
@implementation POMarinefordScheme (Program)
- (NSString *)programHTML {
    if(![self.package[@"program"] boolValue])return nil;
    NSString *html=POMarinefordText([self dataForPath:@"marineford/index.html"]);
    NSString *css=POMarinefordText([self dataForPath:@"marineford/marineford.css"]);
    if(!html.length||!css.length||[css rangeOfString:@"</style" options:NSCaseInsensitiveSearch].location!=NSNotFound)return nil;
    for(NSString *path in self.files) {
        if(![self.files[path][@"kind"] isEqual:@"image"])continue;
        NSMutableArray *sources=[NSMutableArray arrayWithObjects:[@"/" stringByAppendingString:path],
            [@"https://onepiece-card-online.onrender.com/" stringByAppendingString:path],nil];
        if([path hasPrefix:@"marineford/"])[sources addObject:[path substringFromIndex:11]];
        NSString *local=[NSString stringWithFormat:@"url(\"poasset://marineford/%@\")",path];
        for(NSString *source in sources)for(NSString *quote in @[@"",@"'",@"\""]) {
            NSString *pattern=[NSString stringWithFormat:@"url(%@%@%@)",quote,source,quote];
            css=[css stringByReplacingOccurrencesOfString:pattern withString:local];
        }
    }
    NSURL *base=[NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html"];
    NSRegularExpression *scripts=[NSRegularExpression regularExpressionWithPattern:@"<script\\b[^>]*\\bsrc\\s*=\\s*(['\"])([^'\"]+)\\1[^>]*>\\s*</script\\s*>"
        options:NSRegularExpressionCaseInsensitive error:nil];
    NSArray *matches=[scripts matchesInString:html options:0 range:NSMakeRange(0,html.length)];
    NSMutableSet *seen=[NSMutableSet set];
    if(matches.count!=3)return nil;
    for(NSTextCheckingResult *match in matches.reverseObjectEnumerator) {
        NSString *value=[html substringWithRange:[match rangeAtIndex:2]];
        NSURL *url=[NSURL URLWithString:value relativeToURL:base].absoluteURL;
        NSString *path=[url.path hasPrefix:@"/"]?[url.path substringFromIndex:1]:@"";
        if(!POOfficialGameURL(url)||![self.files[path][@"kind"] isEqual:@"script"]||[seen containsObject:path])return nil;
        [seen addObject:path];
        html=[html stringByReplacingCharactersInRange:match.range withString:@""];
    }
    NSRegularExpression *links=[NSRegularExpression regularExpressionWithPattern:@"<link\\b[^>]*\\bhref\\s*=\\s*(['\"])([^'\"]+)\\1[^>]*>"
        options:NSRegularExpressionCaseInsensitive error:nil];
    matches=[links matchesInString:html options:0 range:NSMakeRange(0,html.length)];
    if(matches.count!=1)return nil;
    NSTextCheckingResult *match=matches[0];
    NSURL *url=[NSURL URLWithString:[html substringWithRange:[match rangeAtIndex:2]] relativeToURL:base].absoluteURL;
    if(!POOfficialGameURL(url)||![url.path isEqual:@"/marineford/marineford.css"])return nil;
    return [html stringByReplacingCharactersInRange:match.range withString:
        [NSString stringWithFormat:@"<style id=\"po-marineford-program-style\">%@</style>",css]];
}
- (NSString *)programBootstrapSource:(NSString *)templateSource {
    NSData *data=[self dataForPath:@"marineford/cards.json"];
    NSString *cards=POMarinefordText(data);
    NSString *marker=@"__PO_NATIVE_PROGRAM_DATA__";
    if(!cards.length||!templateSource.length||[templateSource componentsSeparatedByString:marker].count!=2)return nil;
    NSMutableArray *images=[NSMutableArray array];
    for(NSString *path in self.files)if([self.files[path][@"kind"] isEqual:@"image"])[images addObject:path];
    [images sortUsingSelector:@selector(compare:)];
    NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"cards":cards,@"images":images}
        options:NSJSONWritingSortedKeys error:nil];
    NSString *payload=[[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
    return payload?[templateSource stringByReplacingOccurrencesOfString:marker withString:payload]:nil;
}
- (NSArray *)programScripts {
    NSMutableArray *sources=[NSMutableArray array];
    for(NSString *path in @[@"vendor/socket.io-client/4.8.1/socket.io.min.js",@"marineford/sound.js",@"marineford/marineford.js"]) {
        NSString *source=POMarinefordText([self dataForPath:path]);
        if(!source.length)return nil;
        [sources addObject:source];
    }
    return sources;
}
@end
