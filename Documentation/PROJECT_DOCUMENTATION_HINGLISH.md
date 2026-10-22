# Salary Software Project Documentation (Hinglish)

Ye documentation project ko samajhne, client ko explain karne, aur future me new features add karne ke liye banayi gayi hai.

---

## 1. Project Overview

Ye ek Next.js based **Salary & HR Management System** hai jo **Savitri Balika Inter College** ke employees, salary generation, automated email notifications, reports, ledger expenses, users, backup/restore aur security sessions manage karta hai.

---

## 2. Main Modules & Features

### 👤 1. Employee Management
- **Employee Master Data**: Name, Employee ID (auto-generated `SBI-YYYY-XXX`), Role (Teacher/Staff), Department, Phone, Email, Address, Bank details, Base Salary, Photo, Active/Inactive Status.
- **Email Field Persistence**: Employee ka email address MongoDB me properly persist aur sanitize hota hai. Form open karte hi existing email pre-fill ho jata hai aur list view me bhi show hota hai.

### 💰 2. Salary Generation & Automated Email Dispatch
- **Automatic Email Notification**: Jab bhi kisi employee ki salary create hoti hai (POST `/api/salaries`), system automatically employee ke email address par salary created confirmation email bhejta hai jisme salary slip ka URL bhi include hota hai.
- **CL Allowance & Salary Calculation**: Casual Leave (CL) policy, excess CL deduction, emergency leave, bonus, advance deduction, ledger deduction, aur net salary automatic calculate hoti hai.
- **Bulk Salary Generation**: Sabhi active employees ke liye 1-click bulk salary generation.

### 📊 3. Reports & Email Status Tracking
- **Reports Table View**: All salaries with month, year, employee, net salary, payment date, aur email status.
- **Email Status Badges**:
  - **`✅ Email Already Sent`**: Green badge show hota hai jab salary email successfully dispatch ho chuka hota hai.
  - **`🔄 Send Again Click Now`**: Direct clickable button existing sent emails ko dobara resend karne ke liye.
  - **`📧 Send Email`**: Primary button unsent emails ko first time send karne ke liye.

### ✉️ 4. SMTP Settings & Email Infrastructure
- **Gmail SMTP Integration**: Port 465 SSL encrypted connection ke sath Gmail SMTP integration (`smtp.gmail.com`).
- **Encrypted App Passwords**: AES-256-GCM encryption se SMTP passwords securely MongoDB (`settings` collection) me store hote hain.
- **Test Email Dispatch**: Settings UI se direct test recipient email bhej kar verification test karne ki suvidha.

### 📑 5. Salary Slips & Export
- **Corporate Salary Slip**: School Logo, Watermark, Print/PDF Export, Signature area.
- **Excel & PDF Export**: Reports aur Salary Slips ko Excel/PDF me export karne ka support.

### 🔐 6. Authentication & Security
- **Role-Based Access Control (RBAC)**: Admin & Accountant roles with granular permissions.
- **HTTP-Only Cookies & JWT Sessions**: Secure authentication handling.
- **Active Sessions Management**: Real-time active login sessions tracking and remote revocation.

### 💾 7. Database Backup & Restore
- **Backup Download**: Complete database EJSON JSON/Gzip format backup.
- **Full Database Restore**: Single-click complete database restoration with index rebuilds and settings protection.

---

# ✉️ New Feature: Email System & Automated Notifications

Ye document Salary Software me add hone wale **Email System & Automated Notifications** feature ko cover karta hai. Isse main documentation ke Section 6 (API Routes) aur Section 11 (New Feature Process) ke saath reference karein.

---

## 1. Automated Email Dispatch on Salary Generation

- Jab bhi kisi employee ki salary create hoti hai (**POST `/api/salaries`**), system automatically us employee ke email address par confirmation email bhejta hai jisme salary slip URL bhi included hota hai.
- Bulk salary generation (`/api/salaries/bulk`) ke case me bhi har employee ko individually email jaata hai.
- Email trigger `src/lib/mailer.js` ke through hota hai, jo SMTP settings (`src/lib/settings.js`) se configuration leta hai.

## 2. Employee Email Persistence & Sanitization

- Employee Master Data me `email` field properly validate, sanitize aur MongoDB me persist hota hai (validation `zod` se hoti hai).
- Form open karne par existing email address auto-fill hota hai.
- Employees Table me employee ID ke saath email address bhi display hota hai:

  ```
  SBI-2026-014 • employee@gmail.com
  ```

## 3. Reports Table — Email Status & Actions

Reports table me har salary record ke saath email status aur action buttons dikhte hain:

| Status / Button | Meaning |
|---|---|
| ✅ **Email Already Sent** | Green status badge — salary email dispatch ho chuka hai |
| 🔄 **Send Again Click Now** | Direct action button — already-sent email ko dobara resend karne ke liye |
| 📧 **Send Email** | Primary action button — unsent email ko first time send karne ke liye |

## 4. SMTP Email Configuration & Security

- **Gmail SMTP integration** — `smtp.gmail.com` on **Port 465 (SSL)**.
- **AES-256-GCM Encryption** se SMTP passwords securely MongoDB `Setting` collection me store hote hain (plain text me kabhi nahi).
- Settings UI me **Direct Test Email Dispatch** feature — admin ek click me test mail bhej kar SMTP config verify kar sakta hai (existing `api/settings/email/test/route.js` endpoint isi kaam ke liye use hota hai).

---

## Implementation Checklist (New Feature Process ke hisaab se)

1. **Schema Update** — `Employee` model me `email` field add/validate karo (`src/lib/models/*`).
2. **Business Logic** — `src/lib/mailer.js` me salary-confirmation email template aur send function banao.
3. **API Route** — `src/app/api/salaries/route.js` aur `bulk/route.js` me salary create hone ke baad mail-trigger call add karo; email resend ke liye ek naya action endpoint banao.
4. **Permission** — `src/lib/auth.js` ke `PERMISSIONS` me email-send/resend permission add karo agar role-restricted rakhna ho.
5. **Frontend Screen** — `src/components/employees-client.jsx` me email field + auto-fill; `src/components/reports-client.jsx` me status badge aur action buttons.
6. **Security** — SMTP password AES-256-GCM se encrypt/decrypt karne ka helper `src/lib/secure-settings.js` me add karo.
7. **Settings UI** — `src/components/settings-client.jsx` me "Send Test Email" button wire karo.

> **Debug Tip:** Agar email nahi ja raha, sabse pehle Settings → SMTP test mail try karo. Agar wahi fail ho raha hai to problem SMTP credentials/Port 465 SSL config me hai, code me nahi.

---

## 3. Technology Stack

| Component | Technology Used |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | Vanilla CSS, Tailwind CSS |
| **Database** | MongoDB with Mongoose |
| **Email Transport** | Nodemailer (Gmail SMTP, Port 465 SSL) |
| **Security** | bcryptjs, Jose (JWT), Crypto AES-256-GCM |
| **Export Tools** | html2canvas, jsPDF, XLSX |

---

## 4. Setup & Running Instructions

```bash
# Dependencies install karein
npm install

# Database start karein
npm run db:start

# Development server run karein (0.0.0.0 for LAN access)
npm run dev
```

App Browser URL: [http://localhost:3000](http://localhost:3000)

---

## 5. Environment Variables (.env.local)

```env
MONGODB_URI=mongodb://127.0.0.1:27017/savitri_salary
MONGODB_DB=savitri_salary
JWT_SECRET=replace-this-with-a-long-random-secret
ADMIN_EMAIL=Ashish
ADMIN_PASSWORD=8299524399
```
