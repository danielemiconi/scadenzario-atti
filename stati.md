# Stati del Sistema Scadenzario Atti

Lista degli stati attualmente definiti nel sistema:

1. FARE
2. NON FARE
3. FATTO
4. DEPOSITARE
5. NOTIFICARE
6. DEPOSITATO
7. NOTIFICATO

## Note
- Gli stati sono definiti in `src/types/index.ts` nell'oggetto `DeadlineStatus`
- Ogni stato ha anche una mappatura per la visualizzazione in `STATUS_DISPLAY_MAP`