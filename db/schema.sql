-- ============================================================
-- Ledger LK - MySQL schema
-- Smart Loan & Credit Management for Sri Lankan businesses
-- ============================================================

CREATE DATABASE IF NOT EXISTS ledger_lk
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ledger_lk;

-- ---------- Subscription plans (SaaS tiers) ----------
CREATE TABLE IF NOT EXISTS plans (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL UNIQUE,          -- free_trial, basic, standard, annual_basic, annual_standard
  price_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_yearly  DECIMAL(12,2) NOT NULL DEFAULT 0,
  max_customers INT          NULL,                     -- NULL = unlimited
  trial_days    INT          NOT NULL DEFAULT 90,
  features      JSON         NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Shops (the paying customer) ----------
CREATE TABLE IF NOT EXISTS shops (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(150) NOT NULL,
  address            VARCHAR(255) NULL,
  business_type      VARCHAR(80)  NULL,
  language_pref      ENUM('sinhala','tamil','english') NOT NULL DEFAULT 'sinhala',
  phone              VARCHAR(20)  NOT NULL UNIQUE,
  plan_id            INT          NULL,
  subscription_status ENUM('trial','active','expired','locked') NOT NULL DEFAULT 'trial',
  trial_ends_at      DATETIME     NULL,
  plan_ends_at       DATETIME     NULL,
  is_active          TINYINT(1)   NOT NULL DEFAULT 1,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shops_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB;

-- ---------- Users (owner, staff, platform admin) ----------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  shop_id       INT          NULL,                      -- NULL for platform admins
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20)  NOT NULL UNIQUE,
  nic           VARCHAR(20)  NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('owner','staff','admin') NOT NULL DEFAULT 'staff',
  permissions   JSON         NULL,                      -- staff: e.g. ["customers:write","loans:write"]
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Customers (credit accounts: customers & distributors) ----------
CREATE TABLE IF NOT EXISTS customers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  shop_id         INT          NOT NULL,
  kind            ENUM('customer','distributor') NOT NULL DEFAULT 'customer',
  customer_code   VARCHAR(20)  NOT NULL,                -- unique per shop
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NULL,
  nic             VARCHAR(20)  NULL,
  qr_code         VARCHAR(64)  NOT NULL UNIQUE,         -- unique token encoded into QR
  type            ENUM('daily','weekly','monthly','custom') NOT NULL DEFAULT 'daily',
  custom_cycle_days INT        NULL,                    -- when type = 'custom'
  loan_limit      DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance         DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_locked       TINYINT(1)   NOT NULL DEFAULT 0,      -- locked when balance >= loan_limit
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  UNIQUE KEY uq_customers_shop_code (shop_id, customer_code)
) ENGINE=InnoDB;

-- ---------- Loans (credit given out) ----------
CREATE TABLE IF NOT EXISTS loans (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  shop_id     INT NOT NULL,
  customer_id INT NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  note        VARCHAR(255) NULL,
  created_by  INT NULL,
  status      ENUM('active','paid','overdue') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_loans_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_loans_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Transactions (payments & adjustments) ----------
CREATE TABLE IF NOT EXISTS transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  shop_id       INT NOT NULL,
  customer_id   INT NOT NULL,
  loan_id       INT NULL,
  type          ENUM('payment','loan','adjustment') NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  created_by    INT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_txn_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_txn_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_txn_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Reminders (SMS/WhatsApp/push schedule & history) ----------
CREATE TABLE IF NOT EXISTS reminders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  shop_id      INT NOT NULL,
  customer_id  INT NULL,
  type         ENUM('sms','whatsapp','push') NOT NULL DEFAULT 'sms',
  message      VARCHAR(500) NOT NULL,
  scheduled_at DATETIME NOT NULL,
  sent_at      DATETIME NULL,
  status       ENUM('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminders_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Subscriptions / invoices (SaaS billing) ----------
CREATE TABLE IF NOT EXISTS subscriptions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  shop_id      INT NOT NULL,
  plan_id      INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  status       ENUM('trial','pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  period_start DATE NULL,
  period_end   DATE NULL,
  payhere_txn  VARCHAR(100) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subs_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB;

-- ---------- Refresh / OTP log (phone OTP login) ----------
CREATE TABLE IF NOT EXISTS otp_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  phone      VARCHAR(20) NOT NULL,
  otp_code   VARCHAR(8)  NOT NULL,
  purpose    ENUM('login','register') NOT NULL DEFAULT 'login',
  used       TINYINT(1)  NOT NULL DEFAULT 0,
  expires_at DATETIME    NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_phone (phone)
) ENGINE=InnoDB;

-- ============================================================
-- Seed: subscription plans
-- ============================================================
INSERT INTO plans (name, price_monthly, price_yearly, max_customers, trial_days, features)
VALUES
  ('free_trial',     0,     0,      100, 90, JSON_OBJECT('sms_alerts', TRUE, 'reports', TRUE, 'whatsapp', FALSE, 'distributor', FALSE, 'unlimited_customers', FALSE)),
  ('basic',          500,   4500,   100, 0,  JSON_OBJECT('sms_alerts', TRUE, 'reports', TRUE, 'whatsapp', FALSE, 'distributor', FALSE, 'unlimited_customers', FALSE)),
  ('standard',       999,   9999,   NULL, 0,  JSON_OBJECT('sms_alerts', TRUE, 'reports', TRUE, 'whatsapp', TRUE, 'distributor', TRUE, 'unlimited_customers', TRUE))
ON DUPLICATE KEY UPDATE price_monthly = VALUES(price_monthly), price_yearly = VALUES(price_yearly);

 C R E A T E   T A B L E   I F   N O T   E X I S T S   s e t t i n g s   ( 
     i d   I N T   N O T   N U L L   A U T O _ I N C R E M E N T , 
     s h o p _ i d   I N T   N O T   N U L L , 
     c a t e g o r y   V A R C H A R ( 1 0 0 )   N O T   N U L L , 
     s e t t i n g s _ d a t a   J S O N   N O T   N U L L , 
     c r e a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P , 
     u p d a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P   O N   U P D A T E   C U R R E N T _ T I M E S T A M P , 
     P R I M A R Y   K E Y   ( i d ) , 
     F O R E I G N   K E Y   ( s h o p _ i d )   R E F E R E N C E S   s h o p s ( i d )   O N   D E L E T E   C A S C A D E 
 ) ; 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   t e x t l k _ t e m p l a t e s   ( 
     i d   I N T   N O T   N U L L   A U T O _ I N C R E M E N T , 
     s h o p _ i d   I N T   N O T   N U L L , 
     n a m e   V A R C H A R ( 1 5 0 )   N O T   N U L L , 
     b o d y   T E X T   N O T   N U L L , 
     d l t _ t e m p l a t e _ i d   V A R C H A R ( 2 5 5 ) , 
     i s _ a c t i v e   B O O L E A N   N O T   N U L L   D E F A U L T   T R U E , 
     c r e a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P , 
     u p d a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P   O N   U P D A T E   C U R R E N T _ T I M E S T A M P , 
     P R I M A R Y   K E Y   ( i d ) , 
     F O R E I G N   K E Y   ( s h o p _ i d )   R E F E R E N C E S   s h o p s ( i d )   O N   D E L E T E   C A S C A D E 
 ) ; 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   t e x t l k _ c a m p a i g n s   ( 
     i d   I N T   N O T   N U L L   A U T O _ I N C R E M E N T , 
     s h o p _ i d   I N T   N O T   N U L L , 
     n a m e   V A R C H A R ( 2 5 5 )   N O T   N U L L , 
     m e s s a g e   T E X T   N O T   N U L L , 
     c o n t a c t _ l i s t _ i d   V A R C H A R ( 2 5 5 ) , 
     d l t _ t e m p l a t e _ i d   V A R C H A R ( 2 5 5 ) , 
     s c h e d u l e _ t i m e   D A T E T I M E , 
     s t a t u s   V A R C H A R ( 5 0 )   N O T   N U L L   D E F A U L T   ' P e n d i n g ' , 
     r e s p o n s e _ d a t a   J S O N , 
     c r e a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P , 
     u p d a t e d _ a t   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P   O N   U P D A T E   C U R R E N T _ T I M E S T A M P , 
     P R I M A R Y   K E Y   ( i d ) , 
     F O R E I G N   K E Y   ( s h o p _ i d )   R E F E R E N C E S   s h o p s ( i d )   O N   D E L E T E   C A S C A D E 
 ) ; 
 
 A L T E R   T A B L E   s h o p s   A D D   C O L U M N   t e x t l k _ e n a b l e d   B O O L E A N   N O T   N U L L   D E F A U L T   F A L S E ; 
 
 
 