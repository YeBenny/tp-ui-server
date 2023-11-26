var express = require("express");
var { createProxyMiddleware } = require("http-proxy-middleware");
var app = express();

app.use(express.static("public"));

var apiProxy1 = createProxyMiddleware("/tp-usercore/v1", {
  target: "http://111.230.206.174:8001",
  changeOrigin: true,
});
var apiProxy2 = createProxyMiddleware("/tp-trancore/v1", {
  target: "http://111.230.206.174:8002",
  changeOrigin: true,
});
app.use(apiProxy1);
app.use(apiProxy2);

app.listen(3000, function () {
  console.log("Web server listening on port 3000");
});
