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

router.get("/vehicle/:vehicleId", (req, res) => {
  const vehicleId = String(req.params.vehicleId ?? "").trim();
  if (!vehicleId) return res.status(400).send("vehicleId is required.");

  return res.render("vehicle", {
    vehicleId,
  });
});

export default router;
