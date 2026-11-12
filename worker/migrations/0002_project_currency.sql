ALTER TABLE projects ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'));
