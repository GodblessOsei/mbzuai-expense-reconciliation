CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    role TEXT
);

CREATE TABLE cardholders (
    cardholder_id SERIAL PRIMARY KEY,
    -- since for now every user has only one card we could use UNIQUE REFERENCES 
    user_id INTEGER REFERENCES users(user_id),
    cardholder_name TEXT,
    last_four_digits VARCHAR(4)
);

CREATE TABLE reconciliation_periods (
    reconciliation_period_id SERIAL PRIMARY KEY,
    start_date DATE,
    end_date DATE
);

CREATE TABLE budget_items (
    budget_item_id SERIAL PRIMARY KEY,
    -- in case mbzuai stops running some events
    item_name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    cardholder_id INTEGER REFERENCES cardholders(cardholder_id),
    status VARCHAR(20) DEFAULT 'submitted',
    submission_date TIMESTAMP,
    purchase_date TIMESTAMP,
    vendor_name TEXT,
    invoice_number TEXT,
    category TEXT,
    budget_item_id INTEGER REFERENCES budget_items(budget_item_id),
    department TEXT,
    amount_aed NUMERIC(12,2),
    original_currency VARCHAR(3),
    payment_method TEXT,
    reconciliation_period_id INTEGER REFERENCES reconciliation_periods(reconciliation_period_id),
    is_split_payment BOOLEAN DEFAULT FALSE,
    total_payment_parts INTEGER,
    payment_part_number INTEGER,
    overall_order_total NUMERIC(12,2),
    purchase_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    pdf_path TEXT
    
);

CREATE TABLE receipt_files (
    receipt_file_id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(transaction_id),
    original_filename TEXT,
    stored_filename TEXT,
    file_path TEXT,
    file_type TEXT,
    upload_date TIMESTAMP
);


--  flags, budgets, refunds, audit_logs, and additional_spending 

CREATE TABLE flags (
    flag_id        SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id),
    flag_type      VARCHAR(100) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
    budget_id      SERIAL PRIMARY KEY,
    year           INTEGER       NOT NULL UNIQUE,
    planned_amount NUMERIC(12,2) NOT NULL,
    actual_amount  NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE monthly_budgets (
    monthly_budget_id SERIAL PRIMARY KEY,
    year           INTEGER       NOT NULL,
    month          INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
    planned_amount NUMERIC(12,2) NOT NULL,
    UNIQUE (year, month)
);


CREATE TABLE refunds (
    refund_id      SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(transaction_id),   -- nullable
    refund_date    TIMESTAMP     NOT NULL DEFAULT NOW(),
    vendor_name    VARCHAR(255)  NOT NULL,
    refund_amount  NUMERIC(12,2) NOT NULL,
    reason         TEXT          NOT NULL,
    notes          TEXT
);

CREATE TABLE audit_logs (
    log_id         SERIAL PRIMARY KEY,
    edit_session_id UUID,
    transaction_id INTEGER NOT NULL REFERENCES transactions(transaction_id),
    user_id        INTEGER REFERENCES users(user_id),
    action_type    VARCHAR(50) NOT NULL,
    field_name     VARCHAR(100),
    old_value      TEXT,
    new_value      TEXT,
    editor         VARCHAR(100) NOT NULL,
    timestamp      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE additional_spending (
    additional_spending_id SERIAL PRIMARY KEY,
    budget_item_id INTEGER REFERENCES budget_items(budget_item_id),
    date             DATE          NOT NULL,
    vendor_name      VARCHAR(255)  NOT NULL,
    department       VARCHAR(100)  NOT NULL,
    category         VARCHAR(100)  NOT NULL,
    amount_aed       NUMERIC(12,2) NOT NULL,
    payment_method   VARCHAR(100)  NOT NULL,
    reference_number VARCHAR(100),
    notes            TEXT
);


