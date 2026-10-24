// Serves dist-inline/index.js on http://localhost:8787 with Node, for checking a build in a
// browser or running Lighthouse against it. Rebuild with npm run build:inline first.
//
//   npm run serve

import { createServer } from "node:http";

const PORT = Number(process.env.PORT) || 8787;
const worker = (await import(new URL("../dist-inline/index.js", import.meta.url))).default;

createServer(async (req, res) => {
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
  const response = await worker.fetch(
    new Request("https://toiletpaper.app" + req.url, { method: req.method, headers: req.headers, body, duplex: "half" }),
  );
  const headers = Object.fromEntries(response.headers);
  // Redirects point at the real site; keep them on this server.
  if (headers.location) headers.location = headers.location.replace("https://toiletpaper.app", "");
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
