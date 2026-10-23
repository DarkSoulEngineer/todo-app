---
tags:
  - janus
  - sopm
  - validare
  - resurse
  - management
status: draft
version: "1.0"
course: SOPM
supervisor: Prof. Univ. Zaharia Cornel
reviewed: 23.10.2026
---
# Validare, resurse și sponsori: Janus

| Element                | Detalii                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| Proiect                | Janus, aplicație de gestionare a activităților pentru web și mobil |
| Disciplina             | SOPM                                                                |
| Coordonator            | Prof. Univ. Zaharia Cornel                                          |
| Team Lead              | Milchis Catalin-Marian                                              |
| Versiunea documentului | 1.0                                                                 |
| Data revizuirii        | 23.10.2026                                                          |
| Starea documentului    | În lucru                                                            |

Document însoțitor: [[DOCUMENTATIE-PROIECT]].

## 1. Resurse folosite

### 1.1 Echipa
Echipa este formată din cinci membri.

| Membru                 | Rol confirmat     | Responsabilități                                                                                                                     |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Milchis Catalin-Marian | Team Lead         | Coordonarea echipei, planificarea, urmărirea progresului și comunicarea cu profesorul coordonator.<br>UI / UX Aplicatie Web / Mobile |
| Nitu Delia             | Membru al echipei | UI Aplicatie Web / Mobile                                                                                                            |
| Todor Robert-Gabriel   | Membru al echipei | UI/UX Aplicatie Mobile                                                                                                               |
| Valceanu Bogdan-Marius | Membru al echipei | UI/UX  Aplicatie Web                                                                                                                 |
| Luncasu Razvan         | Membru al echipei | Q&A Tester Aplicatie Web / Mobile                                                                                                    |

### 1.2 Responsabilități de repartizat

| Activitate               | Responsabil | Livrabil                                  |
| ------------------------ | ----------- | ----------------------------------------- |
| Analiza cerințelor       | Catalin     | Cerințe și criterii de acceptare          |
| Domeniu și arhitectură   | Catalin     | Model comun și reguli de funcționare      |
| Dezvoltare web           | Bogdan      | Aplicația Next.js                         |
| Dezvoltare mobilă        | Gabriel     | Aplicația React Native                    |
| Design și accesibilitate | Delia       | Interfață și verificări de accesibilitate |
| Testare                  | Razvan      | Rezultate, dovezi și defecte înregistrate |
| Documentație             | Catalin     | Documentele de predare actualizate        |

### 1.3 Resurse software

| Resursă              | Utilizare                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| Node.js și npm       | Instalarea dependențelor, rulare și build                                 |
| TypeScript           | Verificarea tipurilor                                                     |
| React și Next.js     | Aplicația web                                                             |
| React Native și Expo | Aplicația mobilă                                                          |
| Expo Router          | Navigarea mobilă                                                          |
| localStorage         | Persistența datelor pe web                                                |
| AsyncStorage         | Persistența datelor pe mobil                                              |
| ESLint               | Verificarea statică a codului                                             |
| Git                  | Versionarea codului, dacă proiectul este gestionat într-un repository Git |
| Editor de cod        | Dezvoltare și revizuire                                                   |
| Obsidian             | Organizarea documentației Markdown                                        |
### 1.4 Costuri
Bugetul propus pentru achiziții și servicii plătite este de 0 lei. Acesta reprezintă limita planificată, nu dovada că proiectul nu consumă resurse.

Echipamentele personale, timpul echipei, energia electrică și accesul la internet sunt contribuții proprii. Valoarea lor nu a fost estimată.

| Categorie                    | Situație                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Echipamente                  | Se folosesc echipamente personale; eventualele împrumuturi se înregistrează.              |
| Software                     | Se folosesc instrumente gratuite sau open-source, cu respectarea licențelor.              |
| Hosting                      | Nu este necesar pentru demonstrația locală; orice serviciu suplimentar se aprobă separat. |
| Publicare în magazine mobile | Nu este inclusă în scopul inițial.                                                        |
| Cheltuieli efective          | [de completat; se notează 0 lei numai dacă este confirmat]                                |
### 1.5 Beneficii și ROI
Proiectul are în primul rând un scop educațional. Beneficiile urmărite sunt:

- realizarea unei aplicații web și a unei aplicații mobile;
- folosirea unui model de domeniu comun;
- exersarea planificării și colaborării în echipă;
- verificarea funcțiilor prin teste documentate;
- pregătirea unui proiect care poate fi prezentat în portofoliu.

Nu se raportează un ROI financiar, deoarece nu există venituri, economii monetare și costuri totale măsurate. Bugetul de achiziții propus de 0 lei nu permite concluzia că rentabilitatea este infinită sau că dezvoltarea nu are cost.

Beneficiile educaționale se evaluează prin livrabile, rezultatele testării și prezentarea finală, nu prin procente financiare presupuse.

## 2. Validarea și acceptarea proiectului
### 2.1 Înregistrarea verificărilor

Fiecare verificare trebuie să includă:

- versiunea testată sau identificatorul commitului, dacă există;
- data și persoana care a executat verificarea;
- mediul de rulare;
- pașii și rezultatul așteptat;
- rezultatul obținut;
- dovada sau referința către defect.

Verdictele folosite sunt: Netestat, Trecut, Eșuat, Blocat și Neaplicabil. Pentru Neaplicabil se notează motivul.
### 2.2 Verificări statice și build

| ID  | Verificare                      | Metodă                                             | Rezultat așteptat                                     |
| --- | ------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| S01 | Tipuri web                      | Verificarea TypeScript în `todo-app/`              | Fără erori                                            |
| S02 | Lint web                        | Scriptul de lint definit în proiect                | Fără erori                                            |
| S03 | Build web                       | Build de producție                                 | Finalizare fără erori                                 |
| S04 | Tipuri mobil                    | Verificarea TypeScript în `todo-app/mobile/`         | Fără erori                                            |
| S05 | Lint mobil                      | Verificarea Expo/ESLint definită în proiect        | Fără erori                                            |
| S06 | Verificare mobilă               | Rularea `verify.mjs`                               | Toate verificările obligatorii trec                   |
| S07 | Domeniu comun                   | Verificarea scriptului de sincronizare             | Nicio diferență între fișierele partajate             |
| S08 | Compatibilitate Expo            | Diagnosticul dependențelor                         | Fără incompatibilități nerezolvate                    |
| S09 | Export web al aplicației mobile | Export pentru `react-native-web`, dacă este inclus | Export reușit                                         |
| S10 | Rulare mobilă                   | Pornire pe dispozitiv sau emulator                 | Aplicația se deschide și permite fluxurile principale |
| S11 | Denumirea produsului            | Revizuirea metadatelor și mesajelor                | Janus este folosit consecvent în textele vizibile    |
### 2.3 Teste funcționale

Pentru fiecare test se folosesc date cunoscute. Se notează proiectul activ, secțiunile existente și fusul orar, dacă influențează rezultatul.

| ID | Test | Rezultat așteptat | Platformă |
| --- | --- | --- | --- |
| F01 | Adăugarea unei activități cu titlu | Activitatea apare în proiectul curent. | Web și mobil |
| F02 | Adăugarea unei activități cu toate câmpurile suportate | Câmpurile sunt afișate și păstrate după salvare. | Web și mobil |
| F03 | Ștergere și Undo | Activitatea dispare; Undo o restaurează conform comportamentului documentat. | Web și mobil |
| F04 | Finalizarea unei activități | Starea devine Completed. | Web și mobil |
| F05 | Anularea unei activități | Starea devine Canceled. | Web și mobil |
| F06 | Activitate activă cu termen trecut | Starea este Overdue. | Web și mobil |
| F07 | Activitate activă fără termen sau cu termen viitor | Starea este Upcoming. | Web și mobil |
| F08 | Redeschiderea unei activități finalizate sau anulate | Starea este recalculată conform termenului și indicatorilor rămași. | Web și mobil |
| F09 | Quick-add cu prioritate, categorie și termen | Sunt extrase valorile recunoscute fără pierderea textului nerecunoscut. | Web și mobil |
| F10 | Quick-add gol | Interfața tratează intrarea conform regulii stabilite de echipă. | Web și mobil |
| F11 | Căutare, filtrare și sortare | Sunt afișate activitățile și ordinea așteptate. | Web și mobil |
| F12 | Smart lists | Rezultatele corespund regulilor fiecărei liste. | Web și mobil |
| F13 | Mutare între secțiuni | Asocierea și starea se modifică potrivit secțiunii destinație. | Web și mobil |
| F14 | Mutare fără drag | Utilizatorul poate muta activitatea printr-o acțiune alternativă. | Unde este prevăzută |
| F15 | Reprogramare în calendar | Termenul corespunde zilei selectate. | Web și mobil |
| F16 | Eliminarea termenului | Termenul este șters; starea se recalculează fără a anula implicit Completed sau Canceled. | Web și mobil |
| F17 | Subtask-uri | Adăugarea, bifarea și ștergerea actualizează lista și progresul. | Web și mobil |
| F18 | Priorități | Valorile sunt păstrate, iar sortarea respectă ordinea stabilită. | Web și mobil |
| F19 | Categorii | Crearea, redenumirea și ștergerea au efectul documentat asupra activităților. | Web și mobil |
| F20 | Secțiuni personalizate | Modificarea sau ștergerea secțiunii nu pierde activitățile. | Web și mobil |
| F21 | Import valid | Datele suportate sunt încărcate conform modului de import ales. | Web și mobil |
| F22 | Import invalid | Este afișată eroarea, iar datele existente rămân nemodificate. | Web și mobil |
| F23 | Export | Fișierul conține datele și versiunea de format documentate. | Web și mobil |
| F24 | Transfer web–mobil–web | Câmpurile suportate sunt păstrate la fiecare transfer. | Ambele |
| F25 | Izolarea proiectelor | Fiecare proiect păstrează propriile activități și configurații. | Web și mobil |
| F26 | Ștergerea ultimului proiect | Operația este refuzată, fără pierderea datelor. | Web și mobil |
| F27 | Migrarea datelor vechi | Datele sunt păstrate; sursa veche nu este ștearsă înainte de salvarea reușită. | Web și mobil |
| F28 | Reîncărcare după salvare | Datele salvate sunt restaurate. | Web |
| F29 | Repornire după salvare | Datele salvate sunt restaurate. | Mobil |
| F30 | Închidere forțată imediat după editare | Se măsoară dacă ultima editare a fost păstrată și se documentează limita observată. | Mobil |
| F31 | Eșec de stocare | Eroarea este tratată și utilizatorului nu i se confirmă o salvare nereușită. | Web și mobil |
| F32 | Light, dark și system | Tema se aplică și preferința este păstrată conform specificației. | Web și mobil |
| F33 | Insights | Valorile corespund unui set de date cu rezultate calculate în prealabil. | Web și mobil |
| F34 | Accesibilitate | Controalele au etichete, focus utilizabil și alternative la interacțiunile exclusive. | Web și mobil |

Testele pentru funcții mobile neimplementate rămân Netestat sau Blocat. Ele nu sunt trecute pe baza existenței logicii de domeniu.
### 2.4 Registrul rezultatelor

Se completează câte un rând pentru fiecare combinație test–mediu.

| Test           | Versiune       | Mediu          | Data   | Executat de    | Verdict  | Dovadă sau defect |
| -------------- | -------------- | -------------- | ------ | -------------- | -------- | ----------------- |
| [de completat] | [de completat] | [de completat] | [data] | [de completat] | Netestat | [de completat]    |
### 2.5 Compatibilitate

| Aplicație | Mediu                       | Configurație                                    | Verdict  | Observații                                                                                 |
| --------- | --------------------------- | ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Web       | Browser desktop principal   | [sistem de operare, browser, versiune]          | Netestat | [de completat]                                                                             |
| Web       | Browser desktop suplimentar | [sistem de operare, browser, versiune]          | Netestat | [de completat]                                                                             |
| Web       | Browser pe telefon          | [model, sistem, browser, versiune]              | Netestat | [de completat]                                                                             |
| Mobilă    | Android                     | [model sau emulator, versiune Android, runtime] | Netestat | [de completat]                                                                             |
| Mobilă    | iOS                         | [model sau simulator, versiune iOS, runtime]    | Netestat | Se marchează Neaplicabil dacă mediul nu este disponibil și nu este cerut pentru acceptare. |
| Mobilă    | react-native-web            | [sistem, browser, versiune]                     | Netestat | Se verifică separat de aplicația Next.js.                                                  |
### 2.6 Accesibilitate

Se verifică:
- denumirea accesibilă a controalelor doar cu pictogramă;
- ordinea și vizibilitatea focusului pe web;
- utilizarea funcțiilor principale cu tastatura;
- ținte de atingere de minimum 44 de unități logice pe mobil;
- contrastul textului și al controalelor;
- indicarea stării și prin text sau simbol, nu numai prin culoare;
- comportamentul la reducerea animațiilor;
- alternativa fără drag pentru operațiile relevante.

Rezultatele se consemnează în registrul de teste. Respectarea câtorva reguli nu reprezintă, singură, o certificare de conformitate WCAG.
### 2.7 Criterii de acceptare

| ID   | Criteriu                                                                                         | Dovadă                                                            |
| ---- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| AC01 | Adăugarea, ștergerea și cele patru stări funcționează pe web și mobil.                           | Testele minimale și fixtura de stare                              |
| AC02 | Verificările statice și build-urile convenite trec.                                              | Rapoarte de execuție                                              |
| AC03 | Fișierele de domeniu partajate nu diferă.                                                        | Rezultatul verificării de sincronizare                            |
| AC04 | Ecranele incluse în scopul aprobat sunt utilizabile.                                             | Matricea funcțională                                              |
| AC05 | Importul, exportul și izolarea proiectelor nu pierd datele suportate.                            | F21–F27                                                           |
| AC06 | Datele salvate sunt păstrate după repornire; limitele salvării la oprire forțată sunt declarate. | F28–F31                                                           |
| AC07 | Verificările de accesibilitate sunt executate, iar problemele rămase sunt declarate.             | Raportul de accesibilitate                                        |
| AC08 | Pragurile de performanță convenite sunt evaluate.                                                | Raportul de măsurare sau acordul explicit de neaplicabilitate     |
| AC09 | Documentația, instrucțiunile și limitările sunt actualizate.                                     | Revizuirea documentelor                                           |
| AC10 | Scopul documentat corespunde Project Charter-ului.                                               | Decizia privind bugetul energetic și eventualele reduceri de scop |
### 2.8 Procesul de acceptare

1. Echipa încheie verificările și centralizează rezultatele.
2. Defectele sunt corectate sau declarate cu impactul lor.
3. Team Lead-ul verifică livrabilele și propune prezentarea.
4. Profesorul coordonator evaluează proiectul potrivit cerințelor disciplinei.
5. Verdictul și observațiile sunt înregistrate.

| Rol                  | Nume                       | Verdict sau confirmare | Observații     | Data / semnătura, dacă este cerută |
| -------------------- | -------------------------- | ---------------------- | -------------- | ---------------------------------- |
| Team Lead            | Milchis Catalin-Marian     | [de completat]         | [de completat] | [de completat]                     |
| Membru al echipei    | Nitu Delia                 | [de completat]         | [de completat] | [de completat]                     |
| Membru al echipei    | Todor Robert-Gabriel       | [de completat]         | [de completat] | [de completat]                     |
| Membru al echipei    | Valceanu Bogdan-Marius     | [de completat]         | [de completat] | [de completat]                     |
| Membru al echipei    | Luncasu Razvan             | [de completat]         | [de completat] | [de completat]                     |
| Coordonator academic | Prof. Univ. Zaharia Cornel | [de completat]         | [de completat] | [de completat]                     |
## 3. Managerul de proiect

### 3.1 Responsabilități

Milchis Catalin-Marian îndeplinește rolul de Team Lead și coordonează proiectul.

Responsabilitățile sale sunt:
- stabilirea priorităților împreună cu echipa;
- distribuirea sarcinilor și urmărirea progresului;
- identificarea blocajelor și actualizarea riscurilor;
- coordonarea integrării modificărilor;
- verificarea existenței rezultatelor de testare;
- menținerea documentației de management;
- comunicarea cu profesorul coordonator;
- pregătirea predării și a prezentării.
### 3.2 Autoritate și limite

| Decizie                                                      | Autoritate                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Ordinea sarcinilor în scopul convenit                        | Team Lead, cu consultarea membrilor implicați                              |
| Repartizarea activităților                                   | Team Lead și echipa                                                        |
| Alegerea soluțiilor tehnice                                  | Membrii responsabili, cu revizuirea echipei                                |
| Propunerea de predare                                        | Team Lead, pe baza livrabilelor și testelor                                |
| Modificarea cerințelor obligatorii sau a termenului academic | Profesorul coordonator                                                     |
| Acceptarea academică finală                                  | Profesorul coordonator                                                     |
| Asumarea unor cheltuieli sau acorduri externe                | Numai cu acordul persoanelor implicate și, unde este cazul, al instituției |
### 3.3 Matrice de responsabilități
Rolurile tehnice se atribuie nominal înainte de folosirea matricei.
Legendă: R execută, A răspunde de încheiere, C este consultat, I este informat.

| Activitate | Team Lead | Responsabil tehnic desemnat | Responsabil testare desemnat | Restul echipei | Coordonator |
| --- | --- | --- | --- | --- | --- |
| Planificare | A/R | C | C | C | I |
| Implementare | I | A/R | C | C | I |
| Integrare și domeniu comun | C | A/R | C | C | I |
| Testare și raportare | C | C | A/R | R | I |
| Documentație de predare | A | R | R | R | I |
| Gestionarea riscurilor | A/R | C | C | C | I |
| Modificarea cerințelor academice | R | C | C | C | A |
| Acceptarea academică | R | C | C | C | A |
### 3.4 Rezolvarea blocajelor

| Situație                                          | Acțiune                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Problemă tehnică locală                           | Membrul responsabil cere sprijin și notează problema.                |
| Blocaj între sarcini sau conflict de prioritate   | Team Lead-ul coordonează o decizie cu membrii implicați.             |
| Resursă indisponibilă                             | Echipa caută o alternativă și evaluează efectul asupra planului.     |
| Risc asupra termenului sau cerințelor obligatorii | Team Lead-ul informează profesorul coordonator și propune opțiuni.   |
| Problemă legată de o contribuție externă          | Se discută cu persoana sau organizația care a confirmat contribuția. |

Un blocaj care amenință un jalon se comunică imediat ce impactul devine cunoscut. Escaladarea include problema, opțiunile, recomandarea și efectul asupra livrării.
### 3.5 Registrul de decizii

| ID | Subiect | Stare | Decizie / acțiune | Responsabil | Data |
| --- | --- | --- | --- | --- | --- |
| DEC01 | Domeniu comun web și mobil | De confirmat | Confirmarea regulii de modificare în web și propagare prin script | Team Lead și responsabili tehnici | [data] |
| DEC02 | Denumirea produsului | De confirmat | Unificarea textelor vizibile sub numele Janus | Echipa | [data] |
| DEC03 | Directorul mobil activ | De confirmat | Confirmarea folosirii `todo-app/mobile/` și verificarea directorului vechi înainte de arhivare | Echipa | [data] |
| DEC04 | Bugetul energetic | Deschisă | Includere în livrare sau amânare, cu actualizarea charter-ului | Team Lead și coordonator | [data] |
| DEC05 | Licența proiectului | Deschisă | Alegerea licenței și verificarea drepturilor asupra materialelor | Echipa | [data] |
| DEC06 | Roluri tehnice și de testare | Deschisă | Atribuirea nominală a responsabilităților | Echipa | [data] |

O decizie se marchează aprobată numai după confirmare. Existența unei implementări nu dovedește cine a aprobat-o sau ce alternative au fost analizate.
## 5. Completări înainte de predare
- Repartizarea nominală a rolurilor tehnice și de testare.
- Configurațiile echipamentelor și versiunile folosite.
- Datele și rezultatele verificărilor.
- Dovezile pentru testele funcționale.
- Problemele rămase și impactul lor.
- Cheltuielile efective, dacă există.
- Licența proiectului și inventarul materialelor distribuite.
- Decizia privind bugetul energetic.
- Confirmarea echipei și verdictul coordonatorului.