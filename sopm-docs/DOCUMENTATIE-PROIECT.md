---
tags:
  - project-charter
  - management
  - todo-app
  - obsidian
status: active
author: Milchiș Cătălin-Marian & Team
supervisor: Prof. Univ. Zaharia Cornel
---
---
tags: [project-charter, management, todo-app, obsidian]
author: Milchiș Cătălin-Marian & Team
supervisor: Prof. Univ. Zaharia Cornel
---

# Project Charter: Janus

## Aplicație Todo web și mobilă cu buget energetic

| Element             | Detalii                                   |
| ------------------- | ----------------------------------------- |
| Proiect             | Janus                                    |
| Disciplina          | SOPM                                      |
| Tip                 | Aplicație open-source pentru web și mobil |
| Coordonator         | Prof. Univ. Zaharia Cornel                |
| Team Lead           | Milchiș Cătălin-Marian                    |
| Echipă              | 5 membri                                  |
| Starea documentului | În lucru                                  |

## 1. Scopul proiectului
Janus ajută utilizatorul să își organizeze activitățile în funcție de termene, priorități și energia disponibilă într-o zi.

Utilizatorul stabilește un buget energetic zilnic și atribuie fiecărei activități un cost estimat. Aplicația calculează consumul planificat, semnalează depășirea bugetului și propune reorganizarea activităților. Modificările se aplică numai după confirmarea utilizatorului.

Proiectul include o aplicație web realizată cu Next.js și o aplicație mobilă realizată cu React Native. Bugetul energetic este o estimare personală, nu o evaluare medicală.
## 2. Obiective și criterii de succes
Criteriile de mai jos vor fi confirmate de echipă și de coordonator înainte de stabilirea formei finale a proiectului.

| Obiectiv                        | Criteriu de succes                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Gestionarea activităților       | Utilizatorul poate adăuga, edita, șterge, recupera prin Undo și finaliza activități.                                                |
| Organizarea activităților       | Activitățile pot fi căutate, filtrate și organizate după prioritate, categorie și termen.                                           |
| Gestionarea bugetului energetic | Utilizatorul poate introduce bugetul zilnic și costurile activităților. Totalul este calculat corect, iar depășirea este semnalată. |
| Recomandări de planificare      | Sugestiile respectă regulile documentate pentru energie, prioritate și termen. Aplicarea lor necesită confirmare.                   |
| Funcționare pe web și mobil     | Fluxul de creare, planificare și finalizare este demonstrat pe web și pe cel puțin o platformă mobilă convenită.                    |
| Calitatea livrării              | Nu există defecte critice cunoscute care împiedică utilizarea funcțiilor de bază.                                                   |
| Predarea proiectului            | Codul, documentația, rezultatele testării și prezentarea sunt predate coordonatorului.                                              |
## 3. Cerințe de nivel înalt
- Activitățile au titlu, descriere opțională, termen, prioritate, categorie, subtask-uri și stare.
- Interfața oferă vizualizări Listă, Board și Calendar.
- Utilizatorul poate stabili bugetul energetic pentru o zi.
- Fiecare activitate poate primi un cost energetic estimat, exprimat în aceeași unitate ca bugetul.
- Aplicația afișează energia planificată și energia rămasă.
- Sugestiile de reorganizare au reguli explicabile și nu modifică automat planul utilizatorului.
- Datele sunt păstrate local și pot fi exportate și importate pentru backup.
- Interfața web este adaptată ecranelor mici și permite folosirea funcțiilor principale cu tastatura.
- Datele importate sunt validate înainte de salvare.
- Comportamentul offline și limitele fiecărei platforme sunt documentate.
## 4. Descrierea proiectului, limite și livrabile
### Funcționalități incluse
- Gestionarea activităților și a subtask-urilor.
- Organizarea pe categorii, priorități și secțiuni.
- Vizualizări Listă, Board și Calendar.
- Calculul bugetului energetic zilnic.
- Sugestii de reorganizare a activităților.
- Statistici privind activitățile finalizate.
- Persistență locală și backup prin export și import.
- Aplicație web și aplicație mobilă cu funcții de bază echivalente.
- Testare și documentație de utilizare.
### Funcționalități neincluse în versiunea inițială
- Evaluarea medicală a energiei sau a stării de sănătate.
- Sincronizarea în cloud și colaborarea în timp real.
- Un sistem public de plugin-uri.
- Integrări complexe cu servicii externe.
- Publicarea în magazinele de aplicații, dacă nu este solicitată separat.

Aceste funcționalități pot fi introduse ulterior numai după evaluarea timpului și a resurselor necesare.
### Livrabile

| Livrabil                        | Conținut                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Aplicație web                   | Cod sursă Next.js, funcții de bază și instrucțiuni de rulare.                   |
| Aplicație mobilă                | Cod sursă React Native și instrucțiuni de rulare pe platforma convenită.        |
| Modul de planificare energetică | Model de date, reguli de calcul, sugestii și teste.                             |
| Documentație                    | Cerințe, arhitectură, planificare, ghid de utilizare și rezultate ale testării. |
| Materiale de predare            | Versiunea finală a proiectului, prezentare și scenariu de demonstrație.         |
### Constrângeri
- Echipa este formată din 5 membri.
- Dezvoltarea se desfășoară în paralel cu alte activități universitare.
- Se folosesc echipamente personale și instrumente gratuite.
- Termenul de predare este cel stabilit în cadrul disciplinei.
- Funcțiile de bază au prioritate față de extensii și îmbunătățiri vizuale.
## 5. Riscuri

| Risc                                | Efect posibil                                | Măsură                                                                     |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| Timp insuficient                    | Funcții neterminate la predare.              | Prioritizarea versiunii minime și amânarea funcțiilor opționale.           |
| Experiență limitată cu tehnologiile | Blocaje și refacerea unor componente.        | Prototipuri timpurii, lucru în perechi și revizuirea codului.              |
| Diferențe între web și mobil        | Comportament neuniform.                      | Testarea timpurie a fluxurilor comune pe ambele platforme.                 |
| Coordonare slabă                    | Sarcini duplicate sau probleme de integrare. | Responsabilități clare și verificări periodice ale progresului.            |
| Reguli energetice neclare           | Recomandări greu de justificat.              | Definirea regulilor înainte de implementare și verificarea lor pe exemple. |
| Pierderea datelor locale            | Pierderea activităților utilizatorului.      | Export de backup și testarea restaurării.                                  |
## 6. Etape și jaloane
Datele și responsabilii fiecărei etape se stabilesc după confirmarea termenului de predare.

| Jalon | Rezultat așteptat |
| --- | --- |
| M1. Organizarea echipei | Roluri, responsabilități și mod de lucru stabilite. |
| M2. Analiză și proiectare | Cerințe, schițe de interfață și reguli ale bugetului energetic. |
| M3. Implementarea funcțiilor de bază | Gestionarea activităților funcționează pe web și mobil. |
| M4. Implementarea planificării energetice | Calculul bugetului și sugestiile sunt integrate și testate. |
| M5. Testare și corectare | Problemele critice sunt rezolvate, iar documentația este actualizată. |
| M6. Predare și prezentare | Proiectul este demonstrat și evaluat de coordonator. |

Dezvoltarea se face în iterații scurte. Problemele găsite la testare sunt înregistrate și prioritizate înaintea următoarei iterații.

## 7. Resurse financiare și materiale
Bugetul propus pentru achiziții și servicii plătite este de 0 lei.

Echipa folosește:
- calculatoare și telefoane personale;
- instrumente open-source;
- servicii gratuite, în limitele disponibile;
- timpul propriu pentru dezvoltare, testare și documentare.

Orice cheltuială suplimentară se discută înainte de asumare. Taxele pentru publicarea în magazinele de aplicații nu sunt incluse în buget.
## 8. Părți interesate

| Parte interesată           | Rol                                                                      |
| -------------------------- | ------------------------------------------------------------------------ |
| Prof. Univ. Zaharia Cornel | Coordonare academică și evaluare finală.                                 |
| Milchiș Cătălin-Marian     | Coordonarea echipei, planificarea și urmărirea livrării.                 |
| Echipa de dezvoltare       | Analiză, implementare, testare și documentare.                           |
| Utilizatori de test        | Verificarea utilizabilității și feedback asupra planificării energetice. |
## 9. Condiții de aprobare
Proiectul este pregătit pentru prezentare când:

- funcțiile de bază îndeplinesc criteriile de acceptare convenite;
- fluxurile principale au fost testate pe web și pe platforma mobilă aleasă;
- nu există defecte critice cunoscute care blochează demonstrația;
- documentația și instrucțiunile de rulare sunt actualizate;
- limitările și funcțiile nefinalizate sunt declarate.

Team Lead-ul verifică pregătirea pentru prezentare împreună cu echipa. Acceptarea academică finală aparține profesorului coordonator.

Modificările majore de scop sau termen se discută cu coordonatorul.
## 10. Criterii de închidere, suspendare sau anulare
### Închidere
Proiectul se închide după predarea și evaluarea livrabilelor. Codul, documentația și problemele rămase sunt păstrate în repository.

La expirarea termenului se predă stadiul existent, cu menționarea limitărilor.
### Suspendare sau reducere de scop
Aceste măsuri pot fi propuse dacă apar:

- blocaje tehnice care nu pot fi rezolvate în timpul disponibil;
- indisponibilitatea unor membri ai echipei;
- probleme de compatibilitate care afectează funcțiile de bază;
- conflicte de echipă care împiedică dezvoltarea.

Decizia se discută cu profesorul coordonator.
### Anulare
Anularea se ia în considerare dacă obiectivele nu mai pot fi realizate în condițiile convenite. O evaluare nereușită nu înseamnă automat anularea proiectului; se aplică regulile disciplinei și condițiile de remediere stabilite de coordonator.
