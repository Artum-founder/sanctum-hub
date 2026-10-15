# Sanctum hub-oppstart

Onboarding for coacher og utøvere som skal få sin egen hub i Sanctum. De lager en **midlertidig profil** med navn, e-post og en PIN-kode på 6 sifre, svarer på spørsmålene i sitt eget tempo, og sender inn. Du henter ut svarene fra admin-siden og sletter profilen etterpå.

- Ingen kontoer og ingen passord. PIN-koden kan ikke gjenopprettes.
- Svarene lagres mens de skriver, og de kan logge inn igjen med e-post og PIN.
- Seks steg: Deg, Linje (tradisjoner, også egne), Tilbud, Hvor og når, Huben din (moduler, kurs og læring, klientverktøy, betaling) og Til slutt (kontakt og hjemmeside).
- Forhåndsvisning av huben som oppdateres mens de skriver.
- Admin på `/admin`: se alle profiler, last ned (JSON), kopier som tekst, slett.

## Database: Supabase «sol», som Sanctum

Huben kobler seg til Supabase på samme måte som Sanctum-appen: med Supabase-adressen og service role-nøkkelen, gjennom Supabase sitt API. Svarene ligger i schemaet `tantric` i prosjektet **sol**, ved siden av Sanctums egne tabeller:

- `tantric.hub_onboarding_profiles`: én midlertidig profil per coach med svarene.
- `tantric.hub_onboarding_sessions`: innloggingene.

Tabellene er allerede laget (SQL-en ligger i `supabase/schema.sql`). Row level security er på uten regler, og `anon` og `authenticated` har ingen tilgang. Bare serveren, med service role-nøkkelen, når svarene. Nøkkelen sendes aldri til nettleseren.

Svarene ser du på `/admin` i appen, eller i Supabase under Table Editor, schema `tantric`.

## Kjøre på Replit

Koden lages i GitHub, og Replit er basen nettsiden kjører fra.

1. **Importer**: Create App, Import from GitHub, og velg `sanctum-hub`.
2. **Secrets** (Tools, Secrets), de samme som i Sanctum-appen (`tantric-community-hub`) på Replit:
   - `NEXT_PUBLIC_SUPABASE_URL` (eller `SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_KEY`: en lang, tilfeldig nøkkel. Den bruker du for å logge inn på `/admin`.
   - Valgfritt: `CONTACT_NAME` og `CONTACT_EMAIL` (navnet og e-posten som vises i skjemaet, standard er Peder og peder@artum.no).
3. **Run**. I konsollen skal det stå `lagring: supabase`. Er noe feil, står det en forklaring rett under, og den vises også øverst på `/admin`.
   Åpne gjerne appen i en egen fane. Innlogging i Replits forhåndsvisning kan bli blokkert i noen nettlesere (Safari blokkerer informasjonskapsler i innebygde vinduer).
4. **Publish** (Autoscale) når du vil dele lenken.

Uten Supabase-secretene lagres svarene i en fil, og den kan forsvinne når appen publiseres eller starter på nytt. Admin-siden viser en advarsel så lenge det er sånn.

## Kjøre lokalt

```
npm install
ADMIN_KEY=en-lang-nokkel npm start
```

Åpne http://localhost:3000. Uten Supabase-secretene lagres alt i `data/sanctum-hub.json`.

## Personvern og sikkerhet

- PIN-koden lagres aldri i klartekst, bare som en scrypt-hash med eget salt.
- Etter 5 feil PIN-koder låses profilen i 15 minutter. Feil e-post og feil PIN gir samme melding.
- Innloggingen er en HttpOnly-informasjonskapsel. Alle endringer krever en egen header, så andre nettsider ikke kan sende inn på vegne av noen.
- Skriftene ligger på serveren, så siden henter ingenting fra Google eller andre tredjeparter.
- Den som fyller ut kan slette profilen sin selv. Admin kan slette den etter uthenting. Sletting fjerner også innloggingen.
- Samtykket lagres med tidspunkt (`consent_at`).

## Struktur

```
server.js           HTTP-server og API (bare innebygde Node-moduler)
src/store.js        Lagring: Supabase «sol» (schema tantric) via API-et, ellers en JSON-fil
supabase/schema.sql Tabellene i Supabase
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
