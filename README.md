# kmsalary

# KM Builders - Biometric Salary & Attendance Management System

Automated biometric payroll, daily attendance tracking, ledger management, and salary slip generation system tailored for **KM Builders (Property Developers)**.

## Core Features
- **Biometric Integration**: Multi-branch SOAP API WebService sync for Branch 1 (Head Office) and Branch 2 (Site Office).
- **Automated Salary Calculation**: Real-time punch aggregation, OT, late deductions, half-days, and advances.
- **Developer Security Gate**: Restricted Biometric Device Config with brute-force rate-limiting and encrypted session cookies.
- **Employee Management**: Digital profiles, branch mapping, bank credentials, and advance ledgers.
- **Slip Generation & Reports**: Corporate branded PDF payslips and monthly attendance register.

## Tech Stack
- **Framework**: Next.js (App Router), React, Tailwind CSS, Lucide Icons
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT HttpOnly Cookies & Developer Gatekeeper
