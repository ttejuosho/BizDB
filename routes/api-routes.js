import db from '../models/index.cjs';
import Sequelize from 'sequelize';
const Op = Sequelize.Op;
import neatCsv from 'neat-csv';
import fs from 'fs';
import es from 'event-stream';
import moment from 'moment';
import request from 'request';
import { fn, col, where } from "sequelize";

// Routes
// =============================================================
export default function (app) {
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
    db.Business.update({
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
      }).then((dbBusiness) => {
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
        [Sequelize.fn("DISTINCT", Sequelize.col(req.params.columnName)), 'value'],
        //[ "id", "id" ],

      ],
    }).then(function (dbBusiness) {
      res.json(dbBusiness);
    });
  });

  app.get("/api/autoRecordCount", (req, res) => {
    db.Vehicle.findAndCountAll().then((dbCount) => {
      res.json({ count: dbCount.count });
    });
  });

  app.get("/api/loadAutos", (req, resp) => {
    var badCount = 0;
    var s = fs
      .createReadStream("salesdata.csv")
      .pipe(es.split())
      .pipe(
        es.mapSync((vehicle) => {
          var vehicleArray = vehicle.split(',');
          var vArray = [];
          for (var i = 0; i < vehicleArray.length; i++) {
            if (vehicleArray[i].split('')[0] == '"') {
              var itemArray = vehicleArray[i].split('');
              itemArray.pop();
              itemArray.shift();
              vArray.push(itemArray.join(''));
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
            Make_an_Offer_Eligible: (vArray[44] === "N" ? false : true),
            Buy_it_Now_Price: parseFloat(vArray[45]),
            Image_URL: vArray[46],
            Trim: vArray[47],
            Last_Updated_Time: moment(vArray[48]).format("MMM Do, YYYY HH:mm a")
          }

          //console.log(vehicleObj);
          db.Vehicle.create(vehicleObj).catch(function (err) {
            resp.write(
              "<p>Failed to save " +
              vehicleObj.VIN +
              " data to the db</p>"
            );
            console.log(err);
          });

          resp.write(
            "<p>" +
            vehicleObj.VIN +
            " has been saved to the database.</p>"
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

  app.get("/api/getVehicles", (req, res) => {
    db.Vehicle.findAll({}).then((dbVehicle) => {
      res.json(dbVehicle);
    });
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
    const { count, rows } = await db.Vehicle.findAndCountAll({
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

    db.Vehicle.findAll({
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
        if (req.body.isHdImage === true && (req.body.isThumbNail === false || req.body.isThumbNail == undefined)) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (data.lotImages[i].link[j].isHdImage === true && data.lotImages[i].link[j].isThumbNail === false) {
              images.push({ [i + 1]: data.lotImages[i].link[j].url });
            }
          }
        }

        if ((req.body.isHdImage === false && (req.body.isThumbNail === false || req.body.isThumbNail == undefined)) || (req.body.isHdImage == undefined || req.body.isThumbNail == undefined)) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (data.lotImages[i].link[j].isHdImage === false && data.lotImages[i].link[j].isThumbNail === false) {
              images.push({ [i + 1]: data.lotImages[i].link[j].url });
            }
          }
        }

        if (req.body.isThumbNail === true && (req.body.isHdImage === false || req.body.isHdImage == undefined)) {
          for (var j = 0; j < data.lotImages[i].link.length; j++) {
            if (data.lotImages[i].link[j].isThumbNail === true && data.lotImages[i].link[j].isHdImage === false) {
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
    Object.keys(req.query).some((k) => k !== "limit" && k !== "offset" && k !== "sortBy" && k !== "sortDir") &&
    Object.keys(req.query).length > 0;

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
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "") continue;

    // Support comma-separated list => IN (...)
    const asString = String(rawVal).trim();
    const values = asString.split(",").map((s) => s.trim()).filter(Boolean);

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
        [Op.or]: values.map((v) => ({ [columnName]: buildStringPredicate(dialect, v, matchMode) })),
      });
    }
  }

  const where = andConditions.length ? { [Op.and]: andConditions } : {};

  try {
    const { count, rows } = await db.Vehicle.findAndCountAll({
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

app.get("/api/vehicles/distinct/makes", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 100), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const dialect = db.sequelize.getDialect();
    const likeOp = dialect === "postgres" ? Op.iLike : Op.like;

    // Base where: ignore null/empty/whitespace-only Makes
    const where = {
      Make: {
        [Op.and]: [
          { [Op.ne]: null },
          { [Op.ne]: "" }
        ]
      }
    };

    // Optional q filter
    if (q.length > 0) {
      // Use TRIM(Make) LIKE '%q%'
      // If you want case-insensitive on non-Postgres, consider storing a normalized column or using LOWER().
      where.Make = {
        [Op.and]: [
          { [Op.ne]: null },
          { [Op.ne]: "" },
          { [likeOp]: `%${q}%` }
        ]
      };
    }

    const rows = await db.Vehicle.findAll({
      attributes: [[fn("DISTINCT", col("Make")), "Make"]],
      where,
      order: [[col("Make"), "ASC"]],
      //limit,
      offset,
      raw: true,
    });

    // Normalize: trim, drop empties, de-dupe (defensive)
    const makes = Array.from(
      new Set(
        rows
          .map((r) => (r.Make ?? "").toString().trim())
          .filter((m) => m.length > 0)
      )
    );

    return res.json({
      rowCount: makes.length,
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
    const makes = parseMultiQueryParam(req.query.make);
    if (makes.length === 0) {
      return res.status(400).json({
        error: "Query parameter 'make' is required (one or more values).",
      });
    }

    const q = String(req.query.q ?? "").trim();

    const fromYear = parseIntOrNull(req.query.fromYear);
    const toYear = parseIntOrNull(req.query.toYear) ?? new Date().getFullYear(); // default

    if (fromYear !== null && fromYear > toYear) {
      return res.status(400).json({
        error: "'fromYear' must be <= 'toYear'.",
        fromYear,
        toYear,
      });
    }

    const limit = Math.min(Number(req.query.limit ?? 10000), 20000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    // Choose which column represents "Model"
    const MODEL_COL = "Model_Group"; // change to "Model_Details" if desired

    // Base WHERE: Make in makes
    const where = {
      Make: { [Op.in]: makes },
      [MODEL_COL]: { [Op.ne]: null },
    };

    // Exclude empty/whitespace-only models in MySQL
    const andConditions = [
      db.sequelize.where(db.sequelize.fn("TRIM", col(MODEL_COL)), { [Op.ne]: "" }),
    ];

    // Optional: filter by model text within the make(s)
    if (q.length > 0) {
      andConditions.push({
        [MODEL_COL]: { [Op.like]: `%${escapeLike(q)}%` },
      });
    }

    // Year range filter:
    // - If fromYear provided: Year BETWEEN fromYear AND toYear
    // - Else: Year <= toYear (because toYear defaults to current year)
    if (fromYear !== null) {
      andConditions.push({
        Year: { [Op.between]: [fromYear, toYear] },
      });
    } else {
      andConditions.push({
        Year: { [Op.lte]: toYear },
      });
    }

    const rows = await db.Vehicle.findAll({
      attributes: ["Make", MODEL_COL],
      where: {
        ...where,
        [Op.and]: andConditions,
      },
      // MySQL-safe distinctness:
      group: ["Make", MODEL_COL],
      order: [[col("Make"), "ASC"], [col(MODEL_COL), "ASC"]],
      limit,
      offset,
      raw: true,
    });

    // Group results by make
    const byMake = {};
    for (const r of rows) {
      const make = (r.Make ?? "").toString().trim();
      const model = (r[MODEL_COL] ?? "").toString().trim();
      if (!make || !model) continue;

      if (!byMake[make]) byMake[make] = [];
      byMake[make].push(model);
    }

    // De-dupe + sort per make
    for (const make of Object.keys(byMake)) {
      byMake[make] = Array.from(new Set(byMake[make])).sort((a, b) => a.localeCompare(b));
    }

    // Flatten unique list across makes (optional convenience)
    const results = Array.from(new Set(Object.values(byMake).flat())).sort((a, b) =>
      a.localeCompare(b)
    );

    return res.json({
      makes,
      fromYear,
      toYear,
      modelField: MODEL_COL,
      rowCount: results.length,
      results,
      byMake,
      limit,
      offset,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to load distinct models for make(s).",
      details: err?.message ?? String(err),
    });
  }
});


};
