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
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Deadline status enum
export enum DeadlineStatus {
  DEPOSITATO = 'DEPOSITATO',
  FATTO = 'FATTO',
  RINVIATA = 'RINVIATA',
  NOTIFICATO = 'NOTIFICATO',
  NOTE_127_TER = 'NOTE_127_TER',
  NOTE_TRATT_SCRITTA = 'NOTE_TRATT_SCRITTA',
  MEMORIA_171_TER = 'MEMORIA_171_TER',
  NOTE_PC = 'NOTE_PC',
  COMPARSA_COSTITUZIONE = 'COMPARSA_COSTITUZIONE',
  COMPARSA_CONCLUSIONALE = 'COMPARSA_CONCLUSIONALE',
  REPLICHE = 'REPLICHE',
  COMPARSA_APPELLO = 'COMPARSA_APPELLO',
  RICORSO_CASSAZIONE = 'RICORSO_CASSAZIONE',
  RECLAMO = 'RECLAMO',
  MEMORIA_218_DUODECIES = 'MEMORIA_218_DUODECIES',
  UD_EDITTALE = 'UD_EDITTALE',
  PENDENTE = 'PENDENTE'
}

// Status display mapping
export const STATUS_DISPLAY_MAP: Record<DeadlineStatus, string[]> = {
  [DeadlineStatus.DEPOSITATO]: ['DEPOSITATO', 'DEPOSITATA'],
  [DeadlineStatus.FATTO]: ['FATTO', 'FATTA'],
  [DeadlineStatus.RINVIATA]: ['RINVIATA', 'RINVIATO'],
  [DeadlineStatus.NOTIFICATO]: ['NOTIFICATO', 'NOTIFICATA'],
  [DeadlineStatus.NOTE_127_TER]: ['NOTE 127 TER', 'NOTE SCRITTE D\'UDIENZA 127 TER'],
  [DeadlineStatus.NOTE_TRATT_SCRITTA]: ['NOTE TRATT. SCRITTA', 'NOTE DI TRATTAZIONE SCRITTA'],
  [DeadlineStatus.MEMORIA_171_TER]: ['MEMORIA 171 TER', 'MEMORIA 171 TER n. 1'],
  [DeadlineStatus.NOTE_PC]: ['NOTE DI P.C.', 'NOTE DI PC'],
  [DeadlineStatus.COMPARSA_COSTITUZIONE]: ['COMPARSA COSTITUZIONE', 'COMP COST', 'COMPARSA DI COSTITUZIONE'],
  [DeadlineStatus.COMPARSA_CONCLUSIONALE]: ['COMPARSA CONCLUSIONALE', 'COMP CONCL'],
  [DeadlineStatus.REPLICHE]: ['REPLICHE', 'REPLICA'],
  [DeadlineStatus.COMPARSA_APPELLO]: ['COMPARSA APPELLO', 'ATTO DI APPELLO'],
  [DeadlineStatus.RICORSO_CASSAZIONE]: ['RICORSO PER CASSAZIONE'],
  [DeadlineStatus.RECLAMO]: ['RECLAMO'],
  [DeadlineStatus.MEMORIA_218_DUODECIES]: ['MEMORIE EX ART. 218-DUODECIES N. 1 C.P.C.'],
  [DeadlineStatus.UD_EDITTALE]: ['UD. EDITTALE', 'UDIENZA EDITTALE'],
  [DeadlineStatus.PENDENTE]: ['PENDENTE', 'IN ATTESA']
};

// Deadline interface
export interface Deadline {
  id?: string;
  monthYear: string; // Format: "2025-06"
  ownerInitials: string;
  matter: string; // Pratica
  court: string; // Ufficio
  rg: string; // RG number
  actType: string; // Tipo atto
  hearingDate: Timestamp; // Data udienza
  status?: DeadlineStatus;
  statusDate?: Timestamp;
  notes?: string;
  archived: boolean;
  deleted: boolean;
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
  status?: DeadlineStatus;
  searchText?: string;
  archived?: boolean;
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