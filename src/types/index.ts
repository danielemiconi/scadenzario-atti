import { Timestamp } from 'firebase/firestore';

// User roles
export type UserRole = 'admin' | 'standard';

// User interface
export interface User {
  uid?: string;
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Legend entry interface
export interface LegendEntry {
  id?: string;
  initials: string;
  fullName: string;
  active: boolean;
  backgroundColor?: string; // Colore di sfondo personalizzato
  textColor?: string; // Colore del testo personalizzato
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Deadline status type
export const DeadlineStatus = {
  FARE: 'FARE',
  NON_FARE: 'NON_FARE',
  FATTO: 'FATTO',
  GIUDIZIO_TRANSATTO: 'GIUDIZIO_TRANSATTO',
  DEPOSITARE: 'DEPOSITARE',
  NOTIFICARE: 'NOTIFICARE',
  DEPOSITATO: 'DEPOSITATO',
  NOTIFICATO: 'NOTIFICATO'
} as const;

export type DeadlineStatus = (typeof DeadlineStatus)[keyof typeof DeadlineStatus];

// Status display mapping
export const STATUS_DISPLAY_MAP: Record<DeadlineStatus, string[]> = {
  [DeadlineStatus.FARE]: ['FARE', 'DA FARE'],
  [DeadlineStatus.NON_FARE]: ['NON FARE', 'NON DA FARE'],
  [DeadlineStatus.FATTO]: ['FATTO', 'FATTA'],
  [DeadlineStatus.GIUDIZIO_TRANSATTO]: ['GIUDIZIO TRANSATTO', 'TRANSATTO'],
  [DeadlineStatus.DEPOSITARE]: ['DEPOSITARE', 'DA DEPOSITARE'],
  [DeadlineStatus.NOTIFICARE]: ['NOTIFICARE', 'DA NOTIFICARE'],
  [DeadlineStatus.DEPOSITATO]: ['DEPOSITATO', 'DEPOSITATA'],
  [DeadlineStatus.NOTIFICATO]: ['NOTIFICATO', 'NOTIFICATA']
};

// Deadline interface
export interface Deadline {
  id?: string;
  monthYear: string; // Format: "2025-06"
  ownerInitials: string;
  matter: string; // Pratica
  court: string; // Ufficio
  forum?: string; // Foro (luogo dell'ufficio giudiziario)
  rg: string; // Ruolo Generale
  actType: string; // Tipo atto
  hearingDate: Timestamp; // Data scadenza
  status?: DeadlineStatus;
  statusDate?: Timestamp; // Data udienza
  notes?: string;
  archived: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
  deleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Audit log interface
export interface AuditLog {
  id?: string;
  action: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  before?: any;
  after?: any;
  userId: string;
  userEmail: string;
  timestamp: Timestamp;
  ipAddress?: string;
}

// Notification interface
export interface Notification {
  id?: string;
  deadlineId: string;
  userId: string;
  userEmail: string;
  type: 'reminder' | 'urgent' | 'info';
  subject: string;
  body: string;
  sent: boolean;
  sentAt?: Timestamp;
  error?: string;
  createdAt: Timestamp;
}

// Filter interface for deadlines
export interface DeadlineFilter {
  monthYear?: string;
  ownerInitials?: string;
  court?: string;
  forum?: string;
  status?: DeadlineStatus;
  searchText?: string;
  archived?: boolean;
}

// Macro deadline interface
export interface MacroDeadline {
  type: 'macro';
  macroType: '171-ter' | '189' | '281-duodecies';
  hearingDate: Date;
  commonData: {
    ownerInitials: string;
    matter: string;
    court: string;
    forum?: string;
    rg: string;
    status?: DeadlineStatus;
    notes?: string;
  };
  includeSummerSuspension?: boolean;
}

// Batch deadline creation result
export interface BatchDeadlineResult {
  success: boolean;
  created: number;
  errors: Array<{
    deadline: string;
    error: string;
  }>;
}

// Auth context interface
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
}