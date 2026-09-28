"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.BOARD_TAVERN_VFX_SANDBOX_PORT || 18934);
const PUBLIC = path.resolve(__dirname, "../public");
const SANDBOX = path.join(__dirname, "board_tavern_vfx_sandbox.html");
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
};

http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${HOST}:${PORT}`).pathname;
  let filename = null;
  if (pathname === "/" || pathname === "/vfx-sandbox") filename = SANDBOX;
  else if (/^\/(?:css\/board_tavern_reveal\.css|js\/(?:board_cards|board_tavern_vfx\.bundle)\.js|images\/board\/[a-zA-Z0-9_./-]+)$/.test(pathname)) {
    const candidate = path.resolve(PUBLIC, "." + pathname);
    if (candidate.startsWith(PUBLIC + path.sep)) filename = candidate;
  }
  if (!filename) {
    response.writeHead(404).end("Not found");
    return;
  }
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": MIME[path.extname(filename)] || "application/octet-stream",
      "cache-control": "no-store",
      "content-length": stat.size,
    });
    fs.createReadStream(filename).pipe(response);
  });
}).listen(PORT, HOST, () => {
  console.log(`Tavern VFX sandbox: http://${HOST}:${PORT}/vfx-sandbox`);
});
