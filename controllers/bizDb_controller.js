import express from 'express';
import db from '../models/index.cjs';

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/index");
});

router.get("/auction", (req, res) => {
  res.render("auction");
});

router.get("/autos", (req, res) => {
  res.render("autos");
});

router.get("/vq", (req, res) => {
  res.render("autos2");
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

export default router;
