// saleLot.cjs
module.exports = (sequelize, DataTypes) => {
  const SaleLot = sequelize.define("SaleLot", {
    sale_lot_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    item_number: { type: DataTypes.INTEGER, allowNull: false },
    lot_number: { type: DataTypes.INTEGER, allowNull: false },
    grid_row: { type: DataTypes.STRING, allowNull: true },

    created_at_source: { type: DataTypes.STRING, allowNull: true },
    last_updated_at_source: { type: DataTypes.STRING, allowNull: true },
    odometer: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    vehicle_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sale_title_state: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sale_title_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    has_keys: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "No",
    },
    damage_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    secondary_damage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    runs_drives: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  }, {
    tableName: "Sale_Lots",
    timestamps: false,
    indexes: [{ unique: true, fields: ["sale_event_id", "lot_number"] }],
  });

  SaleLot.associate = (models) => {
    SaleLot.belongsTo(models.SaleEvent, { foreignKey: "sale_event_id", allowNull: false });
    SaleLot.belongsTo(models.Vehicle, { foreignKey: "vehicle_id", allowNull: false });
    SaleLot.hasOne(models.SaleLotOutcome, { foreignKey: "sale_lot_id" });
  };

  return SaleLot;
};
