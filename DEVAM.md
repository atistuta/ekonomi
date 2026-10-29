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
- `/api/causal` girdisini (`hareketler`, `gundem`) ureten uc YOK -> `NedenKart`
  "olcemedim" dalinda.
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
tahmin edilebilir `code`, yazma dahil, CORS `*`) · BIST temel bacagi kirik
(ASELS `/api/analyze` -> `fa=null`) · T24 RSS 403, dort vekil de dusuk ·
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
6. Adli bosluklar: `/api/causal` girdi ucu · liste donem % ham ucu ·
   `depo.ts` `listeBildirimAyarla` yazicisi · `app.js:255` regex karari ·
   ucuz yalniz-TA momentum ikizi (maliyet olcumu).
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
