const db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const neatCsv = require("neat-csv");
const fs = require("fs");
var es = require("event-stream");

// Routes
// =============================================================
module.exports = function (app) {
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

  app.post("/api/updateBusiness/:id", (req,res)=>{
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

  app.get("/api/recordCount", (req, res) => {
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
      .createReadStream("8613.csv")
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

  app.get("/api/search/column/:columnName", (req, res) => {
    db.Business.findAll({
      attributes: [
        // specify an array where the first element is the SQL function and the second is the alias
        [
          Sequelize.fn("DISTINCT", Sequelize.col(req.params.columnName)),
          req.params.columnName,
        ],
      ],
    }).then(function (dbBusiness) {
      res.json(dbBusiness);
    });
  });
};
