module.exports = function (sequelize, DataTypes) {
  const Vehicle = sequelize.define("Vehicle", {
    Vehicle_Id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Yard_Number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Yard_Name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Sale_Date: {
        type: DataTypes.STRING,
        allowNull: false
    },
    Day_of_Week: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Sale_Time_HHMM: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    Time_Zone: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Item_Number: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Lot_Number: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Vehicle_Type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Year: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Make: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Model_Group: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Model_Details: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Body_Style: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Color: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Damage_Description: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Secondary_Damage: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Sale_Title_State: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Sale_Title_Type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Has_Keys: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Lot_Condition_Code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    VIN: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Odometer: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Odometer_Brand: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Estimated_Retail_Value: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Repair_Cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Engine: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Drive: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Transmission: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Fuel_Type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Cylinders: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Runs_Drives: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Sale_Status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    High_Bid: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Special_Note: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Location_City: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Location_State: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Location_Zip: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Location_Country: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Currency_Code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Image_Thumbnail: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Create_DateTime: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Grid_Row: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Make_an_Offer_Eligible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
    },
    Buy_it_Now_Price: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    Image_URL: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Trim: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    Last_Updated_Time: {
        type: DataTypes.STRING,
        allowNull: false,
    }
    
  });
  return Vehicle;
};
