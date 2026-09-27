# LETS svetainė ir administravimo panelė

## Supabase paruošimas

Projektas: `jsfoscfckqmekobbjxyp`.

1. [supabase/setup.sql](supabase/setup.sql) faile vietoj `replace-with-your-admin-email@example.com` įrašykite administratoriaus paskyros el. paštą, tada paleiskite SQL Supabase **SQL Editor**. SQL galima paleisti pakartotinai: svetainės tekstai neperrašomi.
2. **Authentication → URL Configuration** į **Site URL** įrašykite Hostinger priskirtą svetainės domeną. Tą patį domeną pridėkite į **Redirect URLs** su `/admin/` keliu. Vietinei peržiūrai papildomai pridėkite `http://127.0.0.1:4173/admin/`. Jei toliau naudosite ankstesnę LETS versiją, jos URL taip pat palikite tarp nukreipimo adresų.
3. Atidarykite svetainės `/admin/`, įrašykite tą patį el. paštą, savo pasirinktą slaptažodį ir spauskite **Sukurti paskyrą**. Patvirtinkite gautą el. laišką. Jei paskyra šiame Supabase projekte jau yra, naudokite **Prisijungti**.

Patvirtintam nurodyto el. pašto savininkui SQL automatiškai suteikia administratoriaus teises. Kitoms paskyroms teisės nesuteikiamos. Slaptažodis kode nesaugomas.

## Kas valdoma panelėje

- `/admin/`: naujienos ir projektai, LT/EN tekstai, Markdown redaktorius, nuotraukos, galerija, PDF dokumentai, SEO laukai, publikavimo laikas, paieška, juodraščiai ir peržiūra.
- `/admin/svetaine/`: pagrindinė EN antraštė ir tekstas, nuotrauka, keturi LETS rodikliai, kontaktai, platformos nuoroda, kontaktų formos įjungimas, partneriai, puslapių peržiūrų statistika.
- `/admin/uzklausos/`: įjungtos kontaktų formos užklausos, būsenos, paieška, vidinės pastabos, atsakingas asmuo ir žymos.

Viešoji svetainė lieka anglų kalba. Naujienos publikuojamos `/news/`; jų detalės atidaromos `/news/article/?slug=...`. Projektai rodomi pagrindiniame puslapyje ir `/project/?slug=...`. Pagrindinio LETS projekto EN aprašymas valdo įžangą „The project“. Projektų PDF nuorodos rodomos „Platform“ puslapyje. Galerija ir projekto duomenys rodomi projekto detalėse. Partnerių pakeitimai matomi „About Project“ ir „Contacts“ puslapiuose.

**Išsaugoti** išlaiko dabartinę įrašo būseną. **Publikuoti** paskelbia arba suplanuoja įrašą. **Paslėpti** grąžina jį į juodraštį. Rašomas tekstas papildomai saugomas šios naršyklės juodraštyje; vieši tekstai keičiami tik paspaudus išsaugojimo mygtuką. Naršyklės juodraštį galima atkurti atskiru mygtuku.

Kontaktai ir platformos adresas iš pradžių tušti. Kontaktų forma išjungta. Svetainė naudoja pateiktą prezentacijos turinį ir veikia net tada, kai Supabase dar neparuoštas.

## Vietinis paleidimas

```sh
npm ci
npm run dev
```

Peržiūra: `http://127.0.0.1:4173/`. Produkcijos statinių failų kūrimas: `npm run build`. Rezultatas: `dist/`. Kanoniniai HTML failai: `web/`; dizaino failai ir vaizdai: `public/assets/`. Nekoreguokite sugeneruoto `dist/` rankiniu būdu.

## Patikra

`node scripts/verify-schema.mjs` tikrina SQL vietiniame PostgreSQL (PGlite), imituodamas Supabase auth/storage bazines lenteles. Patikra apima SQL pakartotinį paleidimą, patvirtintą administratorių, juodraščių ir suplanuotų įrašų privatumą, teisių didinimo blokavimą, užklausų privatumą, saugyklos rašymo teises ir statistikos autorizaciją. Ši patikra nepakeičia tikro projekto API, prisijungimo ir failų įkėlimo patikros po SQL paleidimo.

Visose viešose lentelėse įjungtas RLS. Naršyklei pateikiamas tik publishable raktas. Admino teisės laikomos `profiles`, o leistinas el. paštas – neviešoje `private.admin_emails` lentelėje. Markdown prieš rodymą filtruojamas DOMPurify. Statistika saugo tik puslapio kelią ir laiką.

Panelės React komponentai perkelti iš vartotojo pateikto `3-projektas-karolis` projekto, pritaikyti LETS dizainui ir naujai duomenų bazei. Seno projekto naudotojai ir turinys neperkelti.


## Hostinger Git importas

Pasirinkite `sport-karolis` saugyklos `main` šaką. Projekto šaknyje yra `package.json`, `build` ir `start` scenarijai. Hostinger Node.js programos nustatymuose naudokite `npm install`, `npm run build` ir `npm start`. Serveris pateikia `dist/` statinius failus ir klausosi Hostinger suteikto `PORT`.
