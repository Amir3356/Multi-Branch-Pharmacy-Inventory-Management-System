# Multi-Branch Pharmacy Inventory Management System

This system is a web application for running a pharmacy business with several branches from one place. Each
member of staff signs in with a role, and the system shows them only the work and the branch data that role is
responsible for:

- The **Owner** oversees the whole business: branches, staff accounts, performance, reports, the audit trail and an
  AI business advisor.
- The **Purchase Officer** buys stock for every branch.
- Each branch's **Inventory Officer** receives stock and keeps it accurate.
- Each branch's **Cashier** records sales.

Every change is recorded in a permanent audit trail, and screens update live when another user changes something.

---

## Contents

1. [Users and roles](#1-users-and-roles)
2. [Functional requirements](#2-functional-requirements)
3. [Business rules](#3-business-rules)
4. [Non-functional requirements](#4-non-functional-requirements)
5. [Architecture and technology](#5-architecture-and-technology)
6. [Getting started](#6-getting-started)
7. [Configuration](#7-configuration)
8. [Project structure](#8-project-structure)

---

## 1. Users and roles

| Role | Branch scope | Main responsibilities |
|---|---|---|
| **Owner** | All branches | Branches, staff accounts and sessions, the owner dashboard, all reports, the audit trail, AI Assistance |
| **Purchase Officer** | All branches | Product catalog and categories, recording purchases (procurements) for any branch |
| **Inventory Officer** | One assigned branch | Receiving purchased stock, stock counts and expiry, transfers, damaged items, expenses, stock policy, notifications |
| **Cashier** | One assigned branch | Recording sales at the counter |

### Access by role

| Area | Owner | Purchase Officer | Inventory Officer | Cashier |
|---|:-:|:-:|:-:|:-:|
| Dashboard (role-specific) | ✓ | ✓ | ✓ | ✓ |
| Account Provision (staff accounts, sessions) | ✓ | | | |
| Branches | ✓ | | | |
| Category & Product (catalog) | | ✓ | | |
| Purchase (procurement) | | ✓ | | |
| Inventory | | | ✓ | |
| Stock Transfers | | | ✓ | |
| Damaged Items | | | ✓ | |
| Expenses | | | ✓ | |
| Settings (stock policy) | | | ✓ | |
| Notifications | | | ✓ | |
| Sales | | | | ✓ |
| Sales Report | ✓ | | | ✓ |
| Inventory Report | ✓ | | ✓ | |
| Procurement Report | ✓ | ✓ | | |
| Financial Report | ✓ | | | |
| User Report (access reviews) | ✓ | | | |
| Audit Logs | ✓ | | | |
| AI Assistance and the dashboard's AI Business Advisor | ✓ | | | |

The server enforces this table on every request. The client builds its menu and route guards from the same list
(`server/utils/roles.js`), so a hidden page cannot be opened by typing its address.

---

## 2. Functional requirements

Requirements are numbered by module (for example `FR-SAL-03`) so they can be referenced in reviews and tests.

### 2.1 Authentication and sign-in (`FR-AUTH`)

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system shall let an active user sign in with an email address and password. |
| FR-AUTH-02 | After 5 failed sign-ins for the same email address and IP address, the system shall refuse further attempts for 60 seconds and record a blocked sign-in in the audit trail. |
| FR-AUTH-03 | The system shall let a user request a password-reset email, and set a new password from the emailed link. The link expires after `PASSWORD_RESET_EXPIRE_MINUTES` (default 60). Password-reset requests are limited to 5 per minute. |
| FR-AUTH-04 | The system shall sign a user out when they choose to, and when they have been inactive for `SESSION_IDLE_MINUTES` (default 15). Inactive sessions are checked every 5 minutes. |
| FR-AUTH-05 | Invited (pending) and deactivated accounts shall not be able to sign in. |
| FR-AUTH-06 | After sign-in, the system shall take each user to their role's home page and show only their role's menu. |

### 2.2 Staff accounts — Account Provision (`FR-ACC`, Owner)

| ID | Requirement |
|---|---|
| FR-ACC-01 | The Owner shall be able to invite a staff member as an Inventory Officer, Cashier or Purchase Officer. The system emails them an invitation link. |
| FR-ACC-02 | Inventory Officers and Cashiers shall be assigned to exactly one branch. Purchase Officers and the Owner cover every branch. |
| FR-ACC-03 | An invitation link shall expire after `INVITATION_EXPIRE_MINUTES` (default 10). The Owner can resend it, and the invited person sets their own password when accepting. |
| FR-ACC-04 | The Owner shall be able to edit an account's name, email, role, branch and status (Active or Inactive), and delete an account. Email addresses must be unique. |
| FR-ACC-05 | The Owner shall be able to see every signed-in session: who, which device, the IP address and its approximate location, and (when the user allows it) the device's location. |
| FR-ACC-06 | The Owner shall be able to end a session or remove it. An ended session is signed out immediately. |

### 2.3 Branches (`FR-BR`, Owner)

| ID | Requirement |
|---|---|
| FR-BR-01 | The Owner shall be able to add, edit, deactivate, reactivate and delete branches. Branch names must be unique. Each branch gets an ID (`BR-01`, `BR-02`, …). |
| FR-BR-02 | A deactivated branch shall not receive transfers, and its Inventory Officer cannot record damage, expenses or stock corrections there. |
| FR-BR-03 | The branch list shall show each branch's status and number of staff. |

### 2.4 Product catalog (`FR-CAT`, Purchase Officer)

| ID | Requirement |
|---|---|
| FR-CAT-01 | The Purchase Officer shall be able to add procurement categories. Names are unique, ignoring case. |
| FR-CAT-02 | The Purchase Officer shall be able to add products (name and category) to the catalog shared by all branches. Each product gets an ID. |
| FR-CAT-03 | A product's selling price is shared by every branch (see FR-INV-04). |

### 2.5 Procurement — purchasing (`FR-PRC`)

| ID | Requirement |
|---|---|
| FR-PRC-01 | The Purchase Officer shall be able to record a purchase that has already been paid to the supplier. It records the receiving branch (any active branch), supplier, category, product, quantity, total cost and currency (ETB or USD). |
| FR-PRC-02 | The system shall work out the unit purchase price from the total cost and quantity, and save the order as **Paid** with an ID (`PO-00001`, …). |
| FR-PRC-03 | The receiving branch's Inventory Officer shall add a paid order to stock exactly once ("Receive Stock"). They enter the expiry date on the package, which must be after today, and the selling price. The system generates the batch number (`BT-00001`, …). |
| FR-PRC-04 | Every order shall show its delivery status: **Pending** until it is received into stock, then **Arrived** with its batch number. |

### 2.6 Inventory and stock (`FR-INV`, Inventory Officer)

| ID | Requirement |
|---|---|
| FR-INV-01 | The system shall keep stock per branch, per product and per batch, with each batch's expiry date and units. |
| FR-INV-02 | The system shall show each item's status: **In Stock**, **Low Stock** (below the minimum stock level), **Out of Stock**, **Expiring Soon** (within the expiry-warning window) or **Expired**. |
| FR-INV-03 | The Inventory Officer shall be able to correct a batch's unit count and expiry date at their own active branch. A correction made against an outdated count (someone else changed it first) shall be rejected rather than overwrite it. |
| FR-INV-04 | The Inventory Officer shall be able to set a product's selling price. The new price applies at every branch. |
| FR-INV-05 | Stock shall never go below zero, even when several users change it at the same moment. |

### 2.7 Stock policy — Settings (`FR-POL`, Inventory Officer)

| ID | Requirement |
|---|---|
| FR-POL-01 | The Inventory Officer shall be able to set the **default minimum stock level** (a whole number, 0 or more) that marks products as Low Stock. |
| FR-POL-02 | The Inventory Officer shall be able to set the **expiry-warning window** (1 to 730 days) that marks batches as Expiring Soon. |
| FR-POL-03 | Policy changes shall apply to every branch and update other users' screens live. |

### 2.8 Stock transfers (`FR-TRF`)

| ID | Requirement |
|---|---|
| FR-TRF-01 | An Inventory Officer (from their own branch) or the Owner (from any branch) shall be able to send units of a batch to a different, active branch. The batch picker lists the oldest-expiring batch first. |
| FR-TRF-02 | Units sent shall leave the sending branch's stock at once and show as **In Transit**. |
| FR-TRF-03 | The receiving branch's Inventory Officer shall receive the transfer exactly once and set its selling price. Its units then join that branch's stock. |
| FR-TRF-04 | The sending branch shall not be able to receive its own transfer. |

### 2.9 Damaged items (`FR-DMG`, Inventory Officer)

| ID | Requirement |
|---|---|
| FR-DMG-01 | The Inventory Officer shall be able to record damaged units of a batch at their active branch, with a reason: broken/crushed packaging, water damage, contaminated, temperature damage (cold chain), defective item, or other. |
| FR-DMG-02 | Damaged units shall be removed from stock, and their value at purchase cost recorded as a **damage loss**. |

### 2.10 Expenses (`FR-EXP`, Inventory Officer)

| ID | Requirement |
|---|---|
| FR-EXP-01 | The Inventory Officer shall be able to record a branch expense with a category (rent, transportation, utilities, salaries and wages, maintenance and repairs, supplies and stationery, communication, taxes and licenses, cleaning and security, or other), amount and date. |
| FR-EXP-02 | The expense date shall not be in the future, and an "Other" expense needs a description. |
| FR-EXP-03 | The Inventory Officer shall be able to delete an expense. The Owner and Purchase Officer can view expenses. |

### 2.11 Sales (`FR-SAL`, Cashier)

| ID | Requirement |
|---|---|
| FR-SAL-01 | The Cashier shall be able to record a sale at their own branch: product, quantity, unit price, customer (default "Walk-in Customer") and the batches the units come from. |
| FR-SAL-02 | Units shall come from batches in expiry order (first to expire, first out). An expired batch cannot be sold. |
| FR-SAL-03 | A sale shall never sell more units than are in stock, even when several cashiers sell the same product at the same moment. |
| FR-SAL-04 | Each sale carries a unique key, so a retried request (for example after a network drop) never records the same sale twice. |
| FR-SAL-05 | A recorded sale shall reduce the branch's stock at once and update other screens live. |

### 2.12 Dashboards (`FR-DSH`)

| ID | Requirement |
|---|---|
| FR-DSH-01 | Every role shall have a dashboard with the figures that matter for its work and its branch. |
| FR-DSH-02 | The Owner's dashboard shall show, for a chosen period and for all branches or one branch: revenue, purchases, expenses, damage loss and estimated net profit; charts of money in and out over time, top-selling products and where sales money goes; every branch side by side; and current counts of branches and staff. |
| FR-DSH-03 | The Owner's dashboard shall refresh by itself shortly after any recorded action, or every minute without a live connection. |

### 2.13 Reports (`FR-RPT`)

| ID | Requirement |
|---|---|
| FR-RPT-01 | The system shall provide, for any period and for all branches or one: a **Sales Report** (Owner, Cashier), an **Inventory Report** (Owner, Inventory Officer), a **Procurement Report** (Owner, Purchase Officer) and a **Financial Report** (Owner). |
| FR-RPT-02 | Each report shall show summary figures, charts and tables, and be exportable as a PDF. |
| FR-RPT-03 | The Procurement Report shall show spending per day, per supplier and per branch, and where each order stands (Paid and awaiting delivery, or Received). |
| FR-RPT-04 | The Owner shall be able to generate a **User Report** (access review) for a daily, weekly, monthly, quarterly, yearly or custom period. It lists every account as it was in that period and flags accounts to look at: dormant (no sign-in for `ACCESS_REVIEW_DORMANT_DAYS`, default 90), role changed, invitation no longer valid, or deactivated. The Owner can view and delete these reports. |

### 2.14 Audit trail (`FR-AUD`, Owner)

| ID | Requirement |
|---|---|
| FR-AUD-01 | The system shall record every create, update, delete, approval, rejection, sign-in, sign-out and page view. Each entry has the time, the user and their role, the branch, module, action, a description, a before/after snapshot of the changed data, the IP address and the device. |
| FR-AUD-02 | Audit entries shall be permanent: the database itself refuses to change or delete them, the Owner included. |
| FR-AUD-03 | The Owner shall be able to search and filter the audit log by date range, module, action type and branch, and see new entries arrive live. |

### 2.15 Notifications (`FR-NTF`, Inventory Officer)

| ID | Requirement |
|---|---|
| FR-NTF-01 | The system shall alert the Inventory Officer to low-stock, out-of-stock, expiring-soon and expired items at their branch, and show a count on the menu. |
| FR-NTF-02 | The system shall remind the Inventory Officer of upcoming yearly government tax due dates set on the Settings page. |
| FR-NTF-03 | The Inventory Officer shall be able to mark notifications as read and dismiss them. |

### 2.16 AI Assistance and AI Business Advisor (`FR-AI`, Owner only)

| ID | Requirement |
|---|---|
| FR-AI-01 | The Owner's dashboard shall include an **AI Business Advisor** sidebar that analyses whatever the dashboard shows: the chosen period, and all branches (company-wide) or one branch. |
| FR-AI-02 | The advisor's **Insights** shall give a one-line summary and up to 8 prioritised recommendations (high, medium or low). Each names the products, branches, suppliers or amounts involved, explains why with figures, and gives a next step. |
| FR-AI-03 | The advisor shall cover: (a) **recommendations** to raise revenue and profit, restock, reduce overstock and cut costs and losses; (b) **financial analysis** of revenue, cost of sales, expenses, purchases, damage, gross and net profit and margins against the previous period, with the trend; (c) **forecasting** of revenue, stock-outs, reorders, and stock likely to expire unsold, plus a 30-day projection, each stating what it is based on and how confident it is; (d) **branch comparison** that ranks branches by net profit, margin, sales share, expenses, damage and stock health; (e) **audit-log intelligence**. |
| FR-AI-04 | The system itself, not the AI, shall flag audit events for review using fixed rules: large stock corrections not backed by a sale or damage record, deletions of business records, business changes outside 07:00–21:00, 5 or more failed sign-ins in a day, unusually large sales, and expenses far above that branch's usual amount for the category, plus price changes. Each flag shows what happened, why it was flagged, when, and who. The Owner's own actions are never flagged. |
| FR-AI-05 | The advisor's **Ask & analyse** chat shall answer questions about the business, and offer one-tap analyses: financial summary, compare branches, forecast, restock and overstock, cut costs and losses, audit review, and grow revenue. |
| FR-AI-06 | The AI shall answer only from the system's own figures and never invent products, numbers, suppliers or branches. Staff are identified to the AI only by role and account number (for example "Cashier #5"); no names are sent. |
| FR-AI-07 | Insights for the same period and branch shall be reused for 30 minutes, and refreshed only when the Owner asks, to save AI quota. |
| FR-AI-08 | The AI Assistance page (a full-page chat) and the advisor shall be available to the Owner only. |

### 2.17 Live updates (`FR-RT`)

| ID | Requirement |
|---|---|
| FR-RT-01 | Screens shall update without reloading when another user records a sale, receives or corrects stock, sends or receives a transfer, records damage or an expense, records a procurement, changes the policy, a branch or a product, or ends a session. Each user receives only the updates for the branches they can see. |

---

## 3. Business rules

- **Money:** amounts are in Ethiopian Birr (ETB). Procurements may be recorded in ETB or USD.
- **Profit (estimated):** net profit = sales − cost of the units sold (at each product's latest purchase price) −
  expenses − damage loss.
- **Stock order:** stock is used first-in, first-out by expiry date. Expired batches cannot be sold.
- **Dates and times:** all times are stored in UTC and shown in the store's time zone (`STORE_TIMEZONE`, default
  `Africa/Addis_Ababa`).
- **IDs:** branches `BR-01`, purchase orders `PO-00001`, batches `BT-00001`, sales `SL-00001`, expenses `EXP-00001`,
  damaged items `DMG-00001`, transfers `TRF-00001`, all assigned in sequence by the server.

---

## 4. Non-functional requirements

| Area | Requirement |
|---|---|
| **Security** | Passwords are hashed (bcrypt). Sessions use signed tokens that can be ended on the server. Role checks are enforced on every API request. Sign-in, password reset, invitation and AI endpoints are rate-limited. Security headers are set with Helmet. |
| **Data integrity** | Stock-changing actions run in database transactions with row locks, so simultaneous sales, transfers and corrections can't push stock below zero or apply twice. |
| **Auditability** | The audit trail is permanent and complete (FR-AUD). |
| **Privacy** | No customer or staff names are sent to the outside AI service. |
| **Usability** | The interface works on desktop and phone screen widths, and every list has search and filters. |
| **Responsiveness** | Live updates through WebSockets (Socket.IO), with a polling fallback on the owner dashboard. |

---

## 5. Architecture and technology

```
React (Vite) client  ──HTTP / JSON──▶  Express API  ──SQL──▶  PostgreSQL
        ▲                                   │
        └────────── Socket.IO (live) ◀──────┤──▶ Google Gemini (AI)
                                            └──▶ SMTP (invitation and reset emails)
```

| Layer | Technology |
|---|---|
| Client | React 19, Vite, Redux Toolkit, React Router, TanStack Table, Socket.IO client, jsPDF (PDF export), lucide-react icons |
| Server | Node.js 20 or later, Express 5, `pg`, Zod and rule-based validation, JWT, bcrypt, Socket.IO, node-cron, Nodemailer, Luxon |
| Database | PostgreSQL, with migrations in `server/migrations` (node-pg-migrate) |
| AI | Google Gemini API (`generateContent`) |

The server is one Express application organised in layers: `routes → middleware (auth, validation) → controllers →
services → repositories → PostgreSQL`, plus `models` for shapes and constants and `utils` for shared helpers.

Two background jobs run on the server:

| Job | Schedule |
|---|---|
| Sign out inactive sessions | Every 5 minutes |
| Remove old session records | Daily at 02:00, store time |

---

## 6. Getting started

### Prerequisites

- Node.js 20 or later
- PostgreSQL 14 or later
- An SMTP account for invitation and password-reset emails (optional for local use: without one, emails are
  printed in the server log)
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (optional: only AI Assistance
  needs it)

### 1. Database

Create an empty PostgreSQL database, for example `createdb supermart`.

### 2. Server

```bash
cd server
npm install
cp .env.example .env          # then edit .env: database, JWT secret, mail, Gemini key (see Configuration)
npm run migrate               # creates the tables
OWNER_EMAIL=you@example.com OWNER_PASSWORD='choose-a-strong-password' npm run db:seed   # creates the Owner account
npm run dev                   # API on http://localhost:8000
```

### 3. Client

```bash
cd client
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
npm run dev                   # app on http://localhost:5173
```

Sign in as the Owner. Then add branches (**Branches**) and invite staff (**Account Provision**).

### Useful scripts

| Where | Command | What it does |
|---|---|---|
| server | `npm run dev` | Starts the API with auto-reload (frees the port first) |
| server | `npm start` | Starts the API |
| server | `npm run migrate` | Applies new database migrations |
| server | `npm run migrate:fresh` | Drops and recreates every table. **This deletes all data.** |
| server | `npm run db:seed` | Creates the Owner account if none exists |
| client | `npm run dev` | Starts the client in development mode |
| client | `npm run build` | Builds the client for production into `client/dist` |
| client | `npm run lint` | Lints the client |

---

## 7. Configuration

The server reads `server/.env`; `server/.env.example` lists every setting. Never commit real passwords or keys.

| Setting | Purpose | Default |
|---|---|---|
| `PORT` | API port | `8000` |
| `FRONTEND_URL` | The client's address (used in email links) | `http://localhost:5173` |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL connection | — |
| `JWT_SECRET` | Secret for signing session tokens. Use a long random value. | — |
| `STORE_TIMEZONE` | The store's time zone | `Africa/Addis_Ababa` |
| `SESSION_IDLE_MINUTES` | Inactivity before automatic sign-out | `15` |
| `INVITATION_EXPIRE_MINUTES` | Lifetime of an invitation link | `10` |
| `PASSWORD_RESET_EXPIRE_MINUTES` | Lifetime of a password-reset link | `60` |
| `IP_LOCATION_LOOKUP`, `DEVICE_LOCATION` | Show session locations to the Owner | `true` |
| `TRUSTED_PROXIES` | Proxies allowed to pass the visitor's real IP address | `loopback` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | SMTP for emails | — |
| `GEMINI_API_KEY` | Google Gemini key. AI Assistance is off without it. | — |
| `GEMINI_MODEL` | Main AI model | `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Backup model, used when the main one is overloaded or out of quota (`none` turns it off) | `gemini-3.5-flash-lite` |
| `GEMINI_TIMEOUT` | Seconds to wait for an AI answer | `90` |
| `ACCESS_REVIEW_DORMANT_DAYS` | Days without sign-in before an account counts as dormant | `90` |

The client reads `client/.env`: `VITE_API_URL` (the API address) and, optionally, `VITE_REALTIME_URL`.

> **AI quota:** Google's free tier allows about 20 AI requests a day per model, and no Pro models. For regular use,
> turn on billing for your Google AI Studio project. Pro models (for example `gemini-3.1-pro-preview`) then work by
> changing `GEMINI_MODEL`.

---

## 8. Project structure

```
client/                     React application
  api/                      HTTP calls to the server, one file per area
  components/               Shared UI components (ai/ holds the AI Business Advisor)
  features/                 Feature components and Redux slices (being moved into the layer folders)
  hooks/                    Shared React hooks
  layouts/                  Signed-in and signed-out page layouts
  pages/                    One component per page
  redux/                    Store set-up
  routes/                   Routes, menu and role-based access (paths.js)
  services/                 Client-side logic (e.g. the advisor's quick analyses)
  utils/                    Formatting, dates, stock helpers, HTTP client
server/                     Express API
  config/                   Settings, database pool, logger
  routes/                   URL → middleware → controller, with the allowed roles
  middleware/               Authentication, role checks, rate limits, request validation
  controllers/              Turn requests into service calls and responses
  services/                 Business logic (sales, stock, transfers, reports, AI, …)
  repositories/             SQL queries
  models/                   Data shapes and constants
  migrations/               Database schema (SQL)
  database/                 Migration and seed scripts
  utils/                    Shared helpers, email and AI prompt templates
```
