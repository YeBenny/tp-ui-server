var express = require("express");
var request = require("request");
let fs = require("fs");
var https = require("https");
var cookieParser = require("cookie-parser");
var timeout = require("connect-timeout");
var jwt = require("jsonwebtoken");
var { createProxyMiddleware } = require("http-proxy-middleware");

require("dotenv").config();

var app = express();

app.use(express.static(__dirname + "/public"));
app.use("/css", express.static(__dirname + "/node_modules/bootstrap/dist/css"));
app.use("/js", express.static(__dirname + "/node_modules/bootstrap/dist/js"));
app.use("/assets", express.static(__dirname + "/assets"));
app.use("/.well-known", express.static(__dirname + "/.well-known"));

var simpleRequestLogger = (proxyServer, options) => {
  proxyServer.on("proxyReq", (proxyReq, req, res) => {
    console.log(`[HPM] [${req.method}] ${req.url}`); // outputs: [HPM] GET /users
  });
};

var apiProxy1 = createProxyMiddleware("/tp-usercore/v1", {
  target: "http://111.230.206.174:8001",
  changeOrigin: true,
  plugins: [simpleRequestLogger],
});
var apiProxy2 = createProxyMiddleware("/tp-trancore/v1", {
  target: "http://111.230.206.174:8002",
  changeOrigin: true,
  plugins: [simpleRequestLogger],
});
var apiProxy3 = createProxyMiddleware("/tp-asset-service/v1", {
  target: "http://111.230.206.174:8003",
  changeOrigin: true,
  plugins: [simpleRequestLogger],
});
app.use(apiProxy1);
app.use(apiProxy2);
app.use(apiProxy3);

app.use(timeout("5s"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/home", function (_, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get("/deploy", function (req, res) {
  var accessToken = req.cookies.token;
  if (!accessToken) return res.redirect("/deploy/login");

  try {
    var decoded = jwt.verify(accessToken, process.env.TOKEN_SECRET);
    if (!decoded.admin) return res.redirect("/deploy/login");
    res.sendFile(__dirname + "/index.html");
  } catch (error) {
    return res.redirect("/deploy/login");
  }
});

app.get("/deploy/login", function (_, res) {
  res.sendFile(__dirname + "/login.html");
});

app.post("/deploy/login", function (req, res) {
  try {
    var username = req.body.username;
    var password = req.body.password;
    if (
      username === process.env.USERNAME &&
      password === process.env.PASSWORD
    ) {
      var token = jwt.sign({ admin: true }, process.env.TOKEN_SECRET, {
        expiresIn: 60 * 60,
      });
      var json = {
        error: 0,
        errorMessage: "",
        data: token,
      };
      res.cookie("token", token, {
        maxAge: 900000,
        httpOnly: true,
      });
      res.send(json);
    } else {
      var json = {
        error: 10001,
        errorMessage: "Username and password do not match",
      };
      res.send(json);
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(404);
  }
});

app.get("/deploy/builds", function (req, res) {
  var accessToken = req.cookies.token;
  if (!accessToken) return res.sendStatus(401);

  try {
    var decoded = jwt.verify(accessToken, process.env.TOKEN_SECRET);
    if (!decoded.admin) return res.sendStatus(401);
  } catch (error) {
    return res.sendStatus(401);
  }

  try {
    var token = process.env.CODEMAGIC_TOKEN;
    var appId = process.env.CODEMAGIC_APPID;
    var headers = {
      "Content-Type": "application/json",
      "x-auth-token": token,
    };
    request(
      {
        headers: headers,
        uri: `https://api.codemagic.io/builds?appId=${appId}`,
        method: "GET",
      },
      function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var bodyJson = JSON.parse(body);
          var applications = bodyJson.applications.filter(
            (application) => application._id === appId
          );
          var builds = bodyJson.builds;
          var json = {
            error: 0,
            errorMessage: "",
            data: { applications: applications, builds: builds },
          };
          res.send(json);
        } else {
          console.log(error);
          res.sendStatus(404);
        }
      }
    );
  } catch (error) {
    console.log(error);
    res.sendStatus(404);
  }
});

app.post("/deploy/builds", function (req, res) {
  var accessToken = req.cookies.token;
  if (!accessToken) return res.sendStatus(401);

  try {
    var decoded = jwt.verify(accessToken, process.env.TOKEN_SECRET);
    if (!decoded.admin) return res.sendStatus(401);
  } catch (error) {
    return res.sendStatus(401);
  }

  try {
    var token = process.env.CODEMAGIC_TOKEN;
    var appId = process.env.CODEMAGIC_APPID;
    var headers = {
      "Content-Type": "application/json",
      "x-auth-token": token,
    };
    var json = {
      appId: appId,
      workflowId: req.body.workflowId,
      branch: "cicd",
    };
    request(
      {
        headers: headers,
        uri: "https://api.codemagic.io/builds",
        json: json,
        method: "POST",
      },
      function (error, response, _) {
        if (!error && response.statusCode == 200) {
          var json = {
            error: 0,
            errorMessage: "",
            data: "success",
          };
          res.send(json);
        } else {
          console.log(error);
          res.sendStatus(404);
        }
      }
    );
  } catch (error) {
    console.log(error);
    res.sendStatus(404);
  }
});

app.post("/deploy/artefacts/download", function (req, res) {
  var accessToken = req.cookies.token;
  if (!accessToken) return res.sendStatus(401);

  try {
    var decoded = jwt.verify(accessToken, process.env.TOKEN_SECRET);
    if (!decoded.admin) return res.sendStatus(401);
  } catch (error) {
    return res.sendStatus(401);
  }

  try {
    var token = process.env.CODEMAGIC_TOKEN;
    var headers = {
      "Content-Type": "application/json",
      "x-auth-token": token,
    };
    var url = req.body.url;
    var json = {
      expiresAt: Math.floor(Date.now() / 1000 + 60),
    };
    request(
      {
        headers: headers,
        uri: `${url}/public-url`,
        json: json,
        method: "POST",
      },
      function (error, response, _) {
        if (!error && response.statusCode == 200) {
          var json = {
            error: 0,
            errorMessage: "",
            data: response.body.url,
          };
          res.send(json);
        } else {
          console.log(error);
          res.sendStatus(404);
        }
      }
    );
  } catch (error) {
    console.log(error);
    res.sendStatus(404);
  }
});

https
  .createServer(
    {
      key: fs.readFileSync(__dirname + "/certs/yebenny.cn.key"),
      cert: fs.readFileSync(__dirname + "/certs/yebenny.cn.crt"),
    },
    app
  )
  .listen(443, function () {
    console.log("Web server listening on port 443");
  });
