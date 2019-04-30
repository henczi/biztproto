const PORT = 1234;
const fs = require("fs");
const http = require('http');
const https = require('https');

// memory db
const _db = {};

function requestHandler(req, res) {
  const [_, action, key, time] = req.url.split('/');

  // LOG request
  console.log('REQUEST: ', req.method, action, key, time);

  // POST /send/<key>
  if (req.method == 'POST' && action == 'send') {
    var body = '';
    req.on('data', (data) => body += data);
    req.on('end', function () {
      console.log('body: ', body);
      _db[key] = _db[key] || [];
      _db[key].push({ts: +new Date, data: body});
      res.writeHead(201);
      res.end();
    });

  // GET /get/<key>/<ts>
  } else if (req.method == 'GET' && action == 'get') {
    var tfrom = +time || +new Date;
    const ret = (_db[key] || []).filter(x => x.ts >= tfrom);
    res.writeHead(200);
    res.end(JSON.stringify(ret));
  } else {
    res.writeHead(200);
    res.end('server');
  }
}

https.createServer(
  {
    key: fs.readFileSync('localhost-privkey.pem'),
    cert: fs.readFileSync('localhost-cert.pem')
  },
  requestHandler
).listen(PORT);
http.createServer((req, res) => { res.writeHead(302, {'Location': `https://localhost:${PORT}`}); res.end(); }).listen(1212);
console.log('Server started at port: ' + PORT);

