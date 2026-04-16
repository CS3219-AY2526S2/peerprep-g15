[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)

# CS3219 Project (PeerPrep) - AY2526S2

## Group: G15

PeerPrep is a collaborative interview-practice platform built with a microservices architecture. This repository contains the full project: the frontend application, backend services, end-to-end tests, and root-level tooling for local development and CI.

This root README is intended to give a **project-wide overview** of how PeerPrep is organized and how the pieces fit together. For **service-specific setup, environment variables, scripts, APIs, and implementation details**, please refer to the README inside each service directory.

## Project Overview

PeerPrep is designed to support the end-to-end workflow of technical interview practice. At a high level, the system supports:

- user authentication and profile management
- question management
- user matching for practice sessions
- real-time collaboration
- history tracking of completed sessions

Instead of placing all responsibilities into a single backend, PeerPrep is split into multiple services so that each service owns a clear domain and can be developed, tested, and deployed more independently.

## Repository Structure

The repository currently contains:

- `frontend` – the user-facing web application
- `user-service` – authentication, user management, and authorization
- `question-service` – question-related functionality
- `matching-service` – matching users for sessions
- `collaboration-service` – real-time collaboration features
- `history-service` – storing and retrieving session history
- `playwright-tests` – end-to-end tests
- `.github/workflows` – CI workflows
- `docker-compose.yml` – local multi-service orchestration
- root project configuration such as `package.json`, `playwright.config.ts`, and TypeScript config files

For the latest source layout, see the repository root.

## Architecture

PeerPrep follows a **microservices-based architecture**. Each backend service has a focused responsibility:

### Frontend

The frontend provides the main user interface for interacting with PeerPrep. It handles the user-facing experience and communicates with the backend services.

### User Service

The User Service is responsible for identity and access-related concerns such as authentication, user profiles, roles, and authorization-related flows.

### Question Service

The Question Service manages the question domain, including question retrieval and related business logic.

### Matching Service

The Matching Service is responsible for pairing users for practice sessions.

### Collaboration Service

The Collaboration Service supports collaborative session functionality, including real-time interactions.

### History Service

The History Service stores and retrieves historical records of practice sessions.

This structure keeps responsibilities separated and makes the system easier to reason about as a whole.

## Tech Stack

At the repository level, PeerPrep is primarily a **TypeScript-based project** built around a modern web stack and service-oriented backend.

Common technologies used across the repository include:

- **TypeScript**
- **Node.js**
- **Docker / Docker Compose**
- **GitHub Actions** for CI
- **Playwright** for end-to-end testing

Different services may use different libraries, databases, or testing strategies depending on their needs. Please refer to each service’s README for the exact stack used by that service.

## Local Development

### Prerequisites

Before running PeerPrep locally, make sure you have:

- **Node.js**
- **npm**
- **Docker**
- **Docker Compose**

You may also need service-specific environment files depending on which services you want to run.

### Installing dependencies

Install root-level dependencies first:

```bash
npm install
```
