# WAYWO

## Project Summary

WAYWO is a collaborative platform for makers to document and share the complete lifecycle of DIY projects, from the initial idea and experimentation to completion and reflection. Rather than treating project information as isolated posts, WAYWO organizes project history, discussions, files, and updates around the project itself, with the goal of transforming evolving project documentation into reusable knowledge that can help other makers learn from and build upon previous work.

---

# Developer Getting Started Guide

This guide explains how to set up the WAYWO development environment and run the project locally.

## Prerequisites

Before getting started, install the following:

- [Git](https://git-scm.com/)
- [Python 3.12+](https://www.python.org/)
- [PostgreSQL 18+](https://www.postgresql.org/)

Make sure the required tools are available from your terminal:

```bash
git --version
python --version
psql --version
```

---

## 1. Clone the Repository

Clone the repository:

```bash
git clone <repository-url>
```

Navigate into the project:

```bash
cd WAYWO
```

---

## 2. Project Structure

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

# Backend Setup

The backend uses **Python, FastAPI, and PostgreSQL**.

## 1. Create a Virtual Environment

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

## 2. Install Backend Dependencies

Navigate to the backend:

```bash
cd backend
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

## 3. Configure Environment Variables

Create a `.env` file in the `backend/` directory.

Configure the required environment variables.

**Do not commit `.env` to the repository.**

## 4. Set Up PostgreSQL

Create a PostgreSQL database for local development:

```text
waywo
```

Configure the database connection in `.env`.

Example:

```env
DATABASE_URL=postgresql://<username>:<password>@localhost:5432/waywo
```

## 5. Run Database Migrations

Once database migrations are configured:

```bash
alembic upgrade head
```

## 6. Start the Backend

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

# Frontend Setup

> **TODO:** Add frontend setup instructions once the frontend technology and project structure are finalized.

---

# Wiki

The GitHub Wiki contains detailed project documentation.

## Wiki Table of Contents

| Page | Description |
|---|---|
| [Home](../../wiki/Introduction) | Introduction to WAYWO and an overview of the project |
| [Personas](../../wiki/Personas) | Personas representing the intended WAYWO users |
| [Infrastructure and Tools](../../wiki/Infrastructure-and-tools) | Development infrastructure, tools, and technologies used by the team |
| [Overall Architecture and Class Diagrams](../../wiki/Overall-Architecture-and-Class-Diagrams) | Overall system architecture and class diagrams |
| [Name Conventions](../../wiki/Name-Conventions) | Naming conventions followed throughout the project |
| [Testing Plan and Continuous Integration](../../wiki/Testing-Plan-and-Continuous-Integration) | Testing strategy and continuous integration practices |
| [Performance](../../wiki/Performance) | Performance considerations and requirements |
| [Security](../../wiki/Security) | Security considerations and measures |
| [Legal and Ethical issues](../../wiki/Legal-and-Ethical-issues) | Legal and ethical considerations for the project |
| [User consent and end-user license agreement](../../wiki/User-consent-and-end-user-license-agreement) | User consent and end-user license agreement information |
| [Diversity statement](../../wiki/Diversity-statement) | Project diversity and inclusion considerations |
| [Risks](../../wiki/Risks) | Identified project risks and mitigation strategies |
| [Economic](../../wiki/Economic) | Economic considerations for the project |
| [Budget](../../wiki/Budget) | Project budget and associated costs |
| [Deployment Plan and Infrastructure](../../wiki/Deployment-Plan-and-Infrastructure) | Deployment approach and infrastructure planning |
| [Meeting Minutes](../../wiki/Meeting-Minutes) | Records of project meetings, discussions, and decisions |
| [Missing knowledge and Independent Learning](../../wiki/Missing-knowledge-and-Independent-Learning) | Knowledge gaps identified by the team and independent learning activities |

---

# Project Documentation

For detailed information about WAYWO, refer to the [project Wiki](../../wiki).