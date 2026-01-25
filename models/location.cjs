//location.cjs
module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define("Location", {
    location_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    city: { type: DataTypes.STRING, allowNull: false },
    state: { type: DataTypes.STRING, allowNull: false },
    zip: { type: DataTypes.STRING, allowNull: false },
    country: { type: DataTypes.STRING, allowNull: false },
  }, {
    tableName: "Locations",
    timestamps: false,
    indexes: [{ unique: true, fields: ["city", "state", "zip", "country"] }],
  });

  Location.associate = (models) => {
    Location.hasMany(models.Yard, { foreignKey: "location_id" });
  };

  return Location;
};
