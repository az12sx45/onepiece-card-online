import SwiftUI
import WebKit
import CryptoKit
import Security
import UniformTypeIdentifiers

@main
struct TabletopApp: App {
    var body: some Scene { WindowGroup { LauncherView().ignoresSafeArea(.container, edges: .bottom) } }
}

struct LauncherView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> LauncherController { LauncherController() }
    func updateUIViewController(_ uiViewController: LauncherController, context: Context) {}
}

enum PortError: Error { case invalidRequest, invalidFile, sessionStorage, uninstalled }

final class SessionVault {
    private let service = "tw.rihdi.tabletop.trial.session"
    func load() throws -> [String: Any] {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: "launcher", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return [:] }
        guard status == errSecSuccess, let data = result as? Data,
            let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw PortError.sessionStorage }
        return value
    }
    func save(_ value: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: value)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "launcher"]
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let updated = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updated == errSecItemNotFound {
            guard SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) == errSecSuccess else { throw PortError.sessionStorage }
        } else if updated != errSecSuccess { throw PortError.sessionStorage }
    }
}

struct Asset: Decodable {
    let path: String
    let mime: String?
    let sha256: String
    let size: Int?
    let bytes: Int?
    var expectedSize: Int { size ?? bytes ?? -1 }
}
struct GameManifest: Decodable { let gameId: String; let releaseId: String; let entryPath: String; let assets: [Asset] }
struct ContentManifest: Decodable { let revision: Int; let files: [Asset] }

final class ResourceStore {
    let resources: URL
    let cache: URL
    var games: [String: GameManifest] = [:]
    var content: ContentManifest
    let lock = NSLock()
    private var cancelled = Set<String>()
    private var states: [String: [String: Any]] = [:]
    init() throws {
        guard let resources = Bundle.main.url(forResource: "Resources", withExtension: nil) else { throw PortError.invalidFile }
        self.resources = resources
        cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("tabletop-sha256", isDirectory: true)
        try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
        content = try JSONDecoder().decode(ContentManifest.self, from: Data(contentsOf: resources.appendingPathComponent("launcher-content.json")))
        for id in ["card", "board", "chess"] {
            games[id] = try JSONDecoder().decode(GameManifest.self, from: Data(contentsOf: resources.appendingPathComponent("manifests/\(id).json")))
            states[id] = ["status": "installed", "hasInstalled": true, "installedVersion": games[id]!.releaseId,
                "message": "遊戲程式已內附；素材按需下載，可下載完整素材供後續使用"]
        }
    }
    func safePath(_ path: String) -> Bool {
        !path.isEmpty && !path.hasPrefix("/") && !path.contains("\\") && !path.split(separator: "/", omittingEmptySubsequences: false).contains(where: { $0 == ".." || $0 == "." || $0.isEmpty })
    }
    func validHash(_ hash: String) -> Bool { hash.count == 64 && hash.allSatisfy { "0123456789abcdef".contains($0) } }
    func digest(_ file: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: file); defer { try? handle.close() }
        var hash = SHA256()
        while let data = try handle.read(upToCount: 65536), !data.isEmpty { hash.update(data: data) }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }
    func obtain(_ asset: Asset, launcher: Bool) async throws -> URL {
        guard safePath(asset.path), validHash(asset.sha256), asset.expectedSize >= 0 else { throw PortError.invalidFile }
        let target = cache.appendingPathComponent(asset.sha256)
        if FileManager.default.fileExists(atPath: target.path), (try? digest(target)) == asset.sha256 { return target }
        if !launcher {
            for id in games.keys {
                let local = resources.appendingPathComponent("games/\(id)/\(asset.path)")
                if FileManager.default.fileExists(atPath:local.path), (try? digest(local)) == asset.sha256 { return local }
            }
        }
        let base = launcher ? "https://game-assets.rihdi.tw/desktop/launcher/content/blobs/sha256/" : "https://game-assets.rihdi.tw/desktop/blobs/sha256/"
        let (temporary, response) = try await URLSession.shared.download(from: URL(string: base + asset.sha256)!)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard (response as? HTTPURLResponse)?.statusCode == 200,
            (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?.intValue == asset.expectedSize,
            try digest(temporary) == asset.sha256 else { throw PortError.invalidFile }
        lock.lock(); defer { lock.unlock() }
        if !FileManager.default.fileExists(atPath: target.path) { try FileManager.default.moveItem(at: temporary, to: target) }
        return target
    }
    func resolve(_ url: URL) async throws -> (URL, String) {
        let filePath = String(url.path.dropFirst())
        guard safePath(filePath) else { throw PortError.invalidFile }
        if url.scheme == "opui", url.host == "launcher" {
            let local = resources.appendingPathComponent("launcher/\(filePath)")
            if FileManager.default.fileExists(atPath: local.path) { return (local, mime(filePath)) }
            if let record = content.files.first(where: { $0.path == filePath }) { return (try await obtain(record, launcher: true), mime(filePath)) }
            // Baseline launcher art is also covered by the pinned game asset manifests.
            for game in games.values {
                if let asset = game.assets.first(where: { $0.path == filePath }) { return (try await obtain(asset, launcher: false), asset.mime ?? mime(filePath)) }
            }
        } else if url.scheme == "opgame", let id = url.host, let manifest = games[id],
            let asset = manifest.assets.first(where: { $0.path == filePath }) {
            let local = resources.appendingPathComponent("games/\(id)/\(filePath)")
            if FileManager.default.fileExists(atPath: local.path) { return (local, asset.mime ?? mime(filePath)) }
            return (try await obtain(asset, launcher: false), asset.mime ?? mime(filePath))
        }
        throw PortError.invalidFile
    }
    func mime(_ path: String) -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        if ext == "js" { return "text/javascript" }; if ext == "css" { return "text/css" }; if ext == "html" { return "text/html" }
        return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }
    func snapshot() -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        let free = (try? cache.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]))?.volumeAvailableCapacityForImportantUsage
        let freeValue: Any = free != nil ? NSNumber(value:free!) : NSNull()
        return ["cacheRoot": "iPhone App 儲存空間", "freeBytes": freeValue, "games": states, "catalogSource": "bundled-ios"]
    }
    func cancel(_ id: String) { lock.lock(); cancelled.insert(id); lock.unlock() }
    func setState(_ id: String, _ value: [String: Any]) { lock.lock(); states[id] = value; lock.unlock() }
    func isCancelled(_ id: String) -> Bool { lock.lock(); defer { lock.unlock() }; return cancelled.contains(id) }
    func install(_ id: String, progress: @escaping ([String: Any]) -> Void) async throws {
        guard let manifest = games[id] else { throw PortError.invalidRequest }
        lock.lock(); cancelled.remove(id); lock.unlock()
        var bytes = 0; let total = manifest.assets.reduce(0) { $0 + $1.expectedSize }
        for (index, asset) in manifest.assets.enumerated() {
            if isCancelled(id) { setState(id, ["status":"paused", "hasInstalled":true, "message":"下載已暫停"]); return }
            _ = try await obtain(asset, launcher: false)
            bytes += asset.expectedSize
            let state: [String:Any] = ["status":"downloading", "hasInstalled":true, "downloadedBytes":bytes, "totalBytes":total,
                "completedFiles":index + 1, "totalFiles":manifest.assets.count]
            setState(id,state); progress(state.merging(["gameId":id]) { _,new in new })
        }
        setState(id,["status":"installed", "hasInstalled":true, "installedVersion":manifest.releaseId,"message":"完整素材已下載並驗證"])
    }
    func uninstall(_ id: String) throws {
        guard let manifest = games[id] else { throw PortError.invalidRequest }
        cancel(id)
        // Only this app's managed hash cache; bundled programs and account data remain intact.
        for asset in manifest.assets { let url = cache.appendingPathComponent(asset.sha256); if validHash(asset.sha256) { try? FileManager.default.removeItem(at: url) } }
        setState(id,["status":"installed","hasInstalled":true,"message":"素材快取已移除，遊戲程式仍內附"])
    }
}

final class ResourceHandler: NSObject, WKURLSchemeHandler {
    let store: ResourceStore
    private let lock = NSLock()
    private var tasks: [ObjectIdentifier: Task<Void,Never>] = [:]
    init(_ store: ResourceStore) { self.store = store }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let id = ObjectIdentifier(urlSchemeTask)
        let task = Task { @MainActor in
            do {
                guard let url = urlSchemeTask.request.url else { throw PortError.invalidRequest }
                let (file, mime) = try await store.resolve(url)
                guard !Task.isCancelled else { return }
                let handle = try FileHandle(forReadingFrom: file); defer { try? handle.close() }
                let size = (try FileManager.default.attributesOfItem(atPath: file.path)[.size] as? NSNumber)?.intValue ?? 0
                urlSchemeTask.didReceive(URLResponse(url:url,mimeType:mime,expectedContentLength:size,textEncodingName:mime.hasPrefix("text/") ? "utf-8" : nil))
                while let data = try handle.read(upToCount:65536), !data.isEmpty {
                    if Task.isCancelled { return }; urlSchemeTask.didReceive(data)
                }
                urlSchemeTask.didFinish()
            } catch { if !Task.isCancelled { urlSchemeTask.didFailWithError(error) } }
            lock.lock(); tasks.removeValue(forKey:id); lock.unlock()
        }
        lock.lock(); tasks[id] = task; lock.unlock()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        lock.lock(); let task = tasks.removeValue(forKey:ObjectIdentifier(urlSchemeTask)); lock.unlock(); task?.cancel()
    }
}

final class LauncherController: UIViewController, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
    private var web: WKWebView!
    private var store: ResourceStore!
    private let vault = SessionVault()
    private var downloads: [String:Task<Void,Never>] = [:]
    override func viewDidLoad() {
        super.viewDidLoad()
        do {
            store = try ResourceStore()
            let configuration = WKWebViewConfiguration()
            let handler = ResourceHandler(store)
            configuration.setURLSchemeHandler(handler, forURLScheme:"opui")
            configuration.setURLSchemeHandler(handler, forURLScheme:"opgame")
            configuration.userContentController.addScriptMessageHandler(self, contentWorld:.page, name:"launcher")
            web = WKWebView(frame:view.bounds,configuration:configuration); web.autoresizingMask = [.flexibleWidth,.flexibleHeight]
            web.navigationDelegate = self; view.addSubview(web)
            web.load(URLRequest(url:URL(string:"opui://launcher/launcher.html")!))
        } catch { showError("無法載入已驗證的測試版資源") }
    }
    func showError(_ message:String) {
        let alert = UIAlertController(title:"iOS 測試版",message:message,preferredStyle:.alert)
        alert.addAction(UIAlertAction(title:"關閉",style:.default)); present(alert,animated:true)
    }
    func send(_ name:String,_ value:[String:Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject:value), let json = String(data:data,encoding:.utf8) else { return }
        web.evaluateJavaScript("window.__iosEvent?.('\(name)',\(json))",completionHandler:nil)
    }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage,
        replyHandler:@escaping(Any?,String?)->Void) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "opui",
            message.frameInfo.securityOrigin.host == "launcher", let body = message.body as? [String:Any],
            let method = body["method"] as? String else { replyHandler(nil,"Forbidden bridge origin"); return }
        let args = body["args"] as? [Any] ?? []
        Task { @MainActor in
            do {
                switch method {
                case "loadSession": replyHandler(try vault.load(),nil)
                case "saveSession": guard let value = args.first as? [String:Any] else { throw PortError.invalidRequest }; try vault.save(value); replyHandler(["ok":true],nil)
                case "getAssetsState": replyHandler(store.snapshot(),nil)
                case "installGame":
                    guard let id = args.first as? String, store.games[id] != nil, downloads[id] == nil else { throw PortError.invalidRequest }
                    downloads[id] = Task { @MainActor in
                        do { try await store.install(id) { [weak self] value in Task { @MainActor in self?.send("progress",value) } } }
                        catch { store.setState(id,["status":"error","hasInstalled":true,"message":"素材下載／驗證失敗，可重試"] ) }
                        downloads[id] = nil; send("assets",store.snapshot())
                    }
                    replyHandler(["ok":true],nil)
                case "cancelInstall": guard let id = args.first as? String else { throw PortError.invalidRequest }; store.cancel(id); replyHandler(["ok":true],nil)
                case "uninstallGame": guard let id = args.first as? String, downloads[id] == nil else { throw PortError.invalidRequest }; try store.uninstall(id); replyHandler(["ok":true],nil)
                case "launchGame":
                    guard let id = args.first as? String, let game = store.games[id], args.count == 2,
                        let bootstrap = args[1] as? [String:String] else { throw PortError.invalidRequest }
                    try openGame(id,game:game,bootstrap:bootstrap); replyHandler(["ok":true],nil)
                default:
                    // Explicitly pending; never claim a Windows binary updater can update an iOS app.
                    replyHandler(["ok":false,"state":["status":"unavailable","message":"iOS 更新接入尚未完成；測試版需重新安裝"]],nil)
                }
            } catch { replyHandler(["ok":false,"error":"iOS 操作失敗，請重試"],nil) }
        }
    }
    func openGame(_ id:String,game:GameManifest,bootstrap:[String:String]) throws {
        let configuration = WKWebViewConfiguration(); let handler = ResourceHandler(store)
        configuration.setURLSchemeHandler(handler,forURLScheme:"opgame")
        let data = try JSONSerialization.data(withJSONObject:bootstrap)
        let json = String(data:data,encoding:.utf8)!
        let injection = """
        if(location.protocol==='opgame:'){
        for(const [key,value] of Object.entries(\(json)))localStorage.setItem(key,value);
        localStorage.setItem('op_desktop_launcher','1');
        Object.defineProperty(window,'devicePixelRatio',{get:()=>1});
        let library;Object.defineProperty(window,'io',{configurable:true,get:()=>library,set:fn=>{
          library=(uri,options)=>fn(typeof uri==='string'&&/^https?:/.test(uri)?uri:'https://onepiece-card-online.onrender.com',typeof uri==='object'?uri:options);
          Object.assign(library,fn);
        }});
        }
        """
        configuration.userContentController.addUserScript(WKUserScript(source:injection,injectionTime:.atDocumentStart,forMainFrameOnly:true))
        let gameView = WKWebView(frame:.zero,configuration:configuration)
        let controller = UIViewController(); controller.view = gameView
        let navigation = UINavigationController(rootViewController:controller)
        controller.navigationItem.leftBarButtonItem = UIBarButtonItem(title:"返回啟動器",style:.plain,target:self,action:#selector(closeGame))
        navigation.modalPresentationStyle = .fullScreen
        present(navigation,animated:true)
        gameView.load(URLRequest(url:URL(string:"opgame://\(id)/\(game.entryPath)")!))
    }
    @objc func closeGame() { presentedViewController?.dismiss(animated:true) }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void) {
        guard navigationAction.request.url?.scheme == "opui", navigationAction.request.url?.host == "launcher" else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) { showError("畫面程序被 iOS 結束，尚需實機效能診斷。請重新開啟測試版。") }
}
