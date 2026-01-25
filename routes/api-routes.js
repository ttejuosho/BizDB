import db from "../models/index.cjs";
import Sequelize from "sequelize";
const Op = Sequelize.Op;
import neatCsv from "neat-csv";
import fs from "fs";
import es from "event-stream";
import moment from "moment";
import { fn, col, where, QueryTypes } from "sequelize";
import path from "path";
import csv from "csv-parser";


// Routes
// =============================================================
export default function (app) {
  function slugCode(input) {
    // canonical “code” used for uniqueness. Example: "MERCEDES-BENZ" -> "mercedes-benz"
    return String(input ?? "")
      .trim()
      .toLowerCase()
      .replace(/["']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function toIntOrNull(v) {
    const n = Number.parseInt(String(v ?? "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  function toDateOrNull(v) {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Infer country of manufacture from VIN WMI first character.
   * Rule set provided by you (not exhaustive).
   *
   * @param {string | null | undefined} vin
   * @returns {string | null} Country name or null if vin missing/unknown
   */
  function getCountryOfManufactureFromVin(vin) {
    if (!vin) return null;

    const v = String(vin).trim().toUpperCase();
    if (v.length === 0) return null;

    const first = v[0];

    switch (first) {
      case "1":
      case "4":
      case "5":
        return "United States";
      case "2":
        return "Canada";
      case "3":
        return "Mexico";
      case "J":
        return "Japan";
      case "K":
        return "South Korea";
      case "L":
        return "China";
      case "S":
        return "United Kingdom";
      case "W":
        return "Germany";
      case "9":
        return "Brazil";
      default:
        return null; // unknown / not covered by this rule set
    }
  }

  /**
   * Fetch makes for a list of make IDs.
   *
   * @param {object} db - Your sequelize db object containing db.Make
   * @param {string[] | string} makeIdsInput - Array of UUIDs or a comma-separated string of UUIDs
   * @returns {Promise<{ meta: { requested: number, returned: number, missing: string[] }, results: any[] }>}
   */
  async function getMakesByIds(makeIdsInput) {
    const makeIds = Array.isArray(makeIdsInput)
      ? makeIdsInput
      : parseMultiParam(makeIdsInput);

    if (makeIds.length === 0) {
      const err = new Error("makeIds is required (one or more UUIDs).");
      err.statusCode = 400;
      throw err;
    }

    const badMakeIds = makeIds.filter((x) => !isUuid(x));
    if (badMakeIds.length) {
      const err = new Error("One or more makeIds are not valid UUIDs.");
      err.statusCode = 400;
      err.badMakeIds = badMakeIds;
      throw err;
    }

    const makes = await db.Make.findAll({
      attributes: ["make_id", "make_code", "make_name", "is_active"],
      where: { make_id: { [Op.in]: makeIds } },
      raw: true,
    });

    // Preserve request order
    const makesById = new Map(
      makes.map((r) => [r.make_id, r.make_name ?? null])
    );
    const ordered = makeIds.map((id) => makesById.get(id)).filter(Boolean);
    return ordered;
  }

  /**
   * Optional: Express handler wrapper using the function above.
   */
  function makeGetMakesByIdsHandler() {
    return async (req, res) => {
      try {
        const makeIds = req.query.makeId ?? req.query.makeIds;
        const payload = await getMakesByIds(makeIds);
        res.json(payload);
      } catch (err) {
        const status = err.statusCode || 500;
        res.status(status).json({
          error: err.message || "Failed to load makes by ids.",
          badMakeIds: err.badMakeIds,
        });
      }
    };
  }

  /**
   * Fetch model names for the given modelIds, preserving input order.
   *
   * @param {object} db - Your sequelize db object containing db.Model
   * @param {string[]} modelIds - Array of UUID model IDs
   * @returns {Promise<(string|null)[]>} Array of model_name values aligned to modelIds input order.
   *          If a modelId is not found, the corresponding entry is null.
   */
  async function getModelsByIds(modelIds) {
    if (!Array.isArray(modelIds) || modelIds.length === 0) {
      const err = new Error("modelIds must be a non-empty array of UUIDs.");
      err.statusCode = 400;
      throw err;
    }

    const badIds = modelIds.filter((id) => !isUuid(id));
    if (badIds.length) {
      const err = new Error("One or more modelIds are not valid UUIDs.");
      err.statusCode = 400;
      err.badModelIds = badIds;
      throw err;
    }

    const rows = await db.Model.findAll({
      attributes: ["model_id", "model_name"],
      where: {
        model_id: { [Op.in]: modelIds },
        is_active: true,
      },
      raw: true,
    });

    // If model_id is not globally unique in your schema, this will pick the first row per model_id.
    // If that's a risk in your data, enforce global uniqueness for model_id or require make_id too.
    const nameById = new Map(
      rows.map((r) => [r.model_id, r.model_name ?? null])
    );

    return modelIds.map((id) => nameById.get(id) ?? null);
  }

  app.get("/api/test", async (req, res) => {
    console.log(await getMakesByIds(["113f7cec-318e-4112-9965-a73e38612dcf"]));
    console.log(await getModelsByIds(["cceddcb9-5136-4683-805d-cbf77269a606"]));
  });

  app.get(`/api/Business/:search`, (req, res) => {
    db.Business.findAll({
      where: {
        Company: {
          [Op.startsWith]: req.params.search,
        },
      },
    }).then(function (data) {
      res.json(data);
    });
  });

  app.delete("/api/deleteBusiness/:id", (req, res) => {
    db.Business.destroy({
      where: {
        id: req.params.id,
      },
    }).then((dbBusiness) => {
      res.json(dbBusiness);
    });
  });

  app.post("/api/updateBusiness/:id", (req, res) => {
    db.Business.update(
      {
        Company: req.body.Company,
        Address: req.body.Address,
        City: req.body.City,
        State: req.body.State,
        Zip: req.body.Zip,
        County: req.body.County,
        Phone: req.body.Phone,
        Website: req.body.Website,
        Contact: req.body.Contact,
        Title: req.body.Title,
        Direct_Phone: req.body.Direct_Phone,
        Email: req.body.Email,
        Sales: req.body.Sales,
        Employees: req.body.Employees,
        SIC_Code: req.body.SIC_Code,
        Industry: req.body.Industry,
      },
      {
        where: {
          id: req.params.id,
        },
      }
    ).then((dbBusiness) => {
      res.json(dbBusiness);
    });
  });

  app.get("/api/getBusiness/:id", (req, res) => {
    db.Business.findByPk(req.params.id).then((dbBusiness) => {
      res.json(dbBusiness);
    });
  });

  app.post("/api/saveBusiness", (req, res) => {
    db.Business.findOne({
      where: {
        Company: req.body.Company,
        Contact: req.body.Contact,
        Email: req.body.Email,
      },
    }).then((dbBusiness) => {
      if (dbBusiness == null) {
        db.Business.create({
          Company: req.body.Company,
          Address: req.body.Address,
          City: req.body.City,
          State: req.body.State,
          Zip: req.body.Zip,
          County: req.body.County,
          Phone: req.body.Phone,
          Website: req.body.Website,
          Contact: req.body.Contact,
          Title: req.body.Title,
          Direct_Phone: req.body.Direct_Phone,
          Email: req.body.Email,
          Sales: req.body.Sales,
          Employees: req.body.Employees,
          SIC_Code: req.body.SIC_Code,
          Industry: req.body.Industry,
        }).then((dbBusiness) => {
          res.json(dbBusiness);
        });
      } else {
        res.json("Business Already Exists");
      }
    });
  });

  app.get("/api/getBusinesses", (req, res) => {
    db.Business.findAll({}).then((dbBusiness) => {
      res.json(dbBusiness);
    });
  });

  app.get("/api/loadCSV/", (req, res) => {
    fs.readFile("8611.csv", async (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      let csvData = await neatCsv(data);
      //var oo = [];
      for (var i = 0; i < csvData.length; i++) {
        if (csvData[i]["1"] !== "Address" && csvData["1"] !== undefined) {
          var cleanObj = {
            Company: csvData[i]["0"],
            Address: csvData[i]["1"],
            City: csvData[i]["2"],
            State: csvData[i]["3"],
            Zip: csvData[i]["4"],
            County: csvData[i]["5"],
            Phone: csvData[i]["6"],
            Website: csvData[i]["7"],
            Contact: csvData[i]["8"],
            Title: csvData[i]["9"],
            "Direct Phone": csvData[i]["10"],
            Email: csvData[i]["11"],
            Sales: csvData[i]["12"],
            Employees: csvData[i]["13"],
            "SIC Code": csvData[i]["14"],
            Industry: csvData[i]["15"],
          };

          if (JSON.stringify(cleanObj) !== "{}") {
            //oo.push(cleanObj);
            db.Business.create(cleanObj);
          }
        }
      }

      res.json("ok");
    });
  });

  app.get("/api/bizRecordCount", (req, res) => {
    db.Business.findAndCountAll().then((dbCount) => {
      res.json(dbCount.count + " records in db");
    });
  });

  app.get("/api/getBusinesses/:pageNumber", (req, res) => {
    let limit = 50;
    let offset = 0;
    db.Business.findAndCountAll()
      .then((dbCount) => {
        let page = req.params.pageNumber; // page number
        let pages = Math.ceil(dbCount.count / limit);
        offset = limit * (page - 1);

        db.Business.findAll({
          limit: limit,
          offset: offset,
          $sort: { id: 1 },
        }).then((data) => {
          res
            .status(200)
            .json({ count: dbCount.count, pages: pages, data: data });
        });
      })
      .catch(function (error) {
        res.status(500).send("Internal Server Error");
      });
  });

  app.get("/api/loadFileData", (req, resp) => {
    var badCount = 0;
    var s = fs
      .createReadStream("8611.csv")
      .pipe(es.split())
      .pipe(
        es.mapSync((business) => {
          var businessArray = business.split('","');
          if (businessArray.length === 16) {
            businessArray[0] = businessArray[0].substring(
              1,
              businessArray[0].length
            );
            businessArray[15] = businessArray[15].substring(
              0,
              businessArray[15].length - 1
            );
            var cleanObj = {
              Company: businessArray[0],
              Address: businessArray[1],
              City: businessArray[2],
              State: businessArray[3],
              Zip: businessArray[4],
              County: businessArray[5],
              Phone: businessArray[6],
              Website: businessArray[7],
              Contact: businessArray[8],
              Title: businessArray[9],
              Direct_Phone: businessArray[10],
              Email: businessArray[11],
              Sales: businessArray[12],
              Employees: businessArray[13],
              SIC_Code: businessArray[14],
              Industry: businessArray[15],
            };
            if (cleanObj.Company.toLowerCase().includes("chamber")) {
              db.Business.create(cleanObj).catch(function (err) {
                resp.write(
                  "<p>Failed to save " +
                    cleanObj.Company +
                    " data to the db</p>"
                );
                console.log(err);
              });

              resp.write(
                "<p>" +
                  cleanObj.Company +
                  " has been saved to the database.</p>"
              );
            }
          } else {
            fs.appendFile(
              "missed.csv",
              businessArray.toString() + "\n",
              function (err) {
                if (err) {
                  console.log(
                    "Couldnt write " + businessArray.toString() + " to File."
                  );
                  return console.log(err);
                }
              }
            );
            badCount++;
          }
        })
      )
      .on("error", (err) => {
        console.log("Error while reading file.", err);
      })
      .on("end", () => {
        console.log("Read File Successfull");
        resp.write(badCount + " records were not inserted.");
      });
  });

  // This method does Multi-Column Search
  app.get("/api/search/:searchQuery", (req, res) => {
    const Op = Sequelize.Op;
    const searchQuery = req.params.searchQuery;
    const requestStart = Date.now();
    db.Business.findAll({
      where: {
        [Op.or]: {
          Company: { [Op.like]: "%" + searchQuery + "%" },
          Address: { [Op.like]: "%" + searchQuery + "%" },
          City: { [Op.like]: "%" + searchQuery + "%" },
          State: { [Op.like]: "%" + searchQuery + "%" },
          Zip: { [Op.like]: "%" + searchQuery + "%" },
          County: { [Op.like]: "%" + searchQuery + "%" },
          Contact: { [Op.like]: "%" + searchQuery + "%" },
          Email: { [Op.like]: "%" + searchQuery + "%" },
          Phone: { [Op.like]: "%" + searchQuery + "%" },
          Website: { [Op.like]: "%" + searchQuery + "%" },
          Industry: { [Op.like]: "%" + searchQuery + "%" },
        },
      },
    })
      .then((dbBusiness) => {
        const processingTime = Date.now() - requestStart;
        var data = {
          processingTime: processingTime / 1000 + " seconds",
          rowCount: dbBusiness.length,
          results: dbBusiness,
        };
        res.json(data);
      })
      .catch(function (err) {
        res.render("error", err);
      });
  });

  // The Get searches specified columns
  // searchBy is the column name && searchQuery is the value searchFor
  app.get("/api/advsearch/:searchBy/:searchQuery", (req, res) => {
    const Op = Sequelize.Op;
    const searchBy = req.params.searchBy;
    const searchQuery = req.params.searchQuery;
    const searchObj = {};
    searchObj[searchBy] = { [Op.like]: "%" + searchQuery + "%" };
    const requestStart = Date.now();

    db.Business.findAll({
      where: {
        [Op.or]: searchObj,
      },
    })
      .then((dbBusiness) => {
        const processingTime = Date.now() - requestStart;
        var data = {
          processingTime: processingTime / 1000 + " seconds",
          rowCount: dbBusiness.length,
          results: dbBusiness,
        };
        res.json(data);
      })
      .catch(function (err) {
        res.render("error", err);
      });
  });

  // Gets all the values in the specified columns
  app.get("/api/search/column/:columnName", (req, res) => {
    db.Business.findAll({
      attributes: [
        // specify an array where the first element is the SQL function and the second is the alias
        [
          Sequelize.fn("DISTINCT", Sequelize.col(req.params.columnName)),
          "value",
        ],
        //[ "id", "id" ],
      ],
    }).then(function (dbBusiness) {
      res.json(dbBusiness);
    });
  });

  app.get("/api/autoRecordCount", (req, res) => {
    db.VehicleSale.findAndCountAll().then((dbCount) => {
      res.json({ count: dbCount.count });
    });
  });

// ---- parsing helpers ----
function slugify(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSaleDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "0") return null;

  // YYYYMMDD (e.g., 20200702)
  if (/^\d{8}$/.test(s)) {
    const yyyy = s.slice(0, 4);
    const mm = s.slice(4, 6);
    const dd = s.slice(6, 8);
    return `${yyyy}-${mm}-${dd}`; // DATEONLY-friendly
  }

  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = String(mdy[1]).padStart(2, "0");
    const dd = String(mdy[2]).padStart(2, "0");
    const yyyy = mdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // ISO-ish fallback
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function parseHHMMToTime(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Sometimes numeric like 1200 or 930
  if (/^\d+$/.test(s)) {
    s = s.padStart(4, "0");
    const hh = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const h = Number(hh);
    const m = Number(mm);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${hh}:${mm}:00`;
    return null;
  }

  // Already time-ish
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return s.length === 5 ? `${s}:00` : s;
  }

  return null;
}

function parseBoolYN(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "Y" || s === "YES" || s === "TRUE" || s === "1") return true;
  if (s === "N" || s === "NO" || s === "FALSE" || s === "0") return false;
  return null;
}

function parseDecimal(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // remove currency symbols/commas
  const cleaned = s.replace(/[$,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

app.get("/api/loadVehiclesData", async (req, res) => {
  const filePath = "salesdata1.csv";

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let badCount = 0;
  let badVins = [];

  // Light in-memory caches to reduce DB roundtrips
  const makeCache = new Map(); // make_code -> make_id
  const modelCache = new Map(); // `${make_id}:${model_code}` -> model_id
  const yardCache = new Map(); // yard_number -> yard_id
  const locationCache = new Map(); // `${city}|${state}|${zip}|${country}` -> location_id
  const saleEventCache = new Map(); // `${yard_id}|${sale_date}|${sale_time}|${tz}` -> sale_event_id
  const vehicleCache = new Map(); // vin -> vehicle_id

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: `CSV file not found: ${filePath}` });
    }

    const parser = fs.createReadStream(filePath).pipe(
      csv({
        columns: true,          // use header row
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
        skip_empty_lines: true,
      })
    );

    for await (const row of parser) {
      processed++;

      // ---- pull required fields (by header name) ----
      const yardNumberRaw = row["Yard number"];
      const yardName = row["Yard name"];
      const saleDateRaw = row["Sale Date M/D/CY"];
      const dayOfWeek = row["Day of Week"];
      const saleTimeRaw = row["Sale time (HHMM)"];
      const timeZone = row["Time Zone"];

      const lotNumberRaw = row["Lot number"];
      const itemNumberRaw = row["Item#"];

      const makeName = row["Make"];
      const modelGroup = row["Model Group"];
      const modelDetail = row["Model Detail"];
      const yearRaw = row["Year"];
      const vin = (row["VIN"] ?? "").trim() || null;

      // Location
      const city = row["Location city"];
      const state = row["Location state"];
      const zip = row["Location ZIP"];
      const country = row["Location country"];

      // Outcome fields
      const saleStatus = row["Sale Status"];
      const highBidRaw = row["High Bid =non-vix,Sealed=Vix"];
      const specialNote = row["Special Note"];
      const currencyCode = row["Currency Code"];
      const makeAnOfferRaw = row["Make-an-Offer Eligible"];
      const buyItNowRaw = row["Buy-It-Now Price"];
      const estRetailRaw = row["Est. Retail Value"];
      const repairCostRaw = row["Repair cost"];

      // Lot meta
      const gridRow = row["Grid/Row"];
      const vehicleType = row["Vehicle Type"];
      const odometer = row["Odometer"];
      const saleTitleState = row["Sale Title State"];
      const saleTitleType = row["Sale Title Type"];
      const hasKeys = row["Has Keys-Yes or No"];
      const isRunAndDrive = row["Runs/Drives"];
      const damageDescription = row["Damage Description"];
      const secondaryDamage = row["Secondary Damage"];
      const createdAtSource = row["Create Date/Time"];
      const lastUpdatedAtSource = row["Last Updated Time"];

      // Images
      const thumbnailUrl = row["Image Thumbnail"];
      const imageUrl = row["Image URL"];

      // ---- parse + validate what we need to create a sale event and lot ----
      const yardNumber = Number.parseInt(String(yardNumberRaw ?? "").trim(), 10);
      const lotNumber = Number.parseInt(String(lotNumberRaw ?? "").trim(), 10);
      const itemNumber = Number.parseInt(String(itemNumberRaw ?? "").trim(), 10);

      const sale_date = parseSaleDate(saleDateRaw);
      const sale_time = parseHHMMToTime(saleTimeRaw);

      console.log(`Processing row ${processed}: Lot ${lotNumber}, VIN ${vin}`);

      // If these are missing/unparseable, you cannot place the lot into a sale event with your current schema.
      if (!Number.isFinite(lotNumber)) {
        badCount++;
        badVins.push(vin);
        continue;
      }

      // ---- row-level transaction keeps tables consistent per row ----
      await db.sequelize.transaction(async (t) => {
        // 1) Location
        const locKey = `${city}|${state}|${zip}|${country}`;
        let location_id = locationCache.get(locKey);
        if (!location_id) {
          const [loc] = await db.Location.findOrCreate({
            where: { city, state, zip, country },
            defaults: { city, state, zip, country },
            transaction: t,
          });
          location_id = loc.location_id;
          locationCache.set(locKey, location_id);
        }

        // 2) Yard
        let yard_id = yardCache.get(yardNumber);
        if (!yard_id) {
          const [yard, yardCreated] = await db.Yard.findOrCreate({
            where: { yard_number: yardNumber },
            defaults: { yard_number: yardNumber, yard_name: yardName, location_id },
            transaction: t,
          });

          // keep yard location/name fresh if it changes
          if (!yardCreated) {
            const updatesToApply = {};
            if (yard.yard_name !== yardName && yardName) updatesToApply.yard_name = yardName;
            if (yard.location_id !== location_id && location_id) updatesToApply.location_id = location_id;
            if (Object.keys(updatesToApply).length) await yard.update(updatesToApply, { transaction: t });
          }

          yard_id = yard.yard_id;
          yardCache.set(yardNumber, yard_id);
        }

        // 3) SaleEvent
        const seKey = `${yard_id}|${sale_date}|${sale_time}|${timeZone}`;
        let sale_event_id = saleEventCache.get(seKey);
        if (!sale_event_id) {
          const [saleEvent] = await db.SaleEvent.findOrCreate({
            where: { yard_id, sale_date, sale_time, time_zone: timeZone },
            defaults: {
              yard_id,
              sale_date,
              sale_time,
              time_zone: timeZone,
              day_of_week: dayOfWeek || "",
            },
            transaction: t,
          });

          // optionally keep day_of_week updated if blank and new value arrives
          if ((!saleEvent.day_of_week || saleEvent.day_of_week === "") && dayOfWeek) {
            await saleEvent.update({ day_of_week: dayOfWeek }, { transaction: t });
          }

          sale_event_id = saleEvent.sale_event_id;
          saleEventCache.set(seKey, sale_event_id);
        }

        // 4) Make
        const make_code = slugify(makeName);
        let make_id = makeCache.get(make_code);
        if (!make_id) {
          const [mk] = await db.Make.findOrCreate({
            where: { make_code },
            defaults: { make_code, make_name: makeName, is_active: true },
            transaction: t,
          });
          make_id = mk.make_id;
          makeCache.set(make_code, make_id);
        }

        // 5) Models
        const model_code = slugify(modelGroup);
        const modelKey = `${make_id}:${model_code}`;
        let model_id = modelCache.get(modelKey);
        if (!model_id) {
          const [mdl] = await db.Model.findOrCreate({
            where: { make_id, model_code },
            defaults: {
              make_id,
              model_code,
              model_name: modelGroup,
              is_active: true,
            },
            transaction: t,
          });
          model_id = mdl.model_id;
          modelCache.set(modelKey, model_id);
        }

        // 6) Vehicle (upsert-ish)
        // If VIN exists, treat it as the identity; otherwise create a new vehicle per row.
        let vehicle;
        if (vin) {
          const cachedVehicleId = vehicleCache.get(vin);
          if (cachedVehicleId) {
            vehicle = await db.Vehicle.findByPk(cachedVehicleId, { transaction: t });
          } else {
            vehicle = await db.Vehicle.findOne({ where: { vin }, transaction: t });
          }
        }

        const vehiclePayload = {
          make_id,
          model_id,
          year: Number.isFinite(Number(yearRaw)) ? Number.parseInt(String(yearRaw), 10) : null,
          vin,
          trim: row["Trim"] || null,
          model_details: modelDetail || null,
          body_style: row["Body Style"] || null,
          exterior_color: row["Color"] || null,
          // if you later get interior color, map it; CSV sample does not provide separate interior color
          fuel_type: row["Fuel Type"] || null,
          transmission: row["Transmission"] || null,
          cylinders: row["Cylinders"] || null,
          engine_size: row["Engine"] || null,
          drivetrain: row["Drive"] || null,
          image_thumbnail_url: thumbnailUrl || null,
          image_url: imageUrl || null,
        };

        if (!vehicle) {
          vehicle = await db.Vehicle.create(vehiclePayload, { transaction: t });
          inserted++;
        } else {
          // keep it lightly updated (avoid overwriting with nulls)
          const toUpdate = {};
          for (const [k, v] of Object.entries(vehiclePayload)) {
            if (v != null && v !== "" && vehicle[k] !== v) toUpdate[k] = v;
          }
          if (Object.keys(toUpdate).length) {
            await vehicle.update(toUpdate, { transaction: t });
            updated++;
          }
        }

        if (vin) vehicleCache.set(vin, vehicle.vehicle_id);

        // 7) VehicleImage (optional)
        if (imageUrl) {
          await db.VehicleImage.findOrCreate({
            where: { vehicle_id: vehicle.vehicle_id, image_url: imageUrl },
            defaults: {
              vehicle_id: vehicle.vehicle_id,
              image_url: imageUrl,
              thumbnail_url: thumbnailUrl || null,
              is_primary: true,
            },
            transaction: t,
          });
        }

        // 8) SaleLot (upsert-ish by unique index sale_event_id + lot_number)
        const [saleLot, saleLotCreated] = await db.SaleLot.findOrCreate({
          where: { sale_event_id, lot_number: lotNumber },
          defaults: {
            sale_event_id,
            vehicle_id: vehicle.vehicle_id,
            lot_number: lotNumber,
            item_number: Number.isFinite(itemNumber) ? itemNumber : 0,
            grid_row: gridRow || null,
            vehicle_type: vehicleType || null,
            odometer: Number.isFinite(Number(odometer)) ? Number.parseInt(String(odometer), 10) : null,
            sale_title_state: saleTitleState || null,
            sale_title_type: saleTitleType || null,
            has_keys: hasKeys || null,
            runs_drives: isRunAndDrive || null,
            damage_description: damageDescription || null,
            secondary_damage: secondaryDamage || null,
            created_at_source: createdAtSource || null,
            last_updated_at_source: lastUpdatedAtSource || null,
          },
          transaction: t,
        });

        if (!saleLotCreated) {
          const lotUpdate = {};
          if (saleLot.vehicle_id !== vehicle.vehicle_id) lotUpdate.vehicle_id = vehicle.vehicle_id;
          if (Number.isFinite(itemNumber) && saleLot.item_number !== itemNumber) lotUpdate.item_number = itemNumber;
          if (gridRow && saleLot.grid_row !== gridRow) lotUpdate.grid_row = gridRow;
          if (vehicleType && saleLot.vehicle_type !== vehicleType) lotUpdate.vehicle_type = vehicleType;
          if (Number.isFinite(Number(odometer)) && saleLot.odometer !== Number.parseInt(String(odometer), 10)) {
            lotUpdate.odometer = Number.parseInt(String(odometer), 10);
          }
          if (saleTitleState && saleLot.sale_title_state !== saleTitleState) lotUpdate.sale_title_state = saleTitleState;
          if (saleTitleType && saleLot.sale_title_type !== saleTitleType) lotUpdate.sale_title_type = saleTitleType;
          if (hasKeys && saleLot.has_keys !== hasKeys) lotUpdate.has_keys = hasKeys;
          if (isRunAndDrive && saleLot.runs_drives !== isRunAndDrive) lotUpdate.runs_drives = isRunAndDrive;
          if (damageDescription && saleLot.damage_description !== damageDescription) {
            lotUpdate.damage_description = damageDescription;
          }
          if (secondaryDamage && saleLot.secondary_damage !== secondaryDamage) {
            lotUpdate.secondary_damage = secondaryDamage;
          }
          if (createdAtSource && saleLot.created_at_source !== createdAtSource) lotUpdate.created_at_source = createdAtSource;
          if (lastUpdatedAtSource && saleLot.last_updated_at_source !== lastUpdatedAtSource) lotUpdate.last_updated_at_source = lastUpdatedAtSource;
          if (Object.keys(lotUpdate).length) await saleLot.update(lotUpdate, { transaction: t });
        }

        // 9) SaleLotOutcome (one-to-one by sale_lot_id)
        const high_bid_amount = parseDecimal(highBidRaw);
        const make_an_offer_eligible = parseBoolYN(makeAnOfferRaw);
        const buy_it_now_price = parseDecimal(buyItNowRaw);
        const estimated_retail_value = parseDecimal(estRetailRaw);
        const repair_cost = parseDecimal(repairCostRaw);

        const outcomePayload = {
          sale_lot_id: saleLot.sale_lot_id,
          high_bid_raw: highBidRaw || null,
          high_bid_amount: high_bid_amount,
          buy_it_now_price: buy_it_now_price,
          make_an_offer_eligible: make_an_offer_eligible ?? false,
          estimated_retail_value: estimated_retail_value,
          repair_cost: repair_cost,
          special_note: specialNote || null,
          sale_status: saleStatus || null,
          currency_code: currencyCode || null,
        };

        const existingOutcome = await db.SaleLotOutcome.findOne({
          where: { sale_lot_id: saleLot.sale_lot_id },
          transaction: t,
        });

        if (!existingOutcome) {
          await db.SaleLotOutcome.create(outcomePayload, { transaction: t });
        } else {
          const outUpdate = {};
          for (const [k, v] of Object.entries(outcomePayload)) {
            // allow null updates only if you want to clear fields; here we preserve existing if new is null/empty
            if (v != null && v !== "" && existingOutcome[k] !== v) outUpdate[k] = v;
          }
          if (Object.keys(outUpdate).length) await existingOutcome.update(outUpdate, { transaction: t });
        }
      });
    }

    return res.json({
      ok: true,
      file: filePath,
      processed,
      insertedVehicles: inserted,
      updatedVehicles: updated,
      badCount,
      badVins,
      note: "badCount includes rows skipped due to missing/unparseable yard_number/lot_number/sale_date/sale_time/time_zone.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unexpected error",
    });
  }
});


  app.get("/api/loadAutos", (req, resp) => {
    var badCount = 0;
    var s = fs
      .createReadStream("salesdata1.csv")
      .pipe(es.split())
      .pipe(
        es.mapSync((vehicle) => {
          var vehicleArray = vehicle.split(",");
          var vArray = [];
          for (var i = 0; i < vehicleArray.length; i++) {
            if (vehicleArray[i].split("")[0] == '"') {
              var itemArray = vehicleArray[i].split("");
              itemArray.pop();
              itemArray.shift();
              vArray.push(itemArray.join(""));
            } else {
              vArray.push(vehicleArray[i]);
            }
          }

          //console.log(vArray);
          var vehicleObj = {
            Vehicle_Id: parseFloat(vArray[0]),
            Yard_Number: parseFloat(vArray[1]),
            Yard_Name: vArray[2],
            Sale_Date: moment(vArray[3]).format("MMM Do, YYYY HH:mm a"),
            Day_of_Week: vArray[4],
            Sale_Time_HHMM: moment(vArray[5]).format("HH:mm"),
            Time_Zone: vArray[6],
            Item_Number: parseFloat(vArray[7]),
            Lot_Number: parseFloat(vArray[8]),
            Vehicle_Type: vArray[9],
            Year: parseFloat(vArray[10]),
            Make: vArray[11],
            Model_Group: vArray[12],
            Model_Details: vArray[13],
            Body_Style: vArray[14],
            Color: vArray[15],
            Damage_Description: vArray[16],
            Secondary_Damage: vArray[17],
            Sale_Title_State: vArray[18],
            Sale_Title_Type: vArray[19],
            Has_Keys: vArray[20],
            Lot_Condition_Code: vArray[21],
            VIN: vArray[22],
            Odometer: parseFloat(vArray[23]),
            Odometer_Brand: vArray[24],
            Estimated_Retail_Value: parseFloat(vArray[25]),
            Repair_Cost: parseFloat(vArray[26]),
            Engine: vArray[27],
            Drive: vArray[28],
            Transmission: vArray[29],
            Fuel_Type: vArray[30],
            Cylinders: vArray[31],
            Runs_Drives: vArray[32],
            Sale_Status: vArray[33],
            High_Bid: vArray[34],
            Special_Note: vArray[35],
            Location_City: vArray[36],
            Location_State: vArray[37],
            Location_Zip: vArray[38],
            Location_Country: vArray[39],
            Currency_Code: vArray[40],
            Image_Thumbnail: vArray[41],
            Create_DateTime: vArray[42],
            Grid_Row: vArray[43],
            Make_an_Offer_Eligible: vArray[44] === "N" ? false : true,
            Buy_it_Now_Price: parseFloat(vArray[45]),
            Image_URL: vArray[46],
            Trim: vArray[47],
            Last_Updated_Time: moment(vArray[48]).format(
              "MMM Do, YYYY HH:mm a"
            ),
          };

          //console.log(vehicleObj);
          db.VehicleSale.create(vehicleObj).catch(function (err) {
            resp.write(
              "<p>Failed to save " + vehicleObj.VIN + " data to the db</p>"
            );
            console.log(err);
          });

          resp.write(
            "<p>" + vehicleObj.VIN + " has been saved to the database.</p>"
          );
        })
      )
      .on("error", (err) => {
        console.log("Error while reading file.", err.sqlMessage);
      })
      .on("end", () => {
        console.log("Read File Successfull");
        resp.write(badCount + " records were not inserted.");
      });
  });

  /**
   * GET /api/makes?makeId=<uuid>,<uuid>
   * or: /api/makes?makeId=<uuid>&makeId=<uuid>
   */
// Assumes you already have:
//   const { Op } = require("sequelize");
//   const db = require("./models");
//
// And helpers:
//   parseMultiParam(value) -> string[]
//   isUuid(value) -> boolean

app.get("/api/makesbyIds", async (req, res) => {
  try {
    const makeIds = parseMultiParam(req.query.makeId ?? req.query.makeIds);

    if (makeIds.length === 0) {
      return res.status(400).json({
        error: "Query parameter 'makeId' is required (one or more UUIDs).",
      });
    }

    const badMakeIds = makeIds.filter((x) => !isUuid(x));
    if (badMakeIds.length) {
      return res.status(400).json({
        error: "One or more makeId values are not valid UUIDs.",
        badMakeIds,
      });
    }

    // New model: Make is the authoritative source; this is already correct.
    // Improvements:
    // - Use findAll w/ Op.in
    // - Preserve request order
    // - Optionally enforce is_active (commented out)
    const makes = await db.Make.findAll({
      attributes: ["make_id", "make_code", "make_name", "is_active"],
      where: {
        make_id: { [Op.in]: makeIds },
        // is_active: true, // uncomment if you only want active makes returned
      },
      raw: true,
    });

    // Preserve request order
    const byId = new Map(makes.map((m) => [m.make_id, m]));
    const ordered = makeIds.map((id) => byId.get(id)).filter(Boolean);

    return res.json({
      meta: {
        requested: makeIds.length,
        returned: ordered.length,
        missing: makeIds.filter((id) => !byId.has(id)),
      },
      results: ordered,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load makes by ids.",
      details: err?.message ?? String(err),
    });
  }
});


  /**
   * GET /api/modelsByIds?modelId=<uuid>,<uuid>
   * Returns an array of model names aligned to the input order.
   *
   * Response:
   * {
   *   meta: { requested: 2, returnedNonNull: 2, missingIds: [] },
   *   results: ["SIENNA", "G CLASS"]
   * }
   */
  app.get("/api/modelsByIds", async (req, res) => {
    try {
      const modelIds = parseMultiParam(req.query.modelId ?? req.query.modelIds);

      if (modelIds.length === 0) {
        return res.status(400).json({
          error: "Query parameter 'modelId' is required (one or more UUIDs).",
        });
      }

      const badIds = modelIds.filter((id) => !isUuid(id));
      if (badIds.length) {
        return res.status(400).json({
          error: "One or more modelId values are not valid UUIDs.",
          badModelIds: badIds,
        });
      }

      const rows = await db.Model.findAll({
        attributes: ["model_id", "model_name"],
        where: {
          model_id: { [Op.in]: modelIds },
          is_active: true,
        },
        raw: true,
      });

      // If model_id is not globally unique, this picks one row per model_id.
      const nameById = new Map(
        rows.map((r) => [r.model_id, r.model_name ?? null])
      );
      const results = modelIds.map((id) => nameById.get(id) ?? null);

      res.json({
        meta: {
          requested: modelIds.length,
          returnedNonNull: results.filter((x) => x !== null).length,
          missingIds: modelIds.filter((id) => !nameById.has(id)),
        },
        results,
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to load models by ids.",
        details: err?.message ?? String(err),
      });
    }
  });

// --- helpers (keep near your other helpers) ---
function parseMultiParam(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(parseMultiParam);
  return String(v)
    .split(",")
    .map((s) => String(s).trim())
    .filter(Boolean);
}

function toDecimalOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Accepts "2020-06-23", "2020-06-23T23:18:11Z", or "20200702" -> returns "YYYY-MM-DD" or null
function parseDateYmdOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // yyyymmdd
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // ISO-ish: take first 10 chars if it looks like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // last-resort Date.parse
  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return null;
  const dt = new Date(ts);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// --- endpoint ---
app.get("/api/getVehicles", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 1000), 5000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const makeIds = parseMultiParam(req.query.makeId ?? req.query.makeIds);
    const modelIds = parseMultiParam(req.query.modelId ?? req.query.modelIds);

    const fromYear = toIntOrNull(req.query.fromYear);
    const toYearRaw = toIntOrNull(req.query.toYear);
    const toYear = toYearRaw ?? new Date().getFullYear();

    const vin = String(req.query.vin ?? "").trim();

    // NEW filters
    const locationStates = parseMultiParam(req.query.locationState ?? req.query.state); // ex: "CA,GA"
    const saleStatuses = parseMultiParam(req.query.saleStatus); // ex: "Pure Sale,Minimum Bid"
    const runsDrives = parseMultiParam(req.query.runsDrives ?? req.query.runs_drives); // ex: "Run & Drive Verified"
    const titleTypes = parseMultiParam(req.query.titleType ?? req.query.saleTitleType); // ex: "CT,RT,ST"
    const trim = String(req.query.trim ?? "").trim(); // contains match

    const saleDateFrom = parseDateYmdOrNull(req.query.saleDateFrom ?? req.query.saleDateStart);
    const saleDateTo = parseDateYmdOrNull(req.query.saleDateTo ?? req.query.saleDateEnd);

    const odometerMin = toIntOrNull(req.query.odometerMin);
    const odometerMax = toIntOrNull(req.query.odometerMax);

    const highBidMin = toDecimalOrNull(req.query.highBidMin);
    const highBidMax = toDecimalOrNull(req.query.highBidMax);

    const buyItNowMin = toDecimalOrNull(req.query.buyItNowMin);
    const buyItNowMax = toDecimalOrNull(req.query.buyItNowMax);

    // Validate UUIDs (existing)
    const badMakeIds = makeIds.filter((x) => !isUuid(x));
    const badModelIds = modelIds.filter((x) => !isUuid(x));
    if (badMakeIds.length || badModelIds.length) {
      return res.status(400).json({
        error: "One or more IDs are not valid UUIDs.",
        badMakeIds: badMakeIds.length ? badMakeIds : undefined,
        badModelIds: badModelIds.length ? badModelIds : undefined,
      });
    }

    const dialect = db.sequelize.getDialect();
    const likeOp = dialect === "postgres" ? Op.iLike : Op.like;

    // Vehicle-level filtering
    const vehicleWhere = {};
    if (makeIds.length) vehicleWhere.make_id = { [Op.in]: makeIds };
    if (modelIds.length) vehicleWhere.model_id = { [Op.in]: modelIds };

    if (fromYear !== null && toYear !== null) {
      vehicleWhere.year = { [Op.between]: [fromYear, toYear] };
    } else if (fromYear !== null) {
      vehicleWhere.year = { [Op.gte]: fromYear };
    } else if (toYear !== null) {
      vehicleWhere.year = { [Op.lte]: toYear };
    }

    if (vin.length) vehicleWhere.vin = { [likeOp]: `%${vin}%` };
    if (trim.length) vehicleWhere.trim = { [likeOp]: `%${trim}%` };

    // SaleLot-level filtering (these columns live on SaleLot)
    const saleLotWhere = {};
    if (runsDrives.length) saleLotWhere.runs_drives = { [Op.in]: runsDrives };
    if (titleTypes.length) saleLotWhere.sale_title_type = { [Op.in]: titleTypes };

    if (odometerMin !== null && odometerMax !== null) {
      saleLotWhere.odometer = { [Op.between]: [odometerMin, odometerMax] };
    } else if (odometerMin !== null) {
      saleLotWhere.odometer = { [Op.gte]: odometerMin };
    } else if (odometerMax !== null) {
      saleLotWhere.odometer = { [Op.lte]: odometerMax };
    }

    // SaleEvent-level filtering
    const saleEventWhere = {};
    if (saleDateFrom && saleDateTo) {
      saleEventWhere.sale_date = { [Op.between]: [saleDateFrom, saleDateTo] };
    } else if (saleDateFrom) {
      saleEventWhere.sale_date = { [Op.gte]: saleDateFrom };
    } else if (saleDateTo) {
      saleEventWhere.sale_date = { [Op.lte]: saleDateTo };
    }

    // Outcome-level filtering
    const outcomeWhere = {};
    if (saleStatuses.length) outcomeWhere.sale_status = { [Op.in]: saleStatuses };

    if (highBidMin !== null && highBidMax !== null) {
      outcomeWhere.high_bid_amount = { [Op.between]: [highBidMin, highBidMax] };
    } else if (highBidMin !== null) {
      outcomeWhere.high_bid_amount = { [Op.gte]: highBidMin };
    } else if (highBidMax !== null) {
      outcomeWhere.high_bid_amount = { [Op.lte]: highBidMax };
    }

    if (buyItNowMin !== null && buyItNowMax !== null) {
      outcomeWhere.buy_it_now_price = { [Op.between]: [buyItNowMin, buyItNowMax] };
    } else if (buyItNowMin !== null) {
      outcomeWhere.buy_it_now_price = { [Op.gte]: buyItNowMin };
    } else if (buyItNowMax !== null) {
      outcomeWhere.buy_it_now_price = { [Op.lte]: buyItNowMax };
    }

    // Turn includes into required joins only when we need to filter by them
    const requireOutcome = Object.keys(outcomeWhere).length > 0;
    const requireLocation = locationStates.length > 0;
    const requireSaleEvent = Object.keys(saleEventWhere).length > 0; // still required true overall, but this is for clarity

    const { rows, count } = await db.SaleLot.findAndCountAll({
      limit,
      offset,
      distinct: true,
      subQuery: false,
      where: Object.keys(saleLotWhere).length ? saleLotWhere : undefined,
      include: [
        {
          model: db.Vehicle,
          required: true,
          where: vehicleWhere,
          attributes: [
            "vehicle_id",
            "vin",
            "year",
            "trim",
            "model_details",
            "body_style",
            "exterior_color",
            "interior_color",
            "fuel_type",
            "transmission",
            "cylinders",
            "engine_size",
            "drivetrain",
            "image_thumbnail_url",
            "image_url",
            "created_at",
            "updated_at",
          ],
          include: [
            {
              model: db.Make,
              as: "make",
              required: false,
              attributes: ["make_id", "make_code", "make_name", "is_active"],
            },
            {
              model: db.Model,
              as: "model",
              required: false,
              attributes: ["make_id", "model_id", "model_code", "model_name", "is_active"],
            },
          ],
        },
        {
          model: db.SaleEvent,
          required: true, // always required in your current behavior (a lot belongs to a sale event)
          where: requireSaleEvent ? saleEventWhere : undefined,
          attributes: ["sale_event_id", "sale_date", "sale_time", "time_zone", "day_of_week", "yard_id"],
          include: [
            {
              model: db.Yard,
              required: true,
              attributes: ["yard_id", "yard_number", "yard_name", "location_id"],
              include: [
                {
                  model: db.Location,
                  required: requireLocation, // becomes inner join only when state filter is applied
                  where: requireLocation ? { state: { [Op.in]: locationStates } } : undefined,
                  attributes: ["location_id", "city", "state", "zip", "country"],
                },
              ],
            },
          ],
        },
        {
          model: db.SaleLotOutcome,
          required: requireOutcome, // inner join only when filtering by outcome fields
          where: requireOutcome ? outcomeWhere : undefined,
          attributes: [
            "sale_lot_outcome_id",
            "sale_lot_id",
            "high_bid_raw",
            "high_bid_amount",
            "buy_it_now_price",
            "make_an_offer_eligible",
            "estimated_retail_value",
            "repair_cost",
            "special_note",
            "sale_status",
            "currency_code",
          ],
        },
      ],
      order: [
        [db.SaleEvent, "sale_date", "DESC"],
        [db.SaleEvent, "sale_time", "DESC"],
        ["lot_number", "ASC"],
      ],
    });

    return res.json({
      meta: {
        limit,
        offset,
        returned: rows.length,
        totalCount: typeof count === "number" ? count : undefined,
        filters: {
          makeIds: makeIds.length ? makeIds : null,
          modelIds: modelIds.length ? modelIds : null,
          yearRange: { from: fromYear, to: toYear },
          vin: vin.length ? vin : null,

          // NEW filters echoed back
          locationStates: locationStates.length ? locationStates : null,
          saleStatuses: saleStatuses.length ? saleStatuses : null,
          saleDateRange: { from: saleDateFrom, to: saleDateTo },
          runsDrives: runsDrives.length ? runsDrives : null,
          odometerRange: { min: odometerMin, max: odometerMax },
          highBidRange: { min: highBidMin, max: highBidMax },
          buyItNowRange: { min: buyItNowMin, max: buyItNowMax },
          trim: trim.length ? trim : null,
          titleTypes: titleTypes.length ? titleTypes : null,
        },
      },
      results: rows,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load vehicles.",
      details: err?.message ?? String(err),
    });
  }
});


  // This method does Multi-Column Search
  //const { Op } = require("sequelize");

  app.get("/api/autosearch/:searchQuery", async (req, res) => {
    const requestStart = Date.now();

    // Decode & normalize input
    const raw = String(req.params.searchQuery ?? "");
    const searchQuery = decodeURIComponent(raw).trim();

    // Basic validation for auto-search endpoints
    if (searchQuery.length < 2) {
      return res.status(400).json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        rowCount: 0,
        results: [],
        message: "searchQuery must be at least 2 characters.",
      });
    }

    // Optional: escape % and _ so users can't accidentally broaden the search too much
    // (This is not SQL injection, but it avoids wildcard-only searches.)
    const escaped = searchQuery.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;

    // If query looks numeric, enable exact matching for numeric columns
    const numericQuery = /^\d+$/.test(searchQuery) ? Number(searchQuery) : null;

    // Build OR conditions (portable across Sequelize versions)
    const orConditions = [
      { Item_Number: { [Op.like]: pattern } },
      { Lot_Number: { [Op.like]: pattern } },
      { Make: { [Op.like]: pattern } },
      { Model_Group: { [Op.like]: pattern } },
      { Model_Details: { [Op.like]: pattern } },
      { Body_Style: { [Op.like]: pattern } },
      { Color: { [Op.like]: pattern } },
      { VIN: { [Op.like]: pattern } },
      { Location_City: { [Op.like]: pattern } },
      { Location_State: { [Op.like]: pattern } },
      { Location_Zip: { [Op.like]: pattern } },
      { Location_Country: { [Op.like]: pattern } },
      { Trim: { [Op.like]: pattern } },
    ];

    if (numericQuery !== null) {
      // Prefer equality for numeric columns if those columns are numeric in your schema
      orConditions.push({ Year: numericQuery });
    } else {
      // If Year is actually stored as a string, you can keep LIKE:
      orConditions.push({ Year: { [Op.like]: pattern } });
    }

    // Pagination (defaults)
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    try {
      const { count, rows } = await db.VehicleSale.findAndCountAll({
        where: { [Op.or]: orConditions },
        // If you used escaping above, ensure your dialect supports ESCAPE '\\'
        // Sequelize doesn't always emit ESCAPE automatically; validate on your DB.
        limit,
        offset,
        // Strongly consider returning only fields you need:
        // attributes: ["Item_Number", "Lot_Number", "Year", "Make", "Model_Group", "VIN", "Location_City", "Location_State"],
        order: [["Year", "DESC"]], // adjust as appropriate
      });

      return res.json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        rowCount: rows.length,
        totalCount: count,
        limit,
        offset,
        results: rows,
      });
    } catch (err) {
      return res.status(500).json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        error: "Search failed.",
        details: err?.message ?? String(err),
      });
    }
  });

  // The Get searches specified columns
  // searchBy is the column name && searchQuery is the value searchFor
  app.get("/api/advautosearch/:searchBy/:searchQuery", (req, res) => {
    const Op = Sequelize.Op;
    const searchBy = req.params.searchBy;
    const searchQuery = req.params.searchQuery;
    const searchObj = {};
    searchObj[searchBy] = { [Op.like]: "%" + searchQuery + "%" };
    const requestStart = Date.now();

    db.VehicleSale.findAll({
      where: {
        [Op.or]: searchObj,
      },
    })
      .then((dbVehicle) => {
        const processingTime = Date.now() - requestStart;
        var data = {
          processingTime: processingTime / 1000 + " seconds",
          rowCount: dbVehicle.length,
          results: dbVehicle,
        };
        res.json(data);
      })
      .catch(function (err) {
        res.status(500).json(err);
      });
  });

  app.post("/api/getimages", (req, res) => {
    // Takes an object with imageUrl (string), isHdImage (boolean), isThumbNail (boolean)
    var options = {
      method: "GET",
      uri: req.body.imageUrl,
    };

    request(options, (err, resp, body) => {
      if (err) {
        console.log(err);
        return;
      }

      var data = JSON.parse(body);
      console.log(data.lotImages[0].link);
      var images = [];
      for (var i = 0; i < data.lotImages.length; i++) {
        if (
          req.body.isHdImage === true &&
          (req.body.isThumbNail === false || req.body.isThumbNail == undefined)
        ) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (
              data.lotImages[i].link[j].isHdImage === true &&
              data.lotImages[i].link[j].isThumbNail === false
            ) {
              images.push({ [i + 1]: data.lotImages[i].link[j].url });
            }
          }
        }

        if (
          (req.body.isHdImage === false &&
            (req.body.isThumbNail === false ||
              req.body.isThumbNail == undefined)) ||
          req.body.isHdImage == undefined ||
          req.body.isThumbNail == undefined
        ) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (
              data.lotImages[i].link[j].isHdImage === false &&
              data.lotImages[i].link[j].isThumbNail === false
            ) {
              images.push({ [i + 1]: data.lotImages[i].link[j].url });
            }
          }
        }

        if (
          req.body.isThumbNail === true &&
          (req.body.isHdImage === false || req.body.isHdImage == undefined)
        ) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (
              data.lotImages[i].link[j].isThumbNail === true &&
              data.lotImages[i].link[j].isHdImage === false
            ) {
              images.push({ [i + 1]: data.lotImages[i].link[j].url });
            }
          }
        }
      }

      res.json(images);
    });
  });

  // Map external query param names -> DB column names
  const FIELD_MAP = {
    itemNumber: "Item_Number",
    lotNumber: "Lot_Number",
    year: "Year",
    make: "Make",
    modelGroup: "Model_Group",
    modelDetails: "Model_Details",
    bodyStyle: "Body_Style",
    color: "Color",
    vin: "VIN",
    locationCity: "Location_City",
    locationState: "Location_State",
    locationZip: "Location_Zip",
    locationCountry: "Location_Country",
    trim: "Trim",
  };

  // Fields included in global q search
  const GLOBAL_Q_FIELDS = Object.values(FIELD_MAP);

  // Allow sorting only on known columns (avoid SQL injection via order)
  const SORT_MAP = {
    year: "Year",
    make: "Make",
    lotNumber: "Lot_Number",
    itemNumber: "Item_Number",
  };

  function escapeLike(value) {
    // Avoid accidental wildcard expansion. Not SQL injection (Sequelize parameterizes),
    // but prevents users from using %/_ as wildcards.
    return String(value).replace(/[%_\\]/g, "\\$&");
  }

  function buildStringPredicate(dialect, value, matchMode) {
    const v = escapeLike(value);

    // If using Postgres, Op.iLike is case-insensitive; otherwise you may need collation/lower() patterns.
    const likeOp = dialect === "postgres" ? Op.iLike : Op.like;

    switch (matchMode) {
      case "equals":
        return { [Op.eq]: value };
      case "startsWith":
        return { [likeOp]: `${v}%` };
      case "contains":
      default:
        return { [likeOp]: `%${v}%` };
    }
  }

  app.get("/api/vehicles/search", async (req, res) => {
    const requestStart = Date.now();

    // Pagination
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    // Sorting
    const sortBy = String(req.query.sortBy ?? "year");
    const sortDirRaw = String(req.query.sortDir ?? "DESC").toUpperCase();
    const sortDir = sortDirRaw === "ASC" ? "ASC" : "DESC";
    const sortColumn = SORT_MAP[sortBy] ?? "Year";

    // Match mode: contains | startsWith | equals
    const matchMode = String(req.query.matchMode ?? "contains");

    // Optional: require at least one filter (prevents full table scans)
    const hasAnyQuery =
      Object.keys(req.query).some(
        (k) =>
          k !== "limit" && k !== "offset" && k !== "sortBy" && k !== "sortDir"
      ) && Object.keys(req.query).length > 0;

    if (!hasAnyQuery) {
      return res.status(400).json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        rowCount: 0,
        results: [],
        message: "Provide at least one search parameter.",
      });
    }

    // Build WHERE
    const dialect = db.sequelize.getDialect();
    const andConditions = [];

    // 1) Global q (OR across many columns)
    const q = req.query.q?.toString().trim();
    if (q && q.length >= 2) {
      const predicate = buildStringPredicate(dialect, q, matchMode);
      andConditions.push({
        [Op.or]: GLOBAL_Q_FIELDS.map((col) => ({ [col]: predicate })),
      });
    }

    // 2) Field-specific filters (AND across provided fields)
    for (const [paramName, columnName] of Object.entries(FIELD_MAP)) {
      const rawVal = req.query[paramName];
      if (
        rawVal === undefined ||
        rawVal === null ||
        String(rawVal).trim() === ""
      )
        continue;

      // Support comma-separated list => IN (...)
      const asString = String(rawVal).trim();
      const values = asString
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // If numeric field (example: Year), handle appropriately
      if (columnName === "Year") {
        // Allow list of years: year=2020,2021
        const years = values
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n));

        if (years.length === 1) {
          andConditions.push({ [columnName]: { [Op.eq]: years[0] } });
        } else if (years.length > 1) {
          andConditions.push({ [columnName]: { [Op.in]: years } });
        } else {
          return res.status(400).json({ error: "Invalid year parameter." });
        }
        continue;
      }

      // String field
      if (values.length === 1) {
        andConditions.push({
          [columnName]: buildStringPredicate(dialect, values[0], matchMode),
        });
      } else {
        // If multiple values provided, interpret as OR within that field
        // e.g. make=Honda,Toyota => (Make LIKE ... OR Make LIKE ...)
        andConditions.push({
          [Op.or]: values.map((v) => ({
            [columnName]: buildStringPredicate(dialect, v, matchMode),
          })),
        });
      }
    }

    const where = andConditions.length ? { [Op.and]: andConditions } : {};

    try {
      const { count, rows } = await db.VehicleSale.findAndCountAll({
        where,
        limit,
        offset,
        order: [[sortColumn, sortDir]],
        // Consider reducing payload:
        // attributes: ["Item_Number","Lot_Number","Year","Make","Model_Group","VIN","Location_City","Location_State"],
      });

      return res.json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        rowCount: rows.length,
        totalCount: count,
        limit,
        offset,
        sortBy,
        sortDir,
        results: rows,
      });
    } catch (err) {
      return res.status(500).json({
        processingTime: `${(Date.now() - requestStart) / 1000} seconds`,
        error: "Search failed.",
        details: err?.message ?? String(err),
      });
    }
  });

// Assumes:
//   const { Op, fn, col, where: whereFn, literal } = require("sequelize");
//   const db = require("./models");

app.get("/api/vehicles/distinct/makes", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 1000), 2000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const dialect = db.sequelize.getDialect();
    const likeOp = dialect === "postgres" ? Op.iLike : Op.like;

    // We now pull distinct makes from Makes (not Vehicles.Make)
    // Only return active makes (common pattern in your schema).
    const where = {
      make_code: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      is_active: true,
    };

    if (q.length > 0) {
      // Search across make_name OR make_code
      // - Postgres iLike works as expected
      // - For MySQL, LIKE is usually case-insensitive depending on collation
      where[Op.or] = [
        { make_name: { [likeOp]: `%${q}%` } },
        { make_code: { [likeOp]: `%${q}%` } },
      ];
    }

    const { rows, count } = await db.Make.findAndCountAll({
      attributes: ["make_name"], // return names; can also include make_code if your UI needs it
      where,
      order: [[col("make_name"), "ASC"]],
      limit,
      offset,
      raw: true,
      distinct: true,
    });

    // Defensive normalize + de-dupe
    const makes = Array.from(
      new Set(
        rows
          .map((r) => (r.make_name ?? "").toString().trim())
          .filter((m) => m.length > 0)
      )
    );

    return res.json({
      rowCount: makes.length,
      // totalCount is useful for paging UIs; count may be dialect-dependent.
      totalCount: typeof count === "number" ? count : undefined,
      results: makes,
      limit,
      offset,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load distinct makes.",
      details: err?.message ?? String(err),
    });
  }
});


  // GET /api/vehicles/distinct/models?make=HONDA,TOYOTA&fromYear=2018&toYear=2026&q=AC
  // Returns buckets keyed by Make, with distinct Model_Group values per make.

  //const { Op, col, fn, QueryTypes } = require("sequelize");

  function escapeLike(value) {
    return String(value).replace(/[%_\\]/g, "\\$&");
  }

  function parseMultiQueryParam(input) {
    if (input === undefined || input === null) return [];
    const raw = Array.isArray(input) ? input.join(",") : String(input);
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseIntOrNull(v) {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  }

  app.get("/api/vehicles/distinct/models", async (req, res) => {
    try {
      const MODEL_COL = "Model_Group";
      const DIMENSION = "modelGroup";

      // Inputs
      const makesIn = parseMultiQueryParam(req.query.make);
      if (makesIn.length === 0) {
        return res.status(400).json({
          error: "Query parameter 'make' is required (one or more values).",
        });
      }

      // Normalize makes (matches your sample output)
      const makes = Array.from(new Set(makesIn.map((m) => m.toUpperCase())));
      console.log("Distinct models request for makes:", makes);

      const fromYear =
        parseIntOrNull(req.query.fromYear) ??
        new Date(1900, 0, 1).getFullYear();
      const toYear =
        parseIntOrNull(req.query.toYear) ?? new Date().getFullYear();
      console.log("Year range:", { fromYear, toYear });
      if (fromYear !== null && fromYear > toYear) {
        return res.status(400).json({
          error: "'fromYear' must be <= 'toYear'.",
          fromYear,
          toYear,
        });
      }

      const q = String(req.query.q ?? "").trim();

      const limit = Math.min(Number(req.query.limit ?? 10000), 20000);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      console.log("Pagination:", { limit, offset });
      console.log("Filter q:", q);

      // Shared filters (MySQL-safe)
      const andConditions = [
        // TRIM(Model_Group) <> ''
        db.sequelize.where(db.sequelize.fn("TRIM", col(MODEL_COL)), {
          [Op.ne]: "",
        }),
      ];

      if (q.length > 0) {
        andConditions.push({
          [MODEL_COL]: { [Op.like]: `%${escapeLike(q)}%` },
        });
      }

      if (fromYear !== null) {
        andConditions.push({ Year: { [Op.between]: [fromYear, toYear] } });
      } else {
        andConditions.push({ Year: { [Op.lte]: toYear } });
      }

      const baseWhere = {
        Make: { [Op.in]: makes },
        [MODEL_COL]: { [Op.ne]: null },
        [Op.and]: andConditions,
      };

      /**
       * totalDistinct: count of distinct (Make, Model_Group) pairs matching filters
       * Use raw SQL subquery to avoid Sequelize DISTINCT multi-column issues.
       */
      const totalDistinctSql = `
      SELECT COUNT(*) AS totalDistinct
      FROM (
        SELECT \`Make\`, \`${MODEL_COL}\`
        FROM \`Vehicles\`
        WHERE \`Make\` IN (:makes)
          AND \`${MODEL_COL}\` IS NOT NULL
          AND TRIM(\`${MODEL_COL}\`) <> ''
          ${q.length > 0 ? `AND \`${MODEL_COL}\` LIKE :qLike` : ""}
          ${
            fromYear !== null
              ? `AND \`Year\` BETWEEN :fromYear AND :toYear`
              : `AND \`Year\` <= :toYear`
          }
        GROUP BY \`Make\`, \`${MODEL_COL}\`
      ) t
    `;

      const totalDistinctRows = await db.sequelize.query(totalDistinctSql, {
        type: QueryTypes.SELECT,
        replacements: {
          makes,
          qLike: `%${escapeLike(q)}%`,
          fromYear,
          toYear,
        },
      });
      console.log(
        "Total distinct (Make, Model_Group) pairs:",
        totalDistinctRows
      );

      const totalDistinct = Number(totalDistinctRows?.[0]?.totalDistinct ?? 0);

      // Per-make distinct counts (MySQL-safe)
      const countsRows = await db.Vehicle.findAll({
        attributes: [
          "Make",
          [fn("COUNT", fn("DISTINCT", col(MODEL_COL))), "countDistinct"],
        ],
        where: baseWhere,
        group: ["Make"],
        raw: true,
      });

      const countByMake = new Map(
        countsRows.map((r) => [
          String(r.Make).toUpperCase(),
          Number(r.countDistinct ?? 0),
        ])
      );

      // Distinct values (Make + Model_Group), paginated at pair level
      const pairRows = await db.Vehicle.findAll({
        attributes: ["Make", MODEL_COL],
        where: baseWhere,
        group: ["Make", MODEL_COL],
        order: [
          [col("Make"), "ASC"],
          [col(MODEL_COL), "ASC"],
        ],
        limit,
        offset,
        raw: true,
        // If you see issues with LIMIT + GROUP BY in your Sequelize version, uncomment:
        // subQuery: false,
      });

      const returned = pairRows.length;

      // Group into buckets
      const valuesByMake = new Map();
      for (const r of pairRows) {
        const makeKey = String(r.Make ?? "").toUpperCase();
        const modelVal = String(r[MODEL_COL] ?? "").trim();
        if (!makeKey || !modelVal) continue;

        if (!valuesByMake.has(makeKey)) valuesByMake.set(makeKey, []);
        valuesByMake.get(makeKey).push(modelVal);
      }

      // Build buckets in requested-make order
      const buckets = makes.map((make) => ({
        key: make,
        countDistinct: countByMake.get(make) ?? 0, // total count for that make (ignores pagination)
        values: valuesByMake.get(make) ?? [], // returned values for that make (subject to pagination)
      }));

      return res.json({
        meta: {
          filters: {
            makes,
            yearRange: { from: fromYear, to: toYear },
          },
          dimension: DIMENSION,
          pagination: {
            limit,
            offset,
            returned,
            totalDistinct,
          },
        },
        data: { buckets },
      });
    } catch (err) {
      return res.status(500).json({
        error: "Failed to load distinct models for make(s).",
        details: err?.message ?? String(err),
      });
    }
  });

  function parseMultiParam(input) {
    // Supports: ?make=HONDA,TOYOTA OR ?make=HONDA&make=TOYOTA
    if (input === undefined || input === null) return [];
    const raw = Array.isArray(input) ? input.join(",") : String(input);
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function isUuid(v) {
    // UUID v1-v5 (case-insensitive)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    );
  }

  app.get("/api/vehicles/distinct/years", async (req, res) => {
    try {
      const Stats = db.VehicleMakeModelYearStat;

      const makeIds = parseMultiParam(req.query.makeId ?? req.query.makeIds);
      const modelIds = parseMultiParam(req.query.modelId ?? req.query.modelIds);

      const makes = getMakesByIds(makeIds);
      if(modelIds.length > 0) {
        const models = getModelsByIds(modelIds);
      }

      if (makeIds.length === 0) {
        return res.status(400).json({
          error: "Query parameter 'makeId' is required (one or more UUIDs).",
        });
      }

      const badMakeIds = makeIds.filter((x) => !isUuid(x));
      const badModelIds = modelIds.filter((x) => !isUuid(x));
      if (badMakeIds.length || badModelIds.length) {
        return res.status(400).json({
          error: "One or more IDs are not valid UUIDs.",
          badMakeIds: badMakeIds.length ? badMakeIds : undefined,
          badModelIds: badModelIds.length ? badModelIds : undefined,
        });
      }

      const limit = Math.min(Number(req.query.limit ?? 1000), 5000);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);

      const where = {
        make_id: { [Op.in]: makeIds },
        ...(modelIds.length ? { model_id: { [Op.in]: modelIds } } : {}),
      };

      // Total distinct years across the entire filtered result set (not per make)
      const totalDistinctYears = await Stats.count({
        where,
        distinct: true,
        col: "year",
      });

      // Return (make_id, year) rows with vehicleCount summed across models (if modelIds not provided)
      // Grouped by make_id + year
      const rows = await Stats.findAll({
        attributes: [
          ["make_id", "makeId"],
          ["year", "year"],
          [fn("SUM", col("vehicle_count")), "vehicleCount"],
        ],
        where,
        group: ["make_id", "year"],
        order: [
          ["make_id", "ASC"],
          ["year", "ASC"],
        ],
        // Pagination applies to the (make_id, year) row set (pair-level), like your earlier endpoints.
        limit,
        offset,
        raw: true,
      });

      // Build buckets by makeId
      const byMake = new Map(); // makeId -> { key, countDistinctYears, values: [] }
      for (const r of rows) {
        const mid = String(r.makeId);
        const yr = Number(r.year);
        const vc = Number(r.vehicleCount ?? 0);

        if (!byMake.has(mid)) {
          byMake.set(mid, { key: mid, countDistinctYears: 0, values: [] });
        }
        byMake.get(mid).values.push({ key: yr, vehicleCount: vc });
      }

      // Compute countDistinctYears per make from the returned rows (pagination may truncate)
      // If you want countDistinctYears to ignore pagination, see note below.
      for (const b of byMake.values()) {
        b.countDistinctYears = b.values.length;
      }

      // Preserve requested make order
      const buckets = makeIds.map(
        (mid) =>
          byMake.get(mid) ?? { key: mid, countDistinctYears: 0, values: [] }
      );

      return res.json({
        meta: {
          filters: {
            makeIds,
            modelIds: modelIds.length ? modelIds : null,
          },
          dimension: "year",
          bucketBy: "makeId",
          pagination: {
            limit,
            offset,
            returnedMakes: buckets.filter((b) => b.values.length > 0).length,
            returnedRows: rows.length,
            totalDistinctYears: Number(totalDistinctYears ?? 0),
          },
        },
        data: { buckets },
      });
    } catch (err) {
      return res.status(500).json({
        error: "Failed to load distinct years (bucketed by makeId).",
        details: err?.message ?? String(err),
      });
    }
  });

  /**
   * GET /api/makes
   * Returns active makes (and optionally include inactive via ?includeInactive=true)
   */
  app.get("/api/makes", async (req, res) => {
    try {
      const includeInactive =
        String(req.query.includeInactive ?? "false").toLowerCase() === "true";

      const makes = await db.Make.findAll({
        attributes: ["make_id", "make_code", "make_name", "is_active"],
        where: includeInactive ? undefined : { is_active: true },
        order: [["make_name", "ASC"]],
        raw: true,
      });

      res.json({
        meta: { returned: makes.length, includeInactive },
        results: makes,
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to load makes.",
        details: err?.message ?? String(err),
      });
    }
  });

  /**
   * GET /api/models?makeId=<uuid>,<uuid>
   * Returns active models for the provided makeId(s).
   *
   * Optional:
   *  - ?includeInactive=true
   *  - ?limit=1000&offset=0 (default limit=10000, capped at 20000)
   */
  app.get("/api/models", async (req, res) => {
    try {
      const includeInactive =
        String(req.query.includeInactive ?? "false").toLowerCase() === "true";

      const makeIds = parseMultiParam(req.query.makeId ?? req.query.makeIds);
      if (makeIds.length === 0) {
        return res.status(400).json({
          error: "Query parameter 'makeId' is required (one or more UUIDs).",
        });
      }

      const badMakeIds = makeIds.filter((x) => !isUuid(x));
      if (badMakeIds.length) {
        return res.status(400).json({
          error: "One or more makeId values are not valid UUIDs.",
          badMakeIds,
        });
      }

      const limit = Math.min(Number(req.query.limit ?? 10000), 20000);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);

      const where = {
        make_id: { [Op.in]: makeIds },
        ...(includeInactive ? {} : { is_active: true }),
      };

      const models = await db.Model.findAll({
        attributes: [
          "make_id",
          "model_id",
          "model_code",
          "model_name",
          "is_active",
        ],
        where,
        order: [
          ["make_id", "ASC"],
          ["model_name", "ASC"],
        ],
        limit,
        offset,
        raw: true,
      });

      res.json({
        meta: {
          returned: models.length,
          limit,
          offset,
          includeInactive,
          filters: { makeIds },
        },
        results: models,
      });
    } catch (err) {
      res.status(500).json({
        error: "Failed to load models.",
        details: err?.message ?? String(err),
      });
    }
  });

  /**
   * GET /api/vehicle/:vehicleId
   * Optional: ?saleLotId=123
   */
  app.get("/api/vehicle/:vehicleId", async (req, res) => {
    try {
      const vehicleId = String(req.params.vehicleId ?? "").trim();
      if (!vehicleId) {
        return res.status(400).json({ error: "vehicleId is required." });
      }

      const saleLotIdRaw = req.query.saleLotId;
      const saleLotId =
        saleLotIdRaw === undefined || saleLotIdRaw === null || saleLotIdRaw === ""
          ? null
          : Number(saleLotIdRaw);

      if (saleLotId !== null && !Number.isFinite(saleLotId)) {
        return res.status(400).json({ error: "saleLotId must be a number." });
      }

      const vehicle = await db.Vehicle.findByPk(vehicleId, {
        include: [
          { model: db.Make, as: "make", required: false },
          { model: db.Model, as: "model", required: false },
          { model: db.VehicleImage, as: "VehicleImages", required: false },
          {
            model: db.SaleLot,
            as: "SaleLots",
            required: false,
            include: [
              { model: db.SaleLotOutcome, required: false },
              {
                model: db.SaleEvent,
                required: false,
                include: [
                  {
                    model: db.Yard,
                    required: false,
                    include: [{ model: db.Location, required: false }],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found." });
      }

      const saleLots = Array.isArray(vehicle.SaleLots)
        ? vehicle.SaleLots
        : vehicle.SaleLots || [];

      // choose primary lot
      let primaryLot = null;
      if (saleLotId !== null) {
        primaryLot = saleLots.find((l) => Number(l.sale_lot_id) === saleLotId) || null;
      }

      if (!primaryLot && saleLots.length) {
        const toTs = (lot) => {
          const se = lot.SaleEvent;
          const d = se?.sale_date ? String(se.sale_date) : "";
          const t = se?.sale_time ? String(se.sale_time) : "00:00:00";
          const ts = d ? Date.parse(`${d}T${t}`) : NaN;
          if (Number.isFinite(ts)) return ts;

          const alt = lot.last_updated_at_source || lot.created_at_source;
          const altTs = alt ? Date.parse(String(alt)) : NaN;
          return Number.isFinite(altTs) ? altTs : 0;
        };

        primaryLot = [...saleLots].sort((a, b) => toTs(b) - toTs(a))[0] ?? null;
      }

      const images = vehicle.VehicleImages || [];
      const primaryImage = images.find((i) => i.is_primary) || images[0] || null;

      // Response shape is explicit and stable
      return res.json({
        vehicle,
        make: vehicle.make ?? null,
        model: vehicle.model ?? null,
        images,
        primaryImage,
        saleLots,
        primaryLot,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        error: "Failed to load vehicle details.",
        details: err?.message ?? String(err),
      });
    }
  });

function hasValue(x) {
  return x !== null && x !== undefined && String(x).trim() !== "";
}




}