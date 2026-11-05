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
    if(POMarinefordMediaPath(path)||[path isEqual:POMarinefordCover]||[path isEqual:@"images/game_launcher/launcher_marineford_cover_v1.webp"])return YES;
    NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"^images/board/avatars/([1-9][0-9]{0,2})\\.webp\\z" options:0 error:nil];
    NSTextCheckingResult *match=[pattern firstMatchInString:path options:0 range:NSMakeRange(0,path.length)];
    return match && [[path substringWithRange:[match rangeAtIndex:1]] integerValue]<=222;
}
static NSArray *POMarinefordResourceType(NSString *path) {
    if(POMarinefordImagePath(path))return @[@"image",@"image/webp"];
    if(![path isKindOfClass:NSString.class]||path.length>256||
        [path rangeOfString:@"^marineford/(art|audio|video|videos|fonts)/([a-z0-9_-]+/)*[a-z0-9][a-z0-9._-]*\\.[a-z0-9]+\\z"
            options:NSRegularExpressionSearch].location==NSNotFound)return nil;
    NSDictionary *types=@{@"png":@[@"image",@"image/png"],@"jpg":@[@"image",@"image/jpeg"],
        @"jpeg":@[@"image",@"image/jpeg"],@"jfif":@[@"image",@"image/jpeg"],@"webp":@[@"image",@"image/webp"],@"gif":@[@"image",@"image/gif"],
        @"avif":@[@"image",@"image/avif"],@"svg":@[@"image",@"image/svg+xml"],
        @"mp3":@[@"audio",@"audio/mpeg"],@"m4a":@[@"audio",@"audio/mp4"],@"aac":@[@"audio",@"audio/aac"],
        @"wav":@[@"audio",@"audio/wav"],@"ogg":@[@"audio",@"audio/ogg"],@"flac":@[@"audio",@"audio/flac"],
        @"mp4":@[@"video",@"video/mp4"],@"webm":@[@"video",@"video/webm"],@"mov":@[@"video",@"video/quicktime"],@"m4v":@[@"video",@"video/x-m4v"],
        @"woff":@[@"font",@"font/woff"],@"woff2":@[@"font",@"font/woff2"],
        @"ttf":@[@"font",@"font/ttf"],@"otf":@[@"font",@"font/otf"]};
    NSArray *type=types[path.pathExtension];
    NSString *folder=[path componentsSeparatedByString:@"/"][1];
    BOOL scoped=([type[0] isEqual:@"image"]&&[folder isEqual:@"art"])||
        ([type[0] isEqual:@"audio"]&&[folder isEqual:@"audio"])||
        ([type[0] isEqual:@"video"]&&[@[@"video",@"videos"] containsObject:folder])||
        ([type[0] isEqual:@"font"]&&[folder isEqual:@"fonts"]);
    return scoped?type:nil;
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
    long long bytes=0,unique=0,inlineMediaBytes=0;
    for(id row in json[@"assets"]) {
        if(![row isKindOfClass:NSDictionary.class]||[row count]!=5)return nil;
        NSString *path=row[@"path"],*kind=row[@"kind"],*mime=row[@"mime"],*digest=row[@"sha256"];
        NSNumber *size=row[@"size"];
        if(![path isKindOfClass:NSString.class]||path.length>256||[path compare:previous options:NSLiteralSearch]!=NSOrderedDescending||
            !POMarinefordHash(digest)||!POMarinefordInteger(size,1,32LL*1024*1024))return nil;
        NSArray *type=programs[path];
        if(type) {
            if(![kind isEqual:type[0]]||![mime isEqual:type[1]])return nil;
        } else {
            type=POMarinefordResourceType(path);
            if(!type||![kind isEqual:type[0]]||![mime isEqual:type[1]])return nil;
            if(![kind isEqual:@"image"])inlineMediaBytes+=size.longLongValue;
            if(inlineMediaBytes>64LL*1024*1024)return nil;
        }
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
- (NSDictionary *)programMediaURLs;
- (NSString *)programHTML;
- (NSString *)programBootstrapSource:(NSString *)templateSource;
- (NSArray *)programScripts;
@end
@implementation POMarinefordScheme (Program)
- (NSDictionary *)programMediaURLs {
    NSMutableDictionary *urls=[NSMutableDictionary dictionary];
    for(NSString *path in self.files) {
        NSDictionary *row=self.files[path];
        if(!POMarinefordResourceType(path))continue;
        if([row[@"kind"] isEqual:@"image"])urls[path]=[NSString stringWithFormat:@"poasset://marineford/%@",path];
        else {
            NSData *bytes=[self dataForPath:path];
            if(!bytes.length)return nil;
            urls[path]=[NSString stringWithFormat:@"data:%@;base64,%@",row[@"mime"],[bytes base64EncodedStringWithOptions:0]];
        }
    }
    return urls;
}
- (NSString *)programHTML {
    if(![self.package[@"program"] boolValue])return nil;
    NSString *html=POMarinefordText([self dataForPath:@"marineford/index.html"]);
    NSString *css=POMarinefordText([self dataForPath:@"marineford/marineford.css"]);
    if(!html.length||!css.length||[css rangeOfString:@"</style" options:NSCaseInsensitiveSearch].location!=NSNotFound)return nil;
    NSDictionary *urls=[self programMediaURLs];
    if(!urls)return nil;
    NSURL *base=[NSURL URLWithString:@"https://onepiece-card-online.onrender.com/marineford/index.html"];
    NSRegularExpression *cssURLs=[NSRegularExpression regularExpressionWithPattern:@"url\\(\\s*(['\"]?)([^)'\"\\s]+)\\1\\s*\\)" options:NSRegularExpressionCaseInsensitive error:nil];
    for(NSTextCheckingResult *match in [cssURLs matchesInString:css options:0 range:NSMakeRange(0,css.length)].reverseObjectEnumerator) {
        NSURL *url=[NSURL URLWithString:[css substringWithRange:[match rangeAtIndex:2]] relativeToURL:base].absoluteURL;
        NSString *path=[url.path hasPrefix:@"/"]?[url.path substringFromIndex:1]:@"";
        NSString *local=(POOfficialGameURL(url)||([url.scheme isEqual:@"poasset"]&&[url.host isEqual:@"marineford"]))?urls[path]:nil;
        if(!local&&POOfficialGameURL(url)&&[path rangeOfString:@"^marineford/(art|audio|video|videos|fonts)/" options:NSRegularExpressionSearch].location!=NSNotFound)
            local=[@"poasset://marineford/" stringByAppendingString:path];
        if(local)css=[css stringByReplacingCharactersInRange:match.range withString:[NSString stringWithFormat:@"url(\"%@\")",local]];
    }
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
    html=[html stringByReplacingCharactersInRange:match.range withString:
        [NSString stringWithFormat:@"<style id=\"po-marineford-program-style\">%@</style>",css]];
    NSRegularExpression *attributes=[NSRegularExpression regularExpressionWithPattern:@"\\b(?:src|poster)\\s*=\\s*(['\"])([^'\"]+)\\1" options:NSRegularExpressionCaseInsensitive error:nil];
    for(NSTextCheckingResult *attribute in [attributes matchesInString:html options:0 range:NSMakeRange(0,html.length)].reverseObjectEnumerator) {
        NSURL *target=[NSURL URLWithString:[html substringWithRange:[attribute rangeAtIndex:2]] relativeToURL:base].absoluteURL;
        NSString *path=[target.path hasPrefix:@"/"]?[target.path substringFromIndex:1]:@"";
        if(POOfficialGameURL(target)&&urls[path])html=[html stringByReplacingCharactersInRange:[attribute rangeAtIndex:2] withString:urls[path]];
    }
    // The verified HTML executes its installed program only. API and room
    // traffic remains online, while absent assets cannot fall back to Render.
    NSRegularExpression *head=[NSRegularExpression regularExpressionWithPattern:@"<head\\b[^>]*>" options:NSRegularExpressionCaseInsensitive error:nil];
    NSArray *heads=[head matchesInString:html options:0 range:NSMakeRange(0,html.length)];
    if(heads.count!=1)return nil;
    NSString *policy=@"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src poasset: data: blob:; media-src data: blob:; font-src data: blob:; connect-src https://onepiece-card-online.onrender.com/api/ https://onepiece-card-online.onrender.com/socket.io/ wss://onepiece-card-online.onrender.com/socket.io/; worker-src blob:; object-src 'none'; frame-src 'none'; base-uri https://onepiece-card-online.onrender.com\">";
    html=[html stringByReplacingCharactersInRange:NSMakeRange(NSMaxRange([heads[0] range]),0) withString:policy];
    return html;
}
- (NSString *)programBootstrapSource:(NSString *)templateSource {
    NSData *data=[self dataForPath:@"marineford/cards.json"];
    NSString *cards=POMarinefordText(data);
    NSString *marker=@"__PO_NATIVE_PROGRAM_DATA__";
    if(!cards.length||!templateSource.length||[templateSource componentsSeparatedByString:marker].count!=2)return nil;
    NSMutableArray *images=[NSMutableArray array];
    NSMutableDictionary *media=[NSMutableDictionary dictionary];
    NSDictionary *urls=[self programMediaURLs];
    if(!urls)return nil;
    for(NSString *path in urls) {
        if([self.files[path][@"kind"] isEqual:@"image"])[images addObject:path];
        else media[path]=@{@"mime":self.files[path][@"mime"],@"url":urls[path]};
    }
    [images sortUsingSelector:@selector(compare:)];
    NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"cards":cards,@"images":images,@"media":media}
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
