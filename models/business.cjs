module.exports = function(sequelize, DataTypes) {
    const Business = sequelize.define("Business", {
      Company: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Address: {
        type: DataTypes.STRING
      },
      City: {
        type: DataTypes.STRING
      },
      State: {
        type: DataTypes.STRING
      },
      Zip: {
        type: DataTypes.STRING
      },
      County: {
        type: DataTypes.STRING
      },
      Phone: {
        type: DataTypes.STRING
      },
      Contact: {
        type: DataTypes.STRING
      },
      Title: {
        type: DataTypes.STRING
      },
      Direct_Phone: {
        type: DataTypes.STRING
      },
      Email: {
        type: DataTypes.STRING
      },
      Website: {
        type: DataTypes.STRING
      },
      Sales: {
        type: DataTypes.STRING
      },
      Employees: {
        type: DataTypes.STRING
      },
      SIC_Code: {
        type: DataTypes.STRING
      },
      Industry: {
        type: DataTypes.STRING
      }
    });
    
    return Business;
  };
