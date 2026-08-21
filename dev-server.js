"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

let cardHandler = null;
let inviteHandler = null;
try { cardHandler = require("./api/card"); } catch {}
try { inviteHandler = require("./api/invite"); } catch {}

function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>404 Not Found</h1><p>File does not exist: " + filePath + "</p>");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileSize = stats.size;
    const range = req.headers.range;

    // Handle range requests for video and audio
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
        return res.end();
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      });
      return fileStream.pipe(res);
    }

    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname || "/");

  // Route /invite/*
  const inviteMatch = pathname.match(/^\/invite\/([^/?#]+)/i);
  if (inviteMatch && inviteHandler) {
    try {
      req.headers["x-forwarded-for"] = req.socket.remoteAddress || "127.0.0.1";
      await inviteHandler(req, res);
      return;
    } catch (e) {
      console.error("Invite handler error:", e);
    }
  }

  // Route /3D Wedding Invitation Sample 2/share.html
  if (/^\/3D Wedding Invitation Sample 2\/share\.html/i.test(pathname) && cardHandler) {
    try {
      req.headers["x-forwarded-for"] = req.socket.remoteAddress || "127.0.0.1";
      if (!parsedUrl.query.template) {
        req.url = req.url.includes("?") ? req.url + "&template=sample2" : req.url + "?template=sample2";
      }
      await cardHandler(req, res);
      return;
    } catch (e) {
      console.error("Card handler error:", e);
    }
  }

  // Alias fallback for /world/* and /assets/* to Sample 2
  let filePath = path.join(ROOT, pathname);
  if (!fs.existsSync(filePath)) {
    const s2Path = path.join(ROOT, "3D Wedding Invitation Sample 2", pathname);
    if (fs.existsSync(s2Path)) {
      filePath = s2Path;
    }
  }

  // Default directory index
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    if (fs.existsSync(path.join(filePath, "index.html"))) {
      filePath = path.join(filePath, "index.html");
    } else if (fs.existsSync(path.join(filePath, "invitation.html"))) {
      filePath = path.join(filePath, "invitation.html");
    }
  }

  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 DeepDreams Local Server is running on port ${PORT}!`);
  console.log(`======================================================`);
  console.log(`Main Portfolio:             http://localhost:${PORT}/`);
  console.log(`3D Wedding Invitation:      http://localhost:${PORT}/3D%20Wedding%20Invitation%20Sample%202/`);
  console.log(`3D Invitation Editor:       http://localhost:${PORT}/3D%20Wedding%20Invitation%20Sample%202/create.html`);
  console.log(`3D Baraat Experience:       http://localhost:${PORT}/3D%20Wedding%20Invitation%20Sample%202/world/`);
  console.log(`Sample 1 Invitation:        http://localhost:${PORT}/wedding-invite%20sample%201/`);
  console.log(`======================================================\n`);
});
