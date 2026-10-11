const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const page = path.join(__dirname, 'index.html');
const server = http.createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(page).pipe(response);
    return;
  }
  response.writeHead(404);
  response.end();
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
