-- Incident Risk Predictor - development seed data
-- Run after schema.sql. Both test managers log in with password: Password123!
-- Predictions are not seeded; the backend creates them by calling the Flask /predict endpoint.

INSERT INTO departments (name, description) VALUES
    ('Line Maintenance', 'Turnaround and overnight checks on the ramp'),
    ('Base Maintenance', 'Scheduled heavy checks in the hangar'),
    ('Engineering Support', 'Technical records, planning and troubleshooting');

INSERT INTO shift_managers (department_id, first_name, last_name, email, password_hash, phone) VALUES
    (1, 'Amina', 'Odhiambo', 'amina.odhiambo@example.com',
     '$2a$10$blsdqFQITU6z2OYtKthEq.JKdrRaECgKM/ZenWwxeMtlJpqTqaJ3a', '+254700000001'),
    (2, 'Brian', 'Kamau', 'brian.kamau@example.com',
     '$2a$10$blsdqFQITU6z2OYtKthEq.JKdrRaECgKM/ZenWwxeMtlJpqTqaJ3a', '+254700000002');

INSERT INTO shifts (manager_id, department_id, shift_type, shift_date, start_time, end_time, staff_count, notes) VALUES
    (1, 1, 'Morning',   '2026-10-20', '2026-10-20 06:00+03', '2026-10-20 14:00+03', 8, 'Two turnarounds delayed by weather'),
    (1, 1, 'Night',     '2026-10-20', '2026-10-20 22:00+03', '2026-10-21 06:00+03', 6, 'Overnight A-check on 5Y-KZA'),
    (2, 2, 'Afternoon', '2026-10-21', '2026-10-21 14:00+03', '2026-10-21 22:00+03', 10, 'C-check continues on 5Y-KYZ');

INSERT INTO tasks (shift_id, title, description, aircraft_reg, task_type, complexity, estimated_hours, status) VALUES
    (1, 'Replace main wheel assembly', 'Left main gear #2 wheel worn to limits', '5Y-KZB', 'Corrective', 2, 1.50, 'Complete'),
    (1, 'Cabin pressure controller check', 'Crew report of slow pressurisation', '5Y-KZC', 'Troubleshooting', 4, 3.00, 'In Progress'),
    (2, 'A-check engine borescope', 'Scheduled borescope of engine #1 HPT', '5Y-KZA', 'Scheduled', 3, 4.00, 'Pending'),
    (3, 'Flap actuator overhaul', 'Replace seals on right inboard flap actuator', '5Y-KYZ', 'Scheduled', 5, 6.00, 'In Progress');

INSERT INTO incidents (shift_id, task_id, reported_by, incident_type, description, reported_severity, occurred_at,
                       task_status, severity_score, tool_wear_min, air_temp_k, process_temp_k, rotational_speed, resolution_time) VALUES
    (1, 1, 1, 'Tool wear', 'Torque wrench out of calibration found during wheel change',
     'Low', '2026-10-20 09:15+03', 'Complete', 0.3500, 45, 298.10, 308.60, 1550, 35),
    (1, 2, 1, 'System fault', 'Outflow valve sticking intermittently, part not in stock',
     'Medium', '2026-10-20 12:40+03', 'In Progress', 0.6000, 120, 300.40, 310.20, 1420, 180),
    (2, 3, 1, 'Power failure', 'Ground power unit tripped during borescope, work paused',
     'High', '2026-10-21 02:30+03', 'Pending', 0.9500, 210, 302.10, 311.40, 1380, 240),
    (3, 4, 2, 'Overstrain', 'Hydraulic rig overpressure warning on flap actuator test',
     NULL, '2026-10-21 17:05+03', 'In Progress', 0.8200, 230, 301.50, 310.90, 1290, 300);
