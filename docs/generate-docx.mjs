// Script de generare a documentatiei Word (docs/documentatie.docx)
// Rulare: node docs/generate-docx.mjs
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- helpers ----------

const heading = (text, level = HeadingLevel.HEADING_1) =>
  new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });

const para = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, ...(opts.run ?? {}) })],
  });

// paragraf cu text și rânduri multiple
const paras = (text) =>
  text.split("\n").map(
    (line) =>
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun(line)],
      })
  );

const bullet = (text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun(text)],
  });

// tabel dintr-un header + rânduri (matrice de string-uri)
const table = (headerRow, rows) => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const headerCells = headerRow.map(
    (text) =>
      new TableCell({
        borders,
        shading: { fill: "E8EEF7" },
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true })],
          }),
        ],
      })
  );

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (text) =>
            new TableCell({
              borders,
              children: [new Paragraph({ children: [new TextRun(text)] })],
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
  });
};

const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------- conținut ----------

const children = [];

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Documentație — Stride (Proiect To-Do List, SOPM)", bold: true, size: 40 }),
    ],
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Stride — Focused task manager", italics: true, size: 24 }),
    ],
  })
);
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({
        text: "Disciplina: SOPM  |  Aplicație web (Next.js) + aplicație mobilă (React Native)  |  Versiune document: 1.1",
        italics: true,
      }),
    ],
  })
);

// 1
children.push(heading("1. Scopul proiectului"));
children.push(...paras(
  "Scopul proiectului este realizarea Stride, o aplicație de tip listă de activități (To-Do List) care să ofere utilizatorului un instrument simplu, rapid și plăcut de utilizat pentru a-și organiza sarcinile zilnice."
));
children.push(para("Obiectivele de nivel înalt urmărite sunt:", { run: { bold: true } }));
[
  "Centralizarea activităților personale într-un singur loc, ușor accesibil dintr-un browser.",
  "Claritatea stării fiecărei activități, prin statusuri explicite (Restant, Urmează, Complet, Anulat).",
  "Prioritizarea muncii, prin suport pentru priorități, categorii și subtask-uri.",
  "Persistența datelor la nivel local, la reîncărcarea paginii.",
  "Disponibilitate oriunde: aplicație instalabilă (PWA) care funcționează și offline.",
  "Accesibilitate și respect pentru utilizator: roluri ARIA, navigare de la tastatură, gestionarea focusului și suport pentru prefers-reduced-motion.",
  "Consistența multi-platformă: aceeași experiență și același model de date atât pe web (Next.js), cât și pe mobil (React Native).",
].forEach((t) => children.push(bullet(t)));
children.push(...paras(
  "Proiectul are și un rol didactic: aplicarea practică a conceptelor de management de proiect (planificare, cerințe, riscuri, milestones) și a tehnologiilor moderne din ecosistemul React."
));
children.push(spacer());

// 2
children.push(heading("2. Obiective măsurabile și relevante spre succes"));
children.push(...paras(
  "Obiectivele sunt formulate astfel încât să poată fi verificate cantitativ (SMART)."
));
children.push(
  table(
    ["#", "Obiectiv", "Metrică / țintă", "Relevanță"],
    [
      ["O1", "Operații CRUD complete", "Adăugare, editare, ștergere în 100% din cazuri", "Cerință minimă"],
      ["O2", "Toate cele 4 statusuri", "Restant, Urmează, Complet, Anulat", "Cerință minimă"],
      ["O3", "Ștergere sigură", "100% din ștergeri au Undo", "Previne pierderea datelor"],
      ["O4", "Rată de finalizare vizibilă", "Dashboard afișează progresul", "Feedback de progres"],
      ["O5", "Persistență", "0 pierderi la reîncărcare (localStorage)", "Fiabilitate"],
      ["O6", "Responsive", "Utilizabil de la 320 px în sus", "Cerință UX"],
      ["O7", "Performanță", "Interacțiune < 100 ms; build fără erori", "Calitate"],
      ["O8", "Calitatea codului", "npm run build și lint fără erori", "Mentenanță"],
      ["O9", "Acoperire extinsă", "Minim 80% din funcțiile Extra", "Depășirea minimului"],
    ]
  )
);
children.push(spacer());
children.push(para("Criterii de succes ale proiectului:", { run: { bold: true } }));
[
  "Toate cerințele minimale sunt îndeplinite și demonstrate.",
  "Cel puțin 80% dintre cerințele suplimentare sunt implementate.",
  "Aplicația rulează stabil local, fără erori blocante în consolă.",
  "Proiectul este însoțit de documentație completă și livrabilă.",
].forEach((t) => children.push(bullet(t)));
children.push(spacer());

// 3
children.push(heading("3. Cerințe ridicate"));
children.push(...paras(
  "Pe lângă cerințele minimale ale temei (adăugare/ștergere activități și marcarea stărilor Overdue / Upcoming / Completed / Canceled), echipa a ridicat nivelul proiectului prin cerințe suplimentare."
));
children.push(heading("3.1 Cerințe funcționale suplimentare", HeadingLevel.HEADING_2));
[
  "R1. Editare completă a activităților (nu doar adăugare/ștergere).",
  "R2. Undo la ștergere – anularea ștergerii printr-un toast cu acțiune.",
  "R3. Metadate bogate: descriere, dată și oră limită, prioritate (low/medium/high), categorie/tag, subtask-uri.",
  "R4. Filtrare pe tab-uri: All / Upcoming / Overdue / Completed / Canceled, cu numărătoare.",
  "R5. Căutare full-text după titlu/descriere.",
  "R6. Sortare după dată limită, prioritate și dată creării.",
  "R7. Reordonare prin drag-and-drop.",
  "R8. Clear completed – ștergerea în masă a activităților finalizate.",
  "R9. Dashboard de statistici – rată de finalizare și numărătoare pe stări.",
  "R10. Scurtături de tastatură pentru acțiuni frecvente.",
  "R11. Persistență locală (localStorage).",
  "R12. Adăugare rapidă în limbaj natural (quick-add): parsarea unei linii precum „Pay rent tomorrow 5pm !high #home” în titlu, dată/oră, prioritate și categorie.",
  "R13. Panou de insights – tendința de finalizare pe ultimele 7 zile și streak-ul curent.",
  "R14. Backup și restaurare – export / import JSON și opțiunea Clear all.",
  "R15. Confetti – animație celebratorie când toate activitățile sunt finalizate.",
].forEach((t) => children.push(bullet(t)));
children.push(heading("3.2 Cerințe non-funcționale", HeadingLevel.HEADING_2));
[
  "R16. Temă dark / light comutabilă, cu persistența preferinței.",
  "R17. UX modern: animații, toasts, feedback vizual imediat.",
  "R18. Interfață responsive, mobile-first.",
  "R19. Cod tipizat (TypeScript) și verificat prin ESLint.",
  "R20. Structură scalabilă (Next.js App Router), pregătită pentru extindere spre React Native.",
  "R21. PWA / offline – aplicație instalabilă, cu service worker pentru funcționare offline.",
  "R22. Accesibilitate (a11y) – roluri ARIA, navigare completă de la tastatură, gestionarea focusului.",
  "R23. prefers-reduced-motion – animațiile sunt reduse/dezactivate când utilizatorul își exprimă această preferință.",
].forEach((t) => children.push(bullet(t)));
children.push(spacer());

// 4
children.push(heading("4. Descrierea proiectului"));
children.push(heading("4.1 Descriere generală", HeadingLevel.HEADING_2));
children.push(...paras(
  "Stride (“Focused task manager”) este o aplicație web de gestiune a activităților, implementată cu Next.js (App Router) și TypeScript, stilizată cu Tailwind CSS v4. Aplicația rulează integral în browser și își păstrează datele local, în localStorage, fără a necesita un backend dedicat."
));
children.push(...paras(
  "Aplicația este o PWA instalabilă, dotată cu service worker, astfel încât funcționează și offline. Utilizatorul își poate face backup prin export JSON și poate restaura prin import, poate folosi adăugarea rapidă în limbaj natural, consulta un panou de insights (tendință pe 7 zile + streak) și se bucură de o animație de confetti atunci când toate activitățile sunt finalizate."
));
children.push(...paras(
  "Stride pune accent pe accesibilitate (roluri ARIA, navigare de la tastatură, gestionarea focusului) și respectă preferința prefers-reduced-motion."
));
children.push(...paras(
  "Macheta temei prevede, la nivel de echipă, și o aplicație mobilă React Native care folosește același model de date și aceleași statusuri. Interfața web este gândită mobile-first, astfel încât tranziția către mobil să fie naturală."
));
children.push(heading("4.2 Modelul de date", HeadingLevel.HEADING_2));
[
  "id – identificator unic (generat cu nanoid);",
  "title – titlul activității;",
  "description – descriere opțională;",
  "dueDate – dată și oră limită, opțională;",
  "priority – low | medium | high;",
  "category – categorie / tag;",
  "subtasks – listă de elemente (checklist);",
  "status – completed | canceled sau null (nesetat).",
].forEach((t) => children.push(bullet(t)));
children.push(para("Determinarea stării afișate:", { run: { bold: true } }));
[
  "dacă utilizatorul a marcat Complet → Completed;",
  "dacă utilizatorul a marcat Anulat → Canceled;",
  "altfel, dacă dueDate este în trecut → Overdue (Restant);",
  "altfel (termen viitor sau lipsă) → Upcoming (Urmează).",
].forEach((t) => children.push(bullet(t)));
children.push(heading("4.3 Fluxuri principale", HeadingLevel.HEADING_2));
[
  "Creare: completarea formularului (titlu obligatoriu) și adăugarea activității.",
  "Creare rapidă (quick-add): scrierea unei singure linii (ex. „Pay rent tomorrow 5pm !high #home”) și parsarea automată a câmpurilor.",
  "Editare: modificarea oricărui câmp al unei activități existente.",
  "Ștergere cu Undo: la ștergere se afișează un toast cu acțiune „Undo”.",
  "Schimbare de status: marcarea ca finalizată/anulată sau revenirea la starea derivată.",
  "Organizare: filtrare, căutare, sortare, reordonare drag-and-drop.",
  "Monitorizare: dashboard cu statistici de progres și panou de insights (tendință 7 zile + streak).",
  "Backup și restaurare: export / import JSON și opțiunea Clear all.",
].forEach((t) => children.push(bullet(t)));
children.push(heading("4.4 Edge cases", HeadingLevel.HEADING_2));
children.push(
  table(
    ["#", "Caz limită", "Comportament așteptat"],
    [
      ["E1", "Titlu gol / doar spații", "Nu se salvează; se afișează validare."],
      ["E2", "Fără dată limită", "Considerată Upcoming."],
      ["E3", "Dată limită exact acum", "Tratată ca Overdue."],
      ["E4", "Fus orar / format de dată", "Se folosește ora locală; formatare cu date-fns."],
      ["E5", "Ștergere accidentală", "Undo disponibil imediat în toast."],
      ["E6", "Liste foarte lungi", "Sortare/filtrare client-side rapidă."],
      ["E7", "Reordonare + sortare activă", "Sortarea are prioritate; manual doar când e selectat."],
      ["E8", "Date invalide în localStorage", "Validare/fallback la listă goală."],
      ["E9", "Toate activitățile finalizate", "Clear completed fără erori pe listă goală."],
      ["E10", "Toate subtask-urile marcate", "Sugerare finalizare activitate părinte."],
      ["E11", "Căutare fără rezultate", "Stare goală (empty state) clară."],
      ["E12", "Temă comutată", "Preferința se păstrează între sesiuni."],
      ["E13", "Conținut lung", "Text împachetat corect, fără a strica layout-ul."],
      ["E14", "Quick-add fără dată/prioritate/categorie", "Doar titlul este extras; restul rămâne nesetat, fără erori."],
      ["E15", "Import JSON invalid", "Se validează; eroare afișată; datele existente nu se pierd."],
      ["E16", "Clear all", "Se cere confirmare; nu poate fi declanșat accidental."],
      ["E17", "Offline (fără rețea)", "Aplicația rămâne utilizabilă prin service worker."],
      ["E18", "prefers-reduced-motion activat", "Animațiile (inclusiv confetti) sunt reduse/dezactivate."],
    ]
  )
);
children.push(spacer());
children.push(heading("4.5 Căi de dezvoltare (viitor)", HeadingLevel.HEADING_2));
[
  "Sincronizare în cloud și cont de utilizator (backend, autentificare).",
  "Aplicația mobilă React Native completă, cu partajarea modelului de date.",
  "Notificări / reminder-uri pentru activitățile cu termen limită.",
  "Recurență: activități repetitive (zilnic, săptămânal, lunar).",
  "Colaborare: liste partajate, atribuire de sarcini, comentarii.",
  "Integrare cu calendar (Google Calendar, ICS export/import).",
  "Statistici avansate: grafice extinse, rapoarte periodice.",
  "Import / export extins (CSV) și backup automat.",
  "Widgets pentru ecranul principal (mobil).",
].forEach((t) => children.push(bullet(t)));
children.push(...paras(
  "Deja implementate în versiunea curentă: mod offline / PWA instalabil (service worker), backup prin export/import JSON și Clear all, quick-add în limbaj natural, panou de insights (7 zile + streak), confetti, accesibilitate (ARIA, tastatură, focus) și suport prefers-reduced-motion."
));
children.push(spacer());

// 5
children.push(heading("5. Riscul proiectului"));
children.push(
  table(
    ["#", "Riscul", "Probab.", "Impact", "Măsuri de atenuare"],
    [
      ["RI1", "Depășirea termenului", "Medie", "Ridicat", "Planificare pe milestones; prioritate pe minim; scope controlat."],
      ["RI2", "Incompatibilități versiuni", "Medie", "Mediu", "Documentație oficială; versiuni stabile; build frecvent."],
      ["RI3", "Coliziuni git (lucru paralel)", "Medie", "Mediu", "Responsabilități separate; commit-uri mici; code review."],
      ["RI4", "Pierderea datelor la ștergere", "Scăzută", "Ridicat", "Undo obligatoriu; feedback prin toast."],
      ["RI5", "Complexitate drag-and-drop", "Medie", "Scăzut", "Bibliotecă consacrată (@dnd-kit); reguli clare."],
      ["RI6", "Performanță pe liste mari", "Scăzută", "Mediu", "Optimizare randare; sortare/filtrare eficientă."],
      ["RI7", "Membri indisponibili", "Medie", "Mediu", "Documentație clară; cunoaștere distribuită."],
      ["RI8", "Regresii la modificări", "Medie", "Mediu", "Lint + build înainte de commit; teste manuale."],
      ["RI9", "Design inconsistent", "Scăzută", "Scăzut", "Design tokens; componente reutilizabile."],
      ["RI10", "Pierderea codului", "Scăzută", "Ridicat", "Versionare git; copii de siguranță."],
    ]
  )
);
children.push(spacer());

// 6
children.push(heading("6. Sumar cu cele mai relevante versiuni (milestones)"));
children.push(
  table(
    ["Etapă", "Descriere", "Rezultat / livrabil"],
    [
      ["M0 — Setup", "Inițializare Next.js (App Router, TS, Tailwind v4), structură, tooling.", "Proiect care pornește; lint/TS configurate."],
      ["M1 — CRUD de bază", "Adăugare, editare, ștergere (cu Undo), listare.", "Fluxuri esențiale funcționale."],
      ["M2 — Statusuri", "Restant/Urmează/Complet/Anulat + derivare automată.", "Cerințe minimale îndeplinite."],
      ["M3 — Organizare", "Filtrare cu numărătoare, căutare, sortare.", "Regăsire facilă a activităților."],
      ["M4 — Metadate bogate", "Priorități, categorii, descriere, subtask-uri.", "Model de date complet."],
      ["M5 — UX și persistență", "Temă, localStorage, animații, toasts, scurtături, responsive, confetti, prefers-reduced-motion.", "Experiență modernă și fiabilă."],
      ["M6 — Dashboard, insights și DnD", "Statistici, reordonare și panou de insights (7 zile + streak).", "Vizibilitate asupra progresului."],
      ["M7 — Putere și accesibilitate", "Quick-add natural, export/import JSON + Clear all, PWA/offline, accesibilitate (ARIA, tastatură, focus).", "Funcționalități avansate și incluzive."],
      ["M8 — Stabilizare", "Testare, edge cases, build fără erori.", "Versiune candidată la livrare."],
      ["M9 — Documentație", "Documentație completă (MD + Word), README.", "Livrabile finale."],
    ]
  )
);
children.push(spacer());
children.push(...paras(
  "Fiecare etapă se încheie cu o verificare (npm run build / npm run lint) și, unde este cazul, cu un commit/versiune marcată."
));

// 7
children.push(heading("7. Document Word — descriere minimală"));
children.push(heading("7.1 Resurse folosite", HeadingLevel.HEADING_2));
children.push(para("Resurse umane:", { run: { bold: true } }));
children.push(...paras("Membrii echipei de proiect (dezvoltare web, dezvoltare mobilă, testare, documentare)."));
children.push(para("Resurse tehnice (software):", { run: { bold: true } }));
[
  "Node.js 18+, npm;",
  "Next.js 16 (App Router), React 19, TypeScript;",
  "Tailwind CSS v4;",
  "@dnd-kit, Framer Motion, lucide-react, date-fns, next-themes, sonner, nanoid, clsx, tailwind-merge;",
  "PWA / service worker pentru funcționare offline și instalare;",
  "docx (generare document Word); Git pentru versionare; editor de cod (VS Code);",
  "React Native (pentru componenta mobilă, obiectiv de echipă).",
].forEach((t) => children.push(bullet(t)));
children.push(para("Resurse materiale:", { run: { bold: true } }));
children.push(...paras("Stații de lucru / laptopuri, acces la internet, mediu de dezvoltare local."));
children.push(para("Resurse de informare:", { run: { bold: true } }));
children.push(...paras("Documentația oficială Next.js, React, Tailwind CSS, bibliotecile utilizate și materialele de curs."));
children.push(spacer());

children.push(heading("7.2 Validarea proiectului și acceptarea acestuia", HeadingLevel.HEADING_2));
children.push(para("Validare (cum se verifică):", { run: { bold: true } }));
[
  "Verificarea funcțională a tuturor cerințelor minimale (CRUD + cele 4 statusuri).",
  "Verificarea cerințelor suplimentare (filtrare, căutare, sortare, drag-and-drop, statistici, Undo, temă, responsive).",
  "Verificarea funcționalităților avansate: quick-add în limbaj natural, panou de insights (7 zile + streak), export/import JSON + Clear all, PWA/offline și confetti.",
  "Verificarea accesibilității (roluri ARIA, navigare de la tastatură, gestionarea focusului) și a suportului prefers-reduced-motion.",
  "Rulearea npm run build și npm run lint fără erori.",
  "Testarea manuală a cazurilor limită (secțiunea 4.4).",
  "Verificarea persistenței datelor după reîncărcarea paginii.",
].forEach((t) => children.push(bullet(t)));
children.push(para("Criterii de acceptare:", { run: { bold: true } }));
[
  "Toate cerințele minimale sunt îndeplinite și demonstrative.",
  "Aplicația pornește și rulează stabil, fără erori blocante.",
  "Documentația (Markdown + Word) este completă și coerentă cu implementarea.",
  "Proiectul este livrat în forma cerută (cod + documentație).",
].forEach((t) => children.push(bullet(t)));
children.push(...paras("Acceptator: titularul disciplinei / cadrul didactic, pe baza demonstrației și a documentației."));
children.push(spacer());

children.push(heading("7.3 Manager de proiect, responsabilitate și autoritate", HeadingLevel.HEADING_2));
children.push(para("Manager de proiect: [Nume membru echipa]"));
children.push(para("Responsabilitate: planificarea etapelor, repartizarea sarcinilor, monitorizarea progresului, gestionarea riscurilor și asigurarea livrării la termen și la calitatea cerută."));
children.push(para("Autoritate: decizii privind prioritizarea funcționalităților, acceptarea livrabilelor intermediare, coordonarea echipei și comunicarea cu beneficiarul/cadrul didactic."));
children.push(...paras("Notă: numele reale ale membrilor echipei se completează la livrare."));
children.push(spacer());

children.push(heading("7.4 Sponsori", HeadingLevel.HEADING_2));
children.push(para("Sponsor: [Nume sponsor / instituție]"));
children.push(para("Rol: asigurarea resurselor necesare desfășurării proiectului și validarea la nivel de obiective."));
children.push(...paras("Notă: în context academic, sponsorul/beneficiarul este reprezentat de instituția de învățământ și de cadrul didactic coordonator. Numele concrete se completează la livrare."));

children.push(spacer());
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Document realizat în cadrul disciplinei SOPM.",
        italics: true,
        size: 20,
      }),
    ],
  })
);

const doc = new Document({
  creator: "Echipa SOPM",
  title: "Documentație — Stride (Proiect To-Do List, SOPM)",
  description: "Documentația proiectului Stride (To-Do List) pentru disciplina SOPM",
  sections: [{ children }],
});

const outPath = join(__dirname, "documentatie.docx");
const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);
console.log(`Scris: ${outPath} (${buffer.length} bytes)`);
