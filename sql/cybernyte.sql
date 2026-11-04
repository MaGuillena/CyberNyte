-- Complete CyberNyte schema and starter records. Import into a NEW database.
CREATE DATABASE IF NOT EXISTS cybernyte;
USE cybernyte;

-- Run in a new database. No DROP statements or automatic resets.
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(60) NOT NULL,
    username VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(60) NOT NULL,
    contact_number VARCHAR(20),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    specs VARCHAR(120) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    status ENUM('available', 'maintenance') NOT NULL DEFAULT 'available',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gaming_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    station_id INT NOT NULL,
    started_by INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    charge DECIMAL(12, 2),
    status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (started_by) REFERENCES users(id)
);

CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    station_id INT,
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    method ENUM('Cash', 'GCash', 'Maya', 'Other') NOT NULL DEFAULT 'Cash',
    paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by INT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES gaming_sessions(id),
    FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE food_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    price DECIMAL(10, 2) NOT NULL,
    image_path VARCHAR(255),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE food_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    service_charge_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    service_charge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    status ENUM('pending', 'preparing', 'completed', 'cancelled')
        NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE food_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    food_item_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES food_orders(id),
    FOREIGN KEY (food_item_id) REFERENCES food_items(id)
);

CREATE TABLE cafe_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cafe_name VARCHAR(60) NOT NULL,
    address VARCHAR(120),
    contact_number VARCHAR(20),
    opening_hours VARCHAR(60),
    compact_tables BOOLEAN NOT NULL DEFAULT FALSE,
    reduce_motion BOOLEAN NOT NULL DEFAULT FALSE
);

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
