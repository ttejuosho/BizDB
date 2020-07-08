const db = require("../models");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const neatCsv = require("neat-csv");
const fs = require("fs");
var es = require("event-stream");
var moment = require("moment");
var request = require("request");

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
      .createReadStream("8615.csv")
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
        [ Sequelize.fn("DISTINCT", Sequelize.col(req.params.columnName)), 'value' ],
        //[ "id", "id" ],

      ],
    }).then(function (dbBusiness) {
      res.json(dbBusiness);
    });
  });
  
  app.get("/api/autoRecordCount", (req, res) => {
    db.Vehicle.findAndCountAll().then((dbCount) => {
      res.json(dbCount.count + " records in auto db");
    });
  });

  app.get("/api/loadAutos", (req, resp) => {
    var badCount = 0;
    var s = fs
      .createReadStream("salesdata0.csv")
      .pipe(es.split())
      .pipe(
        es.mapSync((vehicle) => {
          var vehicleArray = vehicle.split(',');
          var vArray = [];
          for(var i = 0; i < vehicleArray.length; i++){
            if(vehicleArray[i].split('')[0] == '"'){
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
            Make_an_Offer_Eligible: (vArray[44] === "N" ? false : true) ,
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
          console.log("Error while reading file.", err);
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
  app.get("/api/autosearch/:searchQuery", (req, res) => {
    const Op = Sequelize.Op;
    const searchQuery = req.params.searchQuery;
    const requestStart = Date.now();
    db.Vehicle.findAll({
      where: {
        [Op.or]: {
          Item_Number: { [Op.like]: "%" + searchQuery + "%" },
          Lot_Number: { [Op.like]: "%" + searchQuery + "%" },
          Year: { [Op.like]: "%" + searchQuery + "%" },
          Make: { [Op.like]: "%" + searchQuery + "%" },
          Model_Group: { [Op.like]: "%" + searchQuery + "%" },
          Model_Details: { [Op.like]: "%" + searchQuery + "%" },
          Body_Style: { [Op.like]: "%" + searchQuery + "%" },
          Color: { [Op.like]: "%" + searchQuery + "%" },
          VIN: { [Op.like]: "%" + searchQuery + "%" },
          Location_City: { [Op.like]: "%" + searchQuery + "%" },
          Location_State: { [Op.like]: "%" + searchQuery + "%" },
          Location_Zip: { [Op.like]: "%" + searchQuery + "%" },
          Location_Country: { [Op.like]: "%" + searchQuery + "%" },
          Trim: { [Op.like]: "%" + searchQuery + "%" },
        },
      },
    })
      .then((dbVehicle) => {
        const processingTime = Date.now() - requestStart;
        var data = {
          processingTime: processingTime / 1000 + " seconds",
          rowCount: dbVehicle.length,
          results: dbVehicle,
        };

        // for(var k = 0; k < dbVehicle.length; k++){
        //   var options = {
        //     method: "GET",
        //     uri: dbVehicle[k].Image_URL,
        //     json: true
        //   };
      
        //   request(options, (err, resp, body) => {
        //     if (err) {
        //       console.log(err);
        //       return;
        //     }
      
        //     var data = body;
        //     var images = [];
        //     for (var i = 0; i < data.lotImages.length; i++){            
        //       for (var j = 0; j < data.lotImages[i].link.length; j++){
        //         if(data.lotImages[i].link[j].isHdImage === false && data.lotImages[i].link[j].isThumbNail === false){
        //           images.push({ [i+1]  : data.lotImages[i].link[j].url });
        //         }
        //       }
        //     }
        //     dbVehicle[i].images = images;
        //   });
        // }
        
        res.json(data);
      })
      .catch(function (err) {
        res.render("error", err);
      });
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
      for (var i = 0; i < data.lotImages.length; i++){
        if (req.body.isHdImage === true && (req.body.isThumbNail === false || req.body.isThumbNail == undefined)){
          for (var j = 0; j < data.lotImages[i].link.length; j++){
            if(data.lotImages[i].link[j].isHdImage === true && data.lotImages[i].link[j].isThumbNail === false){
              images.push({ [i+1] : data.lotImages[i].link[j].url });
            }
          }
        }

        if ((req.body.isHdImage === false && (req.body.isThumbNail === false || req.body.isThumbNail == undefined)) || (req.body.isHdImage == undefined || req.body.isThumbNail == undefined) ){
          for (var j = 0; j < data.lotImages[i].link.length; j++){
            if(data.lotImages[i].link[j].isHdImage === false && data.lotImages[i].link[j].isThumbNail === false){
              images.push({ [i+1]  : data.lotImages[i].link[j].url });
            }
          }
        }

        if (req.body.isThumbNail === true && (req.body.isHdImage === false || req.body.isHdImage == undefined)){
          for (var j = 0; j < data.lotImages[i].link.length; j++){
            if(data.lotImages[i].link[j].isThumbNail === true && data.lotImages[i].link[j].isHdImage === false){
              images.push({ [i+1] : data.lotImages[i].link[j].url });
            }
          }
        }
      }

      res.json(images);
    });
  });


};
