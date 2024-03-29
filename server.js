var express = require("express");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var moment = require("moment");
// bring in the models
var db = require("./models");

var app = express();
// Serve static content for the app from the "public" directory in the application directory.
app.use(express.static(__dirname + "/public"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.text());
app.use(bodyParser.json({type: 'application/vnd.api+json'}));

// override with POST having ?_method=DELETE
app.use(methodOverride("_method"));
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({
  defaultLayout: "main"
}));

app.set("view engine", "handlebars");

var routes = require("./controllers/bizDb_controller");

require("./routes/api-routes.js")(app);

app.use("/", routes);
app.use("/select", routes);
var port = process.env.PORT || 3000;
db.sequelize.sync().then(function() {
  app.listen(port);
});
