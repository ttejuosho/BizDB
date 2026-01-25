// model.cjs
module.exports = (sequelize, DataTypes) => {
  const Model = sequelize.define(
    "Model",
    {
      make_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      model_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      model_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      model_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "Models",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        // UNIQUE (make_id, model_code)
        {
          name: "uq_models_make_model_code",
          unique: true,
          fields: ["make_id", "model_code"],
        },
        // non-unique helper index (as in your DDL)
        { name: "ix_models_model_id", fields: ["model_id"] },
        { name: "ix_models_is_active", fields: ["is_active"] },
      ],
    }
  );

  Model.associate = (models) => {
    Model.belongsTo(models.Make, {
      foreignKey: "make_id",
      as: "make",
    });
  };

  return Model;
};
