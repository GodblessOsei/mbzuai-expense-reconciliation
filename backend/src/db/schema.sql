CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    role TEXT
);

CREATE TABLE cardholders (
    cardholder_id SERIAL PRIMARY KEY,
    -- since for now every user has only one card we could use UNIQUE REFERENCES 
    user_id INTEGER REFERENCES users(user_id),
    last_four_digits VARCHAR(4)
);

CREATE TABLE reconciliation_periods (
    reconciliation_period_id SERIAL PRIMARY KEY,
    start_date DATE,
    end_date DATE
);

CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    cardholder_id INTEGER REFERENCES cardholders(cardholder_id),
    submission_date TIMESTAMP,
    purchase_date TIMESTAMP,
    vendor_name TEXT,
    invoice_number TEXT,
    category TEXT,
    department TEXT,
    amount_aed NUMERIC(12,2),
    original_currency VARCHAR(3),
    payment_method TEXT,
    reconciliation_period_id INTEGER REFERENCES reconciliation_periods(reconciliation_period_id),
    notes TEXT 
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

