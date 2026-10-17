# જ્ઞાન શોધ – Part 2 : Mystery Box Championship

Part 1 જેવી જ game (Wheel, 5x5 Card, Line, Full House), પણ **7 Round x 5 Question = 35** અને દરેક Round પછી **Mystery Box**.

## નવું શું છે (Part 2)
- **Round wise Wheel:** દરેક Round નું અલગ Wheel (Round 1 = Q1-5, Round 2 = Q6-10 ... Round 7 = Q31-35). આવેલો number Wheel માંથી નીકળી જાય.
- **Card:** 25 જવાબ. Round 1-4 માંથી 4-4 અને Round 5-7 માંથી 3-3 (કોઈ Round ના 5/5 નહિ). કયા જવાબ અને કયા ખાનામાં તે દરેક Player માટે random.
- **Mystery Box:** દરેક Round પછી 6 Box માંથી 1 પસંદ (20 સેકન્ડ, ન કરે તો auto). અંદર શું છે તે server પર જ રહે, છેલ્લે જ ખુલે.
- **Score:** Final = સાચા x2 - ખોટા click x1 + Box points (છેલ્લા Round ના Box x2).
- Game દરમિયાન Player ને Score / સાચું-ખોટું / Box કંઈ દેખાતું નથી. ફક્ત "✅ N Round પૂરા · ⏳ N બાકી" અને "જવાબ નોંધાયો".
- **Flow:** 7 Round -> Host "Box Opening" (Player 7 Box ખોલે) -> Host "Result Reveal".
- **10 Winners:** 1 Line, 2 Line, 3 Line, 4 Line, 5 Line, Full House, 3rd Score, 2nd Score, Overall Champion (1st), Zone Winner. (Bonus winner નથી.)
- Score બરાબર હોય તો: વધુ સાચા જવાબ આગળ, પછી ઓછા ખોટા.
- Result માં Player ને Round wise marks અને HTML Report માં પણ Round wise table.

## Questions Add / Edit કરવા
1. **questions.txt** ખોલો (35 Question તૈયાર છે). ફોર્મેટ:
```
Round 1
Question::Answer      (બરાબર 5 લાઇન)
Round 2
...
```
2. Photo માટે લાઇનના અંતે `[img:q6.jpg]` અને photo `public/qimg/` માં મૂકો.
3. દરેક Answer અલગ હોવો જોઈએ. Round માં 5 થી ઓછા/વધુ હોય તો Create Room વખતે Host ને ભૂલ બતાવશે.
4. અથવા Host ના Create Room પેજમાં સીધા Paste કરો (ખાલી છોડો તો questions.txt વપરાશે).

## config.json માં બદલી શકાય
Round ના નામ, Box ના 6 points (`boxPool`), છેલ્લા Round નો ગુણક (`lastRoundMult`), Box સમય (`boxSec`), Score points.

## Host
Login: **admin / gyan2026**. Round પૂરો થાય એટલે "Mystery Box શરૂ કરો" -> "Next Round". Question Time (10-60 સેકન્ડ) Host સેટ કરે તે જ તે Round ના બધા 5 Question માટે; Time Skip બટન છે.

## Run / Deploy
`npm install` પછી `npm start`. Render પર Part 1 જેમ જ (Build: `npm install`, Start: `npm start`). **Part 1 ની repo માં ઉપર અપલોડ ન કરો, નવી અલગ repo / અલગ Render service રાખો.**

---
# જ્ઞાન શોધ — Lucky Card Quiz Championship (Standalone App)

Aa ek standalone Node.js app che — koi pan vyakti (Claude account vagar) direct browser thi kholi shake. Real-time sync Socket.IO thi thaay che, data server ni memory ma rahe che (server restart thay to rooms clear thai jaay — jaruriyat hoy to database (jem ke SQLite/MongoDB) add kari shakay).

## Files
- `server.js` — backend (Express + Socket.IO), badhi game logic (questions, cards, timer, claims, winners) ahi che.
- `public/index.html` — landing page (Host/Player link).
- `public/host.html` — Host dashboard.
- `public/player.html` — Player screen.
- `package.json` — dependencies list.

## Locally Run Karva Mate (testing)
```
npm install
npm start
```
Pachi browser ma `http://localhost:3000` kholo.

## Internet Par Free Deploy Karva Mate (koi pan vyakti access kari shake)
Koi pan Node.js hosting chalse. Sauthi sahelu:

### Option 1: Render.com (free tier)
1. https://render.com par sign up karo, GitHub sathe connect karo (aa folder ne GitHub repo banavo).
2. "New Web Service" → repo select karo.
3. Build Command: `npm install`, Start Command: `npm start`.
4. Deploy thaya pachi tamne ek public URL malshe (jem ke `https://your-app.onrender.com`) — e j link badha players ne aapo.

### Option 2: Railway.app / Replit / Glitch
Aa badha pan free/cheap Node hosting aape che — repo/files upload karo, `npm install && npm start` set karo, public URL malshe.

## Players Potana Mobile Internet Thi Kaise Join Kare (Important)

Players e apna mobile ni internet (data/WiFi, ge pan hoy) thi join karva mate, server **internet par publicly accessible** hovo joiye — matlab fakt `localhost:3000` chalse to fakt host na j WiFi/computer par kaam kare, bahar na koi player thi nahi.

Be rasta che:

### Option A — Ek j event mate zadપી (ngrok, no deployment needed)
Jo aa fakt ek j vaar nu event hoy (jem ke temple satsang), sauthi sahelu:
1. `npm install && npm start` — apna laptop/computer par local server chalu karo.
2. https://ngrok.com par free account banavo, ngrok install karo.
3. Navi terminal ma: `ngrok http 3000`
4. Ngrok ek public link aapshe (jem ke `https://abcd1234.ngrok-free.app`) — **aaj link badha players ne aapo** (potana mobile internet thi khali jashe).
5. **Jaruri:** Event pura thata sudhi tamaru laptop/computer chalu ane internet sathe connected rakhvu — ngrok tunnel band thai jashe jo laptop band karo/sleep thay.

### Option B — Permanent Hosting (recurring use mate, laptop ni jarur nahi)
Upar "Render.com" wala steps follow karo — ek vaar deploy karya pachi link kayam chalu rahe, tamaru computer band hoy to pan.

Banne option ma players fakt link kholi, potanu naam/zone/avatar nakhi, Room Code sathe join kari shakse — potana j mobile data/WiFi thi, host na network sathe judાયેલા hova ni jarur nahi.

## Navi Suvidhao
- Player login/OTP nathi — Player sidhu Name + Zone + Room Code nakhi Join kare (Room Code QR/link thi bharaai jaay).
- Same Name + same Zone ek j room ma ek j var join thai shake; same Name alag Zone ma chale.
- Host Lobby ma Room QR dekhay. Reveal pachi Zone-wise score (Best Zone) dekhay; Excel ma 'Winners' ane 'Zones' sheet.
- Question ma photo: line ma `[img:https://...jpg]` umero (sidhi image link).

## Host Login
Default: **User ID:** `admin`, **Password:** `gyan2026`
(Change karva mate `server.js` na top par `HOST_ID`/`HOST_PW` badlo, athva environment variables `HOST_ID`/`HOST_PW` set karo.)

## Navaa Questions Add Karva
Room banavta j "Questions" box ma paste karo, format:
```
તમારો પ્રશ્ન?::સાચો જવાબ
```
(ke `Question - Answer` pan chalse). Khali rakho to built-in 36 questions vaparashe.

## Limitations (Important)
- Data server ni RAM ma j store thay che — server restart/redeploy thay to badhi rooms/results clear thai jaay. Moti event pehla ek dry-run test jarur karo.
- 500+ players ek j samaye connect kare to free-tier hosting (Render free) slow/sleep thai shake — paid tier (nano $ plan) ke thodu vadhare resources vado plan lo jo bahu moti event hoy.
- Speech (audio) browser-based che, so tamara players na phone/browser par Gujarati TTS voice hovi jaruri.

## Scratch Card ની Images (Score Level પ્રમાણે)
Player ને Result પછી Scratch Card મળે છે. Net Score ના Level પ્રમાણે ઉપર એક Image દેખાય છે.
Images આ folder માં છે: `public/scratch/`

| File | Level (Net Score) |
|---|---|
| level1.png | 👑 જ્ઞાન સમ્રાટ (20+) |
| level2.png | 🌟 જ્ઞાન ચેમ્પિયન (15–19) |
| level3.png | ⭐ તેજસ્વી તારલો (10–14) |
| level4.png | 🚀 ઉગતો સિતારો (5–9) |
| level5.png | 🌱 નવું અંકુર (1–4) |
| level6.png | 🔥 સંઘર્ષ યોદ્ધા (0) |
| level7.png | 💪 હિંમતવાન (0 થી ઓછો) |

બદલવા માટે: એ જ નામની (level1.png ... level7.png) નવી Image GitHub માં `public/scratch/` માં Upload કરી જૂની replace કરો. Render ફરી Deploy થશે.
Image કાઢી નાખો તો તે Level માં Image વગર Scratch Card બને છે (કોઈ error નહિ).
સલાહ: ચોરસ કે ગોળ PNG, આશરે 400×400, 300 KB થી નાની.

## Scratch Card ની લાઇનો (Message) બદલવી
બધી લાઇનો `public/scratch/messages.json` માં છે. એ file GitHub માં ખોલી (✏️ Edit) લખાણ બદલો અને Commit કરો. Render ફરી Deploy થશે.
- `levels` માં 7 Level છે (ઉપરથી નીચે). `min` = તે Level માટે ઓછામાં ઓછો Net Score (છેલ્લો Level બાકીના બધા માટે).
- `tier` = નાનું નામ, `head` = મોટી હેડલાઇન, `texts` = પ્રેરણા લાઇનો (એક Player ને એક આવે), `spiritual` = આધ્યાત્મિક લાઇનો.
- `tips` = નીચેની 💡 સલાહો. `{n}` ની જગ્યાએ સંખ્યા આવશે.
- લાઇન ઉમેરવા/કાઢવા માટે `[ ]` ની અંદર `"લખાણ",` રાખો. છેલ્લી લાઇન પછી અલ્પવિરામ ન રાખો અને `" "` (અવતરણ) ન ભૂલો.
- ભૂલ થાય તો (file ખરાબ હોય) game પોતાની built-in લાઇનો વાપરશે, game તૂટશે નહિ.

## Questions ma Photo (public/qimg/)
Photo `public/qimg/` folder ma Upload karo (nanu naam, space vagar, jem ke `q1.jpg`).
Question ni line ma `[img:q1.jpg]` umero. Details: `public/qimg/README.txt`. Namuna: `questions-with-images-sample.txt`.
