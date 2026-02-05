# Installation Guide

Welcome to the **Fromcode Framework**. This guide will walk you through setting up your development environment.

## Prerequisites

- **Node.js**: v18 or higher (v20 recommended)
- **Docker**: For running PostgreSQL, Redis, and other services
- **npm**: v9 or higher

## Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/fromcode-com/framework.git
   cd framework
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and update it with your settings.
   ```bash
   cp .env.example .env
   ```

## Development Environment

The framework uses Docker Compose to orchestrate local development.

1. **Start Development Services**:
   ```bash
   npm run dev
   ```
   This command starts:
   - **PostgreSQL**: Database for core and plugins.
   - **Redis**: For caching and job queues.
   - **API Server**: Backend service.
   - **Admin Console**: Management interface.
   - **Frontend**: Public-facing application.

2. **Access the Admin Panel**:
   Navigate to [http://localhost:3000](http://localhost:3000) (default) or the domain configured in your `.env`.

## First Run / Onboarding

On your first visit, you will be prompted to create an administrative account. This process initializes the database and sets up the core system settings.

## Production Deployment

For production, we recommend using our pre-configured Docker templates located in the `deploy/` directory.

- **Full-Stack**: Standard production deployment.
- **API-Only**: Headless CMS deployment.
- **Frontend-Only**: Edge deployment connecting to an external API.

For more details, see [Deployment Guides](./deployment.md).
