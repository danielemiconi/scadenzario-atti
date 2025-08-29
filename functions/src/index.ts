import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { setUserRole } from './auth/setUserRole';
import { calculateMonthYear } from './deadlines/calculateMonthYear';
import { checkDuplicates } from './deadlines/checkDuplicates';
import { sendReminders } from './notifications/sendReminders';
import { generateIcs } from './deadlines/generateIcs';
import { exportData } from './deadlines/exportData';
import { auditLogger } from './utils/auditLogger';

// Initialize Firebase Admin
admin.initializeApp();

// Auth Functions
exports.setUserRole = functions.https.onCall(setUserRole);

// Deadline Functions
exports.calculateMonthYear = functions.firestore
  .document('deadlines/{deadlineId}')
  .onWrite(calculateMonthYear);

exports.checkDuplicates = functions.firestore
  .document('deadlines/{deadlineId}')
  .onCreate(checkDuplicates);

// Notification Functions - Scheduled to run daily at 9:00 AM Rome time
exports.sendReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Europe/Rome')
  .onRun(sendReminders);

// Export Functions
exports.generateIcs = functions.https.onCall(generateIcs);
exports.exportData = functions.https.onCall(exportData);

// Audit Functions
exports.auditLogger = functions.firestore
  .document('{collection}/{docId}')
  .onWrite(auditLogger);