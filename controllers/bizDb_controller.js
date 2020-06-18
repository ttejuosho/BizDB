var express = require("express");

var router = express.Router();
// grabbing our models
var db = require("../models");

router.get("/", (req, res) => {
  res.redirect("/index");
});

router.get("/auction", (req, res) => {
  res.render("auction");
});

router.get("/index", (req, res) => {
  db.Business.count().then((dbCount) => {
    return res.render("index", { count: dbCount });
  });
});

router.get("/select", (req, res) => {
  db.Business.count().then((dbCount) => {
    return res.render("select", { count: dbCount });
  });
});

module.exports = router;
