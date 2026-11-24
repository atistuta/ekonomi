# DEVAM — sonraki oturuma devir notu

Bu dosya, sohbet temizlendiginde kaybolmamasi gereken OLCULMUS gercekleri tasir.
Tahmin yok; her satir ya olculdu ya "OLCULMEDI" diye isaretli.

## 1. Proje nedir
Sabah Bulteni. Web surumu (`app.js` + `styles.css` + `api/`) artik GELISTIRME LABORATUVARI.
Gercek urun = native RN/Expo mobil uygulama, YALNIZ Apple App Store.
Degismez kural: **motor -> API ayristir, native ince istemci**. Motorun urettigi
**skor degeri hicbir degisiklikte kaymayacak**.

## 2. Mimari tuzaklari (bunlari bilmeyen kod bozar)
- `api/_motor.js` ve `api/_ayar.js` **URETILMIS** dosyalar. ELLE DUZENLENMEZ.
  Degisiklik `app.js`/`config.js` icinde yapilir, sonra `node tools/motor-uret.mjs`.
- Motor bir FABRIKA: ust duzey ihracatlar yalniz `DILIMLER, IMZA, buildMotor`.
  Her sembol `buildMotor(H)` donusundedir. Kurulum kabugu `dead` ISTER
  (yoksa `TypeError: H.dead is not a function`), ve `MY_PROXY` bos olamaz.
- Motor ihracat yuzeyi ELLE yazilir: `tests/engine.mjs:150 export const EXPORTS = [...]`.
  Bir islevi app.js dilimine yazmak isin YARISI; `EXPORTS` girdisi olmadan sembol `undefined`.
- Dilim sinirlari `tests/engine.mjs` icinde **METIN ISARETI**, satir numarasi degil.
  Isaretler disindaki app.js duzenlemesi uretilen dosyayi degistirmez (uretici "degisiklik yok" der).
- Uretici satir sayisi ile dosya satir sayisi AYNI DEGIL (2713 vs 2827) — karsilastirma yapma.
- `app.js`, `styles.css`, `tests/uc-test.mjs` **CRLF**. Cok satirli eslesmede
  satir sonunu tespit et ve dizileri onunla birlestir (yoksa sessizce 0 eslesme).
  Commit: `git -c core.safecrlf=false commit`.
- Heredoc + JS kacis karakteri birlesimi ters bolu yer — bu ALTI kez kod bozdu.
  KURAL: yardimci betiklerde ters bolu/regex KULLANMA; duz `String.includes`,
  `String.fromCharCode(39)` tek tirnak icin, `String.fromCharCode(92)` ters bolu icin.
  Bash heredoc'u da ayni sebepten patliyor -> uzun dosyayi Write araciyla yaz.
- `node -e` bu Windows kabugunda ASCII disi karakteri bozuyor -> betigi scratchpad'e yaz.
- Vercel Hobby **12 fonksiyon/deploy**. Simdiki dosya sayimi tam 12. 13. sessizce patlar,
  hata yalniz preview deploy'da gorunur. Yeni uc icin `vercel.json` yeniden-yazimi:
  `/api/<ad>` -> `/api/proxy?__rota=<ad>`, `api/proxy.js` icindeki `HANDLERLAR[rota]`.
  `_` ile baslayan dosyalar modul, fonksiyon degil.
- `localhost` bu makinede cozulmuyor -> `127.0.0.1`.
- `grep -c` sifir eslesmede 1 dondurur, `&&` zincirini kirar.
- Mobil uygulama koku `mobile/src/app/` (`mobile/app/` YOK).
- Typecheck mobile icinden: `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
  (kokte `npx tsc` tsc@2.0.4 kurup yanlis gecer).
- Hermes'te `Intl` kisitli -> `mobile/src/lib/format.ts` kendi tr-TR bicimleyicilerini tasir;
  native'de `toLocaleDateString`/`toLocaleTimeString` KULLANILMAZ.

## 3. Kapi kumesi (her commit oncesi hepsi kosar)
| Komut | Beklenen |
|---|---|
| `node --check app.js` | sessiz |
| `node --check config.js` | sessiz |
| `node tools/motor-uret.mjs` | "degisiklik yok" (iki dosya) |
| `node tests/parity.mjs` | FARK 0 / 29 nokta |
| `node tests/uretim-test.mjs` | 73 |
| `node tests/uc-test.mjs` | 1341 (16 uc) |
| `node tests/nabiz-yon-test.mjs 2>&1 \| tail -4` | 40 |
| `node tests/nabiz-alan-test.mjs 2>&1 \| tail -4` | 128 |
| mobile typecheck | EXIT 0 |
| `ls api/*.js \| grep -v '/_' \| wc -l` | 12 (Hobby siniri 12) |

Mobile typecheck TAM komutu (kokte `npx tsc` tsc@2.0.4 kurar ve yanlis gecer):
`cd mobile && node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`

Test cikti tuzagi: her test en sona feragatname basar; `tail -1` onu yakalar.
Nabiz testlerinde `grep` de yaniltir -> `tail -4` kullan.
`tests/baseline.json` ASLA elle duzenlenmez (duzenlemek testi muhre cevirir).
`tests/capture.mjs` ASLA kosturulmaz (canli ag + fikstur uzerine yazar).
`tests/duman.mjs` tek canli-ag testi, elle, CI'da degil, fikstur yazmaz.
CRLF dosyalar: `app.js`, `config.js`, `styles.css`, `tests/uc-test.mjs`,
`mobile/eas.json` -> commit `git -c core.safecrlf=false commit` ile.

## 4. Durum — dürüst (2026-10-29 olcumu, commit `a9068c8`)
SAGLAM: 21 saf motor dilimi, parite FARK 0, 16 uc / 1341 denetim, 73 uretim denetimi,
mobile tsc EXIT 0, fonksiyon sayisi 12. Skor degeri hic kaymadi.

PORT DURUMU (web sekmesi -> native):
- Portlandi: today, general, news, lists, search, technical, fundamental, compare,
  scan, sektor, radar, opps, tez, deger, backtest, tema, nedensellik, kripto, metal,
  calendar. `momentum` ve `earn` icin yeni uc gerekmedi (`/api/recommend`
  `plan.momentum`, `/api/yfin?deep=1` `earnings`).
- `calendar` icin YENI uc: `/api/takvim` (tasiyici `api/_takvim.js` + `vercel.json`
  yeniden-yazimi; yeni Vercel fonksiyonu YOK).
  DUZELTME 2026-10-29: `a9068c8` turunun "takvim portlandi" ifadesi UCUN acildigini
  dogru, EKRANDA oldugunu YANLIS ima ediyordu. Olcum: o turdan sonra `grep -rn
  "api/takvim" mobile/` -> 0 eslesme, `client.ts` `ENDPOINTS` haritasinda `takvim`
  anahtari YOKTU. Yani uc canliydi, onu cizen native kart hic yazilmamisti.
  Bosluk KAPANDI: `mobile/src/api/takvim.ts` (sarmalayici) + `components/bugun/
  TakvimKart.tsx` yazildi, `ENDPOINTS.takvim` eklendi, kart Bugun sekmesine
  `PiyasaGundemiKarti` ardina montelendi. Uc sozlesmesi CANLI olculdu:
  `kapsam=hepsi` -> HTTP 200, `kap[30]` + `temettu[120]`, `tam:true`;
  `kapsam=temettu` gorevinde `kap`/`kapAdet` anahtarlari govdede HIC YOK
  (`undefined` = "sormadim" dali gercek, uydurulmus degil).
  **`kap` maddelerinin 16/30'unda `symbol: null`** (cok sembollu KAP basliklari,
  `app.js:255` ikizinin bilinen ariza); kart o satirlarda sembol UYDURMUYOR,
  basliktan ayristirmaya CALISMIYOR, kac satirin ayristirilamadigini yaziyor.
  `temettu[].yieldPct` yuzde puani -> x100 YAPILMADI.
  OLCULMEDI: kart RENDER EDILMEDI (tsc EXIT 0 + eslint EXIT 0 render kaniti degil);
  ucun 400/502 dallari ve `null`/`[]` dallari canlida HIC gozlenmedi, yalniz
  `api/_kesif.js takvimHandler` sozlesmesinden turetildi.
- `makro` PORTLANAMAZ: web'in makro blogu bastan sona istemci esigi/agirligi/karar
  agaci; HAM SAYI KURALI ile uyumsuz. Olculmus yuzey `/api/pulse` Bugun'de zaten cizili.

ACIK BOSLUKLAR (hepsi bilerek acik, veri uydurulmadi):
- KAPANDI: `/api/causal` girdisinin IKI yarisi da artik olculuyor ->
  `gundem` <- `/api/gundem` + `gundemdenKonseptler` (§20.14),
  `hareketler` <- `/api/chart` ×4 + `fetchNedenHareketleri` (§20.15);
  ikisini `NedenBesleyici.tsx` birlestiriyor. ACIK KALAN tek sey CANLI
  cagri (yerel DNS, §12) ve cihazda cizim.
- KAPANDI 2026-10-29 (`c4734c9`): `YfinKunye` dokuz temettu alanini bildiriyor,
  `detay/TemettuKart` cizili. Birimler CANLI olculdu (`/api/yfin?symbols=KO&deep=1`,
  HTTP 200 / 2345 bayt, dokuzu da dolu): `dividendRate` 2.12 ve
  `trailingAnnualDividendRate` 2.08 ve `lastDividendValue` 0.53 hisse basi ·
  `payoutRatio` 0.6195 ve `trailingAnnualDividendYield` 0.02267524 oran 0-1 ·
  **`dividendYield5y` 2.83 = YUZDE PUANI, oran degil** -> `formatOran` ile x100
  yapmak 100 kat yanlis olur, yapilmadi · `lastDividendTs` 1789430400,
  `exDividendTs` 1796083200, `dividendTs` 1797292800 -> ucu de **10 HANE = saniye**
  (13 haneli milisaniye gelmiyor, `formatGunAyYil` ileri yil basmiyor).
  Olcum tek sembolle (KO) yapildi; BIST sembolunde ayni alanlarin dolu geldigi
  SORGULANMADI -> bos gelirse kart "olcemedim" dalina duser.
  Ayni commit'te `analiz/TemettuKart` dort alan icin YANLIS "olculmedi" basmayi
  birakti: `EKSIK_ALANLAR` gercekten gelmeyen ikiye indi (beyan tarihi,
  temettu gecmisi).
- Liste bazli donem % degisimi icin ham uc YOK (web istemcide hesapliyor:
  `changeFor`, `CHANGE_PERIODS` = gunici/1/7/30/182/365). Listeler sekmesindeki
  en buyuk gorsel bosluk.
- `ListeKaydi.notify` alaninin `depo.ts`'te yazicisi yok -> olu anahtar basilmadi.
- `app.js:255` KAP regexi yildizli coklu bildirim blogunu ESLEMIYOR (`symbol: null`).
  Ikizlik geregi birebir korundu, test (16. bolum, d) ile kilitli.
  **Duzeltilirse app.js ve `api/_takvim.js` ayni anda duzeltilmeli.**
- `/api/deger` metal bacaginda 8 makro olcumu (`dxyChg, tnxChg, vix, gsr, pgr,
  cuChg, ownM, ownH`) yok -> skor notr girdiyle kosuyor. `/api/deger` = metal+kripto
  degerlemesi, hisse DCF'i DEGIL.
- Momentum maliyeti: `recommend.js`in kendi yazili olcumu ABD sembolu basina
  7.2 sn / 31 SEC istegi, `AZAMI_SEMBOL = 8`. Ucuz "yalniz TA" ikizi yapilmadi
  (gerekcesi olcum istiyor).
- KV onbellek isabet dali yerelde hic kosmadi (`kvHazir()` false).
- Borsa kodlari CME/TOR/GER/FRA/VIE/LSE/BUE/NEO/VAN/PAR/HAM ve ASE bilerek `pazar:null`.
- **Hicbir React bileseni BENIM tarafimdan render edilmedi.** Expo kosmadi, ekran
  goruntusu alinmadi. Tek render kaniti: kullanicinin uygulamanin iPhone'unda
  acildigini bildirmesi.
- KAPANDI 2026-10-29 (`d21986c` pushundan sonra, otomatik deploy): `/api/takvim` ve
  `/api/arama` URETIMDE olculdu. `?kapsam=kap&kapAdet=2` -> HTTP 200, 911 bayt,
  14.6 sn, Mynet KAP basliklari dolu. `?kapsam=temettu&temettuAdet=3` -> HTTP 200,
  569 bayt, 0.64 sn, 275794 bayt kaynak, DESA/LIDER/GOKNR tarih+tutar+yieldPct dolu.
  `/api/arama?q=ASELS` -> HTTP 200, tek aday `ASELS.IS` / `pazar:"BIST"`.
  Canli KAP cevabi `app.js:255` hatasini da dogruluyor: `***GRFIN ** EMVAR***`
  blogunda `symbol: null` (bilerek, ikizlik geregi).
- Telefon yapisi `EXPO_PUBLIC_API_URL=https://day-starter.vercel.app` gomuyor;
  deploy edilmemis her uc cihazda 404 verir.
- FAZ 4-6 hic baslamadi: Supabase auth, RevenueCat/IAP, LLM katmani, EAS Submit.
- `eas-cli` yerelde 25.2.0, duyurulan 27.1.0; yukseltilmedi (yeni bagimlilik onay ister).

Bilinen onarilmamis arizalar: `/api/watchlist` kimlik dogrulamasi yok (paylasimli
tahmin edilebilir `code`, yazma dahil, CORS `*`) · ~~BIST temel bacagi kirik~~
**YANLIS TESHIS, bkz. §15.2: bacak CALISIYOR, eksik olan `market=BIST` parametresi** ·
T24 RSS 403, dort vekil de dusuk ·
`lightweight-charts@4.2.0` unpkg'den yuklenemedi · `/api/theme` yolunda istemci basina
hiz siniri yok — anahtar 2026-10-29'dan beri URETIMDE canli oldugu icin bu artik
guvenlik degil **faturalandirma** acikligi (§10, §6/7).

## 5. Itilmemis is
OLCULDU 2026-10-29: calisma agaci temiz (yalniz izlenmeyen PDF/DOCX ve iki
referans klasoru kaldi), `main` ile `origin/main` ESIT.
Bu oturumda push onayi VERILDI ve KULLANILDI, dort commit:
`a9068c8` web -> native port (27 yol) · `d21986c` DEVAM.md yeniden yazimi ·
`852b930` uretim olcumu · `c4734c9` temettu 9 alan + yanlis "olculmedi" kalkti
(5 yol, yalniz `mobile/**`). Hepsi `git add -- <yol>` ile sahnelendi.

ONAY KAPSAMI: kullanici "bekleyen tum commit pushlara onay veriyorum" dedi; o onay
bu dort commit'te KULLANILDI. **Bundan sonraki degisiklikler icin AYRI, taze,
acik "evet" gerekir.** **Asla force-push yok, rebase yok.**
`git add -A` / `git add .` ASLA; yalniz `git add -- <yol>`.
Izlenmeyen ve git'e GIRMEYECEK olanlar: iki PDF, bir DOCX,
`financial-services-main/`, `total motor fikir/`.
Bot commit'i (`poll-kap.yml`) yalniz `worker/.movers.json` + `worker/.seen.json`
dokunur; once fetch, dosya cakismasi yok dogrula, sonra birlestir (rebase degil —
CRLF dosyalar icin `git -c core.safecrlf=false` ile).

DEPLOY: ayrı bir adim DEGIL — `main`'e push otomatik Vercel production deploy
tetikliyor (olculdu). Yani push onayi = deploy onayi; elle `vercel --prod` gereksiz.
`mobile/**` `.vercelignore` ile haric, web sitesine HIC gitmez (§11).

## 6. Siradaki is — siraya gore
1. ~~Deploy~~ TAMAM: push otomatik deploy tetikliyor, `/api/takvim` + `/api/arama`
   uretimde olculdu (§4). Elle `vercel --prod` GEREKMEDI.
2. ~~Ad-hoc yapi~~ TAMAM: `db01122d-ba13-4108-bb8c-8348b7a007d3`, `Build finished`,
   proje 6.8 MB sikistirilip yuklendi, QR + kurulum linki uretildi. Cihaz UDID
   `00008110-000848A614D1401E` profilde kayitli, dagitim sertifikasi
   `17C054173FB282BA0DBD0FF514DB3A76` 2027-06-25'e kadar gecerli, ad-hoc profil
   `S4264TB2H3` etkin, takim `K79M286U78`.
   **Bu yapida `c4734c9` temettu degisiklikleri YOK** (ZIP zaten yuklenmisti).
3. **OTA karari bekliyor** (§11). Cihazdaki yapi guncelleme ALAMAZ: `expo-updates`
   kurulu degil, `app.json`'da `updates`/`runtimeVersion` yok, `cihaz` profilinde
   `channel` yok -> her arayuz degisikligi yeni yapi + yeniden kurulum demek.
   Uclar (`api/**`) ise push ile aninda guncelleniyor.
4. Kullanicinin cihaz geri bildirimini topla -> cila/optimizasyon listesi.
5. TestFlight: App Store Connect uygulama kaydi (KULLANICININ ISI, kategori
   **Finance**) -> tek tikayici. Ardindan `submit.production.ios` icin `ascAppId`,
   App Privacy anketi, Internal Testing grubu, magaza yapisi + `eas submit`.
6. Adli bosluklar: ~~`/api/causal` girdi ucu~~ TAMAM (§20.14 + §20.15) ·
   ~~liste donem % ham ucu~~ TAMAM (§24) ·
   ~~`depo.ts` `listeBildirimAyarla` yazicisi~~ TAMAM (§23) ·
   ucuz yalniz-TA momentum ikizi (maliyet olcumu).
   (`app.js:255` KAP regexi IKI IKIZDE DE ONARILDI; eksik olan yalniz
   kullanicinin deploy'u -> §21 degil, bekleyen is degil.)
   (`YfinKunye` 9 temettu alani KAPANDI -> `c4734c9`.)
7. `/api/theme` istemci basina hiz siniri: anahtar artik URETIMDE canli, yani bu
   artik yalniz guvenlik degil **faturalandirma** acikligi. Ucretli katmandan ONCE.
8. Ucretli katman maliyet hesabi (`/api/theme` LLM bacagi) — "ucretsiz kur,
   parali kisimlari hesapla ve sat" politikasi geregi.
9. FAZ 4-6: Supabase auth, RevenueCat/IAP.

Serit kurali (dosya sahipligi): **D/E** -> `api/_akis.js` + `tests/uc-test.mjs` ·
**F** -> yalniz `mobile/**` · **G** (ben) -> `app.js`, `config.js`, uretilen motor,
`tests/engine.mjs`, `DEVAM.md`. Uca esik/formul/Turkce cumle GIRMEZ (HAM SAYI
KURALI, `BAGIMLILIK_GRAFIGI.md` §5.1). Tarayici/preview erisimi EN FAZLA bir seride.
Subagent JSONL ciktisi kabuktan OKUNMAZ. Subagent onay VEREMEZ.
5'li menu degismez: Listeler · Bugun · Kesfet · Analiz · Arama;
`(tabs)/_layout.tsx` ACILMAZ.

## 7. Kullanicinin kendi yapacaklari (her biri bir cumle)
1. **Terminal sekmeleri c2, c3 ve c6'yi kendisi kapatmali** — icine yazildigi icin
   benim `stop_terminal_tab` cagrilarim reddediliyor (c4 ve c5 kapatildi).
   c2 `eas credentials ios` etkilesimli menude bekliyor, c6 bayat
   `Build in progress...` donuyor (yapinin kendisi `finished` olarak olculdu).
2. Deploy ve ad-hoc yapi kararlari KAPANDI. Siradaki tikayici karar: **OTA**
   (`expo-updates` yeni bagimliligi) ya da her turda yeni yapi (§11).
3. `ANTHROPIC_API_KEY` KAPANDI: kullanici kendisi ekledi, uretimde canli (§10).
   Isterse Preview/Development ortamlarina da kendisi ekler; anahtar sohbete YAZILMAZ.
4. `cd mobile && npx expo install --fix` ile SDK 57 yamalarini al
   (expo 57.0.28->31, expo-router 57.0.26->29, @expo/ui 57.0.23->26,
   expo-constants 57.0.21->22, expo-linking 57.0.12->13).
5. App Store Connect'te uygulamayi olustur; kategori **Finance**.
6. Gizlilik URL'si `https://day-starter.vercel.app/gizlilik`, destek URL'si `.../destek`.
7. App Privacy anketi: Other User Content -> Collected **Yes**, App Functionality,
   **Not Linked to You**, **Not Used for Tracking** (senkron `code`'unda kimlik dogrulama yok).
8. TestFlight'ta Internal Testing grubu olustur ve kendini ekle.
   Apple ID sifresini ve 2FA kodunu kullanici kendi sekmesinde girer; sohbete YAZILMAZ.

## 8. Degismez dil/politika kurallari
- Her kullanici ekraninda "Bilgi amaclidir, yatirim tavsiyesi degildir."
- Kisisellestirilmis yatirim tavsiyesi YASAK; lisansli danisman degilim.
- Magaza/arayuz dilinde yasak: kazandirir, al/sat sinyali, garanti, kar,
  oneri/tavsiye (vaat olarak), firsat (vaat olarak), kazanc.
- 5 menu duzeni degismez: Listeler · Bugun · Kesfet · Analiz · Arama.
  Renk korlugune uygun ▲/▼, `tabular-nums`.
- Native'de skor/gosterge matematigi YOK; ucta esik/agirlik/formul YOK.
- **Olculmeyen sayi basilmaz** — eksik veri `null`, asla `0`.
- Yeni bagimlilik yok (`npm install` yasak); `expo-haptics` yok, kullanilmaz.
- `git add -A` / `git add .` ASLA; yalniz `git add -- <yol>`.
  Izlenmeyen PDF/DOCX, `financial-services-main/`, `total motor fikir/` git'e ve deploy'a girmez.
- `atahasnokar@gmail.com` yalniz gizlilik/destek sayfasi iletisimi olarak gecer;
  UA/baslik/URL icine ASLA girmez (orada `iletisim@day-starter.vercel.app`).
- `api.anthropic.com` `api/_ag.js`'ye ASLA eklenmez.
- `ANTHROPIC_API_KEY` ASLA loglanmaz, istemciye gitmez, sohbete yazilmaz.
- `EXPO_PUBLIC_` ile baslayan her deger JS paketine gomulur ve HERKESE ACIKTIR;
  `service_role` orada ASLA yer almaz.
- UA/istek basligi olcmeden degistirilmez; ucuncu taraflara tekrar firtinasi yok (SEC 10 istek/sn).
- Commit mesaji Turkce, govdede OLCULDU ve OLCULMEDI bolumleri, sonda:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  PR aciklamasi sonunda: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## 9. Bekleyen acik teklifler (kullanici cevap vermedi)
- ABD ETF / SEC kaydi olmayan sembol icin yedek panele `INSIDER_SLOT` ekleme (`app.js` ~5916).
- E1 `pct` -> `buyZoneProximity`; E2 `pct`/`atrPct` -> `SiraKayit`;
  E3 gun tahmini (**ONERMIYORUM**); E4 satir basina `karsilastirilabilir` bayragi
  (`cmp-best`/`cmp-worst` su an BIST TL nominal buyumesini ABD dolari ile ayni cetvelde siraliyor).
- `/api/compare` korelasyonu ertelendi (motor matematigi gerekiyor).
- `genislik` (breadth) sunucuda hesaplanamiyor: evren `localStorage`'a bagli ve
  sembol basina bir TA cagrisi `maxDuration: 10`'u asiyor. Bosluk kilidi kasten kirmizi.
- `stock-page-lists-search.md` (34 KB) OKUNMADAN ONCE PARCALANMALI.
- GitHub Pages'i de acmak (Vercel ile tekrar olur) — karar bekliyor.
- Hobby -> Pro karari ertelendi; yeniden-yazim hilesi sayesinde simdilik gereksiz.

## 10. ANTHROPIC_API_KEY — gerekli ortam
Okuyan tek yer: `api/theme.js:356`. Anahtar yoksa uc 200 ile
`{ candidates: [], error: 'no_key' }` doner (ariza degil, durum bildirimi).
Model: `process.env.THEME_MODEL || 'claude-haiku-4-5-20251001'`.
Vercel projesi baglanmis durumda: `day-starter`, org `team_GlSur06swQU4ceKpaegyyw9c`.
Vercel CLI 54.9.1 kurulu.

OLCULDU 2026-10-29: `vercel env ls production` -> `ANTHROPIC_API_KEY Encrypted
Production`. Anahtari KULLANICI kendisi ekledi; ben gormedim, loglamadim.
Canli kanit: `/api/theme?q=savunma sanayi` -> HTTP 200, 20.9 sn (bu sure ~13 sn
YEREL DNS gecikmesi iceriyor, gercek sunucu suresi ~8 sn -> §12),
`model: claude-haiku-4-5-20251001`, 5 aday (RTX, LMT, BA, GD, NOC) gerekce
metinleriyle. `no_key` dali KAPANDI.
Anahtar YALNIZ Production'da; Preview ve Development'ta YOK -> preview deploy'lari
ve yerel kosu hala `{candidates:[], error:'no_key'}` doner. Gerekirse kullanici
kendisi ekler (anahtar sohbete YAZILMAZ):

    vercel env add ANTHROPIC_API_KEY preview

**UYARI:** bu uc projenin TEK ucretli yuzeyi ve istemci basina hiz siniri YOK.
Anahtar canli oldugu icin bu artik gercek bir faturalandirma acikligi (§6, 7. adim).

## 11. Telefona guncelleme — olculmus durum ve uc yol
OLCULDU 2026-10-29 (`mobile/package.json`, `app.json`, `eas.json`):
`expo-updates` YOK · `expo-dev-client` YOK · `app.json`'da `updates` /
`runtimeVersion` anahtari YOK · `cihaz` profilinde `channel` YOK
(development/preview/production'da var). Sonuc: cihazdaki yapi OTA guncelleme
ALAMAZ; her `mobile/**` degisikligi yeni yapi + Safari'den yeniden kurulum.

Hangi degisiklik nereye gider (`.vercelignore` olculdu):
| Degisen | Web sitesi | Telefon |
|---|---|---|
| `app.js`, `config.js`, `styles.css`, `index.html` | push -> aninda canli | etkilenmez |
| `api/**` | push -> aninda canli | **aninda canli** (ayni uclar) |
| `mobile/**` | HIC gitmez (`.vercelignore`) | yeni yapi gerek |

Uc yol (ucu de ucretsiz):
- **A — Expo Go**: `npx expo start` + QR, kaydettigim an yenilenir. Yapi yok,
  yeni bagimlilik yok. Laptop acik ve ayni wifi'de olmali; bagimsiz uygulama degil.
  `@expo/ui` ve `expo-glass-effect` Expo Go'da yok ama `src/` icinde HIC import
  edilmemis (olculdu, 0 eslesme) -> engel degil. **Expo Go'da acildigi OLCULMEDI.**
- **B — EAS Update / OTA**: `expo-updates` kurulur, `cihaz` profiline kanal eklenir,
  BIR kez yeni yapi; sonra her JS degisikligi `eas update` ile kendi kendine iner.
  Expo ucretsiz katmaninda var. Sarti: **yeni bagimlilik** -> acik "evet" gerek
  (`expo-updates` daha once REDDEDILMISTI). Native degisiklik (yeni paket, ikon,
  izin, bundle adi) ASLA OTA gitmez, hep yeni yapi ister.
- **C — Simdiki duzen**: her turda yeni ad-hoc yapi + yeniden kurulum.

Kurulum notu: ad-hoc iOS kurulumu `itms-services` protokolu kullanir -> link
telefonda **Safari'de** acilmali; QR okuyucu/uygulama ici goruntuleyici calismaz.
Yapi sayfasi (olculdu, HTTP 200 / 49769 bayt):
`https://expo.dev/accounts/atahanpharma/projects/sabah-bulteni/builds/db01122d-ba13-4108-bb8c-8348b7a007d3`

Sonra `preview` ve `development` icin ayni komut tekrarlanir, ardindan
`vercel --prod` ile yeniden yayina alinir. Yerel deneme icin `.env.local`
(git tarafindan yoksayiliyor; `.gitignore:33`).

## 12. "13 saniyelik uc" ARIZA DEGILDI — yerel DNS
OLCULDU 2026-10-29. `/api/arama?q=ASELS` uc kez ust uste 13.5-14.1 sn surdu, ama
faz dokumu suclunun uc OLMADIGINI gosterdi:

    dns=12.91s  baglanti=+0.03s  tls=+0.10s  ilkbayt=+0.30s  toplam=13.36s

Kanitlar:
- SIFIR is yapan cevaplar da ayni sureyi aldi: `/api/score` (400) 13.8 sn,
  `/api/news` (400) 14.2 sn, `/api/tarama` (405) 14.3 sn, 404 sayfasi 13.1 sn,
  statik `/` 13.4 sn. Yani sure HANDLER'DAN ONCE harcaniyor.
- `nslookup day-starter.vercel.app` varsayilan cozucuyle **3 kez zaman asimi**
  (10.1 sn); `nslookup day-starter.vercel.app 1.1.1.1` 0.138 sn -> `64.29.17.67`,
  `216.198.79.67`. `example.com` ilk bayt 0.25 sn (ag sağlam).
- IP sabitleyip DNS atlanınca GERCEK sunucu sureleri:
  `/api/arama?q=ASELS` **0.46 sn** · `/api/takvim` **0.25 sn** · statik `/` **0.30 sn**.

SONUC: bu gelistirme makinesinin/modeminin DNS cozucusu bu konak icin zaman
asimina dusuyor. Uçta ya da kodda onarilacak bir sey YOK; kod degisikligi
YAPILMADI. Cihazda farkli cozucuyle (mobil veri, 1.1.1.1) gorulmesi beklenmiyor
ama CIHAZDA OLCULMEDI.

**BU BOLUMUN GERIYE DONUK SONUCU:** bu oturumda DNS uzerinden alinan TUM sure
olcumleri ~13 sn sismis durumda (ornek: §10'daki `/api/theme` 20.9 sn -> gercegi
~8 sn). Sure olcumu yapacak her gelecek tur `--resolve` ile IP sabitlemeli ya da
cozucuyu degistirmeli; yoksa olculen sey uc degil, DNS olur.

## 13. Olcum gunlugu ARSIVDE (bu dosya kucultuldu 2026-11-17)
Bu dosya 4124 satira / 240 KB'a cikmisti ve her oturum bastan okunuyordu;
bagalamin buyuk bolumunu KAPANMIS islerin gunlugu yiyordu. Gunluk bolundu,
tek satir bile silinmedi:

- `docs/devam-arsiv/2026-10.md` — bolum 13-20: web<->native alan denetimi,
  serit 1-7, tasarim turu 1-2, hesabin istemciden motora tasinmasi.
- `docs/devam-arsiv/2026-11.md` — bolum 22-47: tez defteri, bildirim bayragi,
  donem yuzdesi, gelismeler/yazma eylemleri/sirket profili, bildirim senkronu,
  sepet + ust fiyat seridi + `/api/kur`, iceriden islemler, "neden hareket
  ediyor?", katalizor/risk, vade secici, nakit + hamle gunlugu, ani hareket ucu
  ve baglantisi, app'ten giden bildirim, web listelerinin aktarimi, deploy +
  iOS yapi hatasi, PROcess ad degisikligi, tasarim dili adim 3-4.

KURAL: bitmis is bu dosyada BIRIKMEZ. Kapanan bolum ayni gun ilgili ay
arsivine tasinir; kokteki DEVAM.md yalniz YASAYAN gercegi tasir
(mimari tuzaklari, kapi kumesi, bekleyen is, politika, acik teklifler).

## 14. Guncel durum (2026-11-17)
Bolum 4'teki olcum 2026-10-29 tarihli ve BAYAT; o gunun dokumu arsivde.
Bugun olculen: PROcess tasarim dili adim 1-4 TAMAM (mavi vurgu, rejim grafigi,
akilli etiket seridi + Wall Street hedef fiyati, tematik sonucta tek dokunus).
Kapilar: parite FARK 0/29 · uc-test 2469 (27 uc) · uretim 73 · nabiz-yon 40 ·
nabiz-alan 128/128 · engine EXIT 0 · metin-test EXIT 0 · duman EXIT 0 ·
mobile `tsc --noEmit -p tsconfig.json` EXIT 0 · dokunulan dosyalarda eslint EXIT 0.
Fonksiyon sayisi 12 (Vercel Hobby siniri; 13. sessizce patlar).
OLCULMEDI: hicbir ekran CIHAZDA goruntulenmedi; commit/push/yapi YOK.
ACIK KUSUR (bu farkin disinda): depo genelinde `npx eslint .` EXIT 1 —
tek kaynak `mobile/scripts/ikon-uret.mjs` (11 x `no-undef 'Buffer'`).
Tikayici: Adim 5 (yayin) tamamen kullanicinin Apple hesabina bagli —
`ascAppId`, APNs .p8 + `PUSH_SECRET`, App Privacy anketi.

## 15. ONAY / MALIYET BEKLEYENLER (yan liste - CANLI TUTULUYOR)

Kullanici talimati (2026-11-03): "maliyet hesaplarini ve benim onaylarimi
yanda bir listede beklet". Bu bolum sohbette tekrar edilmez; karar gerektiren
her sey BURAYA yazilir. Sutunlar: durum · hangi adimda cevaplanmasi gerekir.

### 21.1 Onay bekleyen kararlar

| # | Karar | Oneri | Ne zaman cevaplanmali |
|---|-------|-------|-----------------------|
| 7 | KriptoKart / MetalKart ekran yeri | TASIMA YOK - durduklari yerde kalsin | Tasarim turu 3'te (menu duzeni dokunulmadan) |
| 8 | OTA ilk acilis `fallbackToCacheTimeout` | 0 = onbellekten AC, guncellemeyi SESSIZ indir | Store build'i hazirlanmadan ONCE |
| 9 | Tez gunlugu nerede saklanacak | ~~Simdi CIHAZDA; Supabase FAZ 4'te~~ **UYGULANDI 2026-11-03** (§22): defter CIHAZDA (`sb:theses`, webin anahtari), yeni uc YOK, Vercel yuvasi harcanmadi. Webin ISTEMCIDEKI gosterge aritmetigi (`(price-stop)/(target-stop)`, `(target-price)/price*100`) PORTLANMADI -> "hedefe % kac kaldi" sayisi app'te YOK. | ACIK KALAN: cihazlar arasi senkron + yuzde uzakligi MOTORA tasima -> FAZ 4 (Supabase) karari |
| 10 | `/api/theme` istemci basina hiz siniri | Sinir SART - canli anahtar = faturalandirma riski | PARALI KATMANDAN VE maliyet hesabindan ONCE (ENGELLEYICI) |

### 21.2 Maliyet hesabi bekleyen kalemler

| # | Kalem | Olculen durum | Karar aninda |
|---|-------|---------------|--------------|
| M1 | `bigHeadlines` / `pmBig` 3. besleme | Sunucu yolu SU AN 6 paralel istek × 6 sn zaman asimi, `maxDuration 10` altinda. 7. istek bu aritmetigi DEGISTIRIR - olculmedi. | Nabiz karti "web = app" sayilmadan once; olcum yapilmadan eklenmez |
| M2 | Sabit evren uzerinde sembol basina TA maliyeti | `genislik` + `gunDegisimleri`ni sunucu yolunda uretmek icin gerekli. Sembol basina sure OLCULMEDI. | Sabit-evren seridi baslamadan once (ENGELLEYICI: olcum olmadan kod yazilmaz) |
| M3 | Vercel Hobby 12 fonksiyon tavani | TAVANDAYIZ. 13. fonksiyon sessizce patlatir, hata YALNIZ preview deploy'da gorunur. | Yeni uc gerektiren ilk kalemde ya da yayin aninda (Pro karari) |
| M4 | Parali katman maliyet modeli (LLM + RevenueCat + Supabase) | Hic hesaplanmadi. | FAZ 4 baslamadan once; 21.1 #10 ONDEN cozulmus olmali |
| M5 | `npm audit` 15 zafiyet (5 low / 3 moderate / 7 high) | `audit fix` KOSTURULMADI - kirma riski olculmedi. | Store build'inden once |

### 21.3 Bana kapali olanlar (kullanicinin kendi yapacagi)

- Commit / push: her degisiklik icin TAZE, acik "evet". Force-push yok, rebase yok.
- Deploy: kullanici kendisi yapacagini ilan etti.
- Apple ID sifresi ve 2FA kodu: kullanici kendi terminal sekmesinde girer.
- App Store Connect uygulama kaydi (kategori Finance) -> sonra `ascAppId`.

### 20.16 `/api/degisim` + `/api/kripto` + `/api/metal` — native baglanti KURULDU (2026-11-03)

OLCULDU (kaynak okuma; CANLI CAGRI YOK, yerel DNS kirik - bkz. 12):
- `mobile/src/api/types.ts`: `FiyatSayac`, `DEGISIM_DONEMLER/AZAMI_SEMBOL/DONEM_ALANLARI`,
  `DegisimSatir/Response/ErrorCode`, `KRIPTO_AZAMI_ID/ID_BICIM`, `KriptoCoin/Kuresel/Response/ErrorCode`,
  `METAL_MADENLER/KAPSAMLAR/AZAMI_LIMIT/VARSAYILAN_LIMIT`, `VARSAYILAN_METAL_KAPSAM`,
  `MetalSatir/Response/ErrorCode` eklendi (2472 -> 2755 satir).
- `mobile/src/api/client.ts`: `ENDPOINTS.degisim/kripto/metal` + `fetchDegisim`, `fetchKripto`,
  `fetchMetal`. Kapilar ucun kendi kodlariyla, cumle `kesifKapi`nin 3. argumaniyla ACIKCA
  geciliyor (`cok_sembol` sozlukte BACKTEST, `bad_limit` ARAMA cumlesine bagli - carpisma).
- `index.ts` dokunulmadi: `export * from './client'` ucunu de aciyor.

KAPILAR: TSC 0 · eslint 0 · `mobile` npm test 79 · uc-test 1787 · uretim-test 73.

TUZAKLAR (kart adiminda unutma):
- `/api/metal` FIYAT UCU DEGIL -> uc maden icin HABER MADDESI. Fiyat = `fetchDegisim(['GC=F'])`.
  Uc `ysym`den yalniz `GC=F` degisim ucuna verilebiliyor (`SI=F`/`PL=F` sembol kapisindan gecmiyor).
- `DegisimResponse.semboller` = `"PAZAR:SEMBOL"`, cagirani yansitmiyor.
- Her donem IKI alan yaziyor (yuzde + referans fiyat): alan adi `DEGISIM_DONEM_ALANLARI`den okunur.
- `kripto.kuresel`: alan YOK = sormadim, `null` = olcemedim. `maxSupplyAdet: null` = SINIRSIZ, olculemedi degil.
- Taninmayan kripto kimligini ust kaynak sessizce dusuruyor ve `tam`i DUSURMUYOR -> eksik
  `idler.length` ↔ `coinler.length` farkindan gorulur.

SIRADAKI: bu uc ucun KARTLARI (Kesfet/Bugun), sonra `c.note` (#12).

### 20.17 Uc yeni ucun KARTLARI — ekrana ulasti (2026-11-03)

§20.16'da baglanan uc ucun (`/api/degisim`, `/api/kripto`, `/api/metal`) artik EKRAN
yuzu var. YENI SEKME ACILMADI, `(tabs)/_layout.tsx` ACILMADI, 5 menu duzeni ayni.

OLUSTURULAN KARTLAR
- `mobile/src/components/bugun/DonemDegisimKarti.tsx` — `/api/degisim`.
  Evren SABIT: `ENDEKS_SEMBOLLER` (S&P 500 · Nasdaq · ons altin · BIST 100); altyazi
  bunu DURUSTCE yaziyor ("takip listen degil") ve takip listesi uca GONDERILMIYOR.
  Alti donem her biri kendi yuzdesi + o yuzdeyi kuran REFERANS fiyatla basiliyor
  (`DEGISIM_DONEM_ALANLARI`). `donemler` GONDERILMIYOR -> uc kendi "hepsi"sini
  uyguluyor. Yon renkle DEGIL isaretle de tasiniyor (▲ / ▼ / •).
- `mobile/src/components/kesfet/KriptoKart.tsx` — `/api/kripto`.
  Kimlik listesi SABIT (CoinGecko KIMLIGI, sembol degil). `kuresel` cipi; o alanin
  UC DURUMU ayri cizilyor (alan yok = sormadim / `null` = olcemedim / bos sozluk =
  olctum sonuc yok). `dusen = sorulan - coinler.length` KUNYEYE basiliyor, cunku ust
  kaynak taninmayan kimligi sessizce dusuruyor ve `tam`i dusurmuyor.
  `maxSupplyAdet === null` -> "ust sinir yok" (olculemedi DEGIL). Sparkline istenmedi.
- `mobile/src/components/kesfet/MadenHaberKart.tsx` — `/api/metal`.
  Basligi "🪙 Maden haberi", altyazisi fiyatin BU UCTA OLMADIGINI ve nerede oldugunu
  yaziyor. Kapsam cipi (`hepsi` / `tr` / `dunya`) var, cunku kapsam CEVABIN SEKLINI
  degistiriyor: `tr` secilince satirda `dunya` alani HIC GELMIYOR -> o alan yoksa
  hicbir sey cizilmiyor. Gercekten BESLEME okudugu icin `HaberOlcumEksikRozet` +
  `OlcemedimKutu` kullaniliyor; `HaberSatiri` yeniden kullanildi.

NIYE IKI FIYAT KARTI `HaberOlcumEksikRozet` KULLANMIYOR
Rozetin cumleleri "besleme" diyor; Yahoo/CoinGecko icin bu YANLIS olurdu. Iki fiyat
karti sayacini "ust kaynak istegi: ..." diye KUNYEDE ham basiyor. `Durum.tsx`
DEGISTIRILMEDI.

BAGLAMA
- `mobile/src/components/bugun/index.ts` (-> 2394 bayt) ve
  `mobile/src/components/kesfet/index.ts` (-> 3805 bayt): her girisin NIYE'si yazili.
- `(tabs)/bugun.tsx`: `<DonemDegisimKarti onSembol={hisseAc} />`, `<TakvimKart />`
  hemen ardinda.
- `(tabs)/kesfet.tsx`: `<KriptoKart />` + `<MadenHaberKart />`, `<TemaKart />`
  ardinda, oneri dalinin DISINDA.

KAPILAR (hepsi yesil)
- `tsc --noEmit` -> 0 · `eslint` (7 dosya) -> 0
- `cd mobile && npm test` -> 79 · `node tests/uc-test.mjs` -> 1787
- `node tests/uretim-test.mjs` -> 73
(API, motor ve test dosyasi bu seritte ACILMADI; sayilar bu yuzden degismedi.)

OLCULMEDI — TASINAN DURUSTLUK
- Bu uc kartin HICBIRI bir CIHAZDA cizilmedi. Expo/Metro kosmadi, simulator yok,
  ekran goruntusu yok. Tum iddia tip/lint/politika/fikstur kapilarina dayaniyor.
- Uc cekicinin HICBIRI CANLI cagrilmadi (yerel DNS kirik, §12): dolu bir
  `DegisimSatir` / `KriptoCoin` / `MetalSatir` HENUZ GORULMEDI. Kartlarin dolu-veri
  yerlesimi olculmemis durumda.
- `api/_degisim.js`, `api/_kripto.js`, `api/_metal.js` HALA izlenmiyor (`??`).
- Commit/push YOK — taze ve acik "evet" gerekiyor; deploy'u kullanici yapacak.

SIRADAKI: `c.note` (#12), kendi parite kosusunda.

### 20.18 FA kriterinin CUMLESI native'e ulasti (#12, 2026-11-03)

Web'de her temel kriterin bir `note` cumlesi vardi (`app.js bistFundamentalModel` /
`secFetchModel`), ama `api/_akis.js` kriteri `{key, weight, score}`e KIRPIYORDU: ne
cumle ne cumlenin dayandigi ham sayi native'e ulasiyordu. Kapandi. Cumle TELDE
TASINMIYOR — uc MAKINE KODU + HAM SAYI gonderiyor, cumleyi native kuruyor.

OLCULDU — MOTOR
- `app.js` `fa-core` diliminde `faKriterKod(key, s, pazar)` ve
  `faKriterIsaretle(C, sozluk, pazar)`. Esik TEK YERDE: kademeleri (netMargin,
  ndEbitda, d2e) yalniz `faKriterKod` biliyor.
- Iki FA modeli de (BIST + SEC) kriterlere `sayilar` + `kod` isliyor; `faPeCriterion`
  kendi kodunu tasiyor. `EXPORTS` genisletildi.
- Motor yeniden uretildi: sha256:1d4641571813deea · 3632 satir / 33 dilim.
- `api/_akis.js` her iki ayakta `criteria.map(kriterTel)` gonderiyor.
- Parite: 632 farkin 632'si EKLENEN `fa.criteria[*].kod` / `[*].sayilar` anahtari,
  `BASKA fark: 0`. Sonra `node tests/baseline.mjs --zorla`. Simdi `FARK 0 · 29 nokta`.

OLCULDU — NATIVE
- `mobile/src/api/types.ts`: `FaCriterion` -> `kod?: string | null` +
  `sayilar?: Record<string, number | string> | null`. Uc durum TELDE korunuyor
  (alan yok = sorulmadi · `null` = olculemedi · dolu = dal belli).
- `mobile/src/lib/sozluk.ts`: `FA_KRITER_SOZLUK` — 37 kod -> 37 Turkce cumle.
  CUMLELERDE SAYI YOK: "cift haneli" gibi esigi aciga vuran ifade bilincli
  yazilmadi, cunku motor esigi degistiginde ekran sessizce yanlis cumleyi basardi.
  Cumle yalniz DALIN ADINI soyluyor ("guclu kademede"); sayiyi kullanici
  `sayilar`dan ham goruyor. Kod sozlukte yoksa cumle de yok (`sozluktenSec`).
- `mobile/src/components/detay/TemelKart.tsx`: `FA_SAYI_ALANI` (ad + bicim eslemesi,
  hesap yok) + `faSayiSatiri()`. Sonlu olmayan alan ATLANIR -> olculmeyen sayi icin
  `0` BASILMIYOR. Bilinmeyen alan adi gizlenmiyor, ham adiyla notr bicimde basiliyor.
  `onceki`/`simdi` NOTR bicimde, cunku kriterden kritere yuzde puani ya da oran
  tasiyorlar — birim UYDURULMADI. Eski "note telde YOK" paragrafi silindi.

OLCULDU — SURUKLEME BEKCISI (`tests/uc-test.mjs` ⑲, +11 denetim)
- STATIK KUME ESITLIGI: `api/_motor.js`'in `faKriterKod` govdesindeki `'x.y'`
  sabitleri (37) ile `mobile/src/lib/sozluk.ts`'teki `FA_KRITER_SOZLUK` anahtarlari
  (37) BIREBIR. Iki yon de kirmizi: motora yeni dal eklenip sozluge yazilmazsa da,
  sozlukte olu kod kalirsa da test duser. Ek kapi: sozluk cumlelerinde RAKAM yok.
- CEVRIMDISI BIST FIKSTURU: `buildEngine()` -> `parseIsMali(loadMali(sym))` ->
  `bistFundamentalModel(mali, null)` (fiyatsiz calisiyor, AG YOK). 10 sembol
  (`tests/fixtures/isyatirim/`), 160 kriter: hepsi `kod` tasiyor, hepsinin en az bir
  SONLU ham sayisi var. Bu ayni zamanda projenin ILK BIST temel-model kapisi.
- Bu bolum `mobile/src`'i okuyan ILK uc testi — bilincli bagimlilik.

OLCULMEDI
- EKRANDA HICBIR SEY GORULMEDI. Yeni cumle ve ham sayi satirlari bir cihazda ya da
  simulatorde CIZILMEDI (Expo/Metro acilmadi, ekran goruntusu yok). Dogrulanan sey
  TIP + KAPI, piksel degil.
- Canli uca HIC istek atilmadi; `kod`/`sayilar` yalniz fiksturde goruldu.
- Fikstur 37 daldan 26'sini geziyor. Gezilmeyen 11 dal (ornegin `netMargin.zarar`,
  `pe.negatif`, `cashLt.borc-yok`, `d2e.yuksek`) sozlukte VAR ama hic kosulmadi —
  cumlelerinin dogrulugu okuma ile, olcum ile degil.
- ABD (SEC) ayaginin kriterleri bu bolumde SINANMADI: fikstur kapisi yalniz BIST.

KAPILAR (hepsi yesil)
- `node tools/motor-uret.mjs` -> sha256:1d4641571813deea · `tests/uretim-test.mjs` 73
- `node tests/uc-test.mjs` -> 1798 · `node tests/parity.mjs` -> FARK 0 / 29 nokta
- `tsc --noEmit` -> 0 · `eslint` (3 dosya) -> 0 · `cd mobile && npm test` -> 79

### 20.19 `📰 Hisse Haberleri` — webin `news` sekmesi native'e ulasti (2026-11-03)

Webin `index.html:78` sekmesi (`📰 Hisse Haberleri`, `app.js loadUnifiedNews`)
native'de YOKTU. Ucun coklu-sembol kipi (②) uretimde CANLIYDI, `mobile/`
icinden hic cagrilmiyordu.

DOKUNULAN DOSYALAR
- `mobile/src/api/types.ts` — `SembolHaberSatiri` + `HisseHaberleriResponse` (onceki tur)
- `mobile/src/api/client.ts` — `fetchHisseHaberleri` + `HisseHaberleriOptions` (onceki tur)
- `mobile/src/components/bugun/HisseHaberleriKarti.tsx` — YENI kart
- `mobile/src/components/bugun/index.ts` — ad ad dis satim
- `mobile/src/app/(tabs)/bugun.tsx` — `DonemDegisimKarti`'nin ardina takildi
- `mobile/src/api/index.ts` — DOKUNULMADI (`export * from './client'` yeterli)

OLCULDU
- `api/_girdi.js temizleSembol`: pazar SEMBOL BASINA cozuluyor
  (`else if (s.endsWith('.IS')) { pazar = 'BIST'; s = s.slice(0, -3); }`).
  Bu yuzden KARISIK takip listesi TEK istekte gidiyor: pazar secen dugme
  YOK, iki paralel cagri YOK, istemcide gruplama YOK.
- `api/news.js:631-634`: satir basina `adet` + `tam`. Kart `adet:0 && tam`
  ("haber yok", OLCUM) ile `!tam` ("olcemedim") icin AYRI cumle/rozet
  basiyor — tek cumlede birlesmiyor.
- `api/news.js:129`: `type` DAIMA `'NEWS'` → bu uc KAP URETMIYOR. Kart
  KAP'in `🗓️ Takvim`'de oldugunu ACIKCA yaziyor; iki kaynak
  BIRLESTIRILMEDI (webden bilincli sapma).
- `liste.ts BASLANGIC_LISTE` iki pazardan karisik, `useListe(): string[]`
  ham sembolu sonekiyle tutuyor → liste OLDUGU GIBI gonderiliyor.
- `AZAMI_SEMBOL = 8` (`types.ts:34`), `AZAMI_SORGU = 128` (`client.ts:258`).
  Liste 8'den uzunsa kac sembolun DISARIDA kaldigi yaziliyor; sessiz kirpma
  yok.
- `HaberSatiri.tsx:30`: `symbol` bos ise rozet HIC basilmiyor → duz
  `maddeler` listesi sembol rozetiyle bedavaya cizilyor, yeni satir
  bileseni gerekmedi.
- Sembol suzgeci bir SECIM: maddenin ucun yazdigi `symbol` alanina bakiyor,
  baslikdan sembol cikarmiyor. `symbol` bos olan madde suzgec acikken
  gosterilmiyor.
- `duyarlilik` ozeti YALNIZ `!eksik && !secili` iken basiliyor: yarim
  beslemenin ya da suzulmus alt kumenin birlesik puani listeyi temsil
  etmiyor.
- Kapilar YESIL: `tsc --noEmit` 0 · `eslint` (3 dosya) 0 ·
  `cd mobile && npm test` ✅ 79 · `node tests/uc-test.mjs` ✅ 1798.

OLCULMEDI
- CANLI istek YOK: `fetchHisseHaberleri` hic ag uzerinden kosmadi (§12 DNS).
  Kartin `veri` dali CIHAZDA HIC cizilmedi — hicbir ekran goruntusu yok.
- `semboller[].symbol` CIPLAK kod donuyor (`THYAO`, `THYAO.IS` degil);
  satir etiketleri takip listesi dizgileriyle BIREBIR ayni olmayacak. Bu
  kodla ispatlandi, ekranda gorulmedi.
- Uc yineleyen sembolu SESSIZCE atiyor (`_girdi.js gorulen.has`), bu yuzden
  `semboller.length` istenenden KUCUK olabilir — kart `satirlar.length`
  basiyor ama bu sapma cihazda gorulmedi.
- `duyarlilik` alaninin DOLU geldigi hic gorulmedi.
- (KAPANDI, ayni tur) uc-test'e kip ② denetimleri eklendi: `⑭j` (uc
  sozlesmesi, agsiz: `cok_sembol`/`bad_symbol`/`bad_market`/`limit_buyuk`/
  `bad_limit` + ag yasagi olcumu), `⑭j②` (pazar SEMBOL BASINA cozuluyor:
  `.IS` → BIST, donen kod CIPLAK, bilinmeyen sonek `null`, `PAZAR_ESLEME`
  ortak pazar kumesini kapatiyor) ve `⑭j③` (satir basina durustlugun
  statik bekcileri). `node tests/uc-test.mjs` 1798 → ✅ 1820.

### 20.20 `⚡ Momentum girisi` — webin son acik sekmesi native'e ulasti (2026-11-03)

Webin `#tab-momentum` sekmesinin (`index.html:203`) native karsiligi YOKTU.
Rejim native'de yalniz TEK sembolun detayinda basiliyordu
(`mobile/src/components/detay/RiskOdulKart.tsx:319`); "evrende momentumu
acik olanlar hangileri" sorusunun native'de cevabi yoktu.

**ÖLÇÜLDÜ**
- Webin o sekmesi evreni TARAYICIDA tariyor: `app.js:8127
  scanMomentumUniverse` → her sembol icin `ensureDailyCandles` +
  `computeVadeScore(daily,'orta',undefined,bench)` + `momentumInfo(res,'orta')`,
  eszamanlilik 4, 8 dk tazelik penceresi; `mom.active` olanlar kaliyor ve
  `(b.mom.adx||0)-(a.mom.adx||0) || (b.score-a.score)` ile diziliyor
  (`app.js:8154`).
- AYNI karar sunucuda ZATEN uretiliyor: `api/_akis.js:305`
  `momentum: hamYuvarla(eng.momentumInfo(r, vade))`. Esiklerin tamami
  motorda: `api/_motor.js:981` (ADX ≥ 22, skor ≥ 56, banda bosluk vade
  esigi `{gunici 0.02, kisa 0.03, orta 0.05, uzun 0.08}`).
- Kesfet ekrani o turu HALIHAZIRDA atiyor: `app/(tabs)/kesfet.tsx:96`
  `fetchRecommend(liste, { vade: 'orta', signal })` — webin o sekmesiyle
  AYNI vade, AYNI evren (kullanicinin takip listesi).
- **Sonuc: YENI UC YOK, YENI ISTEK YOK, YENI VERCEL YUVASI YOK** (§21 M3
  tavanina dokunulmadi). Kart odenmis turun okunmayan uzvunu basiyor.
- Yeni dosya `mobile/src/components/kesfet/MomentumKart.tsx`: `plan.momentum.active
  === true` suzgeci (motorun BOOLEAN'i — native'de esik yok), `.slice().sort()`
  ile ADX → teknik skor sirasi (siralama hesap degil; kopya uzerinde, cunku
  ayni diziyi `FirsatlarKart` da okuyor), satir basina ADX
  (`formatOran(...,1)`), banda bosluk (`formatOran(...,4)`, **×100 YOK**) ve
  momentum alim bandi (`formatPrice` + pazar para birimi).
- `gapPct` olcegi `RiskOdulKart` ile BIREBIR: ikisi de KESIR basiyor ve
  olcegi altyazi soyluyor. Web o sekmede `Math.round(gapPct*100)` yaziyor —
  native tek olcekte kaldi, cunku ayni alanin tek uygulamada iki olcekte
  gorunmesi kullaniciyi yanlis okutur.
- `zone` tipte ad ile yok (`PlanMomentum`'un `[k: string]: unknown`
  imzasindan geliyor): yerel `sayiDizisi()` kapisindan geciyor, tip
  genisletilmedi (RiskOdulKart'taki gerekcenin aynisi).
- UC AYRI BOSLUK ayri cumlelerde: (1) hicbir satirda rejim olculmedi
  (`plan === null`), (2) olculdu ama hicbiri acik degil — bu bir OLCUM,
  eksik veri degil, (3) bir kismi olculemedi → acik satirlarin yaninda
  AYRI not + sayi. Webin tek cumlesi ("uygun hisse yok") bu ucunu
  ayirmiyordu.
- Liste etiketi BASILMIYOR (web `app.js:8164 momListsFor` basiyor): webde
  evren BIRDEN COK kullanici listesinin birlesimi, native'de takip listesi
  TEK (`api/liste.ts`) — etiket her satirda ayni seyi yazardi. Gerekce kod
  basliginda yazili, alan sessizce dusurulmedi.
- Montaj: `components/kesfet/index.ts` bareline export + `kesfet.tsx` icinde
  `<FirsatlarKart>`in HEMEN ARDINDA, ayni `durum === 'veri' && satirlar.length`
  dalinda (ikisi de ekranin kendi turundan besleniyor).
- Yeni uc-test bolumu `⑳` (16 kapi): tel sozlesmesi (`_akis.js` uzvu),
  kartta `fetch` yok, ekranda tek `fetchRecommend` CAGRISI, suzgec motorun
  bayragi, kartta motorun esigi (22/56/0.05) YOK, olcek RiskOdulKart ile
  ayni, `formatPercent` ve `*100` yok, `.slice().sort()`, uc bosluk dalinin
  varligi, export + mount. Kapilar KODU olcuyor: yerel `yorumsuz()` ile
  gerekce satirlari ayiklaniyor (dosya basligi webin `*100` satirini
  ALINTILIYOR — ilk kosuda tam bu yuzden iki kapi kirmizi yandi).
- Kapilar: `node tests/uc-test.mjs` 1820 → **✅ 1836**; `cd mobile && npx tsc
  --noEmit` **0**; `npx eslint` (uc dokunulan dosya) **0**; `cd mobile && npm
  test` **✅ 79**; `node tests/uretim-test.mjs` **✅ 73**; `node tests/parity.mjs`
  **✅ FARK 0 / 29 nokta**. Motor dosyalarina DOKUNULMADI.

**ÖLÇÜLMEDİ**
- Kart CIHAZDA HIC CIZILMEDI. Hicbir ekran goruntusu yok (Expo/Metro
  kosmadi). Kapilar "kod dogru yeri okuyor" der, "ekranda dogru duruyor"
  DEMEZ.
- `veri` dalinin DOLU hali hic gorulmedi: canli `/api/recommend` cagrilmadi
  (§12 DNS). Yani "rejim acik" bir satirin gercekten nasil gorundugu
  bilinmiyor; `zone` alaninin telde GERCEKTEN geldigi de yalniz motor
  kodundan (`_motor.js:995`) biliniyor, canli cevaptan DEGIL.
- Hangi dalin cihazda sik gorulecegi bilinmiyor: motorun esikleri birlikte
  saglandiginda rejim aciliyor ve bu listede cogu zaman SIFIR satir olmasi
  beklenir. "Bos gorunen kart" ile "bozuk kart" ayrimini kullanicinin
  gozuyle test etmedik.
- Web ile native SIRALAMA aynisi degil: web `res.score` (vade skoru)
  kullaniyor, native `ta.score` (ucun donen teknik skoru). Ikisinin ayni
  sayi oldugu KOD UZERINDE bekleniyor ama iki tarafta yan yana
  OLCULMEDI.
- Webin 8 dk'lik tazelik penceresi native'de YOK: tazelik ekranin
  `useIstek` davranisina bagli, ayrica olculmedi.


## 16. Sahipler paneli + hacim grafigi (2026-11-19 olcumu)

Kullanici istegi (yapistirilmis blok): alim-satim hacim grafigi, hisse
sayfasinda politikacilar/en buyuk 10 hissedar/bariz islemler, Perplexity
Finance "Sahipler" sekmesi (Politikacilar - Iceridekiler - Kurumsal),
Kesfet'e Politikacilar bolumu, ve volatilitenin TA motoruna katilmasi.

### 16.1 YAPILDI (web, commit YOK)
- **Hacim grafigi** (istek 2a): `TA_IND_GROUPS` 9. girdi `hacim`, varsayilan
  ACIK, `drawTAChart` icinde `addHistogramSeries` + `priceScaleId: 'hacim'`,
  `scaleMargins {top:0.78, bottom:0}`. Veri YENI UC GEREKTIRMEDI -
  `api/chart.js` zaten `mumlar[i].volume` tasiyor. Hacmi `null` olan mum
  ATLANIYOR (null, 0 degil).
- **`api/_sahipler.js`** (yeni, 234 satir): kurumsal / fonlar / ozet /
  iceridekiler / islemler / netAktivite / politikacilar. Kaynak Yahoo
  `quoteSummary` (modul kumesi: institutionOwnership, fundOwnership,
  majorHoldersBreakdown, insiderHolders, insiderTransactions,
  netSharePurchaseActivity). `_` dosyasi cunku api/ tam 12 fonksiyonda.
  `vercel.json` yeniden-yazimi + `proxy.js` TASIYICILAR girdisi (import
  belirteci LITERAL - degisken olursa Vercel izlemiyor ve rota 404 veriyor).
- **Web sunum katmani** (`app.js`): `SAHIPLER_SLOT`, `sahiplerShell`,
  `sahiplerGovde`, `fillSahipler`; US ve BIST dallarinin ikisine de baglandi.
  ESIK SUNUMDA: uc yalniz dolara gore siraliyor, "bariz miktar" kesmesi
  (`ISLEM_UST = 8`) sunumda - BAGIMLILIK_GRAFIGI.md 5.1 siniri korundu.

### 16.2 Kapilar (hepsi yesil)
`tools/motor-uret.mjs` **degisiklik yok** (ikisi de: `_motor.js`
sha256:4dc3809a91adbc51 3773 satir/33 dilim, `_ayar.js`
sha256:75512c5271a89b33) - yani sunum isi MOTORA DOKUNMADI.
`tests/engine.mjs` 125 sembol · `tests/metin.mjs` temiz ·
`tests/parity.mjs` **FARK 0 / 29 nokta** · `tests/uc-test.mjs` **2488 denetim**
(2469 -> 2488) · `api/*.js` `_` olmayan sayim **12** (Hobby siniri saglam) ·
`new Function(app.js)` SYNTAX OK · yalnizLF 0 (CRLF bozulmadi).

### 16.3 Render kaniti (tarayici YOK, metin dilimi eval edildi)
Scratchpad `render-test.mjs`: `app.js`ten sahipler dilimi kesilip `new
Function` ile kosturuldu, GERCEK `sahiplerHandler` cevabi beslendi.
- AAPL US -> kod 200, 6 bolum basligi, **38 satir**, 12.844 karakter,
  `undefined`/`NaN`/`>null<` sizintisi YOK, uyari metni var.
- THYAO BIST -> kod 200, 6 baslik, **0 satir**, 1.688 karakter, sizinti YOK.

### 16.4 OLCULDU: BIST veri boslugu (ariza DEGIL)
THYAO/ASELS/GARAN ucten dogru `.IS` sembolu ve DOLU `ozet` donuyor
(THYAO: icerideYuzde 0.49122003, kurumsalYuzde 0.1153, kurumsalAdet 141)
ama `kurumsal`, `iceridekiler`, `islemler` UCU DE `null`, `hata` da `null`.
Yahoo BIST icin kisi bazinda liste VERMIYOR. Bos tablo veya 0 BASILMADI;
bolumler kullaniciyi ayni sayfadaki KAP "Iceriden islemler" panelini
gosteren metne yonlendiriyor.

### 16.5 POLITIKACILAR - CALISAN UCRETSIZ KAYNAK YOK (karar bekliyor)
Olculen cikmaz sokaklar (tarih 2026-11-19, tam liste `api/_sahipler.js`
basliginda):
- house-stock-watcher ve senate-stock-watcher S3 kovalari -> **HTTP 403**
- tracefour.com rotalari -> HTML/404, api.tracefour.com -> baglanamadi
- congressinvests.com/api/trades -> 404 · api.bargo.ai -> HTTP 000
- disclosures-clerk.house.gov 2026FD.zip -> HTTP 200 (66.320 B) ama icinde
  YALNIZ bildirim dizini: Prefix/Last/First/FilingType/StateDst/Year/
  FilingDate/DocID. **SEMBOL YOK, TUTAR YOK.** Ayrinti DocID basina PDF ve
  bu PDF'ler siklikla TARANMIS GORUNTU -> OCR olmadan ayristirilamaz.
- (DUZELTME 2026-11-20, 16.9'a bak: Perplexity'nin politikaci kaynagi
  Unusual Whales DEGIL. Kendi dipnoti: finansal bilgi = Financial Modeling
  Prep, OPSIYON verisi = Unusual Whales. Onceki satir yanlisti.)
- **ONEMLI:** STOCK Act bildirimleri zaten **TUTAR ARALIGI** veriyor
  ($1.001-$15.000 gibi) - KESIN DOLAR DEGIL. Yani kullanicinin istedigi
  "kac lot ve kac dolarlik" sayisi UCRETLI kaynakta da TAM YOK.
Bu yuzden bolum sayi BASMIYOR, durumu SOYLUYOR. Saglayici secilince yalniz
`politikaciCek()` dolacak, cevap SEKLI degismeyecek.
Ayrica: genis kaynak taramasi auto-mode siniflandiricisi tarafindan
ENGELLENDI ("[Unauthorized Access]"; curl -> house/senate stock-watcher,
api.quiverquant.com, efdsearch.senate.gov, capitoltrades.com). Etrafindan
dolanilmadi. Kullaniciya bir izin kurali gerekebilir.

### 16.6 ALIM BOLGESI metrikleri (kullanicinin 1. sorusu)
`app.js:1240-1300`. Aday destek/direnc kumesi: Hacim Profili VAL/VAH/POC +
Bollinger ust/alt + SMA50 + SMA200 + son 250 barin Fibonacci merdiveni.
Capa (`supAnchor`) = fiyattan ATR olcekli bir "erisim" kadar UZAKTAKI
adaylarin EN YAKINI: `buyReach` gunici 0.8 / kisa 1.2 / orta 2 / uzun 3 x ATR.
Bant yarim genisligi `zMult` gunici 0.5 / kisa 0.75 / orta 1.1 / uzun 1.5 x ATR.
Ust kenar GUNCEL FIYATA KIRPILIYOR (`Math.min(supAnchor + hw, price)`).
Yani bizim bolge VOLATILITE OLCEKLI ve VADEYE BAGLI; analist genelde tek
sabit yatay seviye cizer. Fark burada dogar - ikisi ayni sey DEGIL.

### 16.7 VOLATILITE motora katilirsa SKOR KAYAR (karar bekliyor)
`config.js:116-141` - dort vadenin HICBIRINDE ATR/volatilite agirligi YOK:
gunici trend .06 macd .13 rsi .13 stoch .13 boll .11 obv .08 vp .12 oflow .16 volconf .08
kisa trend .10 ichimoku .05 macd .11 rsi .15 stoch .11 boll .11 obv .07 vp .12 oflow .06 rs .07 volconf .05
orta trend .18 ichimoku .13 macd .17 rsi .10 stoch .04 boll .05 obv .10 vp .09 rs .09 ttmpl .05
uzun trend .25 ichimoku .20 macd .16 rsi .08 obv .10 vp .09 rs .07 ttmpl .05
Eklemek `config.js` agirliklarini VE `app.js` skor dilimlerini degistirir,
`node tools/motor-uret.mjs` gerektirir ve "Motorun urettigi skor degeri
hicbir degisiklikte kaymayacak" kuralina + `tests/parity.mjs` /
`tests/baseline.json` kapilarina CARPAR. Acik "evet" olmadan ELLENMEDI.

### 16.8 BEKLEYEN
- Istek 4 (Kesfet Politikacilar bolumu) -> 16.5'teki saglayici kararina bagli.
- Istek 2b (volatilite motorda) -> 16.7'deki acik onaya bagli.
- Native'e port -> kullanici webi degerlendirdikten SONRA.
- Commit/push YOK. DEVAM.md 5/8: "ayri, taze, acik evet" gerekiyor.

### 16.9 OLCULDU 2026-11-20: PERPLEXITY'NIN KAYNAGI + SAGLAYICI TABLOSU
Yontem: WebFetch FMP'de HTTP 403 verdi; TARAYICI BOLMESI calisti. Asagidaki
her satir birinci elden okundu (arama sonucu degil).

PERPLEXITY (perplexity.ai/finance, Turkce servis ediliyor):
- Sayfanin kendi dipnotu: "Finansal bilgiler Financial Modeling Prep
  tarafindan saglanmaktadir. Opsiyon verileri Unus[ual Whales]..."
- Ust menude "Politikacilar" sekmesi VAR (olculdu).
- Diger atiflar: Quartr (bilanco sunumu/transkript), Fiscal.ai (gelir/EPS),
  Polymarket (tahmin piyasalari), FactSet/S&P Global (tahminler).
- SONUC: Unusual Whales onlarin OPSIYON saglayicisi. Politikaci bacagini
  neredeyse kesin FMP'den aliyorlar - cunku FMP sembol bazli senate/house
  trade ucunu SATIYOR (asagi). Bu CIKARIM, Perplexity'nin "politikaci
  verisini X'ten aliyoruz" diyen bir cumlesi DEGIL.

FMP (financialmodelingprep.com) - OLCULDU:
- /stable/senate-trades?symbol=AAPL ve /stable/house-trades?symbol=AAPL
  -> SEMBOL BAZLI. Parametre: symbol* (zorunlu), page (<=100), limit (<=250).
- Kardes uclar: senate-latest, senate-trades-by-name, senate-trades-by-id,
  senate-profile, senate-positions (OFIS gorevleri, hisse pozisyonu DEGIL),
  Senate Net Worth (+Aggregated).
- Cevap alanlari (FMP'nin kendi ornegi, birebir): symbol, senateID,
  disclosureDate, transactionDate, firstName, lastName, office, district,
  owner ("Spouse"), assetDescription, assetType, type ("Sale"),
  amount ("$15,001 - $50,000"), capitalGainsOver200USD, comment, link
  (efdsearch.senate.gov / disclosures-clerk.house.gov PTR PDF'i).
- **ALAN YOK: LOT (hisse adedi) YOK, KESIN DOLAR YOK.** amount bir
  ARALIK METNI. Ayrica bunlar ISLEM kaydi, POZISYON degil.
- Fiyat: Basic $0 (250 cagri/gun) · Starter $29/ay ($19 yillik, 300/dk) ·
  Premium $69/ay ($49 yillik, 750/dk) · Ultimate $139/ay ($99, 3000/dk).
- Kademe kapisi (karsilastirma tablosundan DOM ile okundu):
  "Senate Trading Activity (Basic): Not included." / "(Starter): Full Access."
  "U.S. House Trades" ayni. -> EN UCUZ UYGUN KADEME: Starter $29/ay.
- LISANS KAPISI: "Displaying or redistributing data sourced from FMP
  requires a specific Data Display and Licensing Agreement with FMP."
  Biz GOSTERIYORUZ -> App Store yayinindan ONCE bu anlasma gerekir.

QUIVER QUANTITATIVE (api.quiverquant.com - /pricing/ kayit duvarinin
arkasinda, FAQ'dan okundu):
- Kongre islemleri sembole eslenmis, 2014'ten bu yana. Ayrica Form 4,
  13F, lobi, devlet ihalesi, PAC, dark pool, patent, isten cikarma.
- Hobbyist $30/ay ve Trader $75/ay **YALNIZ KISISEL KULLANIM**.
  TICARI kullanim Startup $250/ay'dan basliyor (yillik <$100K ciro),
  sonrasi Enterprise. Biz ticariyiz -> gercek rakam $250/ay.
- MCP sunucusu da var: https://mcp.quiverquant.com/

DIGERLERI:
- Unusual Whales (/pricing okundu): "from $50 a month"; plan adlari var ama
  fiyatlar sayfada yok ve sayfa KONGRE/SENATO verisinden HIC bahsetmiyor.
- Finnhub: /stock/congressional-trading ucu var, "Premium" etiketli;
  fiyat sayfasi o satiri BOS birakiyor, ucuncu taraf 2026 sayfalari
  birbiriyle celisiyor ($50-$200/ay ... $3.500/ay). **DOGRULANMADI.**
- Apify aktorleri (House+Senate STOCK Act kazima): ~$3,00 / 1.000 islem
  kaydi, ~$5,00 / 1.000 kongre islemi, ya da 100'luk blok basina $0,05.
  Kullanim bazli KAZIMA; lisans/garanti yok.
- Resmi/ucretsiz: kongre islemi icin RESMI API YOK. Her izleyici ayni
  House Clerk PTR PDF'lerini ve Senate eFD'yi kaziyor (16.5'te olculdu:
  sembol yok, tutar yok, PDF'ler taranmis).

URUNE ETKISI (karar icin onemli):
Kullanicinin "kac lot ve kac dolarlik" istegi HICBIR fiyata alinamaz -
bu bir SAGLAYICI eksigi degil, STOCK Act bildirim rejiminin siniri.
Durust ozellik: "bildirilen islemler + tutar BANDI + bildirim tarihi".
Bu zaten projenin "olculmeyen sayi basilmaz" kurali ile uyumlu.

ENTEGRASYON MALIYETI (tasarim boyle kurulmustu):
1) `api/_sahipler.js` icinde YALNIZ `politikaciCek()` govdesi dolar;
   cevap SEKLI degismez.
2) `api/_ag.js` IZINLI listesine tek bir host oneki eklenir (su an 5 tane:
   Yahoo x2, sec.gov, data.sec.gov, isyatirim).
3) API anahtari Vercel ortam degiskeni olarak; istemciye ASLA gitmez.
4) Sunumda kesin dolar yerine BANT basilir.
Motora, skora, agirliklara DOKUNMAZ.

## 17. Benjamin Graham formulu - fiyat belirteci (2026-11-22 olcumu)

ISTEK: "formulu arastir, fiyat belirlemede belirteclerden biri yap, hisse
sayfasina 'Benjamin Graham's Formula' diye bir yer ekle, altinda mi ustunde
mi / % kac goster, karsilastirmaya Atahan Notlari'nin USTUNE ekle, once web
deploy sonra app." Deploy izni kullanici tarafindan SURESIZ verildi
("deploy iznini veriyorum, tekrar tekrar sorma") -> bu kalem icin #5/#8'in
"taze evet" sarti kullanici tarafindan kaldirildi.

### 17.1 Arastirma - UC AYRI formul, karistirilmamali
1) BUYUME FORMULU (The Intelligent Investor, 1962 baskisi, bolum 11):
   V = HBK x (8,5 + 2g)
   8,5 = buyumesiz sirketin baz F/K'si. g = gelecek 7-10 YILIN beklenen
   yillik buyumesi, TAM SAYI yuzde olarak (yuzde 7 icin 7, 0,07 degil).
2) 1974 REVIZYONU (Eylul 1974): V = HBK x (8,5 + 2g) x 4,4 / Y
   4,4 = o gunun yuksek dereceli sirket tahvili ortalama getirisi,
   Y = guncel AAA sirket tahvili getirisi.
   **UYGULANMADI.** Gerekce OLCULDU: `api/_ag.js` IZINLI listesinde
   (Yahoo x2, sec.gov, data.sec.gov, isyatirim) AAA sirket tahvili getirisi
   TASIYAN kaynak YOK. 10 yillik tahvil ile ikame etmek Y'yi DUSUK,
   dolayisiyla V'yi YUKSEK gosterirdi -> "olculmeyen sayi basilmaz"
   kuralini ihlal eder. Arayuzde yalniz NOT olarak yaziliyor.
3) GRAHAM SAYISI (AYRI, daha muhafazakar savunmaci olcut):
   karekok(22,5 x HBK x DDB); 22,5 = 15 (azami F/K) x 1,5 (azami PD/DD).
   22,5 BUYUME FORMULUNUN PARCASI DEGILDIR.
Arayuzde goruneni: Graham bu buyume formulunu hisse SECME araci olarak
one surmemistir - bu uyari karta basiliyor.

### 17.2 Ne yapildi (OLCULDU)
- `app.js` ~5806: Graham motor blogu. HER MOTOR DILIMININ DISINDA
  (`tests/engine.mjs` SLICES hicbirine girmiyor) -> skora sizma yok.
  `GRAHAM` sabitleri: BAZ_FK 8,5 | G_CARPAN 2 | G_MIN 0 | G_MAX 15 |
  SAYI_K 22,5 | BANT 15. `computeGraham` / `grahamIn` / `grahamCardHTML`.
- Hisse sayfasi: `fillResultPlan` icinde `${valHTML}` ile `${dcfHTML}`
  arasina `${grahamHTML}`. Basligi birebir: "Benjamin Graham's Formula".
  Govde: Graham degeri, "Guncel fiyat, Graham degerinin %X ALTINDA/
  USTUNDE", Graham Sayisi, formul & varsayimlar (acilir), DCF karti ile
  AYNI tasarim dili (`.rp-grm`, `styles.css` 35 satir yeni blok).
- Karsilastirma: Graham satiri `cmp-atahan-toggle` satirinin HEMEN
  USTUNDE uretiliyor (kanitlandi, 17.3). Varsayilan KAPALI
  (`compareGrahamOpen = false`), basliga tiklayinca acilir (DCF satirinin
  ayni mekanigi: `graham-open` sinifi + `cvd-body` display).
  En iyi vurgu DCF'in TERSI: DCF en BUYUK yukari potansiyeli isaretler,
  Graham'da fark = fiyat/deger oldugundan en KUCUK (en negatif) isaretlenir
  ve yalniz fark < 0 ise `cmp-best` verilir.
- g KAYNAGI ve SINIRI: g, gecmis gelir buyumesi ile TEMSIL EDILIYOR
  (vekil), 0-15 araligina KIRPILIYOR; kirpildiginda kullaniciya yaziliyor.
  HBK<=0 -> "HBK<=0 | uygulanamaz". g yok -> "buyume (g) yok".
  DDB olculemezse Graham Sayisi BASILMAZ (null, asla 0).
- DDB (defter degeri/pay) kaynagi: BIST'te ozsermaye/pay sayisi
  (`bistValuation`), US'te SEC ozsermaye / (net kar / HBK). Yahoo
  `priceToBook` KULLANILMADI: `yMetrics` yalniz `buildAtahanNotes` ve
  `computeCompareVerdict` icinde var, `fillResultPlan`'da YOK.
- Dilim ici TEK degisiklik: US `metrics` cikisina `equity` eklendi
  (`fa-us` dilimi). `node tools/motor-uret.mjs` KOSTURULDU ->
  `api/_motor.js` yenilendi: sha256 db1e1ccb5723ec2b, 3773 satir /
  33 dilim, 240735 bayt. `api/_ayar.js` DEGISMEDI (75512c5271a89b33).

### 17.3 Kapilar - hepsi YESIL (bu oturumda olculdu)
- `node --check app.js` -> gecti
- `node tests/engine.mjs` -> 125 motor sembolu, hepsi bulundu; 3773 satir
- `node tests/metin.mjs` -> cikis 0
- `node tests/parity.mjs` -> **FARK 0**, 29 karsilastirma noktasi birebir
  ayni -> Graham katmani HICBIR skoru oynatmadi
- `node tests/uretim-test.mjs` -> 73 denetim gecti
- `node tests/uc-test.mjs` -> 2488 denetim gecti (27 ucun hepsi)
- CRLF butunlugu: `app.js` 14768/14768 | `styles.css` 3102/3102
- RENDER KANITI (scratchpad kosumu, iki ayri kanit):
  * kart: 8 senaryo (ucuz/pahali/makul/BIST-kirpma/HBK<0/g yok/DDB yok/bos)
    -> undefined/NaN/null sizmasi YOK, yon+yuzde var, yasak dil YOK;
    formul dogrulandi: HBK 10, g 7 -> V 225; GS karekok(22,5x10x20)=67,0820;
    fark% = (100-225)/225 = -55,56
  * karsilastirma satiri: 8 hucre + 1 etiket = 9 div, en iyi indeks 2,
    `cmp-best` TEK hucrede, uretilen her CSS sinifi `styles.css`'te mevcut
    (tek istisna `cmp-grm-sub` = JS sorgu kancasi; DCF'te `cmp-dcf-sub` de
    stillenmiyor, stil `.cmp-mlbl2 .cml-s`'ten gelir)

### 17.4 OLCULMEDI / SONRAKI
- Gercek cihazda/tarayicida GORSEL dogrulama yapilmadi (deploy sonrasi).
- Native port TAMAM (bkz. 17.6). Uc INCE ISTEMCI kaldi: formul, esik,
  kirpma ve rakam UCTA YOK; sayilar hazir gelir.
- Gercek CIHAZDA Graham karti ve karsilastirma satiri henuz GORULMEDI.
- 1974 revizyonu: AAA getirisi tasiyan izinli kaynak bulunursa acilabilir.

### 17.5 Graham tel katmani (api/_akis.js) - OLCULDU 2026-11-22

- Dosya: 503 -> 577 satir, saf CRLF (CRLF 577 / LF 577). node --check: GECTI.
- Eklendi: grahamTel() beyaz liste (kriterTel ardina), scoreFaUS + scoreFaBIST
  graham bacagi, kayitHam ayirma, analizKatmani(.., graham) 5. parametre.
- TASARIM KARARI (olculdu): graham `fa` icine KONULMADI. tests/run.mjs:76
  scoreOne kaydini oldugu gibi baseline.json a koyuyor, parity.mjs:56 anahtar
  kumesini birebir diff ediyor -> yeni anahtar = FARK. Graham SADECE BILGI
  oldugu icin /api/score sozlesmesi kaydirilmadi; `analiz` katmaninda tasiniyor.
- curSym (TL simgesi) beyaz listeye girmedigi icin tele cikmiyor (compare.js
  basligi: "cevapta bicimlenmis tek alan yok").
- BIST pe yorumu duzeltildi: bistValuation artik motorda (dilim bist-val), ama
  valuation.pe BILEREK bos - computeHolisticScore onu okuyor, eklemek skoru
  kaydirirdi (ayri ve acik onay ister).
- KOSULDU 2026-11-22 (hepsi YESIL): `node tests/parity.mjs` -> FARK 0, 29
  karsilastirma noktasi birebir ayni | `node tests/uretim-test.mjs` -> 73
  denetim gecti (_motor.js <-> app.js, _ayar.js <-> config.js birebir) |
  `node tests/uc-test.mjs` -> 2489 denetim gecti (yeni (a1b) kapisi dahil).
- Kapi (5)f GUNCELLENDI: kayit ozlugu artik `fa: faTel`; yeni (a1b) kapisi
  `const { graham: grahamHam, ...faTel } = fa;` ayristirmasini VE
  `!/kayit:\s*\{[^}]*graham/` sartini birlikte civiliyor -> satir kalkarsa
  graham tele sizar ve parity.mjs patlar.

### 17.6 Native port (adim g-iii) - OLCULDU 2026-11-22

- YENI DOSYA `mobile/src/components/detay/GrahamKart.tsx`: 188 satir, 7309
  bayt, saf LF. Dort yol: `undefined` -> GRAHAM_GONDERILMEDI (OlcemedimKutu),
  `null` -> GRAHAM_OLCULEMEDI, `ok:false` -> GRAHAM_NEDEN_SOZLUK[reason] +
  GRAHAM_NEDEN_ROZET pili, `ok:true` -> deger / fark% + yon / uygulanan F/K
  carpani / kullanilan buyume (+ kirpma notu ve ham buyume satiri) / HBK /
  DDB + AYRI "Graham Sayisi" bolumu + GRAHAM_UYARI dipnotu.
- UCTA HESAP YOK, SAYI YOK: 8,5 / 2 / 22,5 hicbir etikette gecmiyor; carpan
  telden HAM `impliedPE` olarak geliyor, etiket "Uygulanan F/K carpani".
  Sozluk cumleleri rakamsiz (kapi (19)b ilkesi). Para birimi idiomu
  `market === 'BIST' ? 'TRY' : null`.
- `detay/index.ts` (LF): ad ad export + gerekce yorumu. AYRI KART, cunku
  bileske skora GIRMIYOR (DCF/Icsel Deger katmani gibi); TemelKart'in icine
  konsa 0-100 temel skoru besliyormus gibi okunurdu.
- `mobile/src/app/hisse/[sembol].tsx` (LF): `<GrahamKart satir={satir} />`
  TemelKart'tan HEMEN SONRA (satir 238), import satir 79. EK AG TURU YOK -
  `satir.analiz.graham` ekranin elindeki turden geliyor.
- `mobile/src/components/analiz/KarsilastirKart.tsx` (CRLF, 682 satir,
  29484 bayt, CRLF 682 / LF 682): Graham bolumu kartin EN SONUNA, "Temel
  metrikler" blogundan sonra. NEDENI: native'de "Atahan Notlari" satiri
  YOK ve `computeCompareVerdict` cumlesi de YOK (kartin kendi basligi
  yaziyor). Olmayan bir satirin "ustune" koymak icin uydurma bir Atahan
  satiri acmak, web'e ait bir siralamayi native'de taklit etmek olurdu;
  bu yuzden webdeki "Atahan'in hemen ustu" konumu native'de "kartin son
  bolumu" olarak karsilandi. Her sembol icin SEMBOL - DEGER - KONUM.
- Mobil typecheck: `cd mobile && node ./node_modules/typescript/bin/tsc
  --noEmit -p tsconfig.json` -> EXIT=0 (iki kez: mount sonrasi ve
  karsilastirma eklemesi sonrasi).

### 17.7 ARIZA VE TAM KURTARMA: sozluk.ts sifirlanmasi (kapandi)

- NE OLDU: Graham sozlugunu ekleyen betik `mobile/src/lib/sozluk.ts`'i
  SIFIRLADI. Sebep: `io.open(P, 'w')` yazmadan ONCE dosyayi kirpar;
  ardindan gelen `.write()` `UnicodeEncodeError: surrogates not allowed`
  ile patladi (📐 yanlis sekilde `'\ud83d\udcd0'` tek-surrogate cifti
  olarak yazilmisti; dogrusu `'\U0001F4D0'`). Dosya 0 baytta kaldi.
- KURTARMA: `git checkout --` ile geri alindi ve UC BAGIMSIZ kopyayla
  bayt-bayt ayni oldugu KANITLANDI: (1) HEAD blob'u 34047 bayt / 861 LF,
  (2) 8 Kasim Expo web sourcemap'i
  `mobile/dist/_expo/static/js/web/entry-54fd791aea3115603f90744a799369db.js.map`
  icindeki `sources[418] = '/src/lib/sozluk.ts'` -> `sourcesContent` 34047
  karakter, (3) `.claude/worktrees/finans-yatirim-profili-214f98/` altindaki
  14 Kasim kopyasi (34908 bayt = ayni icerik, CRLF). LF'e normalize edildi;
  `git hash-object` = `7e6b70dbbfdff9f4e9f182213ef8bb6cf85225ba` =
  `git rev-parse HEAD:mobile/src/lib/sozluk.ts`. HICBIR VERI KAYBI YOK.
- KURAL (bundan sonra zorunlu): kaynak dosyaya ASLA dogrudan `open(P,'w')`
  yazilmaz. Once `P + '.tmp'` yazilir, sonra `os.replace(T, P)` yapilir ->
  kodlama hatasi dosyayi KIRPAMAZ. Agir Turkce/emoji iceren icerik bash
  heredoc (`<<'TSX'`) ile aynen yazilir, python yalniz EKLEME yapar.
- Konsol kodlamasi cp1254: 📐 ve -> basilamaz. Her betige
  `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` eklenir;
  `python -I` PYTHONIOENCODING'i yok sayar (-I, -E'yi ima eder). Basarili
  `os.replace` sonrasi print patlamasi dosyanin bozuk oldugunu GOSTERMEZ -
  dogrulama bayt/satir sayisiyla yapilir, icerigi ekrana basarak degil.

## 18. NVDA bastan sona olcum (2026-11-23) - skora dokunulmadi

Kaynak: canli uclar, HTTP 200. `GET /api/score?symbols=NVDA&vade=orta`,
`GET /api/analyze?symbols=NVDA`, `GET /api/chart?symbol=NVDA&range=1y&interval=1d`.
`surum.motor = sha256:b9f0340362651918`, `surum.ayar = sha256:75512c5271a89b33`,
`tam: true`, `atlanan: []`. HICBIR DOSYA DEGISTIRILMEDI - bu bolum yalniz olcum.

### 18.1 TA (vade=orta)
score 37.129331 / raw 38.808114 / label "SAT egilimi" / cls bear /
regime "neutral" / adx 49.303416 / bars 1255 / benchBars 1255.
Kirilim (anahtar, skor, agirlik, katki=w*(s-50)*1.15):
ichimoku 14 .13 -5.38 | macd 33.325 .17 -3.26 | rs 27.407 .09 -2.34 |
vp 37.016 .09 -1.34 | obv 40.885 .10 -1.05 | trend 55 .18 +1.04 |
boll 65.842 .05 +0.91 | rsi 42.444 .10 -0.87 | stoch 34.993 .04 -0.69 |
ttmpl 52 .05 +0.12. Agirlik toplami tam 1.00.
Elle dogrulama: devSum = -11.1921 -> raw = 50-11.1921 = 38.808 (API ile ayni),
adxF = 1.15 (ADX>=40) -> score = 50 + (38.808-50)*1.15 = 37.129. TAM UYUM.
regime neden "neutral": fiyat 164.65 < sma50 206.07 (up=false) ve
sma50 206.07 > sma200 203.24 (dn=false) -> trend degil; adx 49.3 >= 18 ->
range da degil. Sonuc: interp 'momentum' (orta ayari) kaldi, rejim anahtari donmedi.

### 18.2 FA
score 88.071207 / present 18 / total 18 / price 164.64 / eps 7.91 / pe 20.814159.
Dusuk puanli iki kriter: accruals 40 (`donusmuyor`, ocf 134.36G < netKar 192.88G),
roaUp 40 (`geriliyor`, 61.530 -> 60.224). pe 58.697 (kat 20.814).
faKarar = { label 'guclu / olumlu', band 'strong' }.

### 18.3 SEC veri butunlugu - SUPHE OLCULDU VE CURUTULDU
eps 7.91 sisirme sanildi. CIK0001045810 `EarningsPerShareDiluted` dogrudan
cekildi (44731 bayt): 4.90 (FY2026 10-K, 363 gun) + 4.85 (181 gun, 2026-07-26)
- 1.84 (181 gun, 2025-07-27) = 7.91 TAM. `secTTM` dogru. VERI HATASI YOK.
Yan bulgu: SEC `fy`/`fp` alanlari guvenilmez (2025-07-27 cercevesi fy 2027
etiketli; uc ayri 10-K cercevesi fy 2026). `secTTM`'in start/end suresine
bakmasi bu yuzden dogru tasarim.

### 18.4 Bantlar (plan.seviye)
price 164.587997 / target 152.553319 / stop 191.03752 / rr 0.455006 /
poc 211.176038 / atr 13.224761 / buyZone [113.185602, 142.280077] /
sellZone [242.61409, 271.708565] / zMult 1.1 / sellKind 'target' /
anchorKind 'kaygan' (capa bollAlt ~127.73 - SABIT degil).
yakinlik { state 'far', dAtr 1.68683 } | momentum { active false, adx 49.303 } |
oynaklik { atrPct 8.03507, kod 'yuksek', stopKat [1.5,2] } |
atrPlan { atrPct 8.03507, kod 'genis' } |
riskOdul { sellUpPct 56.245, brkPrimary 113.186 (swingLow), rrRatio 1.800954 }.
NOT: plan.seviye.rr 0.455 (target/stop) ile riskOdul.rrRatio 1.80 AYRI iki
olcum - birincisi 2*ATR stopuna, ikincisi swingLow kirilimina gore.

### 18.5 Adil deger
graham { ok true, value 304.535, diffPct -45.954324, grahamNumber 40.88149,
gnDiffPct +302.597854, eps 7.91, bvps 9.390623, gUsed 15 (gRaw 100.045,
gClamped true), impliedPE 38.5 }. 7.91*(8.5+2*15) = 304.535 dogrulandi;
sqrt(22.5*7.91*9.390623) = 40.88 dogrulandi.
DCF: HICBIR UC DCF DONDURMUYOR (`grep -rn "dcf" api/*.js` -> yalniz
`eng.usDcfIn` Graham girdisi olarak). Bu yuzden ELLE hesaplandi, motorun
kendi formulleriyle, 251 gunluk kapanis uzerinden:
- annualizedVol(closes) = 0.497825 (250 log getiri, 252 ile olcekli)
- beta = 0.497825/0.18 = 2.766 -> [0.6,2.2] KIRPMASI -> 2.2
- costEquity = 0.043 + 2.2*0.05 = 0.153 ; costDebtAT = 0.062*0.79 = 0.04898
- shares = ni/eps = 192.88G/7.91 = 24.3843G ; E = 4.0134T$ ;
  bookEquity = ni/roe = 229.0G$ ; D = 0.145713*229.0G = 33.37G$ ; E/V = 0.99175
- WACC = 0.15214 (floor 0.075 / cap 0.16 arasinda, KIRPILMADI)
- fcf0 = 127.006G$ ; netDebt = -38.199G$ (net nakit) ; g0 = 1.00045 -> US cap
  0.25 ; gT = 0.03
- FCF merdiveni (g dogrusal 0.25->0.03, %15.214 ile iskonto):
  Y1 158.8/137.8 | Y2 189.7/142.9 | Y3 216.3/141.4 | Y4 234.7/133.2 |
  Y5 241.7/119.1 (G$) ; terminal 2.038T$ -> bugunku 1.004T$
- base = 70.39 $/pay ; 3x3 duyarlilik (WACC +-0.02, g0 +-0.03, her biri
  yeniden kirpilir) -> lo 62.46 / hi 84.43 ; upside -57.23% ; badge 'expensive'
UC OLCUM UC AYRI SONUC (durust tablo): DCF -57.2% (pahali; cunku %49.8
gerceklesmis oynaklik betayi 2.2 tavanina, WACC'i %15.2'ye tasiyor) /
Graham buyume formulu -45.95% (ucuz; cunku iskonto orani YOK, g 15'te kirpik) /
Graham Sayisi +302.6% (cok pahali; defansif olcum, BVPS yalnizca 9.39).

### 18.6 Bileske
composite { faBand 'hi', taBand 'lo', band 'mixed',
label 'Kaliteli ama fiyat zayif', blended 65.147363 } ->
cozuldu: blended = 0.55*FA + 0.45*TA.
butunculluk { skor10 5.3, band 'Zayif - temkinli'/bear,
direkler FA .40 = 0.880721 | TA .30 = 0.371239 | Degerleme .30 = 0.208028 }.
Degerleme sutunu elle dogrulandi: fiyat 164.588 > buyZone[1] 142.280 ->
gap = 0.15679 ; momActive false, buyumeCls 'na' -> baseFair 0.60, slope 2.5 ->
vPart = 0.60 - 0.15679*2.5 = 0.20802. composite01 = 0.5260685 -> 5.3. TAM UYUM.

### 18.7 Haberin skora TEMAS NOKTASI (olculdu)
Haber bugun skora YALNIZ Firsatlar siralama katmanindan giriyor, uc cagri
yerinde ve hepsi `se.score * 7`: `app.js:9916`, `app.js:11222`, `app.js:11337`.
`sentiAggregate(raw,hits) = clamp(raw/(|raw|+4), -1, 1)` -> en fazla +-7 puan,
ve bu puan computeVadeScore skorunu, computeFaScore'u, computeHolisticScore'u,
alim/satim bandini, DCF'i ve Graham'i DEGISTIRMIYOR. Haber sozlugu
`SENTI_POS`/`SENTI_NEG` (app.js:9560-9579) elle yazilmis TR+EN anahtar listesi,
agirlik 1-3. `WHY_HABER_ESIK = 0.12` yorumu ile birlikte "OLCULMEDI, DEVRALINDI".
Gundem tarafi: `computeAgenda`/`agendaScore` (RSS, 20 dk onbellek, 6 tanimli +
2 yukselen konu) ve `computeCausalLinks` (korelasyon okumasi, "Skora dahil
degildir"). Haber bacagini skora sokacak her degisiklik AYRI, TAZE "evet"
gerektirir - bu bolum sadece mevcut durumun olcumudur.

## 19. Teknik analiz: otorite kiyasi + Big 7 geriye donuk olcum (2026-11-24)

### 19.1 Olcum duzeni (nasil yapildi)
- tests/engine.mjs -> buildEngine() ile gercek app.js motoru Node'da kosturuldu.
  makeHost agi kapatiyor ("ag kabugu verilmedi: parite kosusunda canli istek YASAK"),
  yani mumlar enjekte edildi, hicbir canli istek yok.
- computeVadeScore(daily, vadeKey, tfDataOverride, benchDaily) mum dizisi uzerinde SAF.
  Mum dizisini gecmis bir tarihte kesmek gercek bir "o gunku" tekrar oynatma veriyor.
- Mum kaynagi: /api/chart?range=5y&interval=1d, 7 sembol + ^GSPC. AAPL 1254 bar,
  2021-11-24 -> 2026-11-23.
- gunici gunluk mumla null donuyor (intraday gerekiyor). Olcum kisa/orta/uzun ile yapildi.
- DURUSTLUK KONTROLU: git log -L1216,1330:app.js --since=2026-08-01 uc commit gosterdi
  (aa89402, 38691ca, 71fbab5). Iki diff "buyReach|sellReach|zMult|buyZone|sellZone|hw =|supAnchor|resAnchor"
  icin greplendi: aa89402 -> BOS. 38691ca -> yalniz anchorKind, anchorSrc alanlarini
  levels: donusune EKLEDI + buyZoneProximity fonksiyonunu ekledi.
  SONUC: bant matematigi 2026-08-24 oncesinden beri DEGISMEMIS; bolge fiyatlari gercek.
  Yalniz anchorKind/anchorSrc capa-kalite rozeti as-of tarihinden SONRA geldi (anakronik).

### 19.2 Big 7, as-of 2026-08-24, 63 islem gunu ileri
| sembol | as-of fiyat | 3ay getiri | dip/zirve | kisa | orta | uzun |
|---|---|---|---|---|---|---|
| AAPL | 310.34 | +10.4% | 308.21/360.83 | 53.69 Zayif AL; AL [293.24,304.31] DEGMEDI; SAT [329.05,340.11] ULASTI/GECTI; hedef once; sabit/Fibonacci | 60.98 AL eg.; AL [283.33,299.55] degmedi; SAT [353.85,370.07] ULASTI; kaygan/Bollinger alt | 73.25 GUCLU AL; AL [273.57,295.69] degmedi; SAT [387.77,409.9] ulasmadi; sabit/Fibonacci |
| MSFT | 487.31 | -0.6% | 481.03/559.15 | 61.71 AL eg.; AL [442.4,460.52] degmedi; SAT [531.53,549.64] ULASTI/GECTI; hedef once | 68.61 GUCLU AL; AL [438.18,464.74] degmedi; SAT [558.54,585.1] ULASTI | 70.22 GUCLU AL; AL [413.07,449.29] degmedi; SAT [614.08,650.3] ulasmadi; sabit/SMA200 |
| GOOGL | 348.06 | -23.8% | 264.22/364.17 | 52.76 Zayif AL; AL [326.38,340.37] DEGDI/KIRDI; SAT ulasmadi; STOP ONCE; sabit/SMA200 | 55.47 Zayif AL; AL [318.72,339.25] DEGDI/KIRDI; stop once; sabit/VP deger tabani | 69.42 GUCLU AL; AL [293.14,321.12] DEGDI/KIRDI; stop once; sabit/Fibonacci |
| AMZN | 262.07 | -5.8% | 229.36/275.34 | 58.90 AL eg.; AL [246.9,257.82] DEGDI/KIRDI; SAT ulasmadi; hedef once | 68.35 GUCLU AL; AL [233.59,249.61] DEGDI; hedef once | 70.31 GUCLU AL; AL [227.47,249.31] DEGDI; sabit/SMA200 |
| NVDA | 208.48 | -39.8% | 124.50/243.37 | 57.02 AL eg.; AL [195.5,205.11] DEGDI/KIRDI; SAT [229.91,239.53] ULASTI/GECTI; hedef once | 64.71 AL eg.; AL [188.28,202.39] DEGDI/KIRDI; sabit/SMA200 | 75.58 GUCLU AL; AL [169.96,189.2] DEGDI/KIRDI; SAT ulasmadi |
| META | 559.02 | +0.3% | 556.10/779.82 | 45.51 Zayif SAT; AL degmedi; SAT [608.69,638.52] ULASTI/GECTI; stop once; kaygan/Bollinger alt | 38.45 SAT eg.; SAT [711.02,754.78] ULASTI/GECTI; projeksiyon/ATR izdusumu | 40.85 SAT eg.; SAT [767.87,827.54] ULASTI; projeksiyon/ATR izdusumu |
| TSLA | 348.95 | -0.9% | 338.15/414.23 | 42.56 SAT eg.; AL degmedi; SAT [387.65,408.56] ULASTI/GECTI; stop once; kaygan/Bollinger alt | 43.86 SAT eg.; kaygan/Bollinger alt | 49.65 Notr; kaygan/Bollinger alt |

Tek kesit toplami (n=7 -> ANEKDOT, isabet orani DEGIL):
- kisa: AL bolgesine degme %42.9, 1 ay tutma %33.3, altini kirma %42.9, SAT/direnc ulasma %71.4,
  gecme %71.4, hedef-stoptan-once %57.1, YON %28.6.
- orta: 42.9 / 66.7 / 28.6 / 42.9 / 14.3 / 57.1 / 28.6.
- uzun: 42.9 / 33.3 / 28.6 / 14.3 / 0 / 57.1 / 16.7.

### 19.3 Yuvarlanan aylik ornek, n=294 (7 sembol x 42 ay sonu, 2023-02-28 -> 2026-07-31, 63g ileri)
| vade | AL bolgesine degme | degince 1 ay tutma | altini kirma | SAT bolgesine ulasma | gecme | hedef once | YON | capalar | ort. AL mesafesi | ort. SAT mesafesi |
|---|---|---|---|---|---|---|---|---|---|---|
| kisa | %72.1 (212/294) | %56.1 (119/212) | %43.2 | %75.9 | %62.6 | %55.8 | %58.5 (144/246) | kaygan 106, sabit 187, projeksiyon 1 | -%4.19 | +%8.29 |
| orta | %65.6 | %65.8 | %34.4 | %46.3 | %31.3 | %57.5 | %56.5 | sabit 201, kaygan 87, projeksiyon 6 | -%5.14 | +%18.43 |
| uzun | %56.1 | %75.2 | %22.4 | %19.7 | %9.9 | %58.5 | %58.3 | sabit 224, projeksiyon 11, kaygan 59 | -%7.11 | +%31.40 |

### 19.4 ONEMLI NEGATIF BULGU: TA skoru bu ornekte TERS yonlu
- TABAN ORAN: gozlemlerin %67.7si (199/294) 3 ay sonra YUKARIDA; ortalama 3 ay getiri +%9.56.
  Yani "her zaman AL de" stratejisi bizim %56-58 yon isabetimizi YENIYOR.
- Ayirt etme gucu (bull ort. getiri - bear ort. getiri):
  kisa -10.71 puan (bull %7.65 n210 / bear %18.36 n36)
  orta -8.53 puan (%7.87 n228 / %16.40 n48)
  uzun -11.60 puan (%7.22 n245 / %18.82 n38; notr n11 -> %29.45)
- Skor kovalari MONOTON TERS. uzun: 0-45 -> +%20.55 (%90 yukari, n29); 45-55 -> +%18.97 (%74, n31);
  55-65 -> +%11.03 (%75, n48); 65-75 -> +%7.88 (%67, n107); 75-101 -> +%3.19 (%53, n79).
  orta: 19.28 / 11.01 / 7.96 / 6.17 / 9.62. kisa: 21.44 / 9.73 / 6.07 / 9.13.
- AL bandinin ustunden girmek, as-of kapanistan almaktan KOTU: kisa %8.33 (n212), orta %7.34 (n193),
  uzun %7.41 (n165) -- taban %9.56.
- Capa kalitesi MANTIKLI davraniyor: uzunda sabit n224 degme %56/tutma %75/kirma %23;
  kaygan n59 %56/%73/%22. kisada sabit n187 kirma %40, kaygan n106 kirma %49.

### 19.5 Saglamlik (vade-esli ufuk: kisa 21g, orta 63g, uzun 126g; Spearman rho = skor vs ileri getiri)
| ornek | kisa | orta | uzun |
|---|---|---|---|
| tum ay sonlari | n308 taban %59.7 rho -0.030 ayirt -3.25p | n294 taban %67.7 rho -0.199 ayirt -8.53p | n273 taban %74.7 rho -0.283 ayirt -22.30p |
| ortusmeyen ceyrek sonlari | n105 rho -0.018 | n98 rho -0.250 ayirt -12.38p | n91 rho -0.351 ayirt -35.06p |
| 2023-2024 | rho -0.007 | -0.157 | -0.089 |
| 2025-2026 | rho -0.173 (bull ort. -%0.56) | -0.328 | -0.531 |

Sembol basi rho (orta): AAPL -0.415, MSFT -0.336, GOOGL -0.212, AMZN -0.480, NVDA +0.071, META -0.026, TSLA -0.414.
Sembol basi rho (uzun): AAPL -0.580, MSFT -0.648, GOOGL -0.395, AMZN -0.380, NVDA -0.287, META +0.059, TSLA -0.690.
=> 7 sembolun 6sinda NEGATIF; META tek hafif istisna.

YORUM: motor bir momentum/trend-rejim tarifcisi. 2023-2026 arasinda bu yedi mega-capte
yuksek momentum 1-6 ay vadede ORTALAMAYA DONDU. Bu, kullanicinin sordugu kumenin TAM
uzerinde yapilmis bir olcumdur, genel bir iddia DEGIL.
Cekinceler: (1) yalniz 7 yuksek korelasyonlu isim, (2) tek bir tarihsel rejim,
(3) aylik as-of tarihleri 63 gunluk ufukta ~3x ortusuyor, (4) kisada rho ~ 0 demek
"ters sinyal" degil "SINYAL YOK" demektir, (5) anchorKind rozeti as-of sonrasi (38691ca).

### 19.6 Ikinci yapisal kusur: deger ayagi DOYMUS
pos = (px - buyZone[1]) / (sellZone[0] - buyZone[1]), n=294, orta:
- pos <= 0.25 -> 206 gozlem (%9.23 getiri, %67 yukari)
- 0.25 < pos <= 0.50 -> 88 gozlem (%10.32, %69)
- 0.50 < pos <= 0.75 -> 0 gozlem
- pos > 0.75 -> 0 gozlem
SAT bolgesi fiyatin sistematik olarak COK ustune, AL bolgesi hemen altina konuyor; bu yuzden
"fiyat konumu" neredeyse SABIT ve bilgi tasimiyor. computeHolisticScoreun AL-bolgesi
konumundan turettigi deger ayagi (agirlik .30) pratikte ayirt etmiyor.
Capraz tablo tersligi konum kovasi icinde de koruyor:
skor<55 & pos<=0.4 -> %13.88 / %78 yukari (n83); skor 55-68 -> %8.34 / %67 (n110);
skor>=68 -> %6.63 / %59 (n97).

### 19.7 Otorite kiyasi -- KAYNAK ASIMETRISI ONCE
Uc farkli kalitede kaynak var, karistirilmamali:
1. INDIKATOR LISTELERI -- ZAYIF. Resmi CMT/profesyonel anket BULUNAMADI. Egitim sitesi
   konsensusu: hareketli ortalamalar, pivot noktalari, MACD, RSI, Bollinger, hacim, OBV
   (Study.com, Axi, TradingView, Commodity.com). Tek anket-gorunumlu sayi TradeAlgonun
   "2024te 1200 karli gunluk yatirimci" alintisi (VWAP %78, HO %72, bagil hacim %65) --
   KAYNAK ADI YOK, DOGRULANAMADI, ustelik gunici. Naga tek-arac bagimliligina karsi uyariyor.
2. FORMASYON ISABETI -- ORTA (Bulkowski, thepatternsite.com). PPRU %43 basabas basarisizlik
   (yukari kirilim), Shark-32 %32 basarisizlik / %72 olcum kurali, Upside Weekly Reversals %16,
   Key Reversal Downtrend %69 olcum kurali. ~13.932 formasyonluk 1991-2008 calismasinda
   basarisizlik oranlari ZAMAN ICINDE ARTIYOR; 2003 sonrasi yalniz 2003 (%11) %20in altinda.
   DIKKAT: Bulkowskinin kendi sayfasi 1990lar rakaminda kendisiyle celisiyor (%14 vs %26).
   Ucuncu taraf dogrulanmamis: ters OBO %11 basarisizlik / %45 ortalama hareket,
   high-tight flag %85 basari / %39 kazanc (Pipster, TradeAlgo, Sacred Traders).
3. GERCEK "DOGRULUK ORANI" LITERATURU -- GUCLU. Park & Irwin, "The Profitability of
   Technical Analysis: A Review" (AgMAS 04-04) ve AgMAS 05-04: HO kurallari VERI TARAMASI
   (data snooping) kontrol edilene kadar karli gorunuyor; Brock-Lakonishok-LeBaronun
   maliyet sonrasi basarisi veri taramasina atfedildi. FX calismasi gelismekte olan
   piyasalarda TA karliligini "illusory" diyor. Karsi agirlik: bazi ortalamaya donus
   kurallari duzeltmeden sonra da ayakta kaliyor; 2021 ScienceDirect 18.410 kural
   calismasi hala ongorulebilirlik buluyor. Romanya HO-kesisim calismasi: indikatorlerin
   yalniz %40i orneklem ici istatistiksel anlamli. Kural siralamasi: tek HO > ikili HO
   kesisimi > RSI. Duzeltme yontemleri: Whites Reality Check, Hansen SPA testi.
   => Literaturun ozeti: TAnin yayinlanmis "isabet oranlari" cogunlukla cok-kural
   taramasindan dogan bir yanilsamadir. Bizim -0.199/-0.283 rhomuz bu literaturle
   CELISMIYOR; aksine onu destekliyor.
4. CIZGI CIZME KONSENSUSU (LuxAlgo, Forextester, Investing.com, Sarwa, TMGM, QuantStock,
   Trendo, MarketMates, MRPNL, eplanetbrokers): salinim dip/zirvelerine capala; gecerli
   trend cizgisi icin UC DOKUNUS standardi (iki ile ciz, ucuncu dogrular), yatay seviye
   icin iki yeterli; net trend yoksa hic cizme; fiti ZORLAMA; cizgileri CIZGI DEGIL BOLGE
   gibi oku; ana cizgiyi ust zaman diliminde isaretle, sonra islem dilimine in.
   Kaynaklar dokunus sayisinda ayrisiyor.
   BIZIM DURUMUMUZ: "bolge, cizgi degil" ilkesini ATR yarim-genislik bandiyla ZATEN
   uyguluyoruz (dogru taraftayiz). Uc dokunus dogrulamasini UYGULAMIYORUZ -- capalar
   Fibonacci/SMA200/VP deger tabani/Bollinger alt gibi turetilmis seviyeler, dokunus
   sayilmiyor. Olculebilir eksik bu.

### 19.8 1-100 "overall" katmani -- tasarim notlari (UYGULANMADI, taze "evet" bekler)
Kullanicinin istedigi kalemler motorda ZATEN VAR MI diye tek tek bakildi:
- "nakit akisi pozitif mi" -> VAR: fcfPos (Serbest Nakit Akisi, agirlik 0.05).
- "karini arttirmis mi" (YoY) -> VAR: netTrend (0.07 BIST / 0.06 US).
- nakit kalitesi -> VAR: accruals (OCF > Net Kar, 0.06). Ayrica roaUp 0.05, gmUp 0.04, crUp 0.03.
  => Bunlari 1-100 katmanina TEKRAR koymak CIFT SAYMA olur.
- GERCEKTEN YENI OLAN IKI KALEM: (a) 5 YIL UST USTE kar artisi (seri/streak, YoY degil),
  (b) parasini yatirima mi ayiriyor (capex / OCF yeniden yatirim orani).
VERI ZEMINI HAZIR -- YENI ENDPOINT GEREKMIYOR: api/_motor.js icindeki secFetchModel
tek seferde 19 SEC kavram dizisi cekiyor:
const [revA, grossA, niA, opA, daA, ocfA, capexA, assetsA, liabA, eqA, ltdA, ltdcA, cashA, stiA, ppeA, caA, clA, epsA, invA] = arrs;
niA=NetIncomeLoss, ocfA=NetCashProvidedByUsedInOperatingActivities, capexA=PaymentsToAcquirePropertyPlantAndEquipment.
Yardimci da hazir: secAnnualsList(arr) (api/_motor.js:1953) yillik (340-380 gun) donemleri
EN GUNCEL ONCE siralayarak donduruyor. secTTM bunu zaten cagiriyor ama yalniz anns[0]
ve anns[1]i kullaniyor -- tam yillik seri ELDE. BIST karsiligi api/_mali.js:204-207
(netKar, faaliyetNakitAkisi, yatirimHarcamasi).
=> Vercel Hobby 12 fonksiyon sinirina BASKI YOK, yeni bagimlilik YOK.
HABER/GUNDEM DURUMU: bugun haberin TEK sayisal dokunusu SIRALAMA:
combined = clamp(ta.score + senti.score * 7, 2, 98) (app.js:11222, 11337) ve
sentiAggregate +-1 ile sinirli, yani etki +-7 puan. WHY_HABER_ESIK = 0.12 yorumu
"OLCULMEDI, DEVRALINDI". agendaScore (app.js:11889) ve computeCausalLinks skorun DISINDA
("Skora dahil degildir", app.js:12383). Graham da api/_akis.js:190-209da
"SADECE BILGI; FA/TA/bileske skora DOKUNMAZ". 1-100 katmani bu iki duvari KIRACAKSA
bu bilincli bir karar olmali ve tests/baseline.json parite testi kirmizi yanacak.

### 19.9 Olcum betikleri (yeniden kosturulabilir)
Scratchpad: .../scratchpad/bt/ altinda probe.mjs (vade anahtari yoklamasi), run.mjs (ana
geriye donuk kosu -> result.json), stat.mjs (taban oran + ayirt etme), horizon.mjs
(vade-esli ufuk + Spearman + alt donemler -> horizon.json), combo.mjs (skor x fiyat konumu
capraz tablosu). Mumlar ayni klasorde AAPL/MSFT/GOOGL/AMZN/NVDA/META/TSLA/GSPC.json.
Kosu: cd /c/Users/Asus/Desktop/day-starter && node "<yol>"

## 20. 1-100 GENEL SKOR: Graham marji olcumu + haber-gundem-konjonktur katmani (2026-11-24)

Kullanici istegi: "Graham marjini olc, 1-100 overall skor yapisini ve motorunu hazirla...
Bileske skor + Graham + HABER. Bu ucu ile 1-100 final overall skoru yapacagiz."

### 20.1 Graham marji AYIRT ETME GUCU - olculdu (n=289)
Kurgu: 7 sembol (AAPL/MSFT/GOOGL/AMZN/NVDA/META/TSLA) x 42 ay sonu (2023-02..2026-07),
Graham marji = (deger - fiyat)/deger (POZITIF = ucuz). Ileriye donuk 63g ve 126g getiri.

| Olcut                       | 63 gun | 126 gun |
|-----------------------------|--------|---------|
| Spearman rho                | 0.108  | 0.086   |
| Ayirt etme (marj>0 - marj<=0)| +1.46p | +2.82p  |
| Taban oran (yukari biten)   | 68.2%  | 75.0%   |

- Kovalar MONOTON DEGIL: marj arttikca getiri duzenli artmiyor.
- Rejim donmesi: 2025-26 lehte (+7.5p / +13.0p), 2023-24 ALEYHTE (-4.0p / -5.2p).
- Tek anlamli bant: marj > +%50 -> 126g ortalama +%31.9, %84.6 yukari (n=26).
- Graham marji ile TA(orta) skoru arasinda rho = -0.149: BAGIMSIZ bilgi tasiyor,
  bu yuzden eklemek anlamli; ama gucu zayif oldugu icin agirligi KUCUK tutuldu.

### 20.2 ONEMLI DUZELTME: bolunme tabani kirlenmesiydi
Ilk kosuda rho 0.225 ve ayirt etme 14.62p cikti. Sebep: HBK (EPS) bolunme-oncesi
tabanda, fiyat bolunme-sonrasi tabanda. Hizalama yapildiktan sonra guc 0.108 / 1.46p'ye
dustu - yani "gorunen gucun" buyuk kismi olcum hatasiydi. GRAHAM_PUAN = +-4 bu olcumun
sonucudur, tahmin degil.

### 20.3 HABER SKORU GERIYE DONUK OLCULEMEZ (durust kayit)
Gecmis haber arsivi YOK: haber icin KV yok, onbellek anahtari tarihe degil girdi
imzasina bagli, Google News RSS tarih-araligi sorgusu kabul etmiyor. Bu yuzden haber
agirliklari (hisse 0.50 / gundem 0.20 / konjonktur 0.30) ve curume merdiveni
KALIBRE EDILEMEDI. Arayuzde "Haber agirliklari OLCULMEDI" ibaresi ile basiliyor.
Olculebilir hale gelmesi icin haber anlik goruntulerinin tarihli saklanmasi gerekir
(ayri is, ayri onay).

### 20.4 Ilan edilen capalar ve tavanlar (app.js, motora dilimlenir)
HABER_AYAR = AGIRLIK {hisse 0.50, gundem 0.20, konjonktur 0.30}, ASGARI_SINYAL 4,
CURUME [[12,1],[24,0.8],[48,0.55],[96,0.3]], CURUME_TABAN 0.15, KONJ_TABAN_BASKI 0.3.
OVERALL = ANKOR [[0,1],[4,20],[5.5,40],[7,60],[8.5,80],[10,100]], GRAHAM_PUAN 4,
GRAHAM_DOYUM 0.5, HABER_PUAN 8, TAVAN_TOPLAM 10,
BANT [[80 cok_elverisli],[60 destekleyici],[40 ilimli],[20 zayif],[0 olumsuz]].

- 0-10 -> 1-100 cevrimi `skor10 * 10` DEGIL: overallStretch parcali-dogrusal capa
  tablosu. Sebep: bileske 5.5-8.5 bandinda sikisiyor, duz carpma yuzdelik hareketi
  gormezden geliyordu (kullanicinin "matematigi degistirmek gerekebilir" notu).
- Ek iki terimin TOPLAM etkisi +-10 puan ile kirpilir; tek basina bant atlatmamasi icin.
- Olculmeyen bacak 0 veya 50 SAYILMAZ: agirlik yalniz olculenler uzerine dagitilir,
  guven dusurulur, `eksik[]` + `guvenKod` ile ustte raporlanir.
- computeHaberSkor SAF: ag yok, Date.now() yok (simdiMs zorunlu), Turkce metin yok.
- Yeni katman computeHolisticScore'a GERI BESLENMEZ; bileske aynen korunur, parite 0.

### 20.5 Isaret tuzagi (tekrar dusmemek icin)
`grahamMarj` KESIR ve POZITIF = ucuz. `computeGraham.diffPct` ise YUZDE ve NEGATIF =
ucuz. Her cagri yerinde `-graham.diffPct / 100` yazilir (app.js ve api/_akis.js).

### 20.6 Nereye baglandi
- Motor: app.js 6051-6245 (HABER_AYAR, haberCurumeW, computeHaberSkor, OVERALL,
  overallStretch, computeOverall100) -> holistic dilimi icinde, dilim tablosu degismedi.
- Web: hisse sayfasinda Graham kartindan SONRA hesaplanip bileske kartinin USTUNE
  cizilir (`overallHTML`). Yeni CSS yok, mevcut .rp-holistic/.hs-* siniflari.
  Haber bacagi web'de CANLI besleniyor (senti.puanlar + computeAgenda + pulseStance).
- API: api/_akis.js analizKatmani -> `overall` alani. Bu ucta haber girdisi YOK, bu
  yuzden `haberSkor: null` gonderilir ve guvenKod en iyi 'kismi' olur (sahte 50 yok).
- Native: types.ts Overall tipleri, sozluk.ts OVERALL_* (Turkce TEK YERDE),
  format.ts formatImzaliOran (formatImzaliSkor tam sayiya yuvarliyordu, 2.4 puanlik
  katki "2" basilacakti), TezKart.tsx genel skor blogu. Native'de hesap YOK.
- Karsilastirma ekrani (app.js ~13660/13898) HENUZ baglanmadi.

### 20.7 Dogrulama
node --check app.js SYNTAX_OK · node tools/motor-uret.mjs -> 35 dilim,
imza sha256:84a3e52f61cada8d (4120 icerik satiri) · node tests/uretim-test.mjs ->
73 denetim gecti · node tests/parity.mjs -> FARK 0, 29 karsilastirma noktasi birebir ·
node --check api/_akis.js SYNTAX_OK · mobile tsc --noEmit TEMIZ.
API duman testi 5/5:
- graham yok: s10 6.2 -> skor 49, eksik [graham, haber], guvenKod zayif
- graham ucuz (diffPct -55): skor 53, delta.graham +4, guvenKod kismi
- graham pahali (diffPct +80): skor 45, delta.graham -4
- dusuk bileske: s10 2.6 -> skor 9, olumsuz/bear
- yuksek bileske: s10 8.0 -> skor 77, destekleyici/bull

### 20.8 YENI BULUNAN CANLI ARIZA - ONAY BEKLIYOR (duzeltilmedi)
api/_motor.js:1947-1992 `secTTM` capraz-taban hatasi: `secUniqPeriods` ayni donemin
ILK kaydini tutuyor. Bolunmeden sonra ~12 ay boyunca gecen yilin ara donemi ESKI hisse
tabaninda kaliyor ve TTM HBK bozuluyor. Olculen: GOOGL -18.89, NVDA -2.28.
NOT: bu, daha once varsaydigim "donem ortusmesi" hatasi DEGIL - onu SEC XBRL ile
yanlisladim (NVDA 7.91 = 4.90 + 4.85 - 1.84 DOGRU). Duzeltme skorlari OYNATIR, bu
yuzden ayri ve taze bir "evet" gerekir.
