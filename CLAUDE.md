# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scadenzario Atti Processuali is a legal deadline management system built with React, TypeScript, Firebase, and TailwindCSS. It helps law firms track court deadlines, manage legal documents, and receive automated reminders.

## Key Commands

### Development
- `npm run dev` - Start Vite dev server for React app
- `npm run build` - Build React app for production (includes TypeScript compilation)
- `npm run lint` - Run ESLint on TypeScript/React files
- `npm run typecheck` - Type check without emitting files
- `npm run format` - Format code with Prettier
- `npm run firebase:emulators` - Start Firebase emulators for local development

### Firebase Functions
- `cd functions && npm run build` - Build TypeScript functions
- `cd functions && npm run serve` - Run functions with emulators
- `cd functions && npm run lint` - Lint functions code

### Firebase Deployment
- `npm run firebase:deploy` - Build React app and deploy everything
- `npm run firebase:deploy:hosting` - Build and deploy only hosting
- `npm run firebase:deploy:functions` - Deploy only Cloud Functions
- `npm run firebase:deploy:rules` - Deploy only Firestore security rules
- `firebase deploy` - Deploy everything (hosting, functions, rules)
- `firebase emulators:start` - Start local Firebase emulators

### Monitoring
- `npm run functions:logs` - View Cloud Functions logs
- `firebase functions:log` - Alternative way to view logs

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
  - `archiveDeadline.ts` - Archive/restore deadlines
  - `softDeleteDeadline.ts` - Soft delete deadlines (move to trash)
  - `restoreDeadline.ts` - Restore deadlines from trash
  - `emptyTrash.ts` - Permanently delete all trashed items
  - `permanentlyDelete.ts` - Hard delete specific deadline
- **Notifications**: `sendReminders.ts` - Daily scheduled email reminders
- **Audit**: `auditLogger.ts` - Track all Firestore document changes
- **Migrations**: `addMissingFields.ts` - Data migration utilities

### Data Model (Firestore)
- **users**: User profiles with roles and initials
- **deadlines**: Court deadlines with status tracking, archival, and soft deletion
- **legend**: Mapping of initials to full names with custom colors
- **auditLogs**: Change history for compliance (read-only from client)
- **notifications**: Email notification records (read-only from client)

### Security
- Firestore rules in `firestore.rules` enforce role-based access
- Admin role required for user management and data import
- Custom claims set via Cloud Functions for secure role assignment
- Audit logging for all data modifications

## Development Guidelines

### Role-Based Access Control
The system implements strict RBAC with two roles:
- **admin**: Full access to user management, data import/export, trash management
- **standard**: Can manage deadlines they created or are assigned to (via initials)

Role assignment happens via:
1. Firebase custom claims (set via `setUserRole` Cloud Function)
2. Firestore document role field (fallback)
3. Special email admin bypass: `daniele.miconi@iblegal.it`

### Critical Business Logic
- **Duplicate Prevention**: `checkDuplicates` function validates court+rg+actType+hearingDate uniqueness
- **Auto-calculated Fields**: `monthYear` automatically derived from `hearingDate` via `calculateMonthYear`
- **Audit Trail**: All CRUD operations logged via `auditLogger` trigger function
- **Soft Deletion**: Items moved to trash (deleted=true) before permanent deletion

### Data Validation Patterns
- **RG Format**: Must match `^[0-9]{1,6}/[0-9]{4}$` (e.g., "506/2025")
- **MonthYear Format**: Must match `^[0-9]{4}-[0-9]{2}$` (e.g., "2025-06")
- **Required Fields**: All deadlines must have `monthYear`, `ownerInitials`, `matter`, `court`, `rg`, `actType`, `hearingDate`, `createdBy`

### UI/UX Patterns
- **Deadline Highlighting**: Color-coded based on urgency (red <7 days, yellow 7-14 days, green >14 days)
- **Icon-Based Actions**: Edit button uses SVG pencil icon instead of text
- **Visual Deadline Priority**: Scadenza column positioned as last data column for prominence

### Adding New Features
1. TypeScript types go in `src/types/index.ts`
2. Follow existing component patterns in `src/components/`
3. Use TanStack Query for server state management
4. Add Cloud Function if server-side validation/logic needed
5. Update Firestore rules for new collections/fields
6. Consider audit logging requirements

### Firebase Development
1. Use emulators for local development: `npm run firebase:emulators`
2. Functions use TypeScript - always build before deploying
3. Test functions locally with: `cd functions && npm run serve`
4. Email configuration stored in Firebase functions config (legacy, migration needed)

### Deployment Process
1. Use `npm run firebase:deploy` for complete build and deploy
2. Or selective deployment with `npm run firebase:deploy:hosting/functions/rules`
3. Functions deployment skipped if no changes detected
4. Build validation includes TypeScript compilation for both React and Functions

### Setup Requirements
- Node.js 18+ (note: runtime deprecated, upgrade recommended)
- Firebase CLI with billing enabled
- Email configuration for notifications via functions config
- First admin user manually configured via Firestore console
- See README_SETUP.md for detailed environment setup