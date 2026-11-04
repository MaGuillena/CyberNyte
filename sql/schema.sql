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
