import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  runTransaction,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type Deadline, type BatchDeadlineResult, type MacroDeadline } from '../types';
import { calculateMacroDeadlines, type DeadlineCalculation } from '../utils/legalDeadlines';

interface MacroDeadlineWithCustomDates extends MacroDeadline {
  customDeadlines?: DeadlineCalculation[];
}

/**
 * Verifica se esiste già una scadenza con gli stessi parametri
 */
async function checkDuplicateDeadline(
  court: string,
  rg: string,
  actType: string,
  statusDate: Date
): Promise<boolean> {
  const q = query(
    collection(db, 'deadlines'),
    where('court', '==', court),
    where('rg', '==', rg),
    where('actType', '==', actType),
    where('deleted', '==', false)
  );
  
  const snapshot = await getDocs(q);
  
  // Verifica se esiste una scadenza con la stessa statusDate
  return snapshot.docs.some(doc => {
    const data = doc.data() as Deadline;
    if (data.statusDate) {
      const existingDate = data.statusDate.toDate();
      return existingDate.toDateString() === statusDate.toDateString();
    }
    return false;
  });
}

/**
 * Calcola il monthYear da una data
 */
function calculateMonthYear(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Crea multiple scadenze da una macro
 */
export async function createMacroDeadlines(
  macro: MacroDeadlineWithCustomDates,
  userId: string
): Promise<BatchDeadlineResult> {
  const result: BatchDeadlineResult = {
    success: false,
    created: 0,
    errors: []
  };

  try {
    // Usa le scadenze personalizzate se fornite, altrimenti calcola quelle standard
    const calculations = macro.customDeadlines || calculateMacroDeadlines({
      type: macro.macroType,
      hearingDate: macro.hearingDate,
      includeSummerSuspension: macro.includeSummerSuspension
    });

    // Valida il formato RG
    if (!macro.commonData.rg.match(/^\d{1,6}\/\d{4}$/)) {
      throw new Error('Formato RG non valido. Usa il formato: 123/2025');
    }

    // Usa una transazione per garantire atomicità
    await runTransaction(db, async () => {
      const deadlinesToCreate: Partial<Deadline>[] = [];
      
      // Prepara tutte le scadenze da creare
      for (const calc of calculations) {
        // Controlla duplicati
        const isDuplicate = await checkDuplicateDeadline(
          macro.commonData.court,
          macro.commonData.rg,
          calc.type,
          calc.date
        );
        
        if (isDuplicate) {
          result.errors.push({
            deadline: calc.type,
            error: 'Scadenza già esistente con questi parametri'
          });
          continue;
        }
        
        // Prepara i dati della scadenza
        const deadlineData: Partial<Deadline> = {
          monthYear: calculateMonthYear(calc.date),
          ownerInitials: macro.commonData.ownerInitials.toUpperCase(),
          matter: macro.commonData.matter,
          court: macro.commonData.court,
          forum: macro.commonData.forum,
          rg: macro.commonData.rg,
          actType: calc.type.toUpperCase(),
          hearingDate: Timestamp.fromDate(macro.hearingDate),
          status: macro.commonData.status || undefined,
          statusDate: Timestamp.fromDate(calc.date),
          notes: macro.commonData.notes || `${calc.description} (creato da macro ${macro.macroType})`,
          archived: false,
          deleted: false,
          createdBy: userId,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp
        };
        
        deadlinesToCreate.push(deadlineData);
      }
      
      // Crea tutte le scadenze nella transazione
      for (const deadlineData of deadlinesToCreate) {
        await addDoc(collection(db, 'deadlines'), deadlineData);
        result.created++;
      }
    });
    
    result.success = result.created > 0;
    
    if (result.created === 0 && result.errors.length === 0) {
      result.errors.push({
        deadline: 'generale',
        error: 'Nessuna scadenza da creare per questa macro'
      });
    }
    
  } catch (error) {
    result.errors.push({
      deadline: 'generale',
      error: error instanceof Error ? error.message : 'Errore sconosciuto durante la creazione'
    });
  }
  
  return result;
}

/**
 * Crea una singola scadenza
 */
export async function createSingleDeadline(
  deadlineData: Partial<Deadline>,
  userId: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    // Valida il formato RG
    if (deadlineData.rg && !deadlineData.rg.match(/^\d{1,6}\/\d{4}$/)) {
      throw new Error('Formato RG non valido. Usa il formato: 123/2025');
    }
    
    const fullDeadlineData = {
      ...deadlineData,
      archived: false,
      deleted: false,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'deadlines'), fullDeadlineData);
    
    return { success: true, id: docRef.id };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    };
  }
}