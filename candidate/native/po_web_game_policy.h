#pragma once
#import <Foundation/Foundation.h>
static BOOL POOfficialGameURL(NSURL *url) {
    return [url.scheme isEqualToString:@"https"] && [url.host isEqualToString:@"onepiece-card-online.onrender.com"] && (!url.port || url.port.integerValue==443) && !url.user && !url.password;
}
static BOOL POAllowMarinefordProgramNavigation(NSURL *url, BOOL mainFrame, BOOL nativeLoadPending) {
    return mainFrame&&nativeLoadPending&&((POOfficialGameURL(url)&&[url.path isEqual:@"/marineford/index.html"])||
        [url.absoluteString isEqual:@"about:blank"]);
}
