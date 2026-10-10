# Stride — Focused task manager

**Stride** este o aplicație web de tip **listă de activități (To-Do List)** construită cu **Next.js (App Router) + TypeScript + Tailwind CSS v4**. Proiectul face parte din disciplina **SOPM** și urmărește, la nivel de echipă, și o aplicație mobilă echivalentă realizată cu **React Native**.

Aplicația permite gestionarea completă a activităților: adăugare, editare, ștergere (cu **Undo**), organizare pe priorități și categorii, subtask-uri, filtrare, căutare, sortare și statistici de progres. Datele sunt persistate local, în browser (`localStorage`), iar aplicația este **instalabilă (PWA)** și funcționează **offline**. Stride este construită cu accent pe **accesibilitate** (ARIA, navigare cu tastatura, gestionarea focusului) și respectă preferința **`prefers-reduced-motion`**.

> Documentația completă a proiectului este disponibilă în directorul [`docs/`](./docs/documentatie.md) (versiune Markdown) și [`docs/documentatie.docx`](./docs/documentatie.docx) (versiune Word).

---

## Cuprins

- [Funcționalități](#funcționalități)
- [Tehnologii](#tehnologii)
- [Cerințe preliminare](#cerințe-preliminare)
- [Instalare și rulare](#instalare-și-rulare)
- [Structura proiectului](#structura-proiectului)
- [Documentație](#documentație)

---

## Funcționalități

### Gestionarea activităților
- **Adăugare / editare / ștergere** de activități.
- Ștergerea se face cu mecanism de **Undo** (anulare), pentru a evita pierderea accidentală a datelor.
- **Adăugare rapidă în limbaj natural** (_quick-add_): utilizatorul poate scrie o singură linie precum `Pay rent tomorrow 5pm !high #home`, iar aplicația extrage automat titlul, data și ora limită, prioritatea (`!high`) și categoria (`#home`).
- Fiecare activitate are:
  - **titlu** (obligatoriu);
  - **descriere** (opțională);
  - **dată și oră limită** (due date/time);
  - **prioritate**: scăzută / medie / ridicată (low / medium / high);
  - **categorie / tag**;
  - **subtask-uri** (checklist).

### Stări (statusuri)
- **Overdue (Restant)** – termenul limită a trecut.
- **Upcoming (Urmează)** – termenul limită este în viitor sau nu există.
- **Completed (Complet)** – setat explicit de utilizator.
- **Canceled (Anulat)** – setat explicit de utilizator.
- Stările `Completed` și `Canceled` sunt alese de utilizator; în rest, starea este **derivată automat** din data limită (termen trecut → Overdue, termen viitor sau absent → Upcoming).

### Organizare și vizualizare
- **Tab-uri de filtrare**: All / Upcoming / Overdue / Completed / Canceled, fiecare cu **numărătoare (count)**.
- **Căutare** după text.
- **Sortare** după: dată limită, prioritate, dată creării.
- **Drag-and-drop** pentru reordonarea activităților.
- **Carduri de activitate** cu **tooltip** bogat la hover/focus, pentru detalii rapide.
- **Dashboard de statistici**: rata de finalizare și număr de activități pe stări.
- **Panou de insights**: tendința de finalizare pe ultimele **7 zile** și **streak-ul** curent (zile consecutive cu activități finalizate).

### Board cu secțiuni personalizabile (Kanban)
- **Coloane (secțiuni) personalizabile**, controlate de utilizator, peste stările implicite.
- **Adăugare** de secțiuni noi și **redenumire în linie** (_inline-rename_) a secțiunilor custom.
- **Ștergere** a secțiunilor custom; cardurile rămase **revin în coloana stării lor**.
- **Afișare / ascundere** a secțiunilor de status ale sistemului.
- **Reordonare** a secțiunilor prin **drag-and-drop**.
- **Mutarea cardurilor între coloane**:
  - aruncarea într-o **secțiune de status** setează statusul (Completed / Canceled / Overdue / Upcoming);
  - aruncarea într-o **secțiune custom** păstrează cardul în acea secțiune.
- Adăugarea de carduri **direct într-o secțiune**.
- Secțiunile sunt **persistate** (în `localStorage`) și incluse în **export / import JSON**.

### Experiență de utilizare (UX)
- Persistență în **`localStorage`** (datele rămân după reîncărcarea paginii).
- **Temă dark / light** comutabilă.
- **Scurtături de tastatură** (keyboard shortcuts).
- **Clear completed** – ștergerea în masă a activităților finalizate.
- **Backup și restaurare**: **export / import JSON** al datelor (inclusiv secțiunile de board) și opțiunea **Clear all**.
- **Tooltip bogat** pe carduri: titlu complet, descriere, status, prioritate, categorie și data limită; se afișează inteligent, cu **gestionarea focusului**.
- **Animații** și **toasts** (notificări) pentru feedback vizual; la finalizarea tuturor activităților se afișează o **animație de confetti**.
- **PWA / offline**: aplicația este **instalabilă** și funcționează **offline** prin **service worker**.
- **Accesibilitate (a11y)**: roluri **ARIA**, navigare completă de la **tastatură** și **gestionare a focusului**.
- Suport pentru **`prefers-reduced-motion`**: animațiile sunt reduse/dezactivate la cerere.
- Interfață **responsive, mobile-first**.

---

## Tehnologii

| Tehnologie | Rol |
| --- | --- |
| **Next.js 16** (App Router) | Framework React full-stack |
| **React 19** | Biblioteca de UI |
| **TypeScript 5** | Tipare statică |
| **Tailwind CSS v4** | Stilizare utilitară |
| **@dnd-kit** | Drag-and-drop / reordonare |
| **Framer Motion** | Animații |
| **lucide-react** | Iconițe |
| **date-fns** | Manipulare dată și oră |
| **next-themes** | Temă dark / light |
| **sonner** | Notificări (toasts) |
| **nanoid** | Generare de identificatori unici |
| **clsx** + **tailwind-merge** | Compunere de clase CSS |

---

## Cerințe preliminare

- **Node.js 18 sau mai nou** (versiunea LTS recomandată).
- **npm** (sau `pnpm` / `yarn` / `bun`) pentru gestionarea pachetelor.
- Un browser modern (Chrome, Edge, Firefox, Safari).

Verificare versiune Node:

```bash
node --version   # trebuie să fie >= 18
```

---

## Instalare și rulare

Instalarea dependențelor:

```bash
npm install
```

Rulare în modul development (cu hot-reload):

```bash
npm run dev
```

Aplicația este disponibilă la [http://localhost:3000](http://localhost:3000).

Build pentru producție:

```bash
npm run build
```

Pornirea serverului de producție (după build):

```bash
npm run start
```

Verificare linting:

```bash
npm run lint
```

---

## Structura proiectului

```text
todo-app/
├── docs/                       # Documentația proiectului
│   ├── documentatie.md         # Documentație (Markdown)
│   ├── documentatie.docx       # Documentație (Word)
│   └── generate-docx.mjs       # Script de generare a documentului Word
├── public/                     # Resurse statice
├── src/
│   └── app/                    # Next.js App Router
│       ├── layout.tsx          # Layout-ul rădăcină
│       ├── page.tsx            # Pagina principală
│       └── globals.css         # Stiluri globale (Tailwind)
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## Documentație

- [Documentație completă (Markdown)](./docs/documentatie.md)
- [Documentație completă (Word)](./docs/documentatie.docx)

Documentația acoperă: scopul proiectului, obiective măsurabile, cerințe ridicate, descrierea proiectului (inclusiv edge cases și căi de dezvoltare), riscurile proiectului și sumarul etapelor (milestones).
