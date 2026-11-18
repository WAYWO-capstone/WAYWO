# WAYWO


[![CI](https://github.com/WAYWO-capstone/WAYWO/actions/workflows/ci-tests.yml/badge.svg?branch=main)](https://github.com/WAYWO-capstone/WAYWO/actions/workflows/ci-tests.yml)
[![Check PR Title](https://github.com/WAYWO-capstone/WAYWO/actions/workflows/check-pr-title.yml/badge.svg)](https://github.com/WAYWO-capstone/WAYWO/actions/workflows/check-pr-title.yml)

## Project Summary

WAYWO is a collaborative platform for makers to document and share the complete lifecycle of DIY projects, from the initial idea and experimentation to completion and reflection. Rather than treating project information as isolated posts, WAYWO organizes project history, discussions, files, and updates around the project itself, with the goal of transforming evolving project documentation into reusable knowledge that can help other makers learn from and build upon previous work.

---

## Release Demos

| Release | Demo |
|---|---|
| Release 1 | [Video](https://drive.google.com/file/d/1bFKJmXOSMMmYRMsF4bv4mBWLYxQL7XHV/view?usp=sharing) |

---

## Project Board

[WAYWO Project Board](https://github.com/orgs/WAYWO-capstone/projects/1)

--- 

## Developer Getting Started Guide

This guide explains how to set up the WAYWO development environment and run the project locally.

### Prerequisites

Before getting started, install the following:

- [Git](https://git-scm.com/)
- [Python 3.12+](https://www.python.org/)
- [PostgreSQL 18+](https://www.postgresql.org/)
- [Bun.js](https://bun.com/)

Make sure the required tools are available from your terminal:

```bash
git --version
python --version
psql --version
bun --version
```

---

### 1. Clone the Repository

Clone the repository:

```bash
git clone https://github.com/WAYWO-capstone/WAYWO.git
```

Navigate into the project:

```bash
cd WAYWO
```

---

### 2. Project Structure

The repository is organized into separate components:

```text
WAYWO/
├── backend/       # FastAPI backend
├── frontend/      # Frontend application
├── README.md
└── ...
```

Refer to the relevant documentation in the [Wiki](#wiki) for component-specific information.

---

### Backend Setup

The backend uses **Python, FastAPI, and PostgreSQL**.

#### 1. Create a Virtual Environment

```bash
python -m venv .venv
```

Activate it:

Windows:

```bash
.venv\Scripts\activate
```
macOS/Linux:

```bash
source .venv/bin/activate
```

#### 2. Install Backend Dependencies

Navigate to the backend:

```bash
cd backend
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

#### 3. Configure Environment Variables

Create a `.env` file in the `backend/` directory.

Configure the required environment variables using the example file found at `backend/.env.example`

**Do not commit `.env` to the repository.**

#### 4. Set Up PostgreSQL

Create a PostgreSQL database for local development:

```text
waywo
```

Configure the database connection in `.env`.

Example:

```env
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/waywo
```

#### 5. Run Database Migrations

Once database migrations are configured:

```bash
alembic upgrade head
```

#### 6. Start the Backend

From the `backend/` directory:

```bash
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://localhost:8000
```

Interactive API documentation is available at:

```text
http://localhost:8000/docs
```

---

### Frontend Setup

The frontend uses React + Typescript + Vite.
Package management/bundling is handled using [Bun.js](https://bun.com/). Review the Bun [installation steps](https://bun.com/docs/installation) before starting.

#### 1. Install Frontend Dependencies

From the root, navigate to the frontend:

```bash
cd frontend
```

Install the required dependencies:

```bash
bun i
```

#### 2. Run the Vite Development Server
```bash
bun dev
```

---

## Continuous Integration

CI runs on GitHub Actions for every pull request:

- **Backend:** Pylint and Pytest against a PostgreSQL 18 service, after running Alembic migrations
- **Frontend:** Vitest tests, Vite build and oxlint
- **API types:** checks that the generated OpenAPI schema and frontend types match the backend
- **PR title check:** titles must follow `[TAGS] #<issue>: <title>`
- **Issue linking:** a PR is linked to its issue automatically from the branch name (`task/123-name`)

See [Testing Plan and Continuous Integration](../../wiki/Testing-Plan-and-Continuous-Integration) for details.


---
## Wiki

The GitHub Wiki contains detailed project documentation.

### Wiki Table of Contents

| Page | Description |
|---|---|
| [Home](../../wiki) | Introduction to WAYWO and the team members |
| [Personas](../../wiki/Personas) | Personas representing the intended WAYWO users |
| [User Stories & Backlog](../../wiki/User-Stories-&-Backlog) | Story point scale, user stories and product backlog |
| [Iteration and Release Notes](../../wiki/Iteration-and-Release-Notes) | Per-iteration velocity, contractor estimates and release summaries |
| [Infrastructure and Tools](../../wiki/Infrastructure-and-tools) | Development infrastructure, tools, and technologies used by the team |
| [Overall Architecture and Class Diagrams](../../wiki/Overall-Architecture-and-Class-Diagrams) | Overall system architecture and class diagrams |
| [Name Conventions](../../wiki/Name-Conventions) | Naming conventions followed throughout the project |
| [Testing Plan and Continuous Integration](../../wiki/Testing-Plan-and-Continuous-Integration) | Testing strategy and continuous integration practices |
| [Performance](../../wiki/Performance) | Performance considerations and requirements |
| [Security](../../wiki/Security) | Security considerations and measures |
| [Legal and Ethical issues](../../wiki/Legal-and-Ethical-issues) | Legal and ethical considerations for the project |
| [User consent and end-user license agreement](../../wiki/User-consent-and-end%E2%80%90user-license-agreement) | User consent and end-user license agreement information |
| [Diversity statement](../../wiki/Diversity-statement) | Project diversity and inclusion considerations |
| [Risks](../../wiki/Risks) | Identified project risks and mitigation strategies |
| [Economic](../../wiki/Economic) | Economic considerations for the project |
| [Budget](../../wiki/Budget) | Project budget and associated costs |
| [Deployment Plan and Infrastructure](../../wiki/Deployment-Plan-and-Infrastructure) | Deployment approach and infrastructure planning |
| [Meeting Minutes](../../wiki/Meeting-Minutes) | Records of project meetings, discussions, and decisions |
| [Missing knowledge and Independent Learning](../../wiki/Missing-knowledge-and-Independent-Learning) | Knowledge gaps identified by the team and independent learning activities |

---

## Project Documentation

For detailed information about WAYWO, refer to the [project Wiki](../../wiki).
