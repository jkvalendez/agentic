import http from "node:http";
import { URL } from "node:url";
import { add, multiply, isEven } from "./math.js";

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello from the agentic-dev sample project!\n");
    return;
  }

  if (url.pathname === "/add") {
    const a = Number(url.searchParams.get("a"));
    const b = Number(url.searchParams.get("b"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ a, b, result: add(a, b) }));
    return;
  }

  if (url.pathname === "/multiply") {
    const a = Number(url.searchParams.get("a"));
    const b = Number(url.searchParams.get("b"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ a, b, result: multiply(a, b) }));
    return;
  }

  if (url.pathname === "/is-even") {
    const n = Number(url.searchParams.get("n"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ n, result: isEven(n) }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found\n");
});

server.listen(PORT, () => {
  console.log(`Sample project listening on http://localhost:${PORT}`);
});
