// saleEvent.cjs
module.exports = (sequelize, DataTypes) => {
  const SaleEvent = sequelize.define("SaleEvent", {
    sale_event_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    sale_date: { type: DataTypes.DATEONLY, allowNull: true },
    sale_time: { type: DataTypes.TIME, allowNull: true },
    time_zone: { type: DataTypes.STRING, allowNull: true },
    day_of_week: { type: DataTypes.STRING, allowNull: true },
  }, {
    tableName: "Sale_Events",
    timestamps: false,
    indexes: [{ unique: true, fields: ["yard_id", "sale_date", "sale_time", "time_zone"] }],
  });

  SaleEvent.associate = (models) => {
    SaleEvent.belongsTo(models.Yard, { foreignKey: "yard_id", allowNull: false });
    SaleEvent.hasMany(models.SaleLot, { foreignKey: "sale_event_id" });
  };

  return SaleEvent;
};
