var express = require("express");
var bodyParser = require("body-parser");


// bring in the models
var db = require("./models");

var app = express();
// Serve static content for the app from the "public" directory in the application directory.
app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({
  extended: false
}));

var routes = require("./controllers/bizDb_controller");

require("./routes/api-routes.js")(app);


app.use("/", routes);
var port = process.env.PORT || 3000;
db.sequelize.sync().then(function() {
  app.listen(port);
});
