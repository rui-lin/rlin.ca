var express = require("express");
var app = express();
var oneDay = 86400000;

app.use(express.logger());
app.use(express.compress());
app.use(express.static(__dirname + '/public', { maxAge: oneDay }));

/*
app.get('/', function(request, response) {
  //response.send('Hello World!');
  response.send(fs.readFileSync("index.html", "utf8"));
});
*/

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

