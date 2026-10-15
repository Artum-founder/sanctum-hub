# Sanctum hub-oppstart

Onboarding for coacher og utøvere som skal få sin egen hub i Sanctum. De lager en **midlertidig profil** med navn, e-post og en PIN-kode på 6 sifre, svarer på spørsmålene i sitt eget tempo, og sender inn. Du henter ut svarene fra admin-siden og sletter profilen etterpå.

- Ingen kontoer og ingen passord. PIN-koden kan ikke gjenopprettes.
- Svarene lagres mens de skriver, og de kan logge inn igjen med e-post og PIN.
- Seks steg: Deg, Linje (tradisjoner, også egne), Tilbud, Hvor og når, Huben din (moduler, kurs og læring, klientverktøy, betaling) og Til slutt (kontakt og hjemmeside).
- Forhåndsvisning av huben som oppdateres mens de skriver.
- Admin på `/admin`: se alle profiler, last ned (JSON), kopier som tekst, slett.

## Database: Supabase «sol»

Svarene lagres i Supabase-prosjektet **sol**, i en egen avdeling (schema) som heter `sanctum_hub`. Den ligger ved siden av `tantric` (Sanctum-appen), `openground` og `selvskaper`, men er helt adskilt fra dem.

- Tabellene `sanctum_hub.hub_users` og `sanctum_hub.hub_sessions` er allerede laget. Appen lager dem også selv hvis de mangler.
- Row level security er på uten regler, og Supabase-rollene `anon` og `authenticated` har ingen tilgang. Svarene kan altså ikke leses gjennom Supabase sitt offentlige API, bare gjennom denne serveren.
- Svarene ser du i Supabase under Table Editor, schema `sanctum_hub`, eller på `/admin` i appen.

## Kjøre på Replit

Koden lages i GitHub, og Replit er basen nettsiden kjører fra.

1. **Databaseadressen til «sol»** (gjøres én gang, og kan brukes av alle SOL-apper):
   I Supabase: åpne prosjektet sol, trykk **Connect**, velg fanen **Direct** (Connection string), Type **URI** og Method **Session pooler**. Kopier adressen og bytt ut `[YOUR-PASSWORD]` med databasepassordet. Bruk Session pooler, ikke Direct connection, fordi den direkte adressen ikke virker fra Replit.
   Lagre den i Replit som en **Account secret** med navnet `SOL_DATABASE_URL`. Da kan hver SOL-app koble den til med et klikk, i stedet for at du limer den inn i hver app.
2. **Importer**: Create App, Import from GitHub, og velg `sanctum-hub`.
3. **Secrets i appen** (Tools, Secrets):
   - Koble til account-secreten `SOL_DATABASE_URL`. (Eller lim inn adressen som `DATABASE_URL` direkte i appen.)
   - `ADMIN_KEY`: en lang, tilfeldig nøkkel. Den bruker du for å logge inn på `/admin`.
   - Valgfritt: `CONTACT_NAME` og `CONTACT_EMAIL` (navnet og e-posten som vises i skjemaet, standard er Peder og peder@artum.no), og `DB_SCHEMA` (standard `sanctum_hub`).
4. **Run**. I konsollen skal det stå `lagring: postgres`. Åpne gjerne appen i en egen fane. Innlogging i Replits forhåndsvisning kan bli blokkert i noen nettlesere (Safari blokkerer informasjonskapsler i innebygde vinduer).
5. **Publish** (Autoscale) når du vil dele lenken.

Om sertifikatet: Supabase bruker sitt eget sertifikat. Når adressen er en Supabase-adresse, krypterer appen forbindelsen uten å sjekke sertifikatet. Vil du at det også skal sjekkes, last ned sertifikatet i Supabase under Database settings, SSL Configuration, og lim inn hele innholdet som `DATABASE_CA`. `DATABASE_SSL` (`require` eller `no-verify`) overstyrer dette.

Uten databaseadresse lagres svarene i en fil, og den kan forsvinne når appen publiseres eller starter på nytt. Admin-siden viser en advarsel så lenge det er sånn.

## Kjøre lokalt

```
npm install
ADMIN_KEY=en-lang-nokkel npm start
```

Åpne http://localhost:3000. Uten databaseadresse lagres alt i `data/sanctum-hub.json`.

## Personvern og sikkerhet

- PIN-koden lagres aldri i klartekst, bare som en scrypt-hash med eget salt.
- Etter 5 feil PIN-koder låses profilen i 15 minutter. Feil e-post og feil PIN gir samme melding.
- Innloggingen er en HttpOnly-informasjonskapsel. Alle endringer krever en egen header, så andre nettsider ikke kan sende inn på vegne av noen.
- Skriftene ligger på serveren, så siden henter ingenting fra Google eller andre tredjeparter.
- Den som fyller ut kan slette profilen sin selv. Admin kan slette den etter uthenting. Sletting fjerner også innloggingen.
- Samtykket lagres med tidspunkt (`consent_at`).

## Struktur

```
server.js           HTTP-server og API (bare innebygde Node-moduler, pluss pg)
src/store.js        Lagring: PostgreSQL med SOL_DATABASE_URL eller DATABASE_URL (schema sanctum_hub), ellers en JSON-fil
src/security.js     PIN-hashing, økter og begrensning av forsøk
public/index.html   Skjemaet
public/app.js       Skjemaets logikk og forhåndsvisningen
public/shared.js    Felles for nettleser og server: steg, oppsummering, PIN-sjekk
public/admin.html   Admin
public/admin.js
public/app.css      Sanctum-designet (farger, typografi og bevegelse)
```

## API

| Metode | Adresse | Hva |
| --- | --- | --- |
| POST | `/api/register` | Lag profil: `{ name, email, pin, consent }` |
| POST | `/api/login` | Logg inn: `{ email, pin }` |
| POST | `/api/logout` | Logg ut |
| GET | `/api/me` | Profilen og svarene |
| PUT | `/api/profile` | Lagre svar: `{ answers, step }` |
| PUT / DELETE | `/api/profile/photo` | Last opp eller fjern bilde (`{ dataUrl }`) |
| POST | `/api/profile/submit` | Send inn |
| DELETE | `/api/me` | Slett egen profil |
| POST | `/api/admin/login` | `{ key }` |
| GET | `/api/admin/profiles` | Alle profiler (uten bilde) |
| GET / DELETE | `/api/admin/profiles/:id` | Én profil, eller slett den |
| GET | `/api/admin/export` | Alt som én JSON-fil |

Alle forespørsler som endrer noe må ha headeren `X-Sanctum: 1`.
