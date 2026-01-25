// vehicle.cjs
module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define(
    "Vehicle",
    {
      vehicle_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      vin: {
        type: DataTypes.CHAR(20),
        allowNull: true,
        unique: true,
      },
      make_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      model_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
      },
      trim: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      model_details: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      body_style: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      exterior_color: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      interior_color: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      color_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      fuel_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      transmission: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      country_of_mfg: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      image_thumbnail_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      image_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      cylinders: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      powertrain: {
        type: DataTypes.ENUM("Internal Combustion", "Electric", "Hybrid"),
        allowNull: true,
      },
      engine_size: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      drivetrain: {
        type: DataTypes.STRING(50),
        allowNull: true,
      }
    },
    {
      tableName: "Vehicles",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { name: "uq_vehicles_vin", unique: true, fields: ["vin"] },

        //{ name: "ix_vehicles_make_year", fields: ["make_id", "year"] },
        // {
        //   name: "ix_vehicles_make_model_year",
        //   fields: ["make_id", "model_id", "year"],
        // },
        // { name: "ix_vehicles_model_year", fields: ["model_id", "year"] },
        { name: "ix_vehicles_year", fields: ["year"] },
      ],
    }
  );

  Vehicle.associate = (models) => {
    Vehicle.belongsTo(models.Make, {
      foreignKey: "make_id",
      as: "make",
    });
    Vehicle.hasMany(models.VehicleImage, {
      foreignKey: "vehicle_id",
      as: "VehicleImages",
    });
    Vehicle.hasMany(models.SaleLot, {
      foreignKey: "vehicle_id",
      as: "SaleLots",
    });

    /**
     * Composite relationship note:
     * Your DB integrity should be enforced via the composite FK:
     *   vehicles(make_id, model_id) -> models(make_id, model_id)
     *
     * Sequelize does not support composite FKs directly in associations.
     * You have two practical options:
     *
     * 1) Do not define a Model association; query models with where { make_id, model_id }.
     * 2) Define a non-constrained association to allow includes, and always scope by make_id in queries.
     */

    Vehicle.belongsTo(models.Model, {
      foreignKey: "model_id",
      targetKey: "model_id",
      as: "model",
      constraints: false, // critical: avoids Sequelize trying to create a single-column FK
    });
  };

  return Vehicle;
};
