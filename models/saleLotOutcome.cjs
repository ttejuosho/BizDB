// saleLotOutcome.cjs
module.exports = (sequelize, DataTypes) => {
  const SaleLotOutcome = sequelize.define("SaleLotOutcome", {
    sale_lot_outcome_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // Keep raw + parsed if needed
    high_bid_raw: { type: DataTypes.STRING, allowNull: true },
    high_bid_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

    buy_it_now_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    make_an_offer_eligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    estimated_retail_value: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    repair_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

    sale_status: { type: DataTypes.STRING, allowNull: false },
    currency_code: { type: DataTypes.STRING, allowNull: false },

    special_note: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: "Sale_Lot_Outcomes", timestamps: false });

  SaleLotOutcome.associate = (models) => {
    SaleLotOutcome.belongsTo(models.SaleLot, { foreignKey: "sale_lot_id", allowNull: false, unique: true });
  };

  return SaleLotOutcome;
};
