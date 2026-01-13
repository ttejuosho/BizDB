module.exports = (sequelize, DataTypes) => {
  const Make = sequelize.define(
    "Make",
    {
      make_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      make_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      make_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "Makes",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { name: "uq_makes_make_code", unique: true, fields: ["make_code"] },
        { name: "ix_makes_is_active", fields: ["is_active"] },
      ],
    }
  );

  Make.associate = (models) => {
    Make.hasMany(models.Model, {
      foreignKey: "make_id",
      as: "models",
    });

    Make.hasMany(models.Vehicle, {
      foreignKey: "make_id",
      as: "vehicles",
    });
  };

  return Make;
};
