import Foundation
import CryptoKit

enum ContentVerifier {
    static func validate(_ data:Data) throws -> ContentManifest {
        guard data.count <= 2*1024*1024,let document=try JSONSerialization.jsonObject(with:data) as? [String:Any],
            document["schema"] as? Int == 1,document["channel"] as? String == "stable",
            document["platform"] as? String == "win32",document["arch"] as? String == "x64",
            document["coreVersion"] as? String == "1.2.23", let revision=document["revision"] as? Int,revision >= 1,
            document["baseUrl"] as? String == "https://game-assets.rihdi.tw/desktop/launcher/content/blobs/sha256/",
            let files=document["files"] as? [[String:Any]],files.count <= 5000,
            let signature=document["signature"] as? [String:Any],signature["algorithm"] as? String == "Ed25519",
            signature["keyId"] as? String == "launcher-ed25519-cadd711c990664d5715de23131cadf45",
            let encoded=signature["value"] as? String,let signatureBytes=Data(base64Encoded:encoded) else { throw PortError.invalidFile }
        func json(_ value:Any) throws -> String {
            let bytes=try JSONSerialization.data(withJSONObject:value,options:[.fragmentsAllowed,.withoutEscapingSlashes])
            guard let text=String(data:bytes,encoding:.utf8) else { throw PortError.invalidFile };return text
        }
        let keys=["schema","channel","platform","arch","coreVersion","revision","publishedAt","baseUrl"]
        var properties:[String]=[]
        for key in keys { guard let value=document[key] else { throw PortError.invalidFile };properties.append("\"\(key)\":" + (try json(value))) }
        var canonicalFiles:[String]=[];var total=0;var last=""
        let rendererNames:Set<String>=["launcher.html","launcher.css","launcher.js","launcher-social.js","launcher-social.css","launcher-profile-shop.js","launcher-profile-shop.css","launcher-reserved-crew.js","launcher-life-data.js","launcher-life-actions.js","launcher-life.js","launcher-life-room.js","launcher-room.js","launcher-room.css","launcher-room-ambience.js","launcher-room-ambience.css","launcher-room-aquarium.js","launcher-room-aquarium.css","launcher-room-minigames.js","launcher-room-minigames.css","launcher-room-dialogue.js","launcher-room-motion-data.js","launcher-room-motion.js","launcher-announcements.js","launcher-announcements.css","launcher-updates-ui.js","launcher-account-ui.js"]
        for file in files {
            guard let path=file["path"] as? String,let bytes=file["bytes"] as? Int,bytes >= 0,bytes <= 64*1024*1024,
                let hash=file["sha256"] as? String,hash.count == 64,hash.allSatisfy({"0123456789abcdef".contains($0)}),path > last,
                !path.contains(".."),!path.contains("\\"),!path.hasPrefix("/"),!path.contains("//"),
                rendererNames.contains(path) || ["images/","audio/","videos/"].contains(where:{path.hasPrefix($0)}) else { throw PortError.invalidFile }
            last=path;total += bytes;guard total <= 256*1024*1024 else { throw PortError.invalidFile }
            canonicalFiles.append("{\"path\":\(try json(path)),\"bytes\":\(bytes),\"sha256\":\(try json(hash))}")
        }
        properties.append("\"files\":[" + canonicalFiles.joined(separator:",") + "]")
        let canonical=Data(("{" + properties.joined(separator:",") + "}").utf8)
        let spki=Data(base64Encoded:"MCowBQYDK2VwAyEAkSxE7aLqcZ8U91QvOhPfBwAJ0wmAaGfyBEO/jG5Kajs=")!
        let key=try Curve25519.Signing.PublicKey(rawRepresentation:spki.suffix(32))
        guard key.isValidSignature(signatureBytes,for:canonical) else { throw PortError.invalidFile }
        return try JSONDecoder().decode(ContentManifest.self,from:data)
    }
}

final class ContentUpdater {
    let store:ResourceStore
    var state:[String:Any]
    private var staged:Data?
    init(store:ResourceStore) {
        self.store=store
        state=["status":"idle","revision":store.content.revision]
    }
    func check(progress:@escaping([String:Any])->Void) async throws -> [String:Any] {
        state=["status":"checking","revision":store.content.revision];progress(state)
        let (data,response)=try await URLSession.shared.data(from:URL(string:"https://onepiece-card-online.onrender.com/desktop/launcher-content-v1.json")!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw PortError.invalidFile }
        let manifest=try ContentVerifier.validate(data)
        if manifest.revision <= store.content.revision { state=["status":"current","revision":store.content.revision];progress(state);return state }
        var downloaded=0;let total=manifest.files.reduce(0){$0 + $1.expectedSize}
        for file in manifest.files {
            _ = try await store.obtain(file,launcher:true,allowNetwork:true);downloaded += file.expectedSize
            state=["status":"downloading","revision":manifest.revision,"downloadedBytes":downloaded,"totalBytes":total];progress(state)
        }
        staged=data;state=["status":"ready","revision":manifest.revision,"downloadedBytes":downloaded,"totalBytes":total];progress(state);return state
    }
    func apply() throws {
        guard let data=staged else { throw PortError.invalidRequest }
        let manifest=try ContentVerifier.validate(data)
        try data.write(to:store.cache.appendingPathComponent("active-launcher-content.json"),options:.atomic)
        store.content=manifest;store.activeContentOverlay=true
        staged=nil;state=["status":"current","revision":manifest.revision]
    }
}
