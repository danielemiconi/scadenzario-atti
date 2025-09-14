import { subDays, isWeekend, format, addDays, addMonths, getYear, getMonth, getDate } from 'date-fns';

export type MacroType = '171-ter' | '189' | '281-duodecies' | 'appello-lungo' | 'appello-breve';

export interface DeadlineCalculation {
  type: string;
  description: string;
  date: Date;
  daysFromHearing: number;
}

export interface MacroConfig {
  type: MacroType;
  hearingDate: Date;
  includeSummerSuspension?: boolean;
}

// Periodo di sospensione feriale dei termini processuali (1 agosto - 31 agosto)
const SUMMER_SUSPENSION_START_MONTH = 7; // August (0-indexed)
const SUMMER_SUSPENSION_START_DAY = 1;
const SUMMER_SUSPENSION_END_DAY = 31;

/**
 * Calcola la data della Pasqua per un determinato anno usando l'algoritmo di Gauss
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month, day);
}

/**
 * Ottiene la Pasquetta (Lunedì dell'Angelo) per un determinato anno
 */
function getEasterMondayDate(year: number): Date {
  const easter = getEasterDate(year);
  return addDays(easter, 1);
}

/**
 * Verifica se una data è una festività nazionale italiana
 */
function isItalianHoliday(date: Date): boolean {
  const year = getYear(date);
  const month = getMonth(date); // 0-indexed
  const day = getDate(date);
  
  // Festività fisse
  const fixedHolidays = [
    { month: 0, day: 1 },   // Capodanno
    { month: 0, day: 6 },   // Epifania
    { month: 3, day: 25 },  // Liberazione
    { month: 4, day: 1 },   // Festa del Lavoro
    { month: 5, day: 2 },   // Festa della Repubblica
    { month: 7, day: 15 },  // Ferragosto
    { month: 10, day: 1 },  // Ognissanti
    { month: 11, day: 8 },  // Immacolata
    { month: 11, day: 25 }, // Natale
    { month: 11, day: 26 }, // Santo Stefano
  ];
  
  // Controlla festività fisse
  for (const holiday of fixedHolidays) {
    if (month === holiday.month && day === holiday.day) {
      return true;
    }
  }
  
  // Controlla Pasquetta (festività mobile)
  const easterMonday = getEasterMondayDate(year);
  if (month === getMonth(easterMonday) && day === getDate(easterMonday)) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se una data cade nel periodo di sospensione feriale
 */
function isInSummerSuspension(date: Date): boolean {
  const month = getMonth(date);
  const day = getDate(date);
  
  return month === SUMMER_SUSPENSION_START_MONTH && 
         day >= SUMMER_SUSPENSION_START_DAY && 
         day <= SUMMER_SUSPENSION_END_DAY;
}

/**
 * Calcola la scadenza sottraendo giorni di CALENDARIO (non solo lavorativi)
 * considerando opzionalmente la sospensione feriale.
 * 
 * IMPORTANTE: Per i termini processuali (art. 171-ter, 189, etc.) si contano
 * i giorni di calendario, non solo quelli lavorativi.
 * 
 * La sospensione feriale (1-31 agosto) "congela" il conteggio dei termini.
 * Il criterio prudenziale si applica solo alla data finale risultante.
 */
function calculateCalendarDaysBackward(
  hearingDate: Date,
  daysBack: number,
  includeSummerSuspension: boolean = false
): Date {
  let remainingDays = daysBack;
  let currentDate = new Date(hearingDate);
  currentDate.setHours(0, 0, 0, 0);
  
  // Conta all'indietro giorno per giorno (TUTTI i giorni, non solo lavorativi)
  while (remainingDays > 0) {
    currentDate = subDays(currentDate, 1);
    
    // Se la sospensione feriale è attiva e siamo entrati in agosto
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      // Salta tutto agosto andando al 31 luglio
      const year = getYear(currentDate);
      currentDate = new Date(year, 6, 31); // 31 luglio
      // Il 31 luglio deve essere contato come giorno valido
      remainingDays--;
      continue;
    }
    
    // Conta OGNI giorno (inclusi weekend e festivi) purché non sia agosto sospeso
    remainingDays--;
  }
  
  // SOLO ORA applica il criterio prudenziale:
  // se la data finale cade in giorno non lavorativo, anticipare
  while (isWeekend(currentDate) || 
         isItalianHoliday(currentDate) || 
         (includeSummerSuspension && isInSummerSuspension(currentDate))) {
    
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      // Se siamo finiti in agosto, saltiamo al 31 luglio
      const year = getYear(currentDate);
      currentDate = new Date(year, 6, 31);
    } else {
      // Altrimenti anticipiamo di un giorno
      currentDate = subDays(currentDate, 1);
    }
  }
  
  return currentDate;
}

/**
 * Calcola una scadenza aggiungendo giorni di CALENDARIO dalla data di partenza,
 * considerando opzionalmente la sospensione feriale.
 * 
 * Usato per gli atti di appello dove si conta in avanti dalla data di notifica/pubblicazione.
 */
function calculateCalendarDaysForward(
  startDate: Date,
  daysForward: number,
  includeSummerSuspension: boolean = false
): Date {
  let remainingDays = daysForward;
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  // Conta in avanti giorno per giorno (TUTTI i giorni, non solo lavorativi)
  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    
    // Se la sospensione feriale è attiva e siamo entrati in agosto
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      // Salta tutto agosto andando al 1° settembre
      const year = getYear(currentDate);
      currentDate = new Date(year, 8, 1); // 1 settembre
      // Il 1° settembre deve essere contato come giorno valido
      remainingDays--;
      continue;
    }
    
    // Conta OGNI giorno (inclusi weekend e festivi) purché non sia agosto sospeso
    remainingDays--;
  }
  
  // SOLO ORA applica il criterio prudenziale:
  // se la data finale cade in giorno non lavorativo, posticipare al prossimo giorno utile
  while (isWeekend(currentDate) || 
         isItalianHoliday(currentDate) || 
         (includeSummerSuspension && isInSummerSuspension(currentDate))) {
    
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      // Se siamo finiti in agosto, saltiamo al 1° settembre
      const year = getYear(currentDate);
      currentDate = new Date(year, 8, 1);
    } else {
      // Altrimenti posticipamo di un giorno
      currentDate = addDays(currentDate, 1);
    }
  }
  
  return currentDate;
}

/**
 * Calcola una scadenza aggiungendo mesi dalla data di partenza,
 * considerando opzionalmente la sospensione feriale.
 * 
 * Usato per l'appello con termine lungo (6 mesi dalla pubblicazione).
 * Se la sospensione feriale è attiva e la data di partenza cade in agosto,
 * il conteggio inizia dal 1° settembre.
 */
function calculateMonthsForward(
  startDate: Date,
  monthsForward: number,
  includeSummerSuspension: boolean = false
): Date {
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  // Se la sospensione feriale è attiva e la data di partenza cade in agosto,
  // il conteggio dei mesi inizia dal 1° settembre
  if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
    const year = getYear(currentDate);
    currentDate = new Date(year, 8, 1); // 1° settembre - da qui inizia il conteggio
  }
  
  // Aggiungi i mesi dalla data di inizio effettiva
  currentDate = addMonths(currentDate, monthsForward);
  
  // Applica il criterio prudenziale:
  // se la data finale cade in giorno non lavorativo, posticipare al prossimo giorno utile
  while (isWeekend(currentDate) || 
         isItalianHoliday(currentDate) || 
         (includeSummerSuspension && isInSummerSuspension(currentDate))) {
    
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      // Se siamo finiti in agosto, saltiamo al 1° settembre
      const yearLoop = getYear(currentDate);
      currentDate = new Date(yearLoop, 8, 1);
    } else {
      // Altrimenti posticipamo di un giorno
      currentDate = addDays(currentDate, 1);
    }
  }
  
  return currentDate;
}

/**
 * Calcola le scadenze per l'articolo 171-ter C.P.C.
 * - Prima memoria integrativa: 40 giorni (di calendario) prima dell'udienza
 * - Seconda memoria integrativa: 20 giorni (di calendario) prima dell'udienza
 * - Terza memoria (repliche): 10 giorni (di calendario) prima dell'udienza
 */
export function calculate171TerDeadlines(config: MacroConfig): DeadlineCalculation[] {
  const { hearingDate, includeSummerSuspension } = config;
  
  return [
    {
      type: 'MEMORIA 171-TER 1° TERMINE',
      description: 'Prima memoria integrativa',
      date: calculateCalendarDaysBackward(hearingDate, 40, includeSummerSuspension),
      daysFromHearing: -40
    },
    {
      type: 'MEMORIA 171-TER 2° TERMINE',
      description: 'Seconda memoria integrativa',
      date: calculateCalendarDaysBackward(hearingDate, 20, includeSummerSuspension),
      daysFromHearing: -20
    },
    {
      type: 'MEMORIA 171-TER 3° TERMINE',
      description: 'Terza memoria (repliche)',
      date: calculateCalendarDaysBackward(hearingDate, 10, includeSummerSuspension),
      daysFromHearing: -10
    }
  ];
}

/**
 * Calcola le scadenze per l'articolo 189 C.P.C.
 * - Precisazione conclusioni: 60 giorni (di calendario) prima dell'udienza
 * - Comparse conclusionali: 30 giorni (di calendario) prima dell'udienza
 * - Memorie di replica: 10 giorni (di calendario) prima dell'udienza
 */
export function calculate189Deadlines(config: MacroConfig): DeadlineCalculation[] {
  const { hearingDate, includeSummerSuspension } = config;
  
  return [
    {
      type: 'FOGLIO DI PRECISAZIONE DELLE CONCLUSIONI',
      description: 'Precisazione delle conclusioni',
      date: calculateCalendarDaysBackward(hearingDate, 60, includeSummerSuspension),
      daysFromHearing: -60
    },
    {
      type: 'MEMORIA 189 2° TERMINE (CONCLUSIONALE)',
      description: 'Comparsa conclusionale',
      date: calculateCalendarDaysBackward(hearingDate, 30, includeSummerSuspension),
      daysFromHearing: -30
    },
    {
      type: 'MEMORIA 189 3° TERMINE C.P.C. (REPLICHE)',
      description: 'Memoria di replica',
      date: calculateCalendarDaysBackward(hearingDate, 10, includeSummerSuspension),
      daysFromHearing: -10
    }
  ];
}

/**
 * Calcola le scadenze per l'articolo 281-duodecies C.P.C.
 * - Prima memoria: 30 giorni (di calendario) prima dell'udienza
 * - Seconda memoria: 10 giorni (di calendario) prima dell'udienza
 */
export function calculate281DuodeciesDeadlines(config: MacroConfig): DeadlineCalculation[] {
  const { hearingDate, includeSummerSuspension } = config;
  
  return [
    {
      type: 'MEMORIA 281-DUODECIES 1° TERMINE',
      description: 'Prima memoria',
      date: calculateCalendarDaysBackward(hearingDate, 30, includeSummerSuspension),
      daysFromHearing: -30
    },
    {
      type: 'MEMORIA 281-DUODECIES 2° TERMINE',
      description: 'Seconda memoria',
      date: calculateCalendarDaysBackward(hearingDate, 10, includeSummerSuspension),
      daysFromHearing: -10
    }
  ];
}

/**
 * Calcola la scadenza per l'atto di appello con termine lungo
 * - Termine di 6 mesi dalla data di pubblicazione della sentenza (art. 325 C.P.C.)
 */
export function calculateAppealLongDeadline(config: MacroConfig): DeadlineCalculation[] {
  const { hearingDate, includeSummerSuspension } = config;
  
  return [
    {
      type: 'ATTO DI APPELLO (TERMINE LUNGO)',
      description: 'Atto di appello da depositare entro 6 mesi dalla pubblicazione della sentenza',
      date: calculateMonthsForward(hearingDate, 6, includeSummerSuspension),
      daysFromHearing: 0 // Non è riferito a una data udienza ma alla data di pubblicazione
    }
  ];
}

/**
 * Calcola la scadenza per l'atto di appello con termine breve
 * - Termine di 30 giorni dalla data di notifica della sentenza (art. 325 C.P.C.)
 */
export function calculateAppealShortDeadline(config: MacroConfig): DeadlineCalculation[] {
  const { hearingDate, includeSummerSuspension } = config;
  
  return [
    {
      type: 'ATTO DI APPELLO (TERMINE BREVE)',
      description: 'Atto di appello da depositare entro 30 giorni dalla notifica della sentenza',
      date: calculateCalendarDaysForward(hearingDate, 30, includeSummerSuspension),
      daysFromHearing: 0 // Non è riferito a una data udienza ma alla data di notifica
    }
  ];
}

/**
 * Calcola le scadenze in base al tipo di macro selezionato
 */
export function calculateMacroDeadlines(config: MacroConfig): DeadlineCalculation[] {
  switch (config.type) {
    case '171-ter':
      return calculate171TerDeadlines(config);
    case '189':
      return calculate189Deadlines(config);
    case '281-duodecies':
      return calculate281DuodeciesDeadlines(config);
    case 'appello-lungo':
      return calculateAppealLongDeadline(config);
    case 'appello-breve':
      return calculateAppealShortDeadline(config);
    default:
      throw new Error(`Tipo di macro non supportato: ${config.type}`);
  }
}

/**
 * Formatta una data per la visualizzazione
 */
export function formatDeadlineDate(date: Date): string {
  return format(date, 'dd/MM/yyyy');
}

/**
 * Calcola i giorni rimanenti da oggi alla scadenza
 */
export function calculateDaysRemaining(deadlineDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Funzione di debug per verificare il calcolo delle scadenze
 * Restituisce un array con ogni passo del calcolo per verificarne la correttezza
 */
export function debugCalculateCalendarDaysBackward(
  hearingDate: Date,
  daysBack: number,
  includeSummerSuspension: boolean = false
): Array<{ date: string; dayOfWeek: string; isCountedDay: boolean; remainingDays: number; note: string }> {
  const steps: Array<{ date: string; dayOfWeek: string; isCountedDay: boolean; remainingDays: number; note: string }> = [];
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  
  let remainingDays = daysBack;
  let currentDate = new Date(hearingDate);
  currentDate.setHours(0, 0, 0, 0);
  
  // Log starting point
  steps.push({
    date: format(currentDate, 'dd/MM/yyyy'),
    dayOfWeek: daysOfWeek[currentDate.getDay()],
    isCountedDay: false,
    remainingDays: remainingDays,
    note: 'Data udienza (punto di partenza - non si conta)'
  });
  
  // Calcolo principale - contiamo GIORNI DI CALENDARIO
  while (remainingDays > 0) {
    const previousDate = new Date(currentDate);
    currentDate = subDays(currentDate, 1);
    let note = '';
    let isCountedDay = true; // Di default OGNI giorno conta (calendario)
    
    // Se entriamo in agosto con sospensione attiva
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      const year = getYear(currentDate);
      currentDate = new Date(year, 6, 31); // Salta al 31 luglio
      note = `Entrato in agosto dal ${format(previousDate, 'dd/MM')}, salto tutto agosto → 31 luglio (conta come giorno valido)`;
      isCountedDay = true; // Il 31 luglio conta
      remainingDays--; // Il 31 luglio deve essere contato
      steps.push({
        date: format(currentDate, 'dd/MM/yyyy'),
        dayOfWeek: daysOfWeek[currentDate.getDay()],
        isCountedDay: true,
        remainingDays,
        note
      });
      continue;
    }
    
    // Ogni giorno di calendario conta (anche weekend e festivi)
    // tranne agosto se sospeso
    if (isWeekend(currentDate)) {
      note = 'Weekend (conta come giorno di calendario)';
    } else if (isItalianHoliday(currentDate)) {
      note = 'Festività (conta come giorno di calendario)';
    } else {
      note = 'Giorno feriale (conta)';
    }
    
    remainingDays--;
    
    steps.push({
      date: format(currentDate, 'dd/MM/yyyy'),
      dayOfWeek: daysOfWeek[currentDate.getDay()],
      isCountedDay,
      remainingDays,
      note
    });
  }
  
  // Criterio prudenziale - se cade in giorno non lavorativo, anticipare
  let prudentialApplied = false;
  while (isWeekend(currentDate) || 
         isItalianHoliday(currentDate) || 
         (includeSummerSuspension && isInSummerSuspension(currentDate))) {
    
    prudentialApplied = true;
    if (includeSummerSuspension && isInSummerSuspension(currentDate)) {
      const year = getYear(currentDate);
      currentDate = new Date(year, 6, 31);
      steps.push({
        date: format(currentDate, 'dd/MM/yyyy'),
        dayOfWeek: daysOfWeek[currentDate.getDay()],
        isCountedDay: false,
        remainingDays: 0,
        note: 'Criterio prudenziale: data in agosto → anticipo al 31 luglio'
      });
    } else {
      currentDate = subDays(currentDate, 1);
      const reason = isWeekend(currentDate) ? 'weekend' : 
                    isItalianHoliday(currentDate) ? 'festività' : 'non lavorativo';
      steps.push({
        date: format(currentDate, 'dd/MM/yyyy'),
        dayOfWeek: daysOfWeek[currentDate.getDay()],
        isCountedDay: false,
        remainingDays: 0,
        note: `Criterio prudenziale: anticipato di 1 giorno (era ${reason})`
      });
    }
  }
  
  if (prudentialApplied) {
    steps.push({
      date: format(currentDate, 'dd/MM/yyyy'),
      dayOfWeek: daysOfWeek[currentDate.getDay()],
      isCountedDay: true,
      remainingDays: 0,
      note: '✓ SCADENZA FINALE (dopo criterio prudenziale)'
    });
  } else {
    steps[steps.length - 1].note = '✓ SCADENZA FINALE (già giorno lavorativo)';
  }
  
  return steps;
}