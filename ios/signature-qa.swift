import Foundation
enum PortError:Error { case invalidFile,invalidRequest }
struct Asset:Decodable { let path:String;let bytes:Int;let sha256:String;var expectedSize:Int{bytes} }
struct ContentManifest:Decodable { let revision:Int;let files:[Asset] }
final class ResourceStore {
    var content:ContentManifest;var activeContentOverlay=false
    let cache=URL(fileURLWithPath:"/unused-signature-qa")
    init(_ content:ContentManifest){self.content=content}
    func obtain(_ asset:Asset,launcher:Bool,allowNetwork:Bool=false)async throws->URL{throw PortError.invalidRequest}
}
@main struct SignatureQA {
    static func main() throws {
        let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
        let original=try ContentVerifier.validate(data)
        var tampered=try JSONSerialization.jsonObject(with:data) as! [String:Any]
        tampered["revision"]=original.revision+1
        let bytes=try JSONSerialization.data(withJSONObject:tampered)
        var rejected=false
        do {_=try ContentVerifier.validate(bytes)}catch{rejected=true}
        guard rejected else {fatalError("Tampered manifest accepted")}
        print("PASS: signed manifest revision \(original.revision), tampered revision rejected")
    }
}
