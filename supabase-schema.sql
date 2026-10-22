-- ==============================================================================
-- SALARY SOFTWARE (HRMS) - SUPABASE POSTGRESQL DATABASE SCHEMA
-- Run this SQL in your Supabase Project -> SQL Editor -> Run
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('Admin', 'User', 'Accountant')),
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    session_version INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users (status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- 2. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    father_or_spouse_name TEXT DEFAULT 'N/A',
    role TEXT NOT NULL DEFAULT 'Staff',
    department TEXT DEFAULT 'General',
    branch TEXT NOT NULL DEFAULT 'Branch 1',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    joining_date TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD'),
    photo TEXT,
    bank_details JSONB DEFAULT '{"accountNumber":"","ifscCode":"","esslMachineId":""}'::jsonb,
    base_salary NUMERIC(12, 2) DEFAULT 0 CHECK (base_salary >= 0),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees (status);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees (name);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees (department);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees (branch);

-- 3. SALARIES TABLE
CREATE TABLE IF NOT EXISTS public.salaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL, -- SBI-YYYY-XXX
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2000),
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    working_days NUMERIC(8, 2) NOT NULL DEFAULT 1,
    days_present NUMERIC(8, 2) NOT NULL DEFAULT 0,
    absent_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
    total_cl NUMERIC(8, 2) DEFAULT 14,
    casual_leave NUMERIC(8, 2) DEFAULT 0,
    half_cl_taken NUMERIC(8, 2) DEFAULT 0,
    remaining_cl NUMERIC(8, 2) DEFAULT 0,
    excess_cl NUMERIC(8, 2) DEFAULT 0,
    emergency_leave NUMERIC(8, 2) DEFAULT 0,
    bonus NUMERIC(12, 2) DEFAULT 0,
    advance_given NUMERIC(12, 2) DEFAULT 0,
    previous_pending_advance NUMERIC(12, 2) DEFAULT 0,
    advance_deduction NUMERIC(12, 2) DEFAULT 0,
    ledger_deduction NUMERIC(12, 2) DEFAULT 0,
    actual_ledger_deduction NUMERIC(12, 2) DEFAULT 0,
    remaining_ledger_deduction NUMERIC(12, 2) DEFAULT 0,
    remaining_advance NUMERIC(12, 2) DEFAULT 0,
    carried_over_advance NUMERIC(12, 2) DEFAULT 0,
    unrecovered_advance NUMERIC(12, 2) DEFAULT 0,
    pf_amount NUMERIC(12, 2) DEFAULT 0,
    absence_deduction NUMERIC(12, 2) DEFAULT 0,
    excess_cl_deduction NUMERIC(12, 2) DEFAULT 0,
    total_deduction NUMERIC(12, 2) DEFAULT 0,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    per_day_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),
    payment_date TEXT,
    salary_email_sent_at TEXT,
    salary_email_sent_to TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_salary_employee_month_year UNIQUE (employee_code, month, year)
);

CREATE INDEX IF NOT EXISTS idx_salaries_employee_code ON public.salaries (employee_code);
CREATE INDEX IF NOT EXISTS idx_salaries_employee_id ON public.salaries (employee_id);
CREATE INDEX IF NOT EXISTS idx_salaries_year_month ON public.salaries (year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_salaries_status ON public.salaries (status);

-- 4. LEDGER ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    deducted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deducted_amount >= 0),
    balance_amount NUMERIC(12, 2) NOT NULL CHECK (balance_amount >= 0),
    entry_date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
    closed_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_employee_code ON public.ledger_entries (employee_code);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON public.ledger_entries (status);
CREATE INDEX IF NOT EXISTS idx_ledger_entry_date ON public.ledger_entries (entry_date);

-- 5. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    actor_email TEXT DEFAULT '',
    actor_name TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Failed')),
    message TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_actor_email ON public.audit_logs (actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs (created_at DESC);

-- 7. ACTIVE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    role TEXT DEFAULT '',
    session_version INTEGER DEFAULT 0,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.active_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_email ON public.active_sessions (email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.active_sessions (expires_at);

-- 8. PASSWORD RESET OTPS TABLE
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    reset_token_hash TEXT DEFAULT '',
    attempts INTEGER DEFAULT 0,
    request_ip TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_email ON public.password_reset_otps (email);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON public.password_reset_otps (expires_at);

-- 9. STUDENTS TABLE (Optional / Dormant)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_code TEXT UNIQUE,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    section TEXT,
    guardian_name TEXT,
    phone TEXT,
    biometric_id TEXT NOT NULL UNIQUE,
    photo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_class_name ON public.students (class_name);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students (name);
CREATE INDEX IF NOT EXISTS idx_students_biometric_id ON public.students (biometric_id);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at') THEN
        CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_employees_updated_at') THEN
        CREATE TRIGGER set_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_salaries_updated_at') THEN
        CREATE TRIGGER set_salaries_updated_at BEFORE UPDATE ON public.salaries FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_ledger_entries_updated_at') THEN
        CREATE TRIGGER set_ledger_entries_updated_at BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_settings_updated_at') THEN
        CREATE TRIGGER set_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_students_updated_at') THEN
        CREATE TRIGGER set_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$;

-- The application accesses the database only through its server-side service role key.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

-- ==============================================================================
-- INITIAL SEED DATA (Admin User & Company Info)
-- Login: admin / admin1234
-- ==============================================================================
INSERT INTO public.users (name, email, password_hash, role, permissions, status)
VALUES (
    'Administrator',
    'admin',
    '$2a$10$7eD/4BQ4CVMk5RgX3CLW5uXen4t/33djubf5rEN6Gvz4tAtPHrN1a',
    'Admin',
    '["dashboard.view", "employees.view", "employees.create", "employees.edit", "employees.delete", "salary.view", "salary.create", "salary.edit", "salary.delete", "ledger.view", "ledger.create", "ledger.edit", "ledger.delete", "reports.view", "admin.manage"]'::jsonb,
    'Active'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.settings (key, value)
VALUES 
    ('companyInfo', '{"name": "KM Builders", "address": "Branch 1 (Head Office) / Branch 2 (Site Office)", "phone": "8299388507", "email": "hr@kmbuilders.com", "website": ""}'::jsonb),
    ('schoolInfo', '{"name": "KM Builders", "address": "Branch 1 (Head Office) / Branch 2 (Site Office)", "phone": "8299388507", "email": "hr@kmbuilders.com", "website": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

