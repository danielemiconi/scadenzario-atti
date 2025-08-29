# 📋 Scadenzario Atti Processuali - Setup Guide

## 🚀 Quick Start

### Prerequisiti
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Account Firebase con progetto creato

### 1. Configurazione Firebase Console

1. Vai su [Firebase Console](https://console.firebase.google.com)
2. Crea un nuovo progetto o seleziona esistente
3. Abilita i seguenti servizi:
   - **Authentication**: Email/Password + (opzionale) Google
   - **Firestore Database**: Modalità production
   - **Functions**: Regione europe-west1
   - **Hosting**

### 2. Configurazione Locale

```bash
# 1. Clona e installa dipendenze
npm install
cd functions && npm install && cd ..

# 2. Login Firebase
firebase login

# 3. Inizializza progetto
firebase use --add
# Seleziona il tuo progetto Firebase

# 4. Crea file .env con le tue credenziali
cp .env.example .env
# Modifica .env con i valori dal tuo progetto Firebase
```

### 3. Deploy Firestore Rules & Indexes

```bash
# Deploy regole sicurezza
firebase deploy --only firestore:rules

# Deploy indici
firebase deploy --only firestore:indexes
```

### 4. Deploy Functions

```bash
# Build e deploy functions
cd functions
npm run build
firebase deploy --only functions
```

### 5. Configurazione Email (per notifiche)

Nel Firebase Console:
```bash
firebase functions:config:set \
  email.user="tuaemail@gmail.com" \
  email.password="app-specific-password" \
  email.from="noreply@tuodominio.com"
```

### 6. Creazione Primo Admin

1. Avvia l'app in development:
```bash
npm run dev
```

2. Registra un nuovo utente normale
3. Nella Firebase Console, vai su Firestore > users
4. Modifica il documento utente: `role: "admin"`
5. Usa Firebase CLI per impostare custom claims:
```bash
firebase functions:shell
> setUserRole({uid: "USER_ID_HERE", role: "admin"})
```

## 📦 Deploy Produzione

```bash
# Build app
npm run build

# Deploy hosting + functions
firebase deploy
```

## 🔧 Sviluppo Locale con Emulatori

```bash
# Avvia emulatori Firebase
firebase emulators:start

# In altro terminale, avvia app React
npm run dev
```

Decommenta le righe in `src/lib/firebase/config.ts` per usare emulatori locali.

## 📊 Import Dati Iniziali

Formato CSV richiesto:
```csv
iniziali;pratica;ufficio;rg;tipo_atto;data_udienza;stato;data_stato;note
MS;IBLEGAL-IBL;GDP REGGIO EMILIA;506/2025;COMPARSA COSTITUZIONE;19/06/2025;DEPOSITATO;06/06/2025;NOTE 127 TER
```

Usa la funzione import nell'interfaccia Admin.

## 🔐 Sicurezza

### Checklist Pre-Produzione
- [ ] Cambia tutte le password default
- [ ] Configura backup automatici Firestore
- [ ] Abilita 2FA su account Firebase
- [ ] Configura domini autorizzati in Authentication
- [ ] Verifica regole Firestore in production
- [ ] Configura monitoring e alerting

## 🐛 Troubleshooting

### Errore: "Permission denied"
- Verifica ruolo utente in Firestore
- Controlla custom claims con `firebase auth:export`
- Utente deve rifare login dopo cambio ruolo

### Functions non si deployano
- Verifica Node.js version (deve essere 18)
- Controlla `firebase functions:log` per errori
- Assicurati billing sia abilitato per il progetto

### Email non inviate
- Verifica configurazione email in functions config
- Per Gmail, usa App-Specific Password
- Controlla quota invii giornalieri

## 📝 Comandi Utili

```bash
# Logs delle Functions
firebase functions:log

# Export utenti
firebase auth:export users.json

# Backup Firestore
gcloud firestore export gs://[BUCKET_NAME]

# Test locale con emulatori
firebase emulators:start --import=./emulator-data

# Check deploy status
firebase hosting:channel:list
```

## 🆘 Supporto

Per problemi o domande:
1. Controlla i log: `firebase functions:log`
2. Verifica la console Firebase per errori
3. Consulta la documentazione Firebase

## 📚 Risorse

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions Best Practices](https://firebase.google.com/docs/functions/tips)