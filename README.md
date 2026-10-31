# 🌌 Syora — Private, AI-Powered Real-Time Messaging Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-syora.vercel.app-7952d2?style=for-the-badge&logo=vercel)](https://syora.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?style=for-the-badge&logo=socket.io)](https://socket.io/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E%20Tested-2EAD33?style=for-the-badge&logo=playwright)](https://playwright.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Live Production Platform:** [https://syora.vercel.app](https://syora.vercel.app)  
> **Source Repository:** [https://github.com/kumarnallana/syora-private-messaging](https://github.com/kumarnallana/syora-private-messaging)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [The Story & Engineering Motivation](#-the-story--engineering-motivation)
  - [1. Verifiable Privacy & Complete Ownership](#1-verifiable-privacy--complete-ownership)
  - [2. Inline AI Tone Refinement vs. Context Switching](#2-inline-ai-tone-refinement-vs-context-switching)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Key Features](#-key-features)
- [Comprehensive Test Suite](#-comprehensive-test-suite)
  - [Backend Tests (`backend/tests/`)](#1-backend-unit--integration-tests-backendtests)
  - [Frontend Unit Tests (`frontend/tests/`)](#2-frontend-unit-tests-frontendtests)
  - [End-to-End Test Suites (`frontend/e2e/`)](#3-playwright-end-to-end-suites-frontende2e)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Quickstart & Local Setup](#-quickstart--local-setup)
  - [Two-Account Testing Walkthrough](#-two-account-testing-walkthrough-recommended-for-recruiters)
- [Security & Session Policies](#-security--session-policies)
- [Author & Connect](#-author--connect)

---

## 🌟 Overview

**Syora** is an end-to-end private messaging platform built from scratch to eliminate conversational surveillance and friction in professional workplace communication. 

Unlike conventional chat applications that rely on third-party black-box services or treat AI as an external chatbot gimmick, Syora delivers:
1. **Verifiable Data Privacy:** Strict relational row-level isolation where no user can query or intercept another user's conversations or keys.
2. **Real-Time Delivery Engine:** Low-latency bi-directional messaging over WebSockets with granular status dispatch (`sent` ➔ `delivered` ➔ `read`).
3. **Syora INST AI Copilot:** Native, inline tone refinement directly inside the composer—allowing users to convert rough thoughts into polished, executive-ready communication without ever leaving the conversation.
4. **Hardened Session Security:** Automated 5-minute inactivity termination, cryptographic JWT session management, and ephemeral client caching.

---

## 💡 The Story & Engineering Motivation

Syora was not built to be "just another chat clone." It was born out of two real-world challenges experienced firsthand:

### 1. Verifiable Privacy & Complete Ownership
Years ago, while communicating with a friend who lacked a safe, private space on mainstream apps, I realized that existing messaging platforms require blind trust in centralized corporate infrastructure. Even when platforms claim end-to-end encryption, metadata, contacts, and telemetry are harvested.

I wondered: *What if I had the full-stack engineering capability to build our own completely self-hosted, private chat application?* A platform where I control the frontend, backend, socket layer, database schemas, color palette, and session policies—free from black-box telemetry. Once I developed production full-stack engineering skills, I turned that vision into Syora.

### 2. Inline AI Tone Refinement vs. Context Switching
During my web development internship, professional workplace communication in English was challenging. Whenever I needed to send a progress report, follow-up, or blocker notice to my director or colleagues, my workflow was exhausting:

$$\text{Draft thought} \longrightarrow \text{Copy text} \longrightarrow \text{Switch to ChatGPT tab} \longrightarrow \text{Prompt for tone polish} \longrightarrow \text{Copy response} \longrightarrow \text{Switch back} \longrightarrow \text{Paste and send}$$

This repetitive context switching broke conversational momentum. 

When building Syora, I asked: **Why should AI live in an external tab when you are already inside the conversation?**

Syora integrates **Syora INST AI** directly into the message input field:
- **Auto-Polish:** Automatic typo correction, grammar rectification, and clause normalization.
- **Tone Presets:** Convert drafts into *Professional*, *Concise*, *Friendly*, or *Action-Oriented* notes in 1 click.
- **Custom Conversion:** Transform raw notes into bulleted briefings, executive summaries, or affectionate sign-offs without leaving the chat thread.

---

## 🏛 System Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          SYORA CLIENT APPLICATION                      │
│                  (Next.js 16.1.6 · React 19 · TypeScript)              │
│                                                                        │
│   ┌─────────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│   │   Chats & Status    │   │  Syora INST AI  │   │ Session Policy │   │
│   │  (Active Workspace) │   │  (Trie Engine)  │   │ (5-Min Logout) │   │
│   └──────────┬──────────┘   └────────┬────────┘   └───────┬────────┘   │
└──────────────┼───────────────────────┼────────────────────┼────────────┘
               │ Bi-Directional Event  │ REST API & Fallback│ Session Ping
               ▼                       ▼                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND RUNTIME                         │
│                    (Python 3.12+ · Async Event Engine)                 │
│                                                                        │
│   ┌─────────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│   │  Socket.IO Gateway  │   │ AI Orchestrator │   │ JWT Auth Guard │   │
│   │   (< 50ms Latency)  │   │ (Gemini Engine) │   │ & Token Bucket │   │
│   └──────────┬──────────┘   └────────┬────────┘   └───────┬────────┘   │
└──────────────┼───────────────────────┼────────────────────┼────────────┘
               │ Connection Pool       │ Media Object Sync  │ Relational
               ▼                       ▼                    ▼
┌─────────────────────────┐ ┌───────────────────────┐ ┌──────────────────┐
│   PostgreSQL Database   │ │  Cloudflare R2 Bucket │ │   Web Push API   │
│ (Row Isolation Security)│ │   (Encrypted Media)   │ │  (VAPID Alerts)  │
└─────────────────────────┘ └───────────────────────┘ └──────────────────┘
```

### End-to-End Message Delivery Lifecycle
1. **Drafting & AI Polish:** User writes draft; optionally applies Syora INST AI tone refinement via local Trie algorithm or FastAPI LLM synthesis.
2. **Socket Dispatch:** Client emits `send_message` via Socket.IO client over secure WebSocket (`wss://`).
3. **Database Isolation:** Server validates session token, enforces strict tenant boundaries, and records message with status `sent`.
4. **Push & Ack:** If recipient is online in the conversation room, message is pushed in `< 50ms` and transitioned to `delivered`.
5. **Read Receipt:** When the recipient viewport renders the message, an explicit `mark_read` event transitions state to `read` with timestamped delivery receipts.

---

## ⚡ Key Features

- **⚡ Bi-Directional Real-Time Messaging:** Powered by Socket.IO with instantaneous message synchronization, active typing indicators, and online presence tracking.
- **🔒 Zero-Surveillance Architecture:** Multi-tenant relational schema isolation in PostgreSQL ensures strict conversational boundaries between users.
- **🧠 Syora INST AI Copilot:**
  - Fast tone transformer (`Professional`, `Concise`, `Friendly`, `Action`, `Auto-Polish`, `Custom`).
  - Standalone Syora AI Assistant page (`/ai`) for drafting executive updates, cover letters, and client replies with multi-turn history.
  - Client-side **Trie-based Spellchecker** with Levenshtein edit-distance lookup for ultra-fast local typing polish.
- **⏱️ Inactivity Auto-Logout Policy:** Automated client session monitor invalidates credentials and resets browser memory after 5 minutes of total user inactivity.
- **📱 Responsive Mobile-First Design:** Custom cyber dark theme with bottom navigation rail, dedicated touch ergonomics, and distraction-free mobile layouts without heavy animation lag.
- **☁️ Cloudflare R2 Media Integration:** Ephemeral, secure image/video attachments with presigned upload workflows.
- **🔔 Native Web Push API:** Background notifications powered by service workers and VAPID keys for incoming messages when inactive.

---

## 🧪 Comprehensive Test Suite

Syora incorporates unit, integration, and Playwright end-to-end (E2E) testing across both backend and frontend codebases.

```
confidential_web/
├── backend/
│   └── tests/                           # 30 Unit & Integration Tests (Python unittest)
│       ├── admin_notifications_unit.py  # Admin drawer events, notification queuing
│       ├── ai_unit.py                   # Tone synthesis prompt templates & policies
│       ├── ai_integration.py            # AI LLM provider fallback & timeout resilience
│       ├── chat_unit.py                 # Message state lifecycles (sent/delivered/read)
│       └── privacy_integration.py       # Cross-user isolation & session verification
└── frontend/
    ├── tests/                           # Unit Tests (Node/TSX test runner)
    │   ├── ai_engine.test.ts            # Trie spellchecker, LRU cache, tone transformers
    │   └── presentation.test.ts         # Usernames, relative timestamps, date formatting
    └── e2e/                             # Playwright End-to-End Test Suites
        ├── auth.spec.ts                 # Registration, login, password recovery flow
        ├── chat.spec.ts                 # Two-user live conversation & delivery states
        ├── session-policy.spec.ts       # 5-minute inactivity termination policy
        ├── mobile-remediation.spec.ts   # Mobile viewport ergonomics & navigation rail
        ├── public-auth-performance.spec.ts # Web Vitals & initial page hydration
        └── visual-qa.spec.ts            # Theme fidelity & regression validation
```

### 1. Backend Unit & Integration Tests (`backend/tests/`)
30 automated test cases executed via Python's `unittest` framework:
```bash
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "*_unit.py"
```
```text
Ran 30 tests in 0.245s
OK
```

### 2. Frontend Unit Tests (`frontend/tests/`)
9 automated unit tests verifying the local AI engine, Trie dictionary algorithm, and presentation utilities:
```bash
cd frontend
npm test
```
```text
✔ SpellCheckTrie exact search and edit-distance lookup (2.2ms)
✔ LRUCache O(1) eviction and lookup (0.4ms)
✔ formatConversationalFlow normalizes run-on clauses into sentences (1.2ms)
✔ polishMessageLocally fixes typos, flow, and punct in Auto-Polish (2.9ms)
✔ polishMessageLocally supports all tone presets (0.9ms)
✔ username normalization owns presentation prefix exactly once (1.1ms)
✔ last seen formatting never exposes raw ISO timestamps (80.9ms)
ℹ tests 9 | pass 9 | fail 0 | duration_ms 605ms
```

### 3. Playwright End-to-End Suites (`frontend/e2e/`)
Full browser simulations covering real-world user journeys across desktop and mobile viewports:
```bash
cd frontend
npx playwright test
```

---

## 🛠 Tech Stack

| Domain | Technologies |
|---|---|
| **Frontend Framework** | [Next.js 16.1.6](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript 5.9](https://www.typescriptlang.org/) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/), Framer Motion, Lucide Icons |
| **Backend Runtime** | [Python 3.12](https://www.python.org/), [FastAPI](https://fastapi.tiangolo.com/), Uvicorn ASGI |
| **Real-Time Communication** | [Socket.IO](https://socket.io/) (Bi-directional WebSocket event bus) |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/), [SQLAlchemy 2.0](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/) |
| **Cloud Storage** | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) (S3-compatible bucket) |
| **Push Notifications** | Web Push API, Service Workers, VAPID |
| **Testing Infrastructure** | [Playwright](https://playwright.dev/), Node Test Runner (`tsx`), Python `unittest` |
| **Deployment & CI** | [Vercel](https://vercel.com/) (Frontend Edge), Linux Cloud VM (Backend Gateway) |

---

## 📁 Repository Structure

```text
├── backend/
│   ├── alembic/              # Database migration versions
│   ├── app/
│   │   ├── api/              # REST routes (auth, users, conversations, ai)
│   │   ├── core/             # Security, JWT tokens, config, hashing
│   │   ├── db/               # PostgreSQL session management & base
│   │   ├── models/           # SQLAlchemy database entities
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic & AI orchestration
│   │   └── sockets/          # Socket.IO connection manager & events
│   ├── tests/                # 30 Unit & integration test suites
│   ├── pyproject.toml        # Backend dependencies & metadata
│   └── alembic.ini           # Migration configuration
├── frontend/
│   ├── e2e/                  # Playwright E2E test suites (auth, chat, mobile)
│   ├── src/
│   │   ├── app/              # Next.js App Router (chats, status, contacts, ai)
│   │   ├── components/       # Domain components (chat, composer, ai, shell)
│   │   ├── services/         # API layer, Socket client, AI fallbacks
│   │   ├── stores/           # Global application state (useApp hook)
│   │   ├── styles/           # CSS modules & design system tokens
│   │   └── utils/            # Trie spellcheck, crypto, formatting
│   ├── tests/                # Frontend engine & presentation unit tests
│   ├── package.json          # Frontend dependencies & npm scripts
│   └── playwright.config.ts  # Playwright browser configurations
└── README.md                 # Project documentation
```

---

## 🚀 Quickstart & Local Setup

Anyone with a modern laptop can clone Syora, configure their own keys, and run their private chat instance locally.

### Prerequisites
- **Node.js** (v20+) & **npm**
- **Python** (v3.11+)
- **PostgreSQL** instance (Local or hosted like Supabase / Neon)

### 1. Clone Repository
```bash
git clone https://github.com/kumarnallana/syora-private-messaging.git
cd syora-private-messaging
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -e .
cp .env.example .env
# Configure your DATABASE_URL and SECRET_KEY in .env

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Copy environment template
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
# Set NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

# Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` to access Syora.

---

### 🧪 Two-Account Testing Walkthrough (Recommended for Recruiters)

To experience the full architecture of Syora as it was designed:

1. Open `https://syora.vercel.app` in a primary browser window (e.g., Chrome).
2. Open an **Incognito / Private Window** or secondary browser (e.g., Edge / Firefox).
3. **Account 1:** Register user `@alex` (`alex@syora.local`).
4. **Account 2:** Register user `@jordan` (`jordan@syora.local`).
5. From `@alex`, navigate to **Contacts (`/contacts`)**, search for `@jordan`, and click **Add Friend**.
6. On `@jordan`'s screen, accept the incoming friend request.
7. Open the conversation thread:
   - Type a rough draft in the composer and click **✨ SYORA INST AI ➔ Professional** to witness inline tone synthesis.
   - Send the message and observe sub-50ms WebSocket transmission.
   - Notice the status receipts transition dynamically from **Sent** (`single check`) ➔ **Delivered** (`double check`) ➔ **Read** (`colored check`).
8. Leave the window idle for 5 minutes to verify the automated security session termination policy.

---

## 🔒 Security & Session Policies

- **Strict Multi-Tenant Isolation:** Database queries enforce user membership constraints. Conversations cannot be read or enumerated across unauthorized user IDs.
- **Cryptographic Password Hashing:** User passwords hashed via Argon2id / bcrypt with salted digests.
- **Ephemeral Inactivity Window:** To prevent unauthorized physical access on shared or workplace workstations, the client terminates sessions after 5 minutes of inactivity.
- **Stateless Bearer JWT Tokens:** Token lifetimes paired with secure HTTP-only cookies and automatic memory purge upon logout.

---

## 👨‍💻 Author & Connect

**Nallana Sasi Kumar**  
Full-Stack Product Engineer  

- **Portfolio:** [https://nallana-sasi-kumar-portfolio.vercel.app](https://nallana-sasi-kumar-portfolio.vercel.app)
- **GitHub:** [@kumarnallana](https://github.com/kumarnallana)
- **Live Project:** [https://syora.vercel.app](https://syora.vercel.app)
- **LinkedIn:** [Nallana Sasi Kumar](https://linkedin.com/in/nallana-sasi-kumar)

---

<p align="center">
  <sub>Built from a personal communication challenge into a production full-stack engineering reality.</sub>
</p>

