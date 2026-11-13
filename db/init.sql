-- ClaimShield: esquema y datos semilla

CREATE TABLE policies (
  id SERIAL PRIMARY KEY,
  policy_number VARCHAR(30) NOT NULL UNIQUE,
  holder_name VARCHAR(120) NOT NULL,
  national_id VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  deductible NUMERIC(12,2) NOT NULL,
  coverage_limit NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  id SERIAL PRIMARY KEY,
  policy_id INT NOT NULL REFERENCES policies(id),
  description TEXT NOT NULL,
  incident_date DATE NOT NULL,
  claimed_amount NUMERIC(12,2) NOT NULL,
  indemnity_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'APPROVED', 'REJECTED', 'CLOSED')),
  closed_at TIMESTAMPTZ NULL,
  reopen_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claim_audits (
  id SERIAL PRIMARY KEY,
  claim_id INT NOT NULL REFERENCES claims(id),
  old_status VARCHAR(10) NULL,
  new_status VARCHAR(10) NOT NULL,
  changed_by VARCHAR(60) NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_policy ON claims(policy_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_audits_claim ON claim_audits(claim_id);

INSERT INTO policies (policy_number, holder_name, national_id, phone, email, status, start_date, end_date, deductible, coverage_limit) VALUES
('POL-2025-000123', 'María Fernanda Ortiz', '1012345678', '+57 300 123 4567', 'maria.ortiz@example.com', 'ACTIVE', '2025-01-01', '2026-12-31', 250.00, 20000.00),
('POL-2025-000456', 'Carlos Andrés Medina', '79876543', '+57 310 765 4321', 'carlos.medina@example.com', 'ACTIVE', '2025-03-01', '2027-02-28', 500.00, 35000.00),
('POL-2025-000789', 'Laura Beatriz Gómez', '52123987', '+57 315 222 3344', 'laura.gomez@example.com', 'ACTIVE', '2025-06-15', '2027-06-14', 1000.00, 50000.00),
('POL-2025-001011', 'Jorge Iván Restrepo', '98765432', '+57 320 555 8899', 'jorge.restrepo@example.com', 'ACTIVE', '2025-02-01', '2027-01-31', 2000.00, 120000.00),
('POL-2023-000321', 'Sofía Alejandra Pardo', '1098765432', '+57 301 987 6543', 'sofia.pardo@example.com', 'EXPIRED', '2023-01-01', '2024-12-31', 500.00, 15000.00),
('POL-2022-000654', 'Andrés Felipe Cruz', '80112233', '+57 312 444 5566', 'andres.cruz@example.com', 'EXPIRED', '2022-05-01', '2024-04-30', 1000.00, 25000.00);

INSERT INTO claims (policy_id, description, incident_date, claimed_amount, indemnity_amount, status, closed_at, reopen_count, created_at, updated_at) VALUES
(1, 'Colisión leve en parqueadero, daño en parachoques trasero', '2025-08-10', 1800.00, 1550.00, 'OPEN', NULL, 0, '2025-08-12 09:00:00+00', '2025-08-12 09:00:00+00'),
(2, 'Rotura de vidrio delantero por proyectil en carretera', '2025-09-02', 950.00, 450.00, 'OPEN', NULL, 0, '2025-09-03 14:30:00+00', '2025-09-03 14:30:00+00'),
(3, 'Daños por inundación en sótano del inmueble asegurado', '2025-10-05', 8500.00, 7500.00, 'OPEN', NULL, 0, '2025-10-06 11:15:00+00', '2025-10-06 11:15:00+00'),
(1, 'Robo de equipos electrónicos del domicilio', '2025-05-20', 3200.00, 2950.00, 'APPROVED', NULL, 0, '2025-05-21 08:00:00+00', '2025-05-28 10:00:00+00'),
(4, 'Incendio parcial en cocina por falla eléctrica', '2025-04-12', 15000.00, 13000.00, 'APPROVED', NULL, 0, '2025-04-13 16:45:00+00', '2025-04-25 12:00:00+00'),
(2, 'Reclamo por daño preexistente en carrocería', '2025-07-01', 2200.00, 1700.00, 'REJECTED', '2025-07-15 10:00:00+00', 0, '2025-07-02 09:30:00+00', '2025-07-15 10:00:00+00'),
(3, 'Pérdida de equipaje en viaje fuera de cobertura', '2025-06-25', 1200.00, 200.00, 'REJECTED', '2025-07-10 15:00:00+00', 0, '2025-06-26 13:00:00+00', '2025-07-10 15:00:00+00'),
(4, 'Daño por granizo en techo de la vivienda', '2025-03-18', 6400.00, 4400.00, 'CLOSED', '2025-05-02 17:00:00+00', 0, '2025-03-19 10:00:00+00', '2025-05-02 17:00:00+00');

INSERT INTO claim_audits (claim_id, old_status, new_status, changed_by, reason, created_at) VALUES
(1, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-08-12 09:00:00+00'),
(2, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-09-03 14:30:00+00'),
(3, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-10-06 11:15:00+00'),
(4, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-05-21 08:00:00+00'),
(4, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Documentación completa', '2025-05-28 10:00:00+00'),
(5, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-04-13 16:45:00+00'),
(5, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Peritaje confirma cobertura', '2025-04-25 12:00:00+00'),
(6, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-07-02 09:30:00+00'),
(6, 'OPEN', 'REJECTED', 'ajustador.ruiz', 'Daño preexistente según peritaje', '2025-07-15 10:00:00+00'),
(7, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-06-26 13:00:00+00'),
(7, 'OPEN', 'REJECTED', 'ajustador.ruiz', 'Evento fuera de cobertura', '2025-07-10 15:00:00+00'),
(8, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-03-19 10:00:00+00'),
(8, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Peritaje confirma granizo', '2025-04-10 09:00:00+00'),
(8, 'APPROVED', 'CLOSED', 'ajustador.lopez', 'Indemnización pagada', '2025-05-02 17:00:00+00');
