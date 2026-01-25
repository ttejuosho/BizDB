// vehicleImage.cjs
module.exports = (sequelize, DataTypes) => {
  const VehicleImage = sequelize.define("VehicleImage", {
    vehicle_image_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    image_url: { type: DataTypes.STRING, allowNull: false },
    thumbnail_url: { type: DataTypes.STRING, allowNull: true },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    tableName: "Vehicle_Images",
    timestamps: false,
    indexes: [{ unique: true, fields: ["vehicle_id", "image_url"] }],
  });

  VehicleImage.associate = (models) => {
    VehicleImage.belongsTo(models.Vehicle, { foreignKey: "vehicle_id", allowNull: false });
  };

  return VehicleImage;
};
