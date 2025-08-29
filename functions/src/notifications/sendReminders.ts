import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

// Configure email transporter (use environment variables in production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || 'noreply@example.com',
    pass: functions.config().email?.password || 'password',
  },
});

export const sendReminders = async (context: functions.EventContext) => {
  console.log('Starting reminder check at:', new Date().toISOString());

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  try {
    // Get deadlines that need reminders
    const deadlinesSnapshot = await admin
      .firestore()
      .collection('deadlines')
      .where('deleted', '==', false)
      .where('archived', '==', false)
      .where('hearingDate', '>=', admin.firestore.Timestamp.fromDate(today))
      .where('hearingDate', '<=', admin.firestore.Timestamp.fromDate(in7Days))
      .get();

    const reminderPromises: Promise<any>[] = [];

    for (const doc of deadlinesSnapshot.docs) {
      const deadline = doc.data();
      const hearingDate = deadline.hearingDate.toDate();
      
      // Determine reminder type
      let reminderType = '';
      if (isSameDay(hearingDate, today)) {
        reminderType = 'oggi';
      } else if (isSameDay(hearingDate, tomorrow)) {
        reminderType = 'domani';
      } else if (hearingDate <= in7Days) {
        const daysUntil = Math.ceil((hearingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        reminderType = `tra ${daysUntil} giorni`;
      }

      if (reminderType) {
        // Get user data
        const userDoc = await admin
          .firestore()
          .collection('users')
          .doc(deadline.createdBy)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const emailPromise = sendReminderEmail(
            userData!.email,
            userData!.name,
            deadline,
            reminderType
          );
          reminderPromises.push(emailPromise);
        }
      }
    }

    await Promise.all(reminderPromises);
    console.log(`Sent ${reminderPromises.length} reminder emails`);

  } catch (error) {
    console.error('Error sending reminders:', error);
  }

  return null;
};

async function sendReminderEmail(
  email: string,
  userName: string,
  deadline: any,
  reminderType: string
): Promise<void> {
  const subject = `Scadenza Atto ${reminderType} - ${deadline.actType} - RG ${deadline.rg}`;
  
  const html = `
    <h2>Promemoria Scadenza Atto</h2>
    <p>Gentile ${userName},</p>
    <p>Si ricorda la scadenza del seguente atto <strong>${reminderType}</strong>:</p>
    <ul>
      <li><strong>Pratica:</strong> ${deadline.matter}</li>
      <li><strong>Ufficio:</strong> ${deadline.court}</li>
      <li><strong>RG:</strong> ${deadline.rg}</li>
      <li><strong>Tipo Atto:</strong> ${deadline.actType}</li>
      <li><strong>Data Udienza:</strong> ${deadline.hearingDate.toDate().toLocaleDateString('it-IT')}</li>
      <li><strong>Stato:</strong> ${deadline.status || 'Non specificato'}</li>
      ${deadline.notes ? `<li><strong>Note:</strong> ${deadline.notes}</li>` : ''}
    </ul>
    <p>Cordiali saluti,<br>Sistema Scadenzario Atti</p>
  `;

  try {
    await transporter.sendMail({
      from: functions.config().email?.from || 'noreply@scadenzario.com',
      to: email,
      subject,
      html,
    });

    // Log notification sent
    await admin.firestore().collection('notifications').add({
      deadlineId: deadline.id,
      userId: deadline.createdBy,
      userEmail: email,
      type: 'reminder',
      subject,
      body: html,
      sent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Reminder email sent to ${email} for deadline ${deadline.id}`);
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error);
    
    // Log failed notification
    await admin.firestore().collection('notifications').add({
      deadlineId: deadline.id,
      userId: deadline.createdBy,
      userEmail: email,
      type: 'reminder',
      subject,
      body: html,
      sent: false,
      error: String(error),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}