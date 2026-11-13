-- ClaimShield (SQLite): mismos datos semilla que db/init.sql (montos en centavos)
INSERT INTO policies (policy_number, holder_name, national_id, phone, email, status, start_date, end_date, deductible_cents, coverage_limit_cents) VALUES
('POL-2025-000123', 'María Fernanda Ortiz', '1012345678', '+57 300 123 4567', 'maria.ortiz@example.com', 'ACTIVE', '2025-01-01', '2026-12-31', 25000, 2000000),
('POL-2025-000456', 'Carlos Andrés Medina', '79876543', '+57 310 765 4321', 'carlos.medina@example.com', 'ACTIVE', '2025-03-01', '2027-02-28', 50000, 3500000),
('POL-2025-000789', 'Laura Beatriz Gómez', '52123987', '+57 315 222 3344', 'laura.gomez@example.com', 'ACTIVE', '2025-06-15', '2027-06-14', 100000, 5000000),
('POL-2025-001011', 'Jorge Iván Restrepo', '98765432', '+57 320 555 8899', 'jorge.restrepo@example.com', 'ACTIVE', '2025-02-01', '2027-01-31', 200000, 12000000),
('POL-2023-000321', 'Sofía Alejandra Pardo', '1098765432', '+57 301 987 6543', 'sofia.pardo@example.com', 'EXPIRED', '2023-01-01', '2024-12-31', 50000, 1500000),
('POL-2022-000654', 'Andrés Felipe Cruz', '80112233', '+57 312 444 5566', 'andres.cruz@example.com', 'EXPIRED', '2022-05-01', '2024-04-30', 100000, 2500000);

INSERT INTO claims (policy_id, description, incident_date, claimed_amount_cents, indemnity_amount_cents, status, closed_at, reopen_count, created_at, updated_at) VALUES
(1, 'Colisión leve en parqueadero, daño en parachoques trasero', '2025-08-10', 180000, 155000, 'OPEN', NULL, 0, '2025-08-12T09:00:00.000Z', '2025-08-12T09:00:00.000Z'),
(2, 'Rotura de vidrio delantero por proyectil en carretera', '2025-09-02', 95000, 45000, 'OPEN', NULL, 0, '2025-09-03T14:30:00.000Z', '2025-09-03T14:30:00.000Z'),
(3, 'Daños por inundación en sótano del inmueble asegurado', '2025-10-05', 850000, 750000, 'OPEN', NULL, 0, '2025-10-06T11:15:00.000Z', '2025-10-06T11:15:00.000Z'),
(1, 'Robo de equipos electrónicos del domicilio', '2025-05-20', 320000, 295000, 'APPROVED', NULL, 0, '2025-05-21T08:00:00.000Z', '2025-05-28T10:00:00.000Z'),
(4, 'Incendio parcial en cocina por falla eléctrica', '2025-04-12', 1500000, 1300000, 'APPROVED', NULL, 0, '2025-04-13T16:45:00.000Z', '2025-04-25T12:00:00.000Z'),
(2, 'Reclamo por daño preexistente en carrocería', '2025-07-01', 220000, 170000, 'REJECTED', '2025-07-15T10:00:00.000Z', 0, '2025-07-02T09:30:00.000Z', '2025-07-15T10:00:00.000Z'),
(3, 'Pérdida de equipaje en viaje fuera de cobertura', '2025-06-25', 120000, 20000, 'REJECTED', '2025-07-10T15:00:00.000Z', 0, '2025-06-26T13:00:00.000Z', '2025-07-10T15:00:00.000Z'),
(4, 'Daño por granizo en techo de la vivienda', '2025-03-18', 640000, 440000, 'CLOSED', '2025-05-02T17:00:00.000Z', 0, '2025-03-19T10:00:00.000Z', '2025-05-02T17:00:00.000Z');

INSERT INTO claim_audits (claim_id, old_status, new_status, changed_by, reason, created_at) VALUES
(1, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-08-12T09:00:00.000Z'),
(2, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-09-03T14:30:00.000Z'),
(3, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-10-06T11:15:00.000Z'),
(4, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-05-21T08:00:00.000Z'),
(4, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Documentación completa', '2025-05-28T10:00:00.000Z'),
(5, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-04-13T16:45:00.000Z'),
(5, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Peritaje confirma cobertura', '2025-04-25T12:00:00.000Z'),
(6, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-07-02T09:30:00.000Z'),
(6, 'OPEN', 'REJECTED', 'ajustador.ruiz', 'Daño preexistente según peritaje', '2025-07-15T10:00:00.000Z'),
(7, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-06-26T13:00:00.000Z'),
(7, 'OPEN', 'REJECTED', 'ajustador.ruiz', 'Evento fuera de cobertura', '2025-07-10T15:00:00.000Z'),
(8, NULL, 'OPEN', 'system', 'Siniestro reportado', '2025-03-19T10:00:00.000Z'),
(8, 'OPEN', 'APPROVED', 'ajustador.lopez', 'Peritaje confirma granizo', '2025-04-10T09:00:00.000Z'),
(8, 'APPROVED', 'CLOSED', 'ajustador.lopez', 'Indemnización pagada', '2025-05-02T17:00:00.000Z');
