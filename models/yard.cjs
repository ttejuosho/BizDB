// yard.cjs
module.exports = (sequelize, DataTypes) => {
  const Yard = sequelize.define("Yard", {
    yard_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    yard_number: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    yard_name: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: "Yards", timestamps: false });

  Yard.associate = (models) => {
    Yard.belongsTo(models.Location, { foreignKey: "location_id" });
    Yard.hasMany(models.SaleEvent, { foreignKey: "yard_id" });
  };

  return Yard;
};
