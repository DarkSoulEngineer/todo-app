# Documentație — Stride (Proiect To-Do List, SOPM)

**Stride — _Focused task manager_**

**Disciplina:** SOPM
**Denumire produs:** Stride — aplicație de tip To-Do List (listă de activități)
**Tip:** Aplicație web (Next.js) + aplicație mobilă (React Native, obiectiv de echipă)
**Versiune document:** 1.1

---

## 1. Scopul proiectului

Scopul proiectului este realizarea **Stride**, o aplicație de tip **listă de activități (To-Do List)** care să ofere utilizatorului un instrument simplu, rapid și plăcut de utilizat pentru a-și organiza sarcinile zilnice.

Obiectivele de nivel înalt urmărite sunt:

- **Centralizarea** activităților personale într-un singur loc, ușor accesibil dintr-un browser.
- **Claritatea stării** fiecărei activități, prin statusuri explicite (Restant, Urmează, Complet, Anulat) și derivarea automată a stării din termenul limită.
- **Prioritizarea** muncii, prin suport pentru priorități, categorii și subtask-uri.
- **Persistența** datelor la nivel local, astfel încât utilizatorul să nu piardă informația la reîncărcarea paginii.
- **Disponibilitate oriunde**: aplicație **instalabilă (PWA)** care funcționează și **offline**.
- **Accesibilitate și respect pentru utilizator**: roluri ARIA, navigare de la tastatură, gestionarea focusului și suport pentru `prefers-reduced-motion`.
- **Consistența multi-platformă**: aceeași experiență și același model de date atât pe web (Next.js), cât și pe mobil (React Native).

Proiectul are și un rol didactic: aplicarea practică a conceptelor de **management de proiect** (planificare, cerințe, riscuri, milestones) și a tehnologiilor moderne din ecosistemul React.

---

## 2. Obiective măsurabile și relevante spre succes

Obiectivele sunt formulate astfel încât să poată fi **verificate cantitativ** (SMART).

| # | Obiectiv | Metrică / țintă | Relevanță |
| --- | --- | --- | --- |
| O1 | Operații CRUD complete pe activități | Adăugare, editare, ștergere funcționale în 100% din cazurile de test | Cerință minimă a temei |
| O2 | Suport pentru toate cele 4 statusuri | Restant, Urmează, Complet, Anulat implementate și afișate corect | Cerință minimă a temei |
| O3 | Ștergere sigură | 100% din ștergeri au opțiune de **Undo** | Previne pierderea accidentală a datelor |
| O4 | Rata de finalizare vizibilă | Dashboard afișează rata de finalizare a activităților | Oferă feedback de progres |
| O5 | Persistență | Datele se păstrează în `localStorage` la reîncărcarea paginii (0 pierderi) | Fiabilitate |
| O6 | Responsive | Interfață utilizabilă pe ecrane de la 320 px în sus | Cerință UX |
| O7 | Performanță percepută | Timp de interacțiune < 100 ms pentru operații locale; build de producție fără erori | Calitate |
| O8 | Calitatea codului | `npm run build` și `npm run lint` fără erori | Mentenanță |
| O9 | Acoperire funcțională extinsă | Minim 80% din funcționalitățile "Extra" din lista de cerințe | Depășirea minimului |

**Criterii de succes ale proiectului:**
- Toate cerințele minimale sunt îndeplinite și demonstrate.
- Cel puțin 80% dintre cerințele suplimentare (extras) sunt implementate.
- Aplicația rulează stabil local, fără erori blocante în consolă.
- Proiectul este însoțit de documentație completă și livrabilă.

---

## 3. Cerințe ridicate

Pe lângă **cerințele minimale** ale temei (adăugare/ștergere activități și marcarea stărilor Overdue / Upcoming / Completed / Canceled), echipa a ridicat nivelul proiectului prin următoarele cerințe suplimentare:

### 3.1 Cerințe funcționale suplimentare
- **R1. Editare completă** a activităților (nu doar adăugare/ștergere).
- **R2. Undo la ștergere** – anularea ștergerii printr-un toast cu acțiune.
- **R3. Metadate bogate**: descriere opțională, dată și oră limită, prioritate (low / medium / high), categorie/tag, subtask-uri (checklist).
- **R4. Filtrare** pe tab-uri: All / Upcoming / Overdue / Completed / Canceled, fiecare cu numărătoare.
- **R5. Căutare** full-text după titlu/descriere.
- **R6. Sortare** configurabilă după dată limită, prioritate și dată creării.
- **R7. Reordonare** a activităților prin **drag-and-drop**.
- **R8. Clear completed** – ștergerea în masă a activităților finalizate.
- **R9. Dashboard de statistici** – rată de finalizare și număr de activități pe stări.
- **R10. Scurtături de tastatură** pentru acțiuni frecvente.
- **R11. Persistență locală** (`localStorage`).
- **R12. Adăugare rapidă în limbaj natural** (_quick-add_): parsarea unei linii precum `Pay rent tomorrow 5pm !high #home` în titlu, dată/oră limită, prioritate și categorie.
- **R13. Panou de insights** – tendința de finalizare pe ultimele **7 zile** și **streak-ul** curent (zile consecutive cu activități finalizate).
- **R14. Backup și restaurare** – **export / import JSON** al datelor și opțiunea **Clear all** (ștergere totală).
- **R15. Confetti** – animație celebratorie când toate activitățile sunt finalizate.

### 3.2 Cerințe non-funcționale
- **R16. Temă dark / light** comutabilă, cu persistența preferinței.
- **R17. UX modern**: animații, toasts, feedback vizual imediat.
- **R18. Interfață responsive, mobile-first**.
- **R19. Cod tipizat** (TypeScript) și verificat prin ESLint.
- **R20. Structură scalabilă** (Next.js App Router), pregătită pentru extindere către o aplicație mobilă React Native.
- **R21. PWA / offline** – aplicație **instalabilă** pe dispozitiv, cu **service worker** pentru funcționare offline.
- **R22. Accesibilitate (a11y)** – roluri **ARIA**, navigare completă de la **tastatură**, **gestionare a focusului**.
- **R23. `prefers-reduced-motion`** – animațiile sunt reduse/dezactivate când utilizatorul își exprimă această preferință.

---

## 4. Descrierea proiectului

### 4.1 Descriere generală

**Stride** ("Focused task manager") este o aplicație web de gestiune a activităților, implementată cu **Next.js (App Router)** și **TypeScript**, stilizată cu **Tailwind CSS v4**. Aplicația rulează integral în browser și își păstrează datele local, în `localStorage`, fără a necesita un backend dedicat.

Aplicația este o **PWA instalabilă**, dotată cu **service worker**, astfel încât funcționează și **offline**. Utilizatorul își poate face **backup prin export JSON** și poate **restaura prin import**, poate folosi **adăugarea rapidă în limbaj natural**, consulta un **panou de insights** (tendință pe 7 zile + streak) și se bucură de o **animație de confetti** atunci când toate activitățile sunt finalizate.

Stride pune accent pe **accesibilitate** (roluri ARIA, navigare de la tastatură, gestionarea focusului) și respectă preferința **`prefers-reduced-motion`**.

Macheta temei prevede, la nivel de echipă, și o **aplicație mobilă React Native** care folosește același model de date și aceleași statusuri. Interfața web este gândită **mobile-first**, astfel încât tranziția către mobil să fie naturală.

### 4.2 Modelul de date

Fiecare activitate (task) este descrisă de:
- `id` – identificator unic (generat cu `nanoid`);
- `title` – titlul activității;
- `description` – descriere opțională;
- `dueDate` – dată și oră limită, opțională;
- `priority` – `low` | `medium` | `high`;
- `category` – categorie / tag;
- `subtasks` – listă de elemente (checklist);
- `status` – `completed` | `canceled` sau `null` (nesetat);
- starea afișată se determină astfel:
  - dacă utilizatorul a marcat **Complet** → *Completed*;
  - dacă utilizatorul a marcat **Anulat** → *Canceled*;
  - altfel, dacă `dueDate` este în trecut → *Overdue (Restant)*;
  - altfel (termen viitor sau lipsă) → *Upcoming (Urmează)*.

### 4.3 Fluxuri principale
1. **Creare**: utilizatorul completează formularul (titlu obligatoriu, restul opționale) și adaugă activitatea.
2. **Creare rapidă (quick-add)**: scrierea unei singure linii (ex. `Pay rent tomorrow 5pm !high #home`) și parsarea automată a câmpurilor.
3. **Editare**: modificarea oricărui câmp al unei activități existente.
4. **Ștergere cu Undo**: la ștergere se afișează un toast cu acțiune „Undo"; dacă utilizatorul apasă, activitatea este restaurată.
5. **Schimbare de status**: marcarea ca finalizată/anulată sau revenirea la starea derivată.
6. **Organizare**: filtrare pe tab-uri, căutare, sortare, reordonare drag-and-drop.
7. **Monitorizare**: dashboard cu statistici de progres și **panou de insights** (tendință pe 7 zile + streak).
8. **Backup și restaurare**: **export / import JSON** și opțiunea **Clear all**.

### 4.4 Edge cases

| # | Caz limită | Comportament așteptat |
| --- | --- | --- |
| E1 | Titlu gol sau doar spații | Activitatea nu poate fi salvată; se afișează validare. |
| E2 | Fără dată limită | Activitatea este considerată *Upcoming*. |
| E3 | Dată limită exact în momentul curent | Tratat ca *Overdue* (termen atins). |
| E4 | Fus orar / format de dată | Se folosește ora locală a browserului; formatare consecventă cu `date-fns`. |
| E5 | Ștergere accidentală | Undo disponibil imediat în toast. |
| E6 | Liste foarte lungi | Performanță menținută; sortare/filtrare client-side rapidă. |
| E7 | Reordonare + sortare activă | Reordonarea manuală se aplică atunci când sortarea este pe „manual/custom"; altfel sortarea are prioritate. |
| E8 | Date corupte / invalide în `localStorage` | Se face validare/fallback la o listă goală, fără a bloca aplicația. |
| E9 | Toate activitățile finalizate | „Clear completed" nu produce erori la listă goală. |
| E10 | Subtask-uri: marcarea tuturor | Opțional, activitatea părinte poate fi sugerată ca finalizată. |
| E11 | Căutare fără rezultate | Se afișează o stare goală (empty state) clară. |
| E12 | Temă comutată | Preferința se păstrează între sesiuni. |
| E13 | Conținut lung (titlu/descriere) | Text trunchiat/împachetat corect, fără a strica layout-ul. |
| E14 | Quick-add fără dată/oră/prioritate/categorie | Doar titlul este extras; restul rămâne nesetat, fără erori. |
| E15 | Import JSON invalid sau incompatibil | Se validează conținutul; se afișează eroare și datele existente nu se pierd. |
| E16 | Clear all | Se cere confirmare; acțiunea nu poate fi declanșată accidental. |
| E17 | Offline (fără rețea) | Aplicația rămâne utilizabilă prin service worker. |
| E18 | `prefers-reduced-motion` activat | Animațiile (inclusiv confetti) sunt reduse/dezactivate. |

### 4.5 Căi de dezvoltare (viitor)

- **Sincronizare în cloud** și cont de utilizator (backend, autentificare).
- **Aplicația mobilă React Native** completă, cu partajarea modelului de date.
- **Notificări / reminder-uri** pentru activitățile cu termen limită.
- **Recurență**: activități repetitive (zilnic, săptămânal, lunar).
- **Colaborare**: liste partajate, atribuire de sarcini, comentarii.
- **Integrare cu calendar** (Google Calendar, ICS export/import).
- **Statistici avansate**: grafice de evoluție extinse, rapoarte periodice.
- **Import / export extins** (CSV) și backup automat.
- **Widgets** pentru ecranul principal (mobil).

> *Deja implementate în versiunea curentă:* mod **offline / PWA instalabil** (service worker), backup prin **export/import JSON** și **Clear all**, **quick-add în limbaj natural**, **panou de insights** (7 zile + streak), **confetti**, **accesibilitate** (ARIA, tastatură, focus) și suport **`prefers-reduced-motion`**.

---

## 5. Riscul proiectului

| # | Riscul | Probabilitate | Impact | Măsuri de atenuare (mitigare) |
| --- | --- | --- | --- | --- |
| RI1 | Depășirea termenului de livrare | Medie | Ridicat | Planificare pe milestones, prioritate pe cerințele minimale întâi, scope redus controlat. |
| RI2 | Incompatibilități de versiuni (Next.js 16 / React 19 / Tailwind v4) | Medie | Mediu | Verificarea documentației oficiale înainte de cod; lock pe versiuni stabile; teste frecvente de build. |
| RI3 | Coliziuni în lucrul paralel pe cod (git) | Medie | Mediu | Separarea clară a responsabilităților pe fișiere/module, commit-uri mici și frecvente, code review. |
| RI4 | Pierderea datelor utilizatorului la ștergere | Scăzută | Ridicat | Implementarea obligatorie a **Undo**; feedback clar prin toast. |
| RI5 | Complexitate drag-and-drop + sortare | Medie | Scăzut | Folosirea unei biblioteci consacrate (@dnd-kit); reguli clare de prioritate între manual și sortare. |
| RI6 | Probleme de performanță pe liste mari | Scăzută | Mediu | Optimizare randare, evitarea recalculărilor inutile, sortare/filtrare eficientă. |
| RI7 | Membri indisponibili (echipă) | Medie | Mediu | Documentație clară și înlocuire ușoară; cunoaștere distribuită (pair programming). |
| RI8 | Regresii la modificări | Medie | Mediu | Lint + build înainte de commit; set de cazuri de test manuale pentru funcțiile critice. |
| RI9 | Design inconsistent între ecrane | Scăzută | Scăzut | Design tokens / componente reutilizabile, ghid de stil. |
| RI10 | Pierderea codului (fără backup) | Scăzută | Ridicat | Versionare în git + copii de siguranță ale livrabilelor. |

---

## 6. Sumar cu cele mai relevante versiuni (milestones)

| Etapă | Descriere | Rezultat / livrabil |
| --- | --- | --- |
| **M0 — Setup** | Inițializarea proiectului Next.js (App Router, TypeScript, Tailwind CSS v4), structură și tooling. | Proiect care pornește cu `npm run dev`; configurare lint/TS. |
| **M1 — CRUD de bază** | Adăugare, editare, ștergere (cu Undo) și listare a activităților. | Fluxurile esențiale funcționale. |
| **M2 — Statusuri** | Implementarea statusurilor Restant / Urmează / Complet / Anulat și derivarea automată din termenul limită. | Cerințele minimale ale temei îndeplinite. |
| **M3 — Organizare** | Filtrare pe tab-uri cu numărătoare, căutare, sortare. | Navigare și regăsire facilă a activităților. |
| **M4 — Metadate bogate** | Priorități, categorii, descriere, subtask-uri. | Model de date complet. |
| **M5 — UX și persistență** | Temă dark/light, `localStorage`, animații, toasts, scurtături de tastatură, clear-completed, responsive, **confetti**, suport **`prefers-reduced-motion`**. | Experiență modernă și fiabilă. |
| **M6 — Dashboard, insights și drag-and-drop** | Statistici (rată de finalizare, numărătoare), reordonare și **panou de insights** (tendință 7 zile + streak). | Vizibilitate asupra progresului. |
| **M7 — Putere și accesibilitate** | **Quick-add în limbaj natural**, **export/import JSON** + **Clear all**, **PWA/offline** (service worker, instalabil) și **accesibilitate** (ARIA, tastatură, focus). | Funcționalități avansate și incluzive. |
| **M8 — Stabilizare** | Testare, rezolvarea edge cases, build de producție fără erori. | Versiune candidată la livrare. |
| **M9 — Documentație și livrare** | Documentație completă (Markdown + Word), README, pregătire pentru prezentare. | Livrabile finale. |

Fiecare etapă se încheie cu o verificare (`npm run build` / `npm run lint`) și, unde este cazul, cu un commit/versiune marcată.

---

## 7. Document Word — descriere minimală

Această secțiune corespunde versiunii Word a documentației (`docs/documentatie.docx`) și acoperă elementele minimale cerute.

### 7.1 Resurse folosite

**Resurse umane:** membrii echipei de proiect (dezvoltare web, dezvoltare mobilă, testare, documentare).

**Resurse tehnice (software):**
- Node.js 18+, npm;
- Next.js 16 (App Router), React 19, TypeScript;
- Tailwind CSS v4;
- @dnd-kit, Framer Motion, lucide-react, date-fns, next-themes, sonner, nanoid, clsx, tailwind-merge;
- **PWA / service worker** pentru funcționare offline și instalare;
- pachetul `docx` (Node) pentru generarea documentului Word;
- Git pentru versionare; editor de cod (VS Code);
- React Native (pentru componenta mobilă, obiectiv de echipă).

**Resurse materiale:** stații de lucru / laptopuri, acces la internet, mediu de dezvoltare local.

**Resurse de informare:** documentația oficială Next.js, React, Tailwind CSS, bibliotecile utilizate și materialele de curs.

### 7.2 Validarea proiectului și acceptarea acestuia

**Validare (cum se verifică):**
- Verificarea funcțională a tuturor cerințelor minimale (CRUD + cele 4 statusuri).
- Verificarea cerințelor suplimentare (filtrare, căutare, sortare, drag-and-drop, statistici, Undo, temă, responsive).
- Verificarea funcționalităților avansate: **quick-add în limbaj natural**, **panou de insights** (7 zile + streak), **export/import JSON** + **Clear all**, **PWA/offline** și **confetti**.
- Verificarea **accesibilității** (roluri ARIA, navigare de la tastatură, gestionarea focusului) și a suportului **`prefers-reduced-motion`**.
- Rulearea `npm run build` și `npm run lint` fără erori.
- Testare manuală a cazurilor limită (vezi secțiunea 4.4).
- Verificarea persistenței datelor după reîncărcarea paginii.

**Criterii de acceptare:**
- Toate cerințele minimale sunt îndeplinite și demonstrative.
- Aplicația pornește și rulează stabil, fără erori blocante.
- Documentația (Markdown + Word) este completă și coerentă cu implementarea.
- Proiectul este livrat în forma cerută (cod + documentație).

**Acceptator:** titularul disciplinei / cadrul didactic, pe baza demonstrației și a documentației.

### 7.3 Manager de proiect, responsabilitate și autoritate

- **Manager de proiect:** `[Nume membru echipa]`
- **Responsabilitate:** planificarea etapelor, repartizarea sarcinilor între membrii echipei, monitorizarea progresului, gestionarea riscurilor și asigurarea livrării la termen și la calitatea cerută.
- **Autoritate:** decizii privind prioritizarea funcționalităților, acceptarea livrabilelor intermediare, coordonarea echipei și comunicarea cu beneficiarul/cadrul didactic.

> *Placeholder:* numele reale ale membrilor echipei se completează la livrare.

### 7.4 Sponsori

- **Sponsor:** `[Nume sponsor / instituție]`
- **Rol:** asigurarea resurselor necesare desfășurării proiectului și validarea la nivel de obiective.

> *Placeholder:* în context academic, sponsorul/beneficiarul este reprezentat de instituția de învățământ și de cadrul didactic coordonator. Numele concrete se completează la livrare.

---

*Document realizat în cadrul disciplinei SOPM. Versiunea Word (`documentatie.docx`) este generată din acest conținut.*
