# Architecture and database relationships

Frontend → Fetch JSON/multipart → Express → mysql2 prepared statements → MySQL. Express also serves the existing HTML/CSS/JS, assets, and uploaded food images. There is no separate customer-facing client.

```mermaid
erDiagram
    USERS ||--o{ GAMING_SESSIONS : starts
    USERS ||--o{ RESERVATIONS : creates
    USERS ||--o{ PAYMENTS : records
    USERS ||--o{ FOOD_ORDERS : creates
    CUSTOMERS ||--o{ GAMING_SESSIONS : plays
    CUSTOMERS ||--o{ RESERVATIONS : books
    STATIONS ||--o{ GAMING_SESSIONS : hosts
    STATIONS o|--o{ RESERVATIONS : assigned_to
    GAMING_SESSIONS ||--o{ PAYMENTS : receives
    CATEGORIES ||--o{ FOOD_ITEMS : contains
    FOOD_ORDERS ||--|{ FOOD_ORDER_ITEMS : contains
    FOOD_ITEMS ||--o{ FOOD_ORDER_ITEMS : references
    USERS {
      int id PK
      varchar username UK
      varchar password
      enum role
      boolean active
    }
    CUSTOMERS {
      int id PK
      varchar full_name
      varchar contact_number
    }
    STATIONS {
      int id PK
      varchar name UK
      decimal hourly_rate
      enum status
      boolean active
    }
    GAMING_SESSIONS {
      int id PK
      int customer_id FK
      int station_id FK
      int started_by FK
      datetime start_time
      datetime end_time
      decimal hourly_rate
      decimal charge
      enum status
    }
    RESERVATIONS {
      int id PK
      int customer_id FK
      int station_id FK
      int created_by FK
      date reservation_date
      time start_time
      time end_time
      enum status
    }
    PAYMENTS {
      int id PK
      int session_id FK
      int recorded_by FK
      decimal amount
      enum method
      datetime paid_at
    }
    CATEGORIES {
      int id PK
      varchar name UK
      boolean active
    }
    FOOD_ITEMS {
      int id PK
      int category_id FK
      varchar name
      decimal price
      varchar image_path
      boolean available
    }
    FOOD_ORDERS {
      int id PK
      int created_by FK
      decimal subtotal
      decimal service_charge
      decimal total
      enum status
    }
    FOOD_ORDER_ITEMS {
      int id PK
      int order_id FK
      int food_item_id FK
      varchar item_name
      decimal unit_price
      int quantity
      decimal line_total
    }
    CAFE_SETTINGS {
      int id PK
      varchar cafe_name
      varchar address
      varchar contact_number
      varchar opening_hours
      boolean compact_tables
      boolean reduce_motion
    }
```

`station_id` is nullable for an unassigned reservation. Other displayed relationships use required foreign keys. Foreign keys prevent deleting records used by history. Cafe settings are a singleton configuration record, so they have no required business relationship. SQL setup inserts one settings row with ID 1.

Session rate and order-line name/price snapshots intentionally preserve historical bills. Payment customer IDs are derived through the gaming session instead of being duplicated. Revenue, balances, station display status, and booking display status are calculated from persisted records.
