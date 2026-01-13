CREATE TABLE makes (
  make_id     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  make_code   VARCHAR(50)  NOT NULL,
  make_name   VARCHAR(100) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,

  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (make_id),
  UNIQUE KEY uq_makes_make_code (make_code),
  KEY ix_makes_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE models (
  make_id     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  model_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

  model_code  VARCHAR(100) NOT NULL,
  model_name  VARCHAR(150) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,

  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (make_id, model_id),
  UNIQUE KEY uq_models_make_model_code (make_id, model_code),

  KEY ix_models_model_id (model_id),
  KEY ix_models_is_active (is_active),

  CONSTRAINT fk_models_make
    FOREIGN KEY (make_id) REFERENCES makes(make_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vehicles (
  vehicle_id          CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

  vin                 CHAR(17) NULL,

  make_id             CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  model_id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

  year                SMALLINT UNSIGNED NULL,

  trim                VARCHAR(100) NULL,
  model_details       VARCHAR(150) NULL,
  body_style          VARCHAR(100) NULL,
  exterior_color      VARCHAR(50) NULL,
  interior_color      VARCHAR(50) NULL,
  color_code          VARCHAR(50) NULL,

  fuel_type           VARCHAR(50) NULL,
  transmission        VARCHAR(50) NULL,
  country_of_mfg      VARCHAR(50) NULL,

  image_thumbnail_url VARCHAR(500) NULL,
  image_url           VARCHAR(500) NULL,

  last_updated_time   DATETIME NULL,

  powertrain          ENUM('Internal Combustion', 'Electric', 'Hybrid') NULL,
  engine_size         VARCHAR(50) NULL,
  drivetrain          VARCHAR(50) NULL,

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (vehicle_id),
  UNIQUE KEY uq_vehicles_vin (vin),

  CONSTRAINT fk_vehicles_make
    FOREIGN KEY (make_id) REFERENCES makes(make_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_vehicles_model
    FOREIGN KEY (make_id, model_id)
    REFERENCES models(make_id, model_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  KEY ix_vehicles_make_year (make_id, year),
  KEY ix_vehicles_make_model_year (make_id, model_id, year),
  KEY ix_vehicles_model_year (model_id, year),
  KEY ix_vehicles_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Precomputed aggregate table for vehicle counts by year, make and model
CREATE TABLE vehicle_make_model_year_stats (
  make_id        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  model_id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  year           SMALLINT UNSIGNED NOT NULL,

  vehicle_count  INT UNSIGNED NOT NULL DEFAULT 0,
  refreshed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (make_id, model_id, year),

  KEY ix_vmmys_make_year (make_id, year),
  KEY ix_vmmys_model_year (model_id, year),
  KEY ix_vmmys_year (year),

  CONSTRAINT fk_vmmys_make
    FOREIGN KEY (make_id) REFERENCES makes(make_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_vmmys_model
    FOREIGN KEY (make_id, model_id) REFERENCES models(make_id, model_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


TRUNCATE TABLE vehicle_make_model_year_stats;

INSERT INTO vehicle_make_model_year_stats
  (make_id, model_id, year, vehicle_count, refreshed_at)
SELECT
  v.make_id,
  v.model_id,
  v.year,
  COUNT(*) AS vehicle_count,
  NOW() AS refreshed_at
FROM vehicles v
WHERE v.year IS NOT NULL
GROUP BY v.make_id, v.model_id, v.year;
