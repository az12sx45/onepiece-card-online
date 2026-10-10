import Foundation
import Network

// Stable loopback origins keep localStorage, relative URLs and video ranges compatible.
// Listener binds only 127.0.0.1; it is never a LAN/public server.
final class LoopbackServer {
    let port: UInt16
    private let listener: NWListener
    private let queue = DispatchQueue(label:"tabletop.ios.loopback",qos:.userInitiated)
    private let store: ResourceStore
    private let gameId: String?
    init(port:UInt16,store:ResourceStore,gameId:String? = nil) throws {
        self.port=port; self.store=store; self.gameId=gameId
        let parameters=NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host:"127.0.0.1",port:NWEndpoint.Port(rawValue:port)!)
        listener=try NWListener(using:parameters)
    }
    func start(ready:@escaping(Result<Void,Error>)->Void) {
        var notified=false
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready: if !notified { notified=true; ready(.success(())) }
            case .failed(let error): if !notified { notified=true; ready(.failure(error)) }
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self=self else { connection.cancel(); return }
            connection.start(queue:self.queue); self.read(connection,bytes:Data())
        }
        listener.start(queue:queue)
    }
    deinit { listener.cancel() }
    private func read(_ connection:NWConnection,bytes:Data) {
        connection.receive(minimumIncompleteLength:1,maximumLength:16384) { [weak self] data,_,done,error in
            guard let self=self, error == nil else { connection.cancel(); return }
            var combined=bytes; if let data=data { combined.append(data) }
            guard combined.count <= 32768 else { self.error(connection,status:413); return }
            if let request=String(data:combined,encoding:.utf8),request.contains("\r\n\r\n") { self.respond(connection,request:request) }
            else if done { connection.cancel() } else { self.read(connection,bytes:combined) }
        }
    }
    private func error(_ connection:NWConnection,status:Int) {
        connection.send(content:Data("HTTP/1.1 \(status) Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8),completion:.contentProcessed{_ in connection.cancel()})
    }
    private func respond(_ connection:NWConnection,request:String) {
        let lines=request.components(separatedBy:"\r\n")
        let first=(lines.first ?? "").split(separator:" ")
        guard first.count == 3,["GET","HEAD"].contains(String(first[0])),first[1].hasPrefix("/") else { error(connection,status:405); return }
        let head=first[0] == "HEAD"
        let requestPath=String(first[1])
        let prefix = gameId.map { "opgame://\($0)" } ?? "opui://launcher"
        guard let url=URL(string:prefix+requestPath) else { error(connection,status:400); return }
        let rangeLine=lines.first(where:{$0.lowercased().hasPrefix("range:")})
        Task {
            do {
                let (file,mime)=try await store.resolve(url)
                let size=(try FileManager.default.attributesOfItem(atPath:file.path)[.size] as? NSNumber)?.intValue ?? 0
                var start=0;var end=max(0,size-1);var status=200
                if let range=rangeLine?.components(separatedBy:"bytes=").last,rangeLine?.contains("bytes=") == true {
                    let fields=range.trimmingCharacters(in:.whitespaces).split(separator:"-",omittingEmptySubsequences:false)
                    guard fields.count == 2,!range.contains(","),let value=Int(fields[0]),value >= 0,value < size else { self.error(connection,status:416);return }
                    start=value
                    if !fields[1].isEmpty { guard let last=Int(fields[1]),last >= start else { self.error(connection,status:416);return };end=min(last,size-1) }
                    status=206
                }
                let length=size == 0 ? 0 : end-start+1
                let rangeHeader=status == 206 ? "Content-Range: bytes \(start)-\(end)/\(size)\r\n" : ""
                let headers="HTTP/1.1 \(status) OK\r\nContent-Type: \(mime)\r\nContent-Length: \(length)\r\nAccept-Ranges: bytes\r\n\(rangeHeader)Connection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n"
                let handle=try FileHandle(forReadingFrom:file);try handle.seek(toOffset:UInt64(start))
                connection.send(content:Data(headers.utf8),completion:.contentProcessed{[weak self] error in
                    if error != nil || head { try? handle.close();connection.cancel();return }
                    self?.sendFile(connection,handle:handle,remaining:length)
                })
            } catch { self.error(connection,status:404) }
        }
    }
    private func sendFile(_ connection:NWConnection,handle:FileHandle,remaining:Int) {
        if remaining == 0 { try? handle.close();connection.cancel();return }
        do {
            guard let data=try handle.read(upToCount:min(65536,remaining)),!data.isEmpty else { try? handle.close();connection.cancel();return }
            connection.send(content:data,completion:.contentProcessed{[weak self] error in
                if error != nil { try? handle.close();connection.cancel();return }
                self?.sendFile(connection,handle:handle,remaining:remaining-data.count)
            })
        } catch { try? handle.close();connection.cancel() }
    }
}
