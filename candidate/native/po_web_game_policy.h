#import <Foundation/Foundation.h>
static BOOL POOfficialGameURL(NSURL *url) {
    return [url.scheme isEqualToString:@"https"] && [url.host isEqualToString:@"onepiece-card-online.onrender.com"] && (!url.port || url.port.integerValue==443) && !url.user && !url.password;
}
