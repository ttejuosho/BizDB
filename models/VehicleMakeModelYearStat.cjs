// models/VehicleMakeModelYearStat.js
module.exports = (sequelize, DataTypes) => {
  const VehicleMakeModelYearStat = sequelize.define(
    "VehicleMakeModelYearStat",
    {
      make_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      model_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
      },
      vehicle_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      refreshed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "Vehicle_Make_Model_Year_Stats",
      underscored: true,
      timestamps: false,
      indexes: [
        { name: "ix_vmmys_make_year", fields: ["make_id", "year"] },
        { name: "ix_vmmys_model_year", fields: ["model_id", "year"] },
        { name: "ix_vmmys_year", fields: ["year"] },
      ],
    }
  );

  VehicleMakeModelYearStat.associate = (models) => {
    VehicleMakeModelYearStat.belongsTo(models.Make, {
      foreignKey: "make_id",
      as: "make",
    });

    // Composite FK exists in DB; Sequelize can't fully enforce composite FKs in associations.
    // This association is still useful for includes, but keep your joins scoped appropriately.
    VehicleMakeModelYearStat.belongsTo(models.Model, {
      foreignKey: "model_id",
      targetKey: "model_id",
      as: "model",
      constraints: false,
    });
  };

  return VehicleMakeModelYearStat;
};
