Ruolo

Agisci come Senior Full-Stack Engineer specializzato in React + Firebase per studi legali. Lavora con ultrathinking. Pensa in modo esplicito prima di ogni consegna. Avvia il lavoro subito dopo questo prompt.

Obiettivo

Realizzare una webapp per il monitoraggio degli atti processuali in scadenza che mantiene la struttura e il layout del PDF fornito: intestazione “ATTI CON SCADENZA ROMA”, Legenda iniziali→nominativi, sezioni per mese (es. “GIUGNO 2025”), righe tabellari con: iniziali, pratica, ufficio, RG, tipo atto, udienza/UD., stato (“DEPOSITATO”, “FATTO”, “RINVIATA”, “NOTIFICATO”, “NOTE 127 TER”…), data dello stato, eventuali note. 
 

Vincoli chiave

Niente backend custom: usa Firebase Auth, Firestore, Cloud Functions, Hosting.

RBAC: ruoli Admin e Standard.

Admin: crea, modifica, elimina qualsiasi atto; gestisce legenda; archivia.

Standard: crea e modifica atti propri o assegnati alle proprie iniziali; non elimina.

Timezone: Europe/Rome. Formato date UI: dd.MM.yy o dd/MM/yyyy coerente col PDF.

Accessibilità: tastiera, ARIA minima, contrasto tabella, stampa pulita.

Privacy/GDPR: dati giudiziari. Logica di minimizzazione, audit log, export on demand, soft-delete.

Architettura

Front-end: React + Vite. State: React Query o equivalente. Routing minimale.

Auth: Email+password e opzionale Google/Microsoft. Ruolo in custom claims.

DB: Firestore in modalità production.

Funzioni:

set/update custom claims admin.

notifiche scadenze.

deduplica atti su chiave composta.

generazione .ics per singolo atto e per mese.

Hosting: Firebase Hosting.

Modello dati (definisci esattamente prima di codificare)

users/{uid}: { name, email, initials, role: "admin"|"standard", createdAt, updatedAt }.

legend/{id}: mappatura iniziali→nominativo come nel PDF. Solo Admin scrive. 

deadlines/{id}:

{
  monthYear: "2025-06",
  ownerInitials: "MS",
  matter: "IBLEGAL-IBL / …",        // pratica
  court: "GDP REGGIO EMILIA",       // ufficio
  rg: "506/2025",
  actType: "COMPARSA DI COSTITUZIONE",
  hearingDate: "2025-06-19",        // UD./Udienza
  status: "DEPOSITATO" | "FATTO" | "RINVIATA" | "NOTIFICATO" | "NOTE 127 TER" | "NOTE TRATT. SCRITTA" | "REPLICHE" | "COMPARSA APPELLO" | …,
  statusDate: "2025-06-06",
  notes: "NOTE 127 TER / altre note",
  createdBy: uid,
  archived: false,
  createdAt, updatedAt
}


I valori di esempio devono riflettere le varianti viste nel PDF (es. “NOTE TRATT. SCRITTA”, “MEMORIA 171 TER”, “UD. EDITTALE”, “NOTE DI PC”). 
 
 

Sicurezza e permessi

Firestore rules:

read: autenticati.

create: autenticati.

update: Admin oppure proprietario/assegnatario (match su createdBy o ownerInitials == users/{uid}.initials).

delete: solo Admin.

legend: write solo Admin.

users: ogni utente scrive/legge solo il proprio doc; Admin può leggere tutti.

Deduplica: blocca doppioni su (court, rg, actType, hearingDate).

UX/UI richiesta

Schermata Legenda: tabella iniziali→nominativo come nel PDF. Ricerca e filtro. 

Vista per mese: sezioni “GIUGNO 2025”, “LUGLIO 2025” ecc., con tabella che replica l’ordine e la semantica del PDF. Filtri per mese/anno, iniziali, ufficio, stato; ricerca per RG e testo libero. Evidenzia stato con badge. Pulsante Elimina visibile solo agli Admin. 

Form Atto: tutti i campi sopra. Validazioni in linea. Per Standard, ownerInitials precompilato e bloccato. Campo “hearingDate” con selettore rapido mese.

Dettaglio Atto: timeline micro delle variazioni di stato e note.

Export/Print: esporta CSV del mese e stampa pagina con layout fedele al PDF.

.ics: scaricabile da riga e da pagina mese.

Logica di dominio

Status normalizzati dalle diciture presenti nel PDF (esempi nei file). Preserva fedeltà lessicale e maiuscole. 

Calcolo monthYear lato funzione al create/update, da hearingDate.

Reminder: notifica N giorni prima dell’udienza e il giorno stesso, fascia oraria 09:00 Europe/Rome; canali email e opzionale Telegram.

Archiviazione: toggle archived; esclusione dai default list; filtro dedicato.

Controlli: hearingDate futuro o “storico” marcato; pattern RG ^\d{1,6}/\d{4}$.

Import iniziale

CSV importer per bulk load.

Parser testuale per colonne come nel PDF, con pulizia campi comuni (iniziali, RG, “Ud.”, “Udienza”, “R.G.”). Fornisci mapping configurabile e report degli errori. 

Audit e osservabilità

auditLogs/{id} con {action, docId, before, after, by, at}.

PII redaction nei log esportati.

Metriche minime: atti per mese, per stato, per iniziali.

Prestazioni e DX

Indicizza Firestore su: monthYear, ownerInitials, status, court, rg, combinazioni per filtri.

Paginazione a cursori.

Stato UI conservato in querystring.

Loading skeletons e ottimistiche.

Qualità e collaudo

Deliverable senza codice di terze parti non necessario.

Test plan: unit per trasformazioni stato/date; integrazione per RBAC; smoke test su filtri.

Check di stampa: la stampa del mese deve risultare leggibile come il PDF.

Accessibility check: tabella navigabile da tastiera.

Output attesi da te

Piano di lavoro a fasi con milestone e rischi.

Albero progetto con file previsti e ragione d’essere.

Schema dati definitivo e tabella stati normalizzati con mapping dalle varianti testuali viste nel PDF. Cita esempi reali del PDF per coprire casi come “NOTE SCRITTE D'UDIENZA 127 TER”, “MEMORIA 171 TER n. 1”, “NOTE DI P.C.”, “COMPARSA COSTITUZIONE”, "COMPARSA CONCLUSIONALE", "ATTO DI APPELLO", "RICORSO PER CASSAZIONE", "RECLAMO", "REPLICHE", MEMORIE EX ART. 218-DUODECIES N. 1 C.P.C.". 
 
Specifica UX: wireframe descrittivi di: Legenda, Vista mese, Form atto, Dettaglio, Stampa.

Regole Firestore complete e bozza di Cloud Functions necessarie descritte in prosa.

Specifica notifiche con template email e parametri .ics descritti in prosa.

Strategia import CSV con schema, mapping, e validazioni.

Definition of Done con criteri verificabili.

Criteri di accettazione

Layout e struttura coerenti con il PDF per intestazione, legenda, sezioni mese, colonne e diciture di stato. 

RBAC rispettato: solo Admin può eliminare.

Filtri e ricerca funzionano su mese, iniziali, ufficio, stato e RG.

Reminder inviati con timezone corretta.

Export CSV e .ics attivi.

Stampa fedele e leggibile.

Nessun dato sensibile in console log o in URL oltre il necessario.

Inizia ora producendo: (a) piano a fasi, (b) schema dati e mapping stati, (c) wireframe descrittivi, (d) specifiche di sicurezza e notifiche.