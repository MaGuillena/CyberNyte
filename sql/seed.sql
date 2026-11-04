-- Fictional starter records. Only imported once by npm run db:setup.
-- Plain-text passwords are for the requested localhost classroom demo.
INSERT INTO users (id, full_name, username, password, role) VALUES
(1, 'Alex Rivera', 'admin', 'admin123', 'admin'),
(2, 'Jamie Santos', 'staff', 'staff123', 'staff'),
(3, 'Mika Dela Cruz', 'mika', 'mika123', 'staff');

INSERT INTO customers (id, full_name, contact_number) VALUES
(1, 'Juan Dela Cruz', '09175550101'),
(2, 'Maria Santos', '09175550102'),
(3, 'Carla Ramos', NULL);

INSERT INTO stations (id, name, specs, hourly_rate) VALUES
(1, 'PC-01', 'Intel i5 / RTX 3050 / 16GB RAM', 40.00),
(2, 'PC-02', 'Intel i5 / RTX 4060 / 16GB RAM', 50.00),
(3, 'PC-03', 'Ryzen 7 / RTX 4070 / 32GB RAM', 60.00);

INSERT INTO gaming_sessions
(id, customer_id, station_id, started_by, start_time, end_time, hourly_rate, charge, status) VALUES
(1, 1, 1, 2, DATE_SUB(NOW(), INTERVAL 180 MINUTE), DATE_SUB(NOW(), INTERVAL 120 MINUTE), 40, 40, 'completed'),
(2, 2, 2, 2, DATE_SUB(NOW(), INTERVAL 150 MINUTE), DATE_SUB(NOW(), INTERVAL 90 MINUTE), 50, 50, 'completed'),
(3, 3, 3, 3, DATE_SUB(NOW(), INTERVAL 120 MINUTE), DATE_SUB(NOW(), INTERVAL 60 MINUTE), 60, 60, 'completed');

INSERT INTO payments (session_id, amount, method, recorded_by) VALUES
(1, 40, 'Cash', 2),
(2, 25, 'GCash', 2),
(3, 60, 'Maya', 3);

INSERT INTO reservations
(customer_id, station_id, reservation_date, start_time, end_time, created_by) VALUES
(1, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '14:00', '15:00', 2),
(2, 2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:00', '16:00', 2),
(3, 3, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '16:00', '17:00', 3);

INSERT INTO categories (id, name) VALUES
(1, 'Snacks'), (2, 'Burgers'), (3, 'Drinks');

INSERT INTO food_items
(id, category_id, name, description, price, image_path, featured) VALUES
(1, 1, 'French Fries', 'Crispy salted fries.', 50, '/assets/images/food/french-fries.jpg', TRUE),
(2, 2, 'Cheeseburger', 'Beef burger with cheese.', 90, '/assets/images/food/cheeseburger.jpg', FALSE),
(3, 3, 'Iced Coffee', 'Chilled coffee with milk.', 60, '/assets/images/food/iced-coffee.jpg', FALSE);

INSERT INTO food_orders (id, created_by, subtotal, total, status) VALUES
(1, 2, 50, 50, 'pending'),
(2, 2, 90, 90, 'preparing'),
(3, 3, 60, 60, 'completed');

INSERT INTO food_order_items
(order_id, food_item_id, item_name, unit_price, quantity, line_total) VALUES
(1, 1, 'French Fries', 50, 1, 50),
(2, 2, 'Cheeseburger', 90, 1, 90),
(3, 3, 'Iced Coffee', 60, 1, 60);

-- Settings are a singleton: three rows would be conflicting cafe settings.
INSERT INTO cafe_settings (id, cafe_name, address, contact_number, opening_hours) VALUES
(1, 'CyberNyte Gaming Cafe', 'Calamba, Laguna', '09175550000', '10:00 AM - 12:00 AM');
