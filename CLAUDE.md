# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scadenzario Atti Processuali is a legal deadline management system built with React, TypeScript, Firebase, and TailwindCSS. It helps law firms track court deadlines, manage legal documents, and receive automated reminders.

## Key Commands

### Development
- `npm run dev` - Start Vite dev server for React app
- `npm run build` - Build React app for production
- `npm run lint` - Run ESLint on TypeScript/React files
- `npm run typecheck` - Type check without emitting files
- `npm run format` - Format code with Prettier

### Firebase Functions
- `cd functions && npm run build` - Build TypeScript functions
- `cd functions && npm run serve` - Run functions with emulators
- `cd functions && npm run lint` - Lint functions code

### Firebase Deployment
- `firebase deploy` - Deploy everything (hosting, functions, rules)
- `firebase deploy --only functions` - Deploy only Cloud Functions
- `firebase deploy --only hosting` - Deploy only hosting after build
- `firebase deploy --only firestore:rules` - Deploy Firestore security rules
- `firebase emulators:start` - Start local Firebase emulators

### Monitoring
- `firebase functions:log` - View Cloud Functions logs
- `cd functions && npm run logs` - Alternative way to view logs

## Architecture

### Frontend Structure
- **React + TypeScript** app with Vite bundler
- **Authentication**: Firebase Auth with email/password, custom user roles (admin/standard)
- **State Management**: TanStack Query for server state, React Context for auth
- **Routing**: React Router v7 with protected routes based on user roles
- **Styling**: TailwindCSS v4 with PostCSS

### Key Frontend Components
- `src/contexts/AuthContext.tsx` - Authentication state and user management
- `src/components/auth/PrivateRoute.tsx` - Route protection based on auth/role
- `src/pages/Dashboard.tsx` - Main deadline management interface
- `src/pages/AdminPage.tsx` - Admin-only features (user management, data import)
- `src/types/index.ts` - Central TypeScript type definitions

### Backend (Firebase Functions)
Located in `functions/src/`:
- **Auth**: `setUserRole.ts` - Assign admin/standard roles via custom claims
- **Deadlines**: 
  - `calculateMonthYear.ts` - Auto-calculate month/year from hearing date
  - `checkDuplicates.ts` - Prevent duplicate deadline entries
  - `exportData.ts` - Export deadlines to CSV
  - `generateIcs.ts` - Generate calendar files
- **Notifications**: `sendReminders.ts` - Daily scheduled email reminders
- **Audit**: `auditLogger.ts` - Track all Firestore document changes

### Data Model (Firestore)
- **users**: User profiles with roles and initials
- **deadlines**: Court deadlines with status tracking
- **legend**: Mapping of initials to full names
- **audit_logs**: Change history for compliance
- **notifications**: Email notification records

### Security
- Firestore rules in `firestore.rules` enforce role-based access
- Admin role required for user management and data import
- Custom claims set via Cloud Functions for secure role assignment
- Audit logging for all data modifications

## Development Guidelines

### Adding New Features
1. TypeScript types go in `src/types/index.ts`
2. Follow existing component patterns in `src/components/`
3. Use TanStack Query for data fetching
4. Add corresponding Cloud Function if server-side logic needed

### Firebase Development
1. Use emulators for local development: `firebase emulators:start`
2. Functions use TypeScript - build before deploying: `cd functions && npm run build`
3. Test functions locally with: `cd functions && npm run serve`

### Deployment Process
1. Build frontend: `npm run build`
2. Build functions: `cd functions && npm run build`
3. Deploy all: `firebase deploy`
4. Or deploy selectively with `--only` flag

### Environment Setup
- Firebase project configuration required (see README_SETUP.md)
- Email configuration needed for notifications (Firebase config vars)
- First admin must be manually set via Firestore console or CLI