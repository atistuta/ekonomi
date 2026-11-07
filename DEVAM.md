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

## 13. WEB <-> NATIVE ALAN DENETIMI (OLCULDU 2026-10-29, salt-okunur denetim)

Her web sekmesinin ciziciligi ile native karsiligi ALAN ALAN karsilastirildi.
Siniflandirma, is sirasini kendisi veriyor:

- **A** = native'de kart HIC YOK
- **B** = kart var, alan UCTAN GELIYOR, ekrana BASILMIYOR -> en ucuz is, yalniz `mobile/**`, OTA ile gider
- **C** = uc o alani DONDURMUYOR -> uc genisletmesi gerekir
- **D** = web o sayiyi ISTEMCIDE uretiyor (esik/agirlik/formul/karar cumlesi) -> HAM SAYI KURALI geregi ne uca ne native'e TASINMAZ
- **E** = web tarafi ZATEN BOZUK

### Eslesen durum (gercekten portlanmis)
today 19 alan - calendar 7 - sektor 12 - scan 10 - technical 9 (12 dokum anahtari
+ 24 backtest alani dahil) - earn 9 - search 9 - lists 7 - compare 7 - opps 6 -
general 6 - fundamental 6 - radar 5 - kripto 5 - news 4 - metal 4.

### B sinifi — uc hazir, yalniz basilmiyor (YENI UC GEREKMEZ)
1. **Karsilastir: 15 temel metrik satirinin TAMAMI eksik.** Tek en buyuk bosluk.
   Uc `api/_yfin.js:93-120` donduruyor, native tipler `mobile/src/api/yfin.ts:129-155`
   HAZIR. Web ikizi `app.js:12479` COMPARE_ROWS + `app.js:12927` paintCompare.
2. Takvim temettu satirinda `e.link` basilmiyor (`mobile/src/api/takvim.ts:112` tipli).
3. Momentum kunyesi: `plan.momentum` tipli ama hicbir ekranda yok
   (`grep momentum mobile/src/components` -> 0 eslesme). Web: `app.js:7891`.
4. Haberler `x.type` NEWS/KAP cipleri (`app.js:3371`) ve liste bazli suzgec.
5. Genel `x.region` TR/WORLD cipleri (`app.js:6570`).
6. Firsatlar `r.label`/`r.cls` bandi + surucu/`r.group` etiketleri.
7. Temel kiremitleri (fiyat / piyasa degeri / F-K TTM / HBK), earn `days`,
   Bugun listesinde bilanco yakinligi (alan `/api/yfin?deep=1`'de VAR), `l.notify`,
   `q.delayed` satir imi.

### C sinifi — uc genisletmesi (G1-G5, 0 yeni tasiyici, 0 yeni rewrite)
- **G1** `/api/score` | `/api/analyze` -> HAM gosterge degerleri. Su an HICBIR uc
  donmuyor (`grep` api/score.js api/analyze.js api/_akis.js -> yalniz yorum):
  rsi, stochK/D, macdLine/Signal/Hist, bollUpper/Mid/Lower + widthPct + posPct,
  obvSlope20, ichiTenkan/Kijun/SenkouA/SenkouB, ema20, sma50/sma200 uzaklik,
  mum formasyonu kodu. Web ikizi `app.js:4361 renderTAIndicators`.
- **G2** `/api/yfin` -> `fiftyTwoWeekHigh`/`Low` (52 hafta bandi konumu,
  `app.js:5873`). `api/_yfin.js:93-120` dondurmuyor.
- **G3** `/api/sektor` -> `name`, `industry`, `bizSummary`. `api/_kesif.js` kovaya
  yalniz `sym` + metrik koyuyor, hisse ADI yok (`app.js:10073`).
- **G4** `/api/takvim` -> `temettu[].paid` + gecmis temettu dilimi (`app.js:6649`).
- **G5** `/api/recommend` -> `plan.momentum` ZATEN var; is native tarafta (B-3).

### C sinifi — yeni rota (Y1-Y3 zorunlu, Y4-Y6 istege bagli)
- **Y1** `/api/degisim` — ham donem yuzdeleri (gunici,1,7,30,182,365) + gunici
  `dayChg`. TEK BASINA dort yuzeyi besler: Listeler donem %, Nabiz, Bugun, Arama
  gunluk degisim. Web ikizi `app.js:7978 fillListRows` + `CHANGE_PERIODS`.
- **Y2** `/api/kripto` — market_cap_rank, price_change_percentage_24h,
  total_volume, circulating_supply, max_supply, ath, ath_change_percentage,
  hakimiyet yuzdesi (`app.js:6856`). `api/proxy.js:85` yalnizca beyaz liste.
- **Y3** `/api/metal` — metal haber akisi (`app.js:2180`).
- Istege bagli: **Y4** `/api/sec` (bilanco kiremitleri, Form 4 iceriden islem),
  **Y5** `/api/nabiz`, **Y6** nedensel girdi ureticisi.
- VERCEL: su an 12/12. Y1-Y3 = 3 alt-cizgili tasiyici (`api/_degisim.js`,
  `_kripto.js`, `_metal.js`) + 3 `vercel.json` rewrite -> **YENI FONKSIYON 0**.

### D sinifi — ESITLENEMEZ (tasinmaz, karar gerekir)
todayConj kavusum (`app.js:11602`) - todayAgenda gundem ozeti (`app.js:11270`) -
haber tonu katkisi `sc.senti`/`reasons` - rvol - `r.sudden`/`r.up`/`r.acls` -
MakroNabizKarti'nin tum esikleri - SCAN_PRESETS (`app.js:9170`) + scanCrit/
scanBlend/scanScore - radar `d.heat`/`d.tone` + zincir cumlesi (`app.js:10409`) -
priceOppChip(r.prox) (`app.js:9044`) + newsChip(r.senti) + combined harman -
rowExtrema + computeCompareVerdict - earnScenario (`app.js:9448`) - faVerdict/
c.note - COMPOSITE_SLOT (motorun `composite.blendedShown`'indan FARKLI sayi) -
atrPct yorumu - degerleme dagilim cubugu + manset etiketleri.
SECIM: ya web'den kaldirilir, ya ham girdi tasinip yorum BIRAKILIR. Karar
SORULMADI, Serit 3 bitince sorulacak.

### A sinifi — urun karari gerekir
- **tez sekmesi**: `detay/TezKart.tsx` AYNI SEY DEGIL (motor `direkler`ini basiyor).
  Web'deki tez, kullanicinin kendi yazdigi tez gunlugu: `TEZ_LS_KEY='sb:theses'`
  localStorage (`app.js:9604`), alanlar thesis/pillars/catalysts/risks/target/
  stop/position/conviction. Depolama semasi karari (Supabase?) VERILMEDI.
- Nabiz sekmesinin native karsiligi HIC YOK (0 alan eslesti).
- `renderRecentSearches` (son aramalar), sektorde "bu N hisseyi Karsilastir'da ac",
  tarayici bildirimi.

### E sinifi — web zaten bozuk (port degil ONARIM isi)
- KAP `x.symbol`: `app.js:255` regex, canlida 16/30 `null`. Onarim `app.js` ve
  `api/_takvim.js`'de AYNI ANDA olmali (uc-testi (16)d kilitliyor).
  **ONARILDI §15.1** - sebep `[^*]+`'in blok ici yildizi reddetmesiydi; 16'nin 16'si
  tek bicim (`***KOD ** KOD***`). Yerelde 0 null kaldi; CANLIDA HENUZ DEGIL (deploy yok).
- ~~BIST temel bacagi: `app.js:6129 bistFundamentalModel`; ASELS `/api/analyze` ->
  `fa=null`.~~ **YANLIS TESHIS, bkz. §15.2:** `fa=null`in sebebi kirik bacak degil,
  `market` parametresinin verilmemesi (`_girdi.js:196` `gPazar || 'US'`).
  `&market=BIST` ile `fa.score 82,33`, 16/16 kriter dolu. KOD DEGISTIRILMEDI.

### BU DENETIMIN OLCULMEDIKLERI
- HICBIR EKRAN RENDER EDILMEDI. Denetim salt-okunur kaynak karsilastirmasidir.
- `renderVadeScore` (`app.js:3729`), `renderDisambig` (`app.js:8438`),
  `renderThemeResults` (`app.js:8690`) OKUNMADI.
- `styles.css` gorsel farklari INCELENMEDI (tasarim turunun isi).
- Canli uc dogrulamasi YAPILMADI (yerel DNS arizasi, §12).
- `earnCur`/`earnRevCur` ve `taRange`/`taLegend` sinifi KESINLESMEDI.

## 14. ESITLEME TURU: SERIT 1/2/4 KAPANDI (OLCULDU 2026-10-29/30)

§13 denetiminin is emri 8 serde kuyruklandi. Bu bolum BITEN uclerin ne dondurdugunu
ve neyin HALA GORULMEDIGINI kayda geciriyor.

### 14.1 Serit 2 / G1 - ham gosterge degerleri (BITTI)
Motor 13 gosterge ailesini (`calcSMA/calcEMA/calcRSI/calcMACD/calcBollinger/calcATR/
calcADX/calcStochastic/calcOBV/calcIchimoku/calcFibonacci/calcVolumeProfile/
calcOrderFlow`, app.js:554-1476) ZATEN hesapliyordu ama HICBIRINI uca vermiyordu.
Yeni gosterge matematigi YAZILMADI; var olan degerler yayildi.

- `app.js:1470-1557` `taHamGostergeler(candles)` -> 42 alanli duz sozluk;
  `taHamUcGostergeler(sym, market)` mumlari 5y/1d cekiyor (`api/_akis.js taHam` ile
  ayni pencere; `birKez` ikinci ag turunu onluyor).
- Govdede yeri: `sonuclar[i].ta.ham` (eklemeli, `ta`nin son anahtari).
- Yeni `['mum']` dilimi: `detectCandlePattern` (eskiden app.js:4300, `ta` dilimi
  DISINDA) tasindi; 8 donus `code:` makine kodu kazandi (bullishEngulfing,
  bearishEngulfing, darkCloudCover, piercingLine, bullishHarami, bearishHarami,
  hammer, shootingStar). Turkce `name`/`txt` UCA GITMIYOR.
- BIRIMLER: `bar, ichiBase, ofPencere` = bar sayisi * `fiyat, ema20, sma50, sma200,
  bollUst/bollOrta/bollAlt, atr, tenkan, kijun, senkouA, senkouB, fibHi, fibLo,
  fibFark, vpPoc, vpVah, vpVal, ofFiyatDegisim` = enstruman para birimi, carpan YOK *
  `rsi, rsi3Once, stochK, stochD, adx, plusDI, minusDI, ofAlisYuzde` = 0-100 yuzde
  puani * `macdCizgi, macdSinyal, macdHist, macdHistOnceki` = fiyat birimi fark *
  `obv, obv20Once, ofCvdDegisim, ofBugunDelta` = hacim (adet) * `ofBugunZ` = birimsiz
  kat * `fibYon` = 'up'|'down' * `mumKodu`/`mumSinyali` = sabit kumeli makine kodu.
  Her alanin `null` dali var.
- BILEREK EKLENMEDI: turetilmis oranlar (`bollGenislikYuzde`, `atrYuzde`, OBV degisim
  yuzdesi). Istemci donen referans degerleri kendisi bolsun; motor formulu
  kopyalanmasin.
- **DURUST SINIR:** `fib*`, `vp*`, `of*` PENCEREYE BAGLI. Uc 5y/1d, web gorunen
  periyot -> bu uc grup web kartiyla ESIT OLMAYACAK. `bar` tam bu yuzden donuyor.
- Govdede gercekten gorundugu KANITLANDI (cevrimdisi fixture, `tests/score.mjs
  makeOfflineFetch`, canli ag yok): `/api/score` ve `/api/analyze` 200, `ta.ham` 42
  alan dolu; AAPL rsi 56,12 / macdHist -0,442 / adx 15,50 / obv 3.227.621.400 /
  ichiBase 26. `sayac: yahoo{istek:3, kesinti:0}, tekrar:1` -> ikinci mum istegi
  `birKez` ile tekillestirildi, YENI AG TURU YOK. 12 barlik seri sma50/sma200/rsi/
  adx/atr/of* icin `0` degil `null` dondu.
- Motor imzasi: `_motor.js` sha256 **c26a74d2ebb7bd8b** (2861 satir / 22 dilim);
  `_ayar.js` **75512c5271a89b33** DEGISMEDI (4 vade).
- Kapilar: motor-uret yeniden uretildi, engine.mjs EXIT 0 (79 sembol),
  uretim-test 73, **parity.mjs FARK 0 / 29 - SKOR KAYMADI**, fonksiyon 12.

### 14.2 Serit 4 - G2/G3/G4 uc genislemeleri (BITTI, her birinde EK ISTEK 0)
- **G2 52-hafta** `api/_yfin.js:132-141`: `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`,
  `summaryDetail`ten `num()` ile (-> `null`, asla 0). Adlar web ikiziyle eslendi
  (app.js:5917/6258/7873), `api/chart.js:139 kunye` ve `types.ts:445-446` zaten bu
  adlari ilan ediyordu. Bant konumu SUNUCUDA HESAPLANMADI (turetme; app.js:5918
  ekranda kuruyor). Canli dogrulandi (crumb el sikismasi): AAPL hi 351,73 / lo
  243,42 * ASELS.IS hi 450 / lo 171,5. `summaryDetail` zaten isteniyordu -> EK
  ISTEK 0.
- **G3 sektor adi** `api/_kesif.js:441-467`: `name`, `industry`, `bizSummary`,
  `bizSummaryKirpik`. Yeni sabit `SEKTOR_BIZ_AZAMI = 400` (:143-152); sozlesme
  yorumu :393-402. Kirpma SESSIZ DEGIL (`bizSummaryKirpik: true`). Olculdu: ASELS.IS
  `longBusinessSummary` 1991 karakter -> kirpma gercekten oluyor. Alanlar
  gruplama/medyan/siralamaya GIRMIYOR. `res.name || u.symbol` geri dusmesi
  (sembolu ad sanmak, app.js:10079) BILEREK PORTLANMADI. Bu uc aga cikmiyor,
  alanlar istemcinin POST govdesinde zaten vardi -> EK ISTEK 0.
- **G4 temettu `paid`** `api/_takvim.js`: `'paid'` `TEMETTU_MADDE_ALANLARI`na eklendi
  (:106-109; mevcut alti ad/birim/tip DEGISMEDI, `yieldPct` hala yuzde puani, x100
  YOK). Iki yeni SAF fonksiyon (:187-240): `trTakvimGunu(ms)` -> TR yerel gun
  `YYYY-MM-DD`, **tamsayi aritmetigiyle (Hinnant civil_from_days)** cunku uc-test
  (16c)/(16k) bu dosyada `new Date`/`Date.now` YASAKLIYOR; 8 vaka ile dogrulandi (UTC
  20:30 -> onceki gun, 21:30 -> sonraki gun, 2024-02-29 artik, 2000-12-31T23:00Z ->
  2001-01-01, NaN/string -> `null`). `temettuOdendi(tarih, bugun)` -> `true|false|
  null`, app.js:6681 `paid: d.date <= today` ikizini `<=` dahil koruyor, sozluksel
  ISO karsilastirma; olculemezse `false` DEGIL `null`.
  `ayristirTemettu(html, azami, bugun = null)` -> ucuncu parametre OPSIYONEL, saat
  ICERIDE HIC OKUNMUYOR (fonksiyon saf kaldi). Saat TEK yerde okunuyor:
  `api/_kesif.js takvimHandler` -> `bugun = trTakvimGunu(Date.now())`. Govde
  `temettuGecmisAdet`, `temettuGelecekAdet`, `temettuBugun` kazandi; onbellek
  anahtari artik `bugun` iceriyor (dunun `paid`i servis edilmesin). KAP sembol
  ayristirmasi DOKUNULMADI.
  **OLCULEN TUZAK (sozlesme yorumuna yazildi):** kaynak aylari JANUARY->DECEMBER
  basiyor ve `ayristirTemettu` maddeleri BELGE SIRASIYLA tavana kadar aliyor. Yilin
  ikinci yarisinda varsayilan 120 tavani GECMIS satirlarla dolabilir ve gelecek
  temettuler HIC gorunmez. Mevcut davranis, BILEREK degistirilmedi; istemci
  `temettuGelecekAdet === 0 && temettuAdet === temettuAzami` ise `temettuAdet=400`
  ile yeniden sormali.

### 14.3 Serit 1 - B sinifi native alanlar (7 kalemin 5'i cizildi)
- Karsilastir tablosu `components/analiz/KarsilastirKart.tsx:1-60`: web sirasi/
  etiketleri birebir 15 satir, yatay ScrollView (etiket 150 / hucre 108 = webin
  170/148px karsiligi). `analiz.tsx` -> `kunye={kunye.veri}`: MEVCUT tek
  `/api/yfin` turu paylasildi, IKINCI AG TURU YOK. `rowExtrema` ve
  `computeCompareVerdict` BILEREK yok (istemci kiyas/karar uretmez).
- Temel kiremitleri `components/detay/TemelKart.tsx`: Son Fiyat / Piyasa Degeri /
  F-K (TTM) / HBK (TTM). `marketCap` `AnalyzeRow`/`ScoreFa`da YOK; webin
  `price x (ni/eps)` turetmesi istemci formulu olurdu -> kart `detay/` emsaline
  uyup kendi `fetchYfin([sembol], {deep:false})` turunu atiyor.
- Haber tur cipleri: `types.ts` `HABER_TURLERI = ['NEWS','KAP']`, `HaberMadde`ye
  `type?: string` + `symbol?: string | null`. Uc bu ikisini HER ZAMAN gonderiyordu
  (`api/_haber.js:81`, `:242`) ama dort alanli sozlesme tipi ekrana ulastirmiyordu.
  Opsiyonel birakildi ki `undefined` dali ayirt edilebilsin. Cipler YALNIZ en az bir
  maddede `type` doluysa ciziliyor; suzme esitlik, ESIK YOK. Ucuncu dal: "suzgec
  listeyi bosaltti" mesaji, "hic haber yok"tan AYRI.
  DURUSTLUK NOTU: bu tasiyici yalniz 'NEWS' uretiyor -> 'KAP' cipi "olctum, yok"
  sonucu verir.
- Firsatlar bandi `components/kesfet/FirsatlarKart.tsx`: bant YALNIZ uctan
  (`composite.label ?? composite.band`, `ta.label`, `ta.cls`), ESIKTEN BANT
  TURETILMEDI; `ta.breakdown`in ilk 2 kalemi motorun sirasiyla + "+N gosterge daha".
  Pill tonu bilerek notr (`cls`e gore renklendirmek istemci yorumu olurdu).
- `plan.momentum` `components/detay/RiskOdulKart.tsx`e BLOK olarak eklendi (yeni kart
  yok, `(tabs)/_layout.tsx` ACILMADI; gerekce: momentum `plan`in dorduncu uzvu,
  `seviye`/`riskOdul` ayni kartta). Basilan ham alanlar: `active`, `trendAligned`,
  `adx`, `gapPct`, varsa `zone` -> fiyat bandi. `momentum === null` -> "olculmedi".
  `sma50`/`sma200` govdede var ama BASILMADI (ayni iki kalem `seviye` bolumunde
  zaten var; ikinci kez basmak iki ayri olcum sanisi verirdi).
- **YAPILAMADI, UCTA ALAN YOK (2 kalem):** (a) temettu satirinda baglanti -
  `TakvimTemettuMadde` = {symbol,date,dateHam,amount,yieldPct,currency} ve
  `api/_takvim.js:106` ayni ALTI alani beyaz listeliyor, `link` YOK; sembolden
  KAP/Mynet adresi kurmak UYDURMA BAGLANTI olurdu. (b) haber bolge cipleri - web
  `x.region` ile suzuyor (app.js:6570) ama bu ucta `region` alani HIC yok
  (`api/_haber.js`/`api/news.js`te tek eslesme yok). Yerellik ISTEK parametresi
  (`?market=TR|US`), o yuzden karttaki mevcut TR/US cipleri suzme DEGIL YENI OLCUM
  turu aciyor; "Tumu" cipi madde basina kokeni soylenemez hale getirirdi. Iki karta
  olcum notu dusuldu, islevsel degisiklik yapilmadi.
- **YUZDE BICIMI OLCULDU (x100 uydurulmadi):** `profitMargin`/`returnOnEquity`/
  `revenueGrowth`/`dividendYield` = KESIR (0-1), kanit: KO 0,0229 * AAPL 0,0031 *
  THYAO.IS 0 + `api/_yfin.js:105-110` Yahoo alanini dogrudan geciriyor. Web x100
  yapiyor, native YAPMIYOR -> `formatOran(v,4)`, olcek etikette yazili.
  `debtToEquity` = YUZDE PUANI (150 = 1,50x) -> `formatOran(v,1)`.
  `takvim.yieldPct` = YUZDE PUANI -> `formatPercent`.
  `plan.momentum.gapPct` = KESIR (`api/_motor.js:963` `(p - bzTop) / p`); adindaki
  "Pct" ALDATICI, `formatPercent` sayiyi 100 kat kucuk gosterirdi -> `formatOran`.

### 14.4 Donmus alan kumesi kilitleri KIRILDI (beklenen)
Alan eklemek bu korumalari ZORUNLU olarak kirar; `tests/uc-test.mjs` tek seferde
guncellenecek (dosya Serit 3'te):
- (15d) (~4166) `grup hissesi alanlari SABIT`: beklenen `basis,forwardPE,market,peg,
  profitMargin,revenueGrowth,sym,trailingPE` -> yenisi `basis,bizSummary,
  bizSummaryKirpik,forwardPE,industry,market,name,peg,profitMargin,revenueGrowth,
  sym,trailingPE`.
- (16a) (~4793) `temettu madde alan kumesi yazili`: `symbol,date,dateHam,amount,
  yieldPct,currency` -> `...,paid`. Kardes (16h) GECIYOR (sabit listesi de
  guncellendi).
- (16c)/(16k) tur ortasinda `new Date(` yasagiyla kirilmisti -> ONARILDI.

### 14.5 metin-test onarildi (ESKI ARIZA, bu turun isi degil)
`tests/metin-test.mjs` 2 dogrulama kaliyordu. Kanit eskiden geldigini gosterdi:
`git show HEAD:app.js | grep -c "<code>"` -> 2. Bicim/ceviri katmani (HTML -> token
-> RN betimleyici gidis-donusu) YALNIZ b/em/i/br taniyor; app.js:8812
`<code>/api/theme</code>` tasiyordu ve 55 cumleden YALNIZ BIRI boyleydi. Bicim
dagarcigini web ve native boyunca genisletmek yerine o tek cumle `<b>` yapildi
(patlama yaricapi kucuk olan). app.js:8857'deki ikinci `<code>` bir
`why = ...ts-info...` HTML dizgisinin icinde, korpus cumlesi DEGIL -> test onu
isaretlemiyor, DOKUNULMADI.
Sonuc: `node tests/metin-test.mjs` EXIT 0, 31 dogrulama gecti.

### 14.6 BU BOLUMUN OLCULMEDIKLERI
- **HICBIR SEY RENDER EDILMEDI.** Bu turda Expo turu, simulator, ekran goruntusu,
  tarayici YOK. Tum native ve web iddialari yalnizca tip/lint/politika/fixture
  kapilarina dayaniyor. Tek render kaniti kullanicinin cihazi olacak.
- Bu turun HICBIR isi CANLI UCTA dogrulanmadi (yerel DNS arizasi §12).
  `/api/yfin|sektor|takvim|score|analyze` govdeleri uretimden CEKILMEDI.
- `/api/takvim`in `paid`/`temettuGecmisAdet`/`temettuGelecekAdet` alanlari gercek
  temettuhisseleri.com HTMLine HIC kosturulmadi; 400/502 dallari halen gorulmedi.
- `bizSummary` 400 karakter tavani TEK sembolde olculdu (1991 -> 400); 20 sembollu
  govde AGIRLIK OLARAK olculmedi.
- Web teknik sekmesi `code:` eklendikten sonra RENDER EDILMEDI (`node --check`
  gecti ve `renderTAIndicators` `cp.name/cp.sig/cp.txt` okuyor, yani yeni `code`
  alani etkilememeli - ama GORULMEDI).
- KV onbellek isabet dali yerelde HIC kosmadi (`kvHazir()` false). `ta.ham` yalniz
  `tam:true` govdelerle onbellege girer; motor imzasi degisimi eski anahtarlari
  kendiliginden gecersiz kilar - canli KVde OLCULMEDI.
- OTA HIC CALISTIRILMADI; zincir build 7c30803e-c120-4761-8adf-83a94d0392aa ile
  kapanacak.
- `npm audit` 15 zafiyet (5 dusuk, 3 orta, 7 yuksek); kokeni olculmedi, `audit fix`
  kosturulmadi.

## 15. SERIT 6 - E SINIFI ONARIM (OLCULDU 2026-10-30)

### 15.1 KAP sembol ayristirma - ONARILDI
OLCUM (canli, `--resolve day-starter.vercel.app:443:64.29.17.67`,
`/api/takvim?kapsam=hepsi`, HTTP 200, 22919 bayt): 30 KAP maddesi, **16'sinda
`symbol: null`** - bildirilen 16/30 BIREBIR dogrulandi.

**Kritik bulgu: null kalan 16 maddenin 16'si DA TEK BIR BICIM** - `***KOD ** KOD***`
(blok ICINDE iki-yildiz ayrac). Baska kacirilan bicim YOK, sayim tam. Gercek
basliklar:
- `***GARAN ** TGB*** TURKIYE GARANTI BANKASI A.S. (Banka Finansal Rapor)` (5 madde)
- `***TCR ** NOI*** TACIRLER PORTFOY YONETIMI A.S. (Portfoy Dagilim Raporu)` (5 madde)
- `***DESA ** MNDTR ** OYYAT ** TSKB ** KRPLS ** MEDTR ** AGESA ** YKSLN ** BRISA
  ** EGGUB ** ENJSA*** BORSA ISTANBUL A.S. (BIST Pay Endeksleri)` - 11 kodlu

SEBEP: `/\*\*\*([^*]+)\*\*\*/` icindeki `[^*]+` blok ICI yildizi REDDEDIYOR ->
hic eslesmiyor -> `[]` -> `symbol: null`.

DEGISIKLIK (iki ikiz AYNI ANDA, `[^*]+` -> tembel `[\s\S]+?`):
- `app.js:264` (`tickerBlock`), gerekce yorumu eklendi
- `api/_takvim.js:243` (`kapSemboller`), ikizlik + olcum notu eklendi
Kapanis HALA UC yildiz ariyor; tembel oldugu icin `***A*** metin ***B***` iki blogu
BIRLESTIRMIYOR.

DEGISIKLIGIN OLCUMU (ayni 30 canli madde uzerinde yeniden kosturuldu):
**16 duzeldi, 0 null kaldi, onceden ayrisan 14 maddenin HICBIRINDE degisiklik yok.**
Sembol uydurulmadi; bicim tutmayan satir yine `null`.

COKLU SEMBOL KARARI: mevcut davranis KORUNDU - `symbol` = ilk kod, tamami `tickers`
dizisinde. Gerekce: `tickers` ZATEN var ve `KAP_MADDE_ALANLARI`nda ilan edilmis; yeni
alan eklemek (16g)'nin alan-kumesi kilidini ve `_haber.js` suzgecini (tek kod okuyor)
gereksiz kirardi. Virgulle tikistirma YAPILMADI.

### 15.2 BIST temel bacagi - ARIZA DEGIL, KOD DEGISTIRILMEDI (ONCEKI IDDIA YANLIS)
Onceki turlar `/api/analyze` ASELS -> `fa: null` olcumunu "BIST temel bacagi kirik"
diye kaydetmisti. **Bu teshis YANLIS.** `bistFundamentalModel` (app.js:6060) KIRIK
DEGIL ve DEGISTIRILMEDI.

OLCUM: canli `/api/analyze?symbol=ASELS` cevabinda kritik alan **`"market":"US"`**;
sayaclar `bist:{istek:0, kesinti:0}`, `sec:{istek:1, yok:0}`. Yani **BIST bacagi HIC
KOSMADI**. `fa.why: "secFetchModel null"`, `ta.why: "mum alinamadi: yahoo 404"`
(Yahoo'ya `ASELS.IS` degil ham `ASELS` gitti).

SEBEP `api/_girdi.js:196`: `market: gPazar || 'US'` - pazar SORGUDAN gelir, sembolden
CIKARSANMAZ (dosyanin kendi sozlesmesi, satir 109-121). `market` verilmeyince ASELS
bir US sembolu sayildi, SEC'te CIK yok -> `fa: null`. **Bu DOGRU davranis** (olculmeyen
sayi basilmiyor).

KARSI OLCUM: `/api/analyze?symbol=ASELS&market=BIST` -> `market:"BIST"`,
**`fa.score: 82,326178`**, `present: 16`, `total: 16`, `price: 358,5`,
`years: [2025, 2024, 2023, 2022]`, 16 kriterin hepsi dolu; `ta.score: 54,690273`.
**BIST temel bacagi CALISIYOR.** Hicbir kaynak 404/403 vermiyor, ayristirma bos
donmuyor, erken `null` cikisi yok. Sahte/varsayilan FA skoru URETILMEDI.

ACIK URUN KARARI (olculmedi, karar verilmedi): `/api/analyze` pazari sembolden
cikarsasin mi? Istemci `market` gondermeyi unutursa BIST sembolu sessizce US sanilir.
Bu `api/_girdi.js`in ilan edilmis sozlesmesi; degistirmek ayri bir is.

### 15.3 Serit 6 kapilari
`node --check app.js` EXIT 0 * `motor-uret.mjs` "degisiklik yok" (`_motor.js`
sha256:c26a74d2ebb7bd8b, `_ayar.js` 75512c5271a89b33 - KAP ayristirici `DILIMLER`
beyaz listesinde degil, motora girmiyor) * **`parity.mjs` FARK 0 / 29 - skor
KAYMADI** * `engine.mjs` EXIT 0 (79 sembol) * `uretim-test` 73 * fonksiyon 12 *
`uc-test` EXIT 1, 3 basarisiz / 1341 denetim.

### 15.4 uc-test: kirilan UC madde ve YENI DOGRU BEKLENENLERI
`tests/uc-test.mjs` Serit 3'te; ucu TEK SEFERDE guncellenecek.
1. **(16d)** (iddia kaynagi ~4860, cikti satiri 1315) - eski beklenen
   `TAKVIM.kapSemboller('***OMP ** ODP*** Birlesme').length === 0`; simdiki gercek
   `OMP,ODP` (uzunluk 2). Yeni dogru beklenen: `.join(',') === 'OMP,ODP'`. Ustundeki
   4855-4859 yorum blogu ("regex BIREBIR korundu ... duzeltme IKI YERDE ayni anda
   yapilsin") artik YANLIS - duzeltme iki yerde yapildi, yorum guncellenmeli.
   (16d)'nin diger 4 maddesi ve (16g)'nin TAMAMI GECIYOR (tek kod, yildizsiz virgullu
   coklu, kod yok -> `[]`, `***bist100 ASELS COKUZUNKOD***` -> `ASELS`).
2. **(15d)** (~4166, cikti 1125) `grup hissesi alanlari SABIT` -> §14.4'teki yeni
   kume (Serit 4'un `api/_kesif.js` eklemeleri).
3. **(16a)** (~4793, cikti 1295) `temettu madde alan kumesi yazili` -> `...,paid`
   (Serit 4). `git show HEAD:api/_takvim.js` ile dogrulandi: HEAD'de 6 alan, calisma
   kopyasinda 7.

### 15.5 Serit 6 OLCULMEDIKLERI
- Duzeltme DEPLOY EDILMEDI (commit/push yasak) -> **canli `/api/takvim` HALA eski
  regexle 16 null basiyor.** Olcum yerel kodla, canli 30 maddenin GERCEK ham
  basliklari uzerinde yapildi.
- `***A*** metin ***B***` (ayri iki blok) bicimi canli 30 maddede HIC GORULMEDI; yeni
  regexin ilk blogu alacagi mantikla dogru ama GERCEK VERIYLE dogrulanmadi.
- Sure/gecikme olculmedi (yerel DNS bozuk; `--resolve` ile yalniz icerik cekildi).
- **Deploy edilmis motor sha `e9e8ecf78db80c02` (canli cevaptan) yerel uretilenle
  `c26a74d2ebb7bd8b` AYNI DEGIL** - bu turun yayinlanmamis `app.js`/`_motor.js`
  degisiklikleri. Beklenen; Serit 6 motoru hic degistirmiyor.
- `temettu` bacaginin DOGRULUGU olculmedi (kapsam disi).

## 16. SERIT 3 + SERIT 5 KAPANDI (OLCULDU 2026-10-30)

### 16.1 Serit 3 - uc yeni tasiyici + uc-test (17) bolumu
DURUM: tamam. `api/_degisim.js` (549 satir), `api/_kripto.js` (359),
`api/_metal.js` (~292) yazildi; `api/proxy.js` HANDLERLAR kaydi (satir 102-104) ve
`vercel.json` rewrite'lari (satir 33-35) yerinde. **Fonksiyon sayisi 12** - Hobby
tavani korundu, hicbir oneksiz `api/<ad>.js` acilmadi.

KAPI SAYILARI (ana oturumda BAGIMSIZ yeniden olculdu, ajan iddiasina guvenilmedi):
```
node --check (3 modul + proxy.js + uc-test.mjs)  5/5 OK
ls api/*.js | grep -v '/_' | wc -l               12
node tools/motor-uret.mjs    degisiklik yok * _motor.js c26a74d2ebb7bd8b
                                            * _ayar.js 75512c5271a89b33
node tests/parity.mjs        EXIT 0 * FARK 0 * 29 nokta birebir (DEGISMEDI)
node tests/engine.mjs        EXIT 0 * 2861 satir * 79 motor sembolu
node tests/uretim-test.mjs   EXIT 0 * 73 denetim
node tests/uc-test.mjs       EXIT 0 * 1501 denetim * 0 basarisiz
                             (onceki tur: 1341 denetim * 2-3 basarisiz)
```

#### Duzeltilen arizalar
1. **`api/_metal.js` SAHTE 502.** Besleme sayimi `s.value.tam` okuyordu; `tam`
   `_haber.js:330`'da PAYLASILAN sayactan uretiliyor, yani 6 paralel beslemeden BIRI
   dustugu an sonraki her cagri `tam:false` donuyor ve 5 besleme okunmusken uc 502
   `metal_alinamadi` basabiliyordu. Sayim `if (maddeler.length > 0) okunan++` oldu -
   `_haber.js:521` `gundemCek`in OLCULMUS kalibi. uc-test (17)g kaynak kalibi kilitliyor.
2. **`api/_metal.js` yorumunda DOGRULANMAMIS IDDIA.** Baslik uc `ysym`in
   `/api/degisim`e gonderilebilecegini soyluyordu. Olculdu: `ENDEKS_SOZLUGU` yalniz
   `GC=F` tasiyor; `SI=F`/`PL=F` yok ve `SEMBOL_BICIM` (`_girdi.js:79`) `=` karakterini
   reddediyor -> 400 `bad_sembol`. Yorum olculen 1/3 sinirini yaziyor; bayat
   `app.js:6896` referansi `app.js:6907` oldu. `/api/chart` sozlugu GENISLETILMEDI.
3. **§15.4'te YAZMAYAN DORDUNCU kirik iddia: uc-test (15)b.** Uc yeni rewrite,
   (15)b'nin iki "ters yon" kilidini kirmisti (`ROTALAR u {yfin}` DISINDA rewrite YOK;
   rewrite sayisi = ROTALAR + yfin, olculen 11). Duzeltme ELLE liste kopyalamadan:
   `api/proxy.js:106` artik `export const TASIYICI_ROTALARI = Object.freeze(...)`
   veriyor, test onu ice aliyor (`uc-test.mjs:172`). Tek kaynak: vercel.json <->
   proxy.js <-> modulun kendi ROTA'si.
4. §15.4'teki uc iddia duzeltildi: (16)d `kapSemboller('***OMP ** ODP*** ...')` ->
   `'OMP,ODP'` (ustundeki yorum blogu da), (15)d grup-hisse alan kumesi, (16)a temettu
   alan kumesine `paid`.

#### uc-test (17) neyi kilitliyor
- **(17)a yuzey:** `TASIYICI_ROTALARI` = degisim,kripto,metal * dondurulmus * her
  modulun ROTA/HANDLERLAR tekligi * `_kesif.js` ROTALARI ile AYRIKLIK (ayni ad iki
  tabloda olsa proxy `_kesif.js`i ONCE deneyip bu uclari sessizce golgeler).
- **(17)b 13. fonksiyon kilidi:** oneksiz `api/*.js` = 12 * uc dosya `_` onekli * her
  rewrite `/api/proxy?__rota=<ad>` * proxy.js belirteci LITERAL `import('./_X.js')` -
  `import(degisken)` Vercel paket izleyicisi tarafindan IZLENMEZ, dosya bundle'a
  girmez, uc canlida 404 verir * elle `=== 'degisim'` dali yok * vercel.json
  `functions` blogu buyumedi.
- **(17)c konak ikizligi:** modulun `IZINLI_KONAK`i proxy.js `IZINLI_KONAKLAR`inda da
  var * `izinliAdres` http/yabanci konak reddi * `_degisim`/`_kripto`da TEK `fetch(` +
  AbortController * `_metal.js`te SIFIR `fetch(` (ag `_haber.js haberCek`inde, ikinci
  RSS ayristiricisi dogmadi).
- **(17)d yontem/400:** OPTIONS 204 + CORS kumesi * POST 405 + `Allow` + kisa onbellek
  * degisim `semboller_yok`/`cok_sembol`/`bad_sembol`/`bad_donem` * kripto
  `kripto_id_yok`/`cok_id`/`bad_id` * metal `bad_maden`/`bad_kapsam`/`bad_limit` *
  toplu suzgec: her govde UYARI tasiyor, HTML/yigin izi yok, `error` makine kodu
  (`^[a-z_]+$`).
- **(17)e-f-g saf ayristiricilar + SOZLESME KILITLERI:** `SATIR_ALANLARI` 9 alan,
  `DONEM_ANAHTARLARI` 6 donem, coin kaydi 13 alan, `MADDE_ALANLARI` ikizligi,
  `METALLER` TR/dunya sorgulari `config.js` ile birebir, `__proto__`/`toString`
  sizmiyor, `marketTs`/`athTs` MILISANIYE, `null` ASLA 0.
- **(17)h sizinti:** `Intl`/`toFixed`/`toLocaleString`/esik-agirlik-skor sozcugu yok *
  `_motor.js`/`_ayar.js`/`_ag.js` ice alinmiyor * `detail:`/`writeFileSync` yok *
  e-posta/anahtar yok * UYARI dizgesi birebir * UA'da `@` yok *
  `score.js`/`recommend.js`/`analyze.js` uc tasiyicidan HICBIRINI tanimiyor.

AG YASAGI (17)'de daha kati: bu uc handler gecerli girdide KV'ye ya da aga cikiyor.
Bu yuzden handler YALNIZ (a) OPTIONS, (b) GET-disi yontem, (c) dogrulamadan DONEN
sorgularla cagriliyor - ucunde de dogrulama bloklari onbellek anahtarindan ONCE return
ediyor (olculdu). Gecerli girdiler yalniz saf disa aktarimlarla sinaniyor. uc-test
modul duzeyinde `api/proxy.js`i ice aliyor; guvenli, cunku proxy.js modul duzeyinde
yalniz `_yfin.js`i aliyor ve `_yfin.js`teki her `fetch` fonksiyon ICINDE (satir 36, 38,
79, 159 olculdu).

### 16.2 Serit 5 - Serit 2/4 alanlarinin native cizimi
DURUM: tamam, 8 dosya `mobile/src/**` icinde. Tek satir motor matematigi eklenmedi;
turev oran hesaplanmadi. `(tabs)/_layout.tsx` ACILMADI (git ile dogrulandi: 0 degisik).

- **`ta.ham` (42 alan) -> `mobile/src/components/detay/TeknikKart.tsx`** (+306/-2).
  `types.ts`te `ScoreTa.ham?: TaHam | null` (tip `TaHam` zaten 42 alanla tanimliydi).
  11 bolum, her satirda anahtar + BIRIM notu (para / 0-100 puan / fiyat-birimi fark /
  hacim adet / birimsiz kat / bar sayisi). `ham.bar` ekranda basiliyor; `fib*`/`vp*`/
  `of*` bolumleri "pencereye bagli, web kartiyla ayni sayiyi vermez" notuyla isaretli.
  `mumKodu`/`mumSinyali`/`fibYon` yalniz ad cevirisiyle basiliyor (esik/sira/agirlik
  yok); bilinmeyen kod HAM basiliyor. Uc dal ayri: alan govdede yok = "uc gondermedi",
  `null` = "olculemedi - sifir DEMEK DEGIL", sayi = basilir. 0/"" asla basilmiyor.
  **UCTA ALAN YOK:** para alanlari icin para birimi kodu yok (`AnalyzeRow`/`ScoreTa`
  uzerinde kur alani yok) -> kur kodsuz basiliyor, birim etikette yaziyor. Uydurulmadi.
- **`fiftyTwoWeekHigh`/`Low` -> `mobile/src/components/detay/TemelKart.tsx`**
  (+185/-12). `src/api/yfin.ts`e iki alan eklendi, iki `Kiremit` olarak basiliyor.
  **YENI AG TURU ACILMADI** - kartin mevcut `fetchYfin([sembol], {deep:false})` turu
  paylasildi. Bant konumu/yuzdesi HESAPLANMIYOR; ekran bunun turev oran oldugunu ve bu
  ekranda hesap yapilmadigini aciktan yaziyor.
- **`/api/sektor` kimlik alanlari -> `mobile/src/components/kesfet/SektorKart.tsx`**
  (+42). `name`/`industry`/`bizSummary`/`bizSummaryKirpik` tipe eklendi, `name *
  industry` satiri + is tanimi blogu cizildi. **DIKKAT (gerekli duzeltme):**
  `olcumYap()` payload'i `bizSummary` GONDERMIYORDU, eklendi - yoksa uc yankilayacak
  metin bulamiyor. Kirpma sessiz degil: `bizSummaryKirpik` true ise "uc 400 karakterde
  KIRPTI" + "ekranda 3 satira sigdirildi" yaziliyor.
- **`/api/takvim` temettu -> `mobile/src/components/bugun/TakvimKart.tsx`** (+124/-11).
  `paid` uc dal (GECTI / GELECEK / "gecti mi OLCULEMEDI" / "uc GONDERMEDI").
  `temettuGecmisAdet`/`temettuGelecekAdet`/`temettuBugun` sayac blogu; `paid === null`
  satirlarin iki sayima da GIRMEDIGI ekranda yaziyor. **TAVAN TUZAGI UYGULANDI:**
  `temettuGelecekAdet === 0` VE tavan dolu ise ayni `cagri` icinde `temettuAdet=400`
  ile BIR KEZ yeniden soruluyor; genis tur duserse olculmus ilk tur korunuyor;
  kullaniciya "400 satirla YENIDEN soruldu" notu basiliyor. `src/api/takvim.ts`e
  `TAKVIM_VARSAYILAN_TEMETTU = 120` ucun ILAN ETTIGI varsayilan olarak BELGELENEREK
  eklendi (uydurma degil), `src/api/index.ts`ten export edildi.

CIZILEMEYEN / KASITLI YOK: bant konumu, degisim %, herhangi bir turev oran.
`OlcumKayit`e `bizSummaryKirpik` eklenmedi - o tip ISTEK govdesi, bayragi uc hesapliyor.

TUZAK (ogrenildi): yeniden sorma mantigini `useEffect`+`setState` ile kurmak eslint
`react-hooks/set-state-in-effect` veriyor; bayragi `ref`te tutup render'da okumak da
`react-hooks/refs` veriyor. Dogru sekil: karar fetch callback'inin ICINDE, bayrak
`useState`, `setState` `await` SONRASINDA (callback bagimliliklarinda degil, dongu yok).

KAPILAR (tsc ana oturumda BAGIMSIZ yeniden olculdu): `node
./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` **EXIT 0** * `npx eslint`
(8 dosya) 0 hata 0 uyari * canli `Intl`/`toLocale` cagrisi **0** (tek eslesme
`TakvimKart.tsx:69` YORUM satiri) * eklenen satirlarda yasak kelime 0 (dosyalardaki
eslesmeler onceden vardi: feragatname, `FA_ETIKET` muhasebe terimleri, mevcut
"Firsatlar" kart adi).

### 16.3 Bu bolumun OLCULMEDIKLERI
- **Uc yeni uc CANLIDA DOGRULANMADI** - deploy edilmedi (commit/push onayi yok).
  Gercek Yahoo chart / CoinGecko / Google News govdeleri, KV onbellek davranisi ve 502
  yolu olculmedi. Ilk deploy'dan sonra `/api/degisim`, `/api/kripto`, `/api/metal`
  `--resolve day-starter.vercel.app:443:64.29.17.67` ile ICERIK bazinda dogrulanmali
  (SURE olculmez; yerel DNS arizasi her DNS'li olcumu ~13 sn sisiriyor, §12).
- **HICBIR SEY RENDER EDILMEDI.** Simulator/Expo/`expo start` calistirilmadi, ekran
  goruntusu alinmadi. Tum native iddialar yalniz tip/lint/politika kapilarina dayaniyor;
  tek render kaniti kullanicinin cihazi olacak.
- Canli uc cevabiyla karsilastirma yapilmadi: `ta.ham`, `paid`, `temettuGelecekAdet`
  gercek govdeyle eslestirilmedi.
- `tests/duman.mjs` ve `tests/capture.mjs` kosturulmadi, `baseline.json` elle
  duzenlenmedi.
- Commit/push/`git add` YOK. KAP duzeltmesi (§15.1) HALA CANLIDA DEGIL.

## 17. SERIT 7 KAPANDI - A SINIFI SON KALEMLER (OLCULDU 2026-10-30)

### 17.1 ONCUL DUZELTMESI - "Nabiz webde var, nativede yok" YANLIS

Serit 7'nin brief'indeki K1 onculu olculebilir sekilde hatali cikti, iki
yarisi da tutmuyor:

- `grep -n "api/pulse" app.js` -> yalniz iki YORUM satiri (`app.js:10759`,
  `app.js:11981`). Web `/api/pulse`'u HIC CAGIRMIYOR, nabzi yerel hesapliyor.
- Native'de `MakroNabizKarti()` `mobile/src/app/(tabs)/bugun.tsx:386`'da
  ZATEN cizili, `:270`'te monte. §4 de bunu soyluyordu.

Bu yuzden yeni ekran ya da rota ACILMADI - ikinci bir yuzey ayni govdeyi
iki kez cizmek olurdu. 5 menu duzeni ve `(tabs)/_layout.tsx` ellenmedi
(`git status --short` -> BOS).

Onun yerine ucun GERCEKTEN donderdigi ama basilmayan alanlar kapatildi
(+42 satir, YENI AG TURU YOK - mansetler ayni pulse yanitinin icinde):
`haberler.faiz`, `haberler.enflasyon`, `haberler: null` icin ayri
"govdede YOK" dali, `haberler.sorgu[].maddeler` (gercek mansetler,
`HaberSatiri` ile) ve `surum.ayar`. Sorgu sabiti `NABIZ_SORGU = 'Fed faiz'`.

`konjonktur` nativede HEP `null`: uc onu ancak cagirici `genislik` /
`enflasyonBaskisi` / `risk` yollarsa hesapliyor, native'in boyle bir
kaynagi yok -> "olculemedi" dalinda basiliyor, UYDURULMUYOR.

### 17.2 K2 Son aramalar - depo katmani vardi, TUKETICISI yoktu

Dosya: `mobile/src/app/(tabs)/arama.tsx` (+121) + `mobile/src/api/index.ts` (+2).

YOL DUZELTMESI: dogru yol `mobile/src/api/depo.ts`. DEVAM.md'de ve
brief'te gecen `mobile/src/lib/depo.ts` YOK (`ls` -> No such file).
`AZAMI_ARAMA = 12`, `AramaKaydi`, `aramaSuz`, `aramalarDepo`,
`useAramalar()`, `aramaHatirla()` hepsi zaten hazirdi; `depo.ts`
DEGISMEDI (`:942`'deki mesru `toLocaleUpperCase('tr-TR')` ellenmedi).
`aramaHatirla` barrel'dan export edilmiyordu -> `api/index.ts`'ye eklendi
ki ekran `@/api/depo`'ya uzanmasin.

Uc dal ayri basiliyor: depo okunmadi = "BILINMIYOR" * `[]` = "kayit yok"
* dolu = buton listesi. Yazim TEK KAPIDAN (`olc()`): hem Enter hem
"Sembol olc" butonu oradan geciyor. Temizleme `aramalarDepo.temizle()` -
bos dizi YAZILMIYOR, kayit siliniyor. Tema metni sembol DEGIL ve pazari
olculmemis -> kaydedilmiyor, ekranda da boyle yazili. Kayit cihazdan
cikmiyor, yeni bagimlilik yok.

### 17.3 K3 Sektor -> Karsilastir koprusu

Dosyalar: `mobile/src/components/kesfet/SektorKart.tsx` (+95, kaynak) +
`mobile/src/app/(tabs)/analiz.tsx` (+71, hedef).

Mevcut `tema` oruntusu izlendi: `SektorKart.tsx:334`
`router.navigate({ pathname: '/analiz', params: { kiyas: tasinan.join(',') } })`
(yol parametresi metin tasidigi icin virgulle ayrik). `analiz.tsx:187-193`
`kiyas`'i ayristirip `kiyasListesi` olarak `fetchCompare`'e veriyor.
Parametre yoksa ESKI DAVRANIS (takip listesi) aynen duruyor.

OLCULMUS TUZAK: `sembolUcu()` `AZAMI_SEMBOL`(=8) ustunde YEREL 400
`cok_sembol` donuyor - 12 hisseli bir sektor grubu SESSIZCE patlardi.
Iki tarafta da 8'e kirpiliyor (`SektorKart.tsx:292`,
`analiz.tsx:198 kiyasDisarida`) ve DUSEN SAYI EKRANDA yazili.
`KarsilastirKart`'in "Temel metrikler" tablosu `kunye` turundan geliyor;
o tur ikinci bir `yfin` turu acmamak icin takip listesinde BIRAKILDI -
kiyas kumesiyle uyusmazlik METINLE ilan edildi, sayiyla ortulmedi.
Serit 5'in `name`/`industry`/`bizSummary` blogu ellenmedi.

### 17.4 Kapilar - KENDIM YENIDEN OLCTUM (ajan raporuna guvenilmedi)

| kapi | sonuc |
|---|---|
| `cd mobile; node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | EXIT 0 |
| `git status --short "mobile/src/app/(tabs)/_layout.tsx"` | BOS - dosya acilmadi |
| `grep -n "Intl\.\|toLocale"` bes dokunulan dosya | EXIT 1 = 0 canli cagri |
| oneksiz `api/*.js` sayisi | 12 - Hobby tavani korundu |
| diffstat | 322 ekleme / 9 silme, 5 dosya |

Ajanin kendi olctugu, benim YENIDEN OLCMEDIGIM kapilar: `npx eslint` bes
dosya (EXIT 0, 0 error / 0 warning) ve yasak kelime taramasi (yalniz bu
bes dosyanin `git diff` `^+` satirlari, kelime sinirli desen -> 0 isabet;
ajanin ilk GENIS deseni baska seritlerin `karsilastir` / `Kar Marji`
satirlarini yakalamis, daraltmak gerekiyor - bu tarama kalibini
tekrarlayacak olan icin not).

### 17.5 Bu bolumun OLCULMEDIKLERI

- HICBIR SEY CIHAZDA/SIMULATORDE KOSMADI, RENDER EDILMEDI. Butun esitleme
  turu (Serit 1-7) tip/lint/politika/fikstur kapilarina dayaniyor; tek
  render kaniti kullanicinin cihazi olacak.
- Depo kaliciligi OLCULMEDI: uygulama yeniden acilinca son aramalar
  geliyor mu bilinmiyor.
- Kopru navigasyonu OLCULMEDI - parametrenin `/analiz`'e gercekten
  tasindigi yalnizca TIP duzeyinde dogru.
- `/api/pulse`'a canli istek atilmadi; sozlesme yalnizca `api/pulse.js`
  kaynagindan okundu. `haberler.sorgu[].maddeler`'in gercek govdede dolu
  geldigi OLCULMEDI.
- Commit/push/`git add` YOK. Yeni bagimlilik YOK. `api/**`, `app.js`,
  `tests/**`, `vercel.json`, `config.js` ellenmedi. KAP duzeltmesi (§15.1)
  ve uc yeni uc (§16.1) HALA CANLIDA DEGIL.

### 17.6 Kuyruk durumu - esitleme turu BITTI

| # | is | durum |
|---|---|---|
| S1 | B sinifi native alanlar | BITTI (5 cizildi, 2 ucta alan yok) |
| S2 | G1 ham gosterge degerleri | BITTI |
| S3 | Y1/Y2/Y3 yeni uclar + uc-test (17) | BITTI |
| S4 | G2 52-hafta * G3 sektor adi * G4 temettu `paid` | BITTI |
| S5 | S2-S4 alanlarinin native cizimi | BITTI |
| S6 | E sinifi onarim | BITTI (KAP onarildi, BIST ariza degildi) |
| S7 | A sinifi: Nabiz denetimi, son aramalar, sektor koprusu | BITTI |
| S8 | D sinifi karar (tasinamazlar) | KULLANICIYA SORULDU, cevap yok |

Siradaki (kullanicinin ilan ettigi sira): tasarim -> menuler -> TestFlight
-> optimizasyon. Once iki karar gerekiyor: (1) TAZE commit+push onayi -
`main`'e push = canli deploy; (2) D sinifi kalemler webden kaldirilsin mi
yoksa yorumsuz ham sayi olarak mi kalsin.

## 18. TASARIM TURU 1 - BILGI HIYERARSISI (OLCULDU 2026-10-30)

Esitleme turu (S1-S7) ucun donderdigi her alani cizdi ama DUZ bir olcum
dokumu olarak: onlarca "anahtar: deger" satiri, her satirin altinda birim
notu, hepsi varsayilan ACIK. Bu tur o borcu kapatti. HICBIR SAYI, HICBIR
DONUSUM, HICBIR BIRIM DEGISMEDI - yalniz yerlesim ve gorunurluk.

### 18.1 Iki yeni paylasimli bilesen (ayni mantik alti dosyaya KOPYALANMADI)

`mobile/src/components/OlcumSatiri.tsx` (143 satir) - `OlcumSatiri`
(`etiket`, `deger`, `isaret?`, `renk?`, `not?`, `erisimEtiketi?`) ve
`OlcumBaslik` (`baslik`, `birim?`, `not?`). Uc kademeli hiyerarsi: deger
`type.bodyBold` + numeric + sag hizali (birincil), etiket
`type.small`/`textDim` (ikincil), not `type.micro`/`textFaint` (ucuncul).

`mobile/src/components/Katlanir.tsx` (107 satir) - `baslik`, `ozet?`,
`birim?`, `acikBaslangic?`. `Pressable` baslik + `accessibilityRole`
`accessibilityState.expanded`, govde YALNIZ acikken render. ANIMASYON YOK
(yeni bagimlilik yok; `LayoutAnimation` Android bayragi gerektiriyor).

Yeni jeton: `theme/layout.ts` -> `olcumDegerSutunu = 92` (sayi sutunu
hizasi). Bu bir TIPOGRAFI TAHMINI, cihaz olcumu DEGIL - uzun para
degerleri sutunu tasirabilir, olculmedi.

### 18.2 Alti sicak noktada ne degisti

- `detay/TeknikKart.tsx`: `ta.ham` artik VARSAYILAN KAPALI `Katlanir`,
  ozet "11 bolum * 42 sayisal alan + oruntu kodlari". Birim notu her
  satirdan BOLUM BASLIGINA tasindi (9 kez degil 1 kez) ama SILINMEDI -
  ayrica her satirin `erisimEtiketi`'nde duruyor, sesli erisimde kayip 0.
- `detay/TemelKart.tsx`: 52-hafta kiremitleri kendi grubuna, "kunye
  ucundan (52 hafta)" notu iki kez yerine baslikta bir kez. "Fiyatin bu
  araligin neresinde durdugu HESAPLANMADI" cumlesi KORUNDU.
- `bugun/TakvimKart.tsx`: temettu sayac blogu varsayilan KAPALI
  (`birim="adet"` bir kez). `TemettuSatiri` hiyerarsisi cevrildi: olculmus
  deger birincil, tarih ikincil, `paid` dali ucuncul.
- `kesfet/SektorKart.tsx`: hisse listesi ve is tanimi varsayilan KAPALI.
  Grup medyanlari `OlcumBaslik` ile ayrildi - yuzde ile carpansiz oran
  artik AYNI SUTUNDA karismiyor. Is tanimi bloku `Pressable`'in
  ICINDEN CIKARILIP KARDESI yapildi (ic ice dokunma hedefi hazardi).
- `(tabs)/bugun.tsx` `MakroNabizKarti`: `durus` ham sayilarina birim
  EKLENDI - onceden HIC yazilmiyordu. `-1..+1 motor ciktisi, yuzde DEGIL`.
  Yuzde saniliyor olmasi en pahali yanlis okumaydi. Iki kunye blogu
  (durus olcum kunyesi, manset sayac kunyesi) varsayilan KAPALI; durus
  Pill + cumle ve faz Pill + cumle GORUNUR kaldi (kartin karari bunlar).
- `(tabs)/arama.tsx`: "Hangi aramalar kaydedilir?" dipnotu katlanira
  girdi, metin aynen.

`detay/Satir.tsx` 129 -> 22 satir: tip koruyan TAKMA AD oldu, boylece onu
ice alan yedi dosya ve `detay/index.ts` DEGISMEDI. Satir ilkeli zaten
vardi ama (i) kok barrel'dan ihrac edilmiyordu, `bugun/` ve `kesfet/`
ERISEMIYORDU, (ii) deger ve etiket AYNI PUNTOYDU - hiyerarsi yoktu.

### 18.3 Kapilar - KENDIM YENIDEN OLCTUM

| kapi | sonuc |
|---|---|
| `cd mobile; node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | EXIT 0 |
| `npx eslint` 12 dokunulan dosya | EXIT 0, 0 error / 0 warning |
| `grep "Intl\.\|toLocale"` dokunulan dosyalar | yalniz `TakvimKart.tsx:69` YORUMU, 0 canli cagri |
| `grep -E "#[0-9a-fA-F]{3,6}"` dokunulan dosyalar | yalniz `theme/layout.ts:79,95` ONCEDEN VAR OLAN `shadowColor` (git diff'te YOK = bu turda eklenmedi) |
| `git status --short "mobile/src/app/(tabs)/_layout.tsx"` | BOS |
| durustluk dallari | TeknikKart 3+3, TemelKart 0+5, TakvimKart 1+2, bugun.tsx 1+2 - "uc gondermedi" / "olculemedi" metinleri YERINDE |
| `mobile/src` toplam | 23 dosya, 2035 ekleme / 264 silme (onceki seritlerin commit edilmemis satirlari DAHIL, git ayiramiyor) |

KENDI IDDIAMIN DUZELTMESI: "dokunulan dosyalarda 0 sabit hex" olcumum
`components/*.tsx` ile SINIRLIYDI; `theme/layout.ts`'te `elevation`
jetonunun icinde iki `shadowColor: '#000000'` onceden duruyor. Kural
bozulmadi (jetonun kendisi) ama olcumun kapsami dar ilan edilmisti.

### 18.4 OLCULMEYEN

- **HICBIR SEY CIHAZDA/SIMULATORDE RENDER EDILMEDI.** Expo/Metro
  acilmadi, ekran goruntusu alinmadi. Gercek yogunluk kazanci, satir
  tasmalari, `numberOfLines` kirpmalari, aydinlik/karanlik kontrast,
  sayi sutunu hizasinin gercek metinle tutup tutmadigi - HICBIRI
  OLCULMEDI. Butun tur tip + lint duzeyinde dogru.
- `olcumDegerSutunu = 92` tipografi tahmini, cihaz olcumu degil.
- `Katlanir`'in ekran okuyucuda "acildi/kapandi" diye okundugu
  test EDILMEDI (TalkBack/VoiceOver kosturulmadi).
- Ic ice dokunma hedefi hazardinin kardes yapiyla cozuldugu DOKUNARAK
  dogrulanmadi.
- Varsayilan KAPALI yapilan bolumlerin dogru varsayilan olup olmadigi
  bir kullaniciyla sinanmadi - benim kararim uygulandi.
- `TemelKart.kiremit` `minWidth: 120` sihirli sayisi BIRAKILDI: izgara
  kirilma noktasi, jetonlastirmak cihazda olcum gerektirir, uydurulmadi.
- Commit/push/`git add` YOK. `api/**`, `app.js`, `config.js`, `tests/**`,
  `vercel.json`, `depo.ts` ellenmedi. KAP duzeltmesi (§15.1) ve uc yeni
  uc (§16.1) HALA CANLIDA DEGIL.

### 18.5 Siradaki

Kullanicinin ilan ettigi sira: tasarim -> menuler -> TestFlight ->
optimizasyon. Tasarim turu 1 (hiyerarsi) bitti. Bekleyen iki karar:
(1) TAZE commit+push onayi (`main` -> canli deploy), (2) D sinifi
kalemler webden kaldirilsin mi yoksa yorumsuz ham sayi mi.
GERCEK RENDER KANITI HENUZ SIFIR - bir sonraki anlamli adim cihazda
calistirmak; o olmadan tasarim turu 2 (menuler) tahmine dayanir.

## 19. TASARIM TURU 2 - EKRAN ICI BILGI MIMARISI (OLCULDU 2026-10-31)

Tur 1 satir hiyerarsisini kapatti; bu tur KART/EKRAN duzeyini kapatti.
Sekme sayisi, sirasi, adi, ikonu DEGISMEDI; `(tabs)/_layout.tsx` ACILMADI
(`git status --short` -> BOS). Hicbir sayi, donusum, birim, bicimleyici
degismedi. Hicbir kart SILINMEDI, hicbir kart sekme DEGISTIRMEDI.

### 19.1 Olculen yogunluk dengesizligi

| sekme | kart sayisi |
|---|---|
| `index.tsx` (Listeler) | 2 (`ListelerKart` :173, `Card` "Liste nerede saklaniyor?" :175) |
| `bugun.tsx` | 6 |
| `kesfet.tsx` | 7 |
| `analiz.tsx` | 10+ |
| `arama.tsx` | 4 |

Listeler bos dururken Analiz tek kaydirmada tasiyordu. YOL DUZELTMESI:
Listeler sekmesinin dosyasi `index.tsx`'tir; `liste.tsx` YOK.

### 19.2 Ilan edilen siralama kurali (bes sekmenin dosya basligina yazildi)

Ekranin KENDI turunun karari/olcumu once -> kendi ucuna gidip kullanicinin
listesini olcen kartlar -> sembol BAGIMSIZ sozluk/kesif yuzeyleri ->
"olcemedim" tanilari ve kunye/manset -> OLCULMEYENIN ILANI (katlanir,
kapali) en sonda. Sembolden bagimsiz SABIT EVRENLER her zaman en altta.

Uygulanisi: `kesfet.tsx` Firsatlar -> Tarama/Sektor -> Radar/Tema ->
Neden/Gundem (RadarKart ilk karttan kesif bolumune indi). `bugun.tsx`
`TematikHaberKarti` en sona indi (olcum degil, girdi bekleyen kesif
araci). `analiz.tsx` sirasi ZATEN kurala uyuyordu - hicbir kart
tasinmadi, grafigin skorlardan ONCE gelmesi (262 ms ~ 45-55 sn olcumu)
KORUNDU, yalniz `BolumBasligi` ile gruplandi.

### 19.3 Iki yeni dosya

`mobile/src/lib/gezinme.ts` (37 satir) - `hisseAc(sembol, pazar?)`.
TEK gezinme kalibi. OLCULMUS ARIZA: ayni rotaya iki bicimde gidiliyordu;
Listeler/Arama `{sembol, pazar}` yollarken Bugun sira satiri ve Kesfet
kart satirlari yalniz `{sembol}` yolluyordu. `pazar` URUN DAVRANISI -
`?symbols=THYAO` -> market US, ta null, fa null; `?symbols=THYAO.IS` ->
market BIST, ta 29.39, fa 62.34. Yani pazarin dustugu HER DOKUNUSTA BIST
hissesi YANLIS BORSADA olculuyordu. Kalip bos/`null` pazari HIC
GONDERMIYOR - `''` uydurmuyor (`AdayKarti` onceden `pazar: ''`
gonderiyordu, duzeldi). `RadarKart` bilerek tek parametreli kaldi:
sozluk satirlarinda ucta pazar alani YOK, uydurulmadi -> bicim duzeyinde
tek kalip saglandi, VERI duzeyinde radarin pazari hala bilinmiyor (uc isi).

`mobile/src/components/BolumBasligi.tsx` (57 satir) - ekran duzeyinde
bolum basligi (sac cizgisi + ad + tek satir kunye), yalniz
`space`/`type`/`colors` jetonlari. `kesfet.tsx` 4, `analiz.tsx` 3 adet.

### 19.4 "Henuz olculmeyen kartlar" - SILINMEDI, akranliktan CIKARILDI

`bugun.tsx:315` artik `<Katlanir baslik="Henüz ölçülmeyen kartlar"
ozet="Dürüst eksik listesi">`, VARSAYILAN KAPALI, ekranin EN ALTINDA,
METIN AYNEN. Gelistirici durustluk listesi kullanicinin ana ekraninda
olculmus kartlarin akrani olmaktan cikti; icerik kaybi SIFIR.

### 19.5 Kapilar - KENDIM YENIDEN OLCTUM

| kapi | sonuc |
|---|---|
| `cd mobile; node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | EXIT 0 |
| `npx eslint` 14 dokunulan dosya | EXIT 0, 0 error / 0 warning |
| `grep "Intl\.\|toLocale"` 14 dosya | exit 1 = 0 eslesme |
| `grep -E "#[0-9a-fA-F]{3,6}"` 14 dosya | exit 1 = 0 eslesme |
| `git status --short "(tabs)/_layout.tsx"` | BOS |
| `cd mobile; npm test` | 79 denetim gecti, EXIT 0 |
| oneksiz `api/*.js` | 12 - Hobby tavani korundu |
| durustluk metni SILINDI mi | `git diff -- mobile/src \| grep "^-"` + aksanli desen -> SIFIR silinmis satir |

Durustluk kapisini ajanin kalibiyla DEGIL, silinme kalibiyla olctum:
HEAD'den bu yana "göndermedi/ölçülemedi/ÖLÇEMEDİM/ölçülmedi" iceren
HICBIR satir silinmemis. Mevcut sayimlar: bugun 1+4, analiz 1+7,
SektorKart 1+3, AdayKarti 0+5, ListeBlogu 0+3, index 0+2, arama 0+2,
TaramaKart 0+2, TemaKart 0+2, kesfet 0+1, FirsatlarKart 0+1.

GOREV METNIMIN YANLIS CIKAN ONCULU: kapi 6'da ASCII desen
(`gondermedi`/`olculemedi`) verdim; bu kod tabaninda 13 dosyada 0
donduruyor cunku gercek metinler AKSANLI. Ajan dogru tespit etti.
Ikinci oncul de olcumle kapandi: "bolume atla" yolu IMKANSIZ -
`ScreenShell.tsx:83` `ScrollView`u KENDI tutuyor ve `forwardRef` YOK
(kendim greple dogruladim), `scrollTo` hedefi olculmus sayi degil tahmin
olurdu. Gorevin izin verdigi ikinci yol (bolum basligiyla gorsel
gruplama) secildi; hicbir kaydiriciya ve Listeler'in tek
pull-to-refresh'ine dokunulmadi.

### 19.6 KriptoKart / MetalKart - SADECE ONERI, TASINMADI

Teshis: ikisi `KRIPTO_SEMBOLLER`/`METAL_SEMBOLLER` SABIT EVRENLERI,
secilen sembolle ilgisiz; Analiz'in konusu tek hissenin dokumu. Ayrica
bilincli olarak `yfin` turunun disinda (`api/_yfin.js` 12 sembolde
sessizce kesiyor; `deep=1` kripto/vadeli icin olmayan modulleri isterdi).
Oneri: ilk adim TASIMAK DEGIL - yanlis dosyalanma hissinin kaynagi sira
degil AKRANLIK, ve bu tur eklenen "Piyasa seridi - secilen sembolle
ilgisiz sabit evrenler" bolum basligi sorunu BEDELSIZ cozuyor. Urun
karari tasimak yonunde verilirse dogal yeri BUGUN (ekran zaten "bugun
piyasada ne var" yuzeyi) ama bedeli olculu: Bugun su an 4 tur + takvim
kosuyor, iki kart iki dis istek daha ekler ve en agir ekrani agirlastirir.
KESFET YANLIS OLUR (orasi kullanicinin listesine bagli kesif).
KULLANICIYA SORULACAK.

### 19.7 OLCULMEYEN

- **HICBIR SEY CIHAZDA/SIMULATORDE RENDER EDILMEDI.** Katlanirin
  acilip kapanmasi, `BolumBasligi` sac cizgisinin aydinlik/karanlik
  gorunumu, yeni siranin kaydirma hissi, `hisseAc` ile acilan ekranin
  BIST sembolunu `.IS` ile olctugu - HICBIRI olculmedi. Butun tur tip +
  lint + fikstur duzeyinde dogru.
- Koprüler (`?kiyas`, `?tema`) kodda bozulmadi ama CALISTIRILMADI.
- `index.tsx` pull-to-refresh'e dokunulmadi, canli denenmedi.
- Erisilebilirlik (TalkBack/VoiceOver): `accessibilityRole="header"` ve
  `expanded` durumu DUYULMADI.
- Hicbir uca gercek istek atilmadi.
- Bilerek TEK BICIME INDIRILMEYEN dal: Arama'daki "Cihaz kaydi
  okunuyor - henuz BILINMIYOR". `VeriYok`a sokmak "veri yok" demek
  olurdu; bu dal "henuz bilinmiyor". ANLAM BIRLESTIRILMEDI.
- `SonAramalarKarti` ve Arama'daki tema adaylari `hisse/[sembol]`
  kapisi DEGIL; oraya gezinme eklemek YENI DAVRANIS olurdu, yapilmadi.
- Commit/push/`git add` YOK. Yeni bagimlilik YOK. `api/**`, `app.js`,
  `config.js`, `tests/**`, `vercel.json`, `depo.ts` ellenmedi.

### 19.8 KULLANICI KARARI - deploy kullanicida, D sinifi cozuldu

Kullanici 2026-10-31'de ilan etti: "tum adimlari tamamladiginda deploy
edecegim. app'i actigimda webdeki tum fonksiyonlarin calistigini gormek
istiyorum." YANI: push/deploy BANA KAPALI, kullanici yapacak. Taze bir
"evet" olmadan commit bile yok.

SIRALAMA GERCEGI: uc yeni uc (`/api/degisim`, `/api/kripto`,
`/api/metal`) ve KAP duzeltmesi canlida olmadan app'te native kartlar
durust dali ("uc gondermedi") cizer. Deploy app'i acmadan ONCE gelmeli.
Ayrica `mobile/**` cihaza ancak native build ile gider; OTA'yi
etkinlestirecek o son build ALINMADI.

D SINIFI KARARI kullanicinin hedefinden cikti: "webdeki tum fonksiyonlar
app'te calissin" demek, bu kalemleri webden kaldirmak da nativede sayisiz
birakmak da OLMAZ. Tek mimari gecerli yol UCUNCUSU: hesabi istemciden
MOTORA tasimak - `app.js` -> `node tools/motor-uret.mjs` -> uc ham sayi +
makine kodu donderir, native YALNIZ cizer. Esik/agirlik/formul ucta degil
MOTORDA kalir, ham sayi kurali bozulmaz, `tests/parity.mjs` "FARK 0" ile
korur. S8 bu kapsamla sirada.

## 20. S8 - D SINIFI: HESAP ISTEMCIDEN MOTORA (OLCULDU 2026-10-31)

Yontem her kalemde ayni ve 19.8'deki karardan cikiyor: hesap `app.js`ten
`tests/engine.mjs` DILIMLERI ile motora alinir, `node tools/motor-uret.mjs`
ile `api/_motor.js` uretilir, uc HAM SAYI + MAKINE KODU donderir, native
`lib/sozluk.ts`ten cumle secip cizer. `api/_motor.js` ve `api/_ayar.js`
ELLE DUZENLENMEDI.

### 20.1 Yikilan iki envanter onkabulu

Once "nativede yok" diye yazilmis iki iddia OLCULDU ve YANLIS cikti;
ikisi de kodda ve metinde duzeltildi. Envanteri kendi notlarima degil
koda bakarak kurma kurali buradan geliyor.

### 20.2 Duyarlilik + firsat katmani (onceki pencere)

- Motora eklendi: `sentiAggregate`, `oppCombined`.
- Uc yarisi: `api/news.js` `duyarlilikKatmani`, `api/_akis.js`
  `firsatKatmani`.
- Native: `mobile/src/lib/sozluk.ts` (TURKCE CUMLENIN SECILDIGI TEK YER -
  `kod`/`cls` aramasi, esik/karsilastirma/aritmetik YOK; bilinmeyen kod
  `null` doner, cumle HIC basilmaz), `formatImzaliSkor` (+/- yonlu skor;
  ekran eksisi, ASCII tiresi degil), `DuyarlilikOzeti` dort yuzeye
  baglandi.
- Kapilar: uc-test 1503 -> 1519 (5f), 1519 -> 1537 (14j).
- ILAN EDILEN SAPMA: web puani `title + description` okuyor, bu
  tasiyicida `description` YOK -> `alan: ['title']`. Sapma sayiyla
  ORTULMEDI, tipte yazili.

### 20.3 S8 #10a - `rowExtrema` (kiyas tablosu en iyi/en kotu imi)

TAMAM: motor + uc + kapi + native tip + native cizim.

- Motor: `tests/engine.mjs`e `['kiyas-uc', ...]` dilimi ve `rowExtrema`
  ihraci eklendi. `api/_motor.js` YENIDEN URETILDI -> 23 dilim / 2904
  satir, imza `sha256:3a98b04bcdec0609`. `api/_ayar.js` degismedi.
- `COMPARE_ROWS` (app.js:12595) BILEREK DISARIDA: icinde
  `xf: trIndustry` fonksiyon referansi (dilimlenmis motorda
  ReferenceError) ve Turkce `label`/`hint` (ham sayi kurali) var.
- Uc: `api/_yfin.js` icinde `KIYAS_SATIRLARI` - KOPYA DEGIL DAR
  IZDUSUM: yonu olan 11 satir, yalniz `key`/`type`/`dir`, SIFIR sayi.
  `ekstremKatmani()` motoru cagirip satir basina sonucu tasiyor.
- OLCULMUS KISIT - TEMBEL MOTOR KURULUMU: `api/proxy.js:47` `_yfin.js`i
  STATIK ice aliyor, `_kesif.js`i ise BILEREK dinamik
  (proxy.js:42-46: "DUZ /api/proxy?url= trafigi de her soguk baslangicta
  o kurulumu ODERDI"). Ilk yama modul duzeyinde `buildMotor` kuruyordu -
  tam o bedeli geri getiriyordu; GERI ALINDI ve `async motorKur()` ile
  tembel hale getirildi. Kurulum YALNIZ `?symbols=` kipinde, ilk
  cagrida bir kez. Kapi bunu kalici olarak koruyor.
- SEMBOL, INDEKS DEGIL: native tablo `kunyeler.filter((k) => k.ok)` ile
  suzuyor; indeks tasinsa im sessizce yanlis sutuna basardi.
- ILAN EDILEN SAPMA: en iyi ile en kotu AYNI sembole dusunce (tum
  degerler esit) anahtar ATILIYOR. Web o hucreye iki CSS sinifini birden
  basiyor; "hem en iyi hem en kotu" bir im olarak cizilemez.
- UC HAL AYRI: alan `undefined` = uc gondermedi · `null` = uc motoru
  kuramadi (olcemedim) · `{}` = OLCTUM, ekstrem yok (tek sembol / tum
  degerler esit). Bir satirin anahtari hic yoksa iki gecerli deger
  bulunamadi demek - 0 UYDURULMUYOR.
- Native: `YfinEkstremAlan` + `YfinEkstremSatir` tipleri; `YfinResponse`
  artik `results` YANINDA `ekstrem` tasiyor (kunye nesnelerinin ICI
  BUYUMEDI). `yfin.ts`teki "ust duzeyde `results` DISINDA alan yok"
  iddiasi duzeltildi.
- Native cizim: `KarsilastirKart.tsx` hucresinde ham sayi AYNEN duruyor,
  im ALTINA ayri satir olarak dusuyor (ton + ok + kelime; renk tek
  tasiyici degil). `imSec()` yalniz `===` sembol esitligi yapiyor -
  sayi karsilastirmasi, esik, yon kurali YOK.
- Kartin iki durustluk eseri duzeltildi: baslikdaki "`rowExtrema`
  NATIVE'DE YOK" iddiasi ve ekrandaki "en iyi/en kotu imi yok" notu.
  Ekran notu artik UCUN HALINE gore uc ayri cumle veriyor.
  `computeCompareVerdict` HALA nativede yok - o bir istemci karar
  kurali, motora tasinmadi.

### 20.4 Kapilar - bu pencerede OLCULEN

- `node tests/uc-test.mjs` -> 1537'den **1559** denetim, hepsi gecti.
  Yeni bolum 18 (`/api/yfin`): tembel-motor kilidi, tarif safligi
  (dondurulmus, yalniz key/type/dir, SAYI SABITI yok - tip adlari
  `ratio2`/`d2e` sayilmiyor), `COMPARE_ROWS` ile yon/tip PARITESI,
  islevsel vektorler, sozlesme buyumedi denetimi.
- `node tools/motor-uret.mjs` + `node tests/uretim-test.mjs` -> 73 gecti.
- `node tests/engine.mjs` -> motor sembolu 81'den **82**.
- `node tests/parity.mjs` -> **FARK 0**, 29 nokta birebir.
- `node tests/metin-test.mjs` -> 55 cumle bayt bayt · `nabiz-alan-test`
  128 · `nabiz-yon-test` 40.
- `mobile`: `tsc --noEmit` temiz · `eslint` temiz · `npm test` 79 gecti ·
  `Intl` yalniz `lib/format.ts`te · kartta hex renk yok.
- Vercel fonksiyon sayisi: **12** (tavan 12).

### 20.5 Bu pencerede OLCULMEYEN (durustluk)

- HICBIR SEY CIHAZDA CIZILMEDI. Expo/Metro kosmadi, simulator
  acilmadi, ekran goruntusu alinmadi, tarayici kullanilmadi. Her native
  iddia tip/lint/politika/fixture kapilarina dayaniyor.
- Hicbir uca CANLI istek atilmadi; `ekstrem` katmani yalniz elde
  kurulmus kunye vektorleriyle olculdu.
- Commit/push/`git add` YOK (19.8: deploy kullanicida).
- Yeni bagimlilik YOK.
- S8'de SIRADA kalanlar: `earnScenario` (#11, once `api/_yfin.js`
  kazanc alanlari olculecek) -> `themeTone` (#8a) -> `atrPct` (#14,
  esik catismasi app.js:4584 4/2 ile app.js:5829 4/1.5 - kullaniciya
  soruldu, cevap yok) -> makro/nabiz (#1/#6/#4/#5) -> `agendaScore`
  (#2a) -> `c.note` (#12) EN SON, kendi parite turunda.

### 20.6 S8 #11 - `earnScenario` (bilanco senaryosu) TAMAM

Motor + uc + kapi + native tip + native cizim. Dort katman da olculdu.

- YIKILAN ONKABUL: `api/_kesif.js:1061` "Senaryo matematigi
  (`earnScenario`) BICIMLEME, uca girmez" diyordu. OLCULDU, YANLIS:
  icinde K=2,0 tepki katsayisi, CAP=0,40 tavani ve analist dagilimi
  aritmetigi var (app.js:9535-9549). Yani web bu sayiyi TARAYICIDA
  uretiyordu; ince istemci ya formulu kopyalayacak (S5.1 ihlali) ya da
  ozellik eksik kalacakti. Yanlis satir kodda duzeltildi (silinmedi -
  neden yanlis oldugu yazili kaldi).
- Motor: `tests/engine.mjs`e `['earn-senaryo', ...]` dilimi + `earnScenario`
  ihraci. Bitis imi `initEarn`den ONCE (o DOM'a olay bagliyor).
  `api/_motor.js` YENIDEN URETILDI -> 24 dilim / 2920 satir / 83 sembol,
  imza `sha256:8c76fd15e3fdc327`. `api/_ayar.js` degismedi.
- Uc: `api/_yfin.js` `senaryoKatmani()` - SEMBOL anahtarli, `results`in
  YANINDA kardes alan (`ekstrem` ile ayni gerekce: `YfinKunye`
  sozlesmesi sessizce buyumesin). YALNIZ `deep=1`: senaryo `earnings`
  dagilimindan cikiyor, o da yalniz MODULES_DEEP ile geliyor; `deep`
  yoksa alan HIC KONULMUYOR ("sormadim" ile "olcemedim" karismasin).
- OLCULMUS KISIT KORUNDU: `motorKur()` TEMBEL kaldi. `api/proxy.js:47`
  `_yfin.js`i STATIK ice aliyor; modul duzeyinde motor kurmak her soguk
  baslangicta DUZ `?url=` trafigine de o bedeli odetirdi (proxy.js:42-46
  gerekcesi). Kapi 18a bunu kalici koruyor.
- UCTA ISLEVSEL OLCUM (tip degil, CALISMA): elde kurulmus 5 kunye ile
  uc bicim birebir cikti - A `{bull:{px:140,ret:0.4}, base:{px:100,
  ret:0}, bear:{px:60,ret:-0.4}}` · B `{tight:true}` · C/D/E ANAHTARI
  HIC YOK. `null`/`[]` girdi -> `{}`, cokme yok. `ok:false` kunye ve
  `earnings`siz kunye atlaniyor. Kunye nesneleri MUTASYONA UGRAMADI.
- Kapi: `node tests/uc-test.mjs` 1559'dan **1574** denetime, hepsi gecti.
  Yeni 18g: katmanda SAYI SABITI yok (K/CAP motorda kaldi), Turkce cumle
  yok, yerel `Math.min/max/abs` yok, hesap `eng.earnScenario`dan geliyor,
  uc bicim, `deep`-only dal, sozlesme buyumedi, arama kipi senaryo
  tasimiyor.
- KENDI YAMAM BIR KAPIYI KIRDI: 18f cevabi TEK SATIRLIK kalipla
  ariyordu (`/json\(\{ results: out, ekstrem: ... \}\)/`); cevap cok
  satirli olunca bu imkansiz hale geldi. Kalip GEVSETILMEDI - iki alan
  AYRI AYRI, kati bicimde araniyor ve eski bicimin neden dustugu yazili.
- Native tip: `YfinSenaryoKutu` (`{px, ret}`) + `YfinSenaryo`
  (`{tight:true}` | uc kutu birlesimi); `YfinResponse.senaryo?:
  Record<string, YfinSenaryo> | null`. Barrel (`api/index.ts`) iki tipi
  de disa aciyor.
- BICIMLEYICI KARARI OLCULDU: `ret` KESIR. `formatPercent`
  (lib/format.ts:63-67) YUZDE PUANI bekliyor ve 100'e BOLMUYOR, yani
  0,4 -> "0,4%" basardi. `formatOran` (:105-108) 0-1 orani aliyor ve
  100 ile CARPMIYOR. Dogru olan `formatOran` - kartin kendi buyume
  alanlarinda uyguladigi kuralin aynisi. Istemcide olcek degistirme YOK.
- Native cizim: `BilancoKart.tsx` `TakvimSatiri`na IKINCI prop olarak
  `senaryo={veri?.senaryo?.[k.symbol]}` geciyor - SEMBOLLE, indeksle
  DEGIL (liste once `ok`a gore suzuluyor, sonra tarihe gore siralaniyor,
  sonra pazar suzgecinden geciyor; indeks sessizce baska hissenin
  satirina dusebilirdi). Ekran degisikligi gerekmedi: karta gelen `veri`
  zaten `YfinResponse`un TAMAMI.
- `{tight:true}` UC OZDES %0 KUTUSU OLARAK CIZILMIYOR - o "senaryo
  olctum" demek olurdu. Motor bu hali ayrica bildiriyor, istemci cumleyi
  seciyor.
- DORT HAL KARTIN DIBINDE AYRI CUMLE: alan yok = "bu surumde uctan
  gelmiyor" · `null` = "ucta olculemedi" · `{}` = "olctum, hicbir
  sembolde dagilim cikmadi" · sembol anahtari = kutular. Istemcideki tek
  islem `Object.keys(...).length`.
- Mobil kapilar: `tsc --noEmit` temiz · `eslint` temiz · `npm test` 79
  gecti · `Intl` yalniz `lib/format.ts`te · kartta hex renk yok.

### 20.7 Bu pencerede OLCULMEYEN (durustluk)

- HICBIR SEY CIHAZDA CIZILMEDI. Expo/Metro kosmadi, simulator acilmadi,
  ekran goruntusu alinmadi. Senaryo kutulari ve 10a kiyas imi EKRANDA
  HIC GORULMEDI.
- Hicbir uca CANLI istek atilmadi; senaryo yalniz elde kurulmus kunye
  vektorleriyle olculdu.
- Commit/push/`git add` YOK - deploy kullanicida (19.8).
- Yeni bagimlilik YOK.
- S8'de SIRADA: `themeTone` (#8a) -> `atrPct` (#14, esik catismasi
  app.js:4584 4/2 ile app.js:5829 4/1.5 - kullaniciya soruldu, cevap
  yok) -> makro/nabiz (#1/#6/#4/#5) -> `agendaScore` (#2a) -> `c.note`
  (#12) EN SON, kendi parite turunda.

### 20.8 S8 #8a - tema haber eslestirme (TAMAM, uctan native'e)

- SORUN: `/api/theme` yalniz `{symbol, market, name, reason}` donuyor;
  hangi adayin hangi MANSETTE gectigi uctan GELMIYORDU. Web bu iliskiyi
  TARAYICIDA kuruyordu (esik + durak sozcuk listesi + sembol
  kelime-siniri regexi orada). Nativede tema haberi HIC YOKTU.
- YENI UC ACILMADI: Vercel Hobby tavani 12 fonksiyon ve DOLU (11.x).
  Bu yuzden `/api/news` kip (1) genisletildi:
  `&adaylar=SEMBOL|PAZAR|ad;...` (en cok 14 = `AZAMI_TEMA_ADAY`).
- CEVAP KARDES ALANI `tema`: `{ sozcukler[], ilgisiz[], adaylar:
  { SEMBOL: [madde sirasi] } }`. Hesabin tamami MOTORDA
  (`temaSorguSozcukleri` · `temaBaslikIlgili` · `themeNorm` ·
  `themeNewsHits`); uc kodunda rakam, `Math.`, regex literali,
  `toLowerCase` ve Turkce cumle YOK.
- DEGER SIRA DIZISI, MANSET KOPYASI DEGIL: ayni cevabin `maddeler`
  dizisine indeks. Govde ikiye katlanmiyor, iki kopya kaymiyor.
  Indeks geri alma: motora `{title, _i}` kutulari verildi -
  `themeNewsHits` yalniz `it.title` okuyup nesnenin kendisini donduruyor.
- `maddeler` SUZULMEDI: mevcut sozlesme bozulmasin diye yalniz ilgisiz
  maddelerin SIRASI bildiriliyor.
- UCTA OLCULEN (ag YOK, elde kurulmus kunye): sorgu "savunma sanayi
  temasi" + 4 manset -> `{"sozcukler":["savunma","sanayi"],"ilgisiz":[1],
  "adaylar":{"ASELS":[0],"NVDA":[2]}}` · `''` -> `{adaylar:[],hata:null}`
  · 15 kalem -> `cok_aday` · `'A B C|US|x'` -> `bad_aday` ·
  `'ASELS|XX|x'` -> `bad_aday_pazar` · `'tema hisse'` -> bos `sozcukler`
  VE bos `ilgisiz` (ilgi olculemiyorsa suzme YOK) · girdi maddeleri
  degismedi, `_i` anahtari kalmadi.
- KAPI: `node tests/uc-test.mjs` -> 1613 denetim (1574'ten +39, yeni
  bolum ⑭k). `AZAMI_TEMA_ADAY` export edildi ki kapi iki dosyanin
  canli degerini karsilastirsin (14 = `AZAMI_ADAY`).
- NATIVE: `types.ts` `TemaHaber` + `NewsResponse.tema?: TemaHaber|null`
  + dort yeni `NewsErrorCode` · `client.ts` `NewsOptions.adaylar` +
  `temaAdaylarDizgesi` (`;` adin icinde bosluga cevriliyor - TASIMA
  bicimi; `|` dokunulmuyor, uc adi `join('|')` ile geri birlestiriyor) ·
  `TemaKart.tsx` IKINCI cagriyi yapiyor ve kaniti aday satirinin altina
  ciziyor (`HaberSatiri` yeniden kullanildi).
- ISTEMCIYE SAYI YAZILMADI: aday tavani ucun (`AZAMI_TEMA_ADAY`) ve
  `/api/theme` ayni sayiyla sinirli - ucuncu bir sayi yazmak esik
  yazmak olurdu (SS5.1). Tavan asilirsa uc 400 `cok_aday` donuyor.
- DORT HAL KARTTA AYRI: alan yok = sormadim (hicbir sey basilmaz) ·
  `null` = "Kanit mansetleri ucta olculemedi" · `adaylar[SEMBOL] = []` =
  "Bu adayla eslesen manset yok" (OLCUM) · dolu = o siralarin basliklari.
  Haber cagrisi hata verirse AYRI cumle: "Kanit mansetleri okunamadi."
- WEBDEN AYRILAN YER, DIPNOTTA YAZILI: web ABD + TR beslemelerini
  BIRLESTIRIP ariyordu; `/api/news` tek yerel okuyor. Istemciye "hangi
  yerel" kurali YAZILMADI (ucun varsayilani `TR` birakildi) - "adaylarin
  cogu US ise US" bir esik olurdu. Kart hangi yereli okudugunu,
  kac manset okundugunu ve ilgi sozcuklerini EKRANDA yaziyor.
- Mobil kapilar: `tsc --noEmit` temiz · `eslint` temiz · `npm test` 79
  gecti · `Intl` yalniz `lib/format.ts`te · kartta hex renk yok.
- OLCULMEYEN: kart CIHAZDA CIZILMEDI; kanit satirlari EKRANDA HIC
  GORULMEDI. Canli `/api/news?...&adaylar=` istegi ATILMADI (kod
  deploy edilmedi - deploy kullanicida). Commit/push YOK.
- S8'de SIRADA: `atrPct` (#14, esik catismasi app.js:4584 4/2 ile
  app.js:5829 4/1.5 - kullaniciya soruldu, cevap yok) -> makro/nabiz
  (#1/#6/#4/#5) -> `agendaScore` (#2a) -> `c.note` (#12) EN SON.

### 20.9 S8 #14 - `atrPct` IKI AYRI KOD (TAMAM, motordan native'e)

KARAR (kullanici onayladi): tek kazanan YOK, IKI ayri makine kodu.
Gerekce: `atr / price * 100` app.js'te IKI YERDE hesaplaniyor ve IKI
FARKLI soruya cevap veriyordu -> (1) ATR/Volatilite karti UC KADEMELI
sinif (>=4 yuksek / >=2 orta / alti dusuk) + "stop icin ATR'nin 1.5-2
kati" cumlesi; (2) `fillCatalysts` yalniz UCLARDA konusuyor (>=4 genis /
<1.5 sakin) ve ARADA (1.5 <= x < 4) HICBIR SEY basmiyor - SESSIZ BANT.
Tek alana indirmek o sessizligi sessizce silerdi.

ZINCIR:
- `app.js` - `atrVolKod(atr, price)` ve `atrPlanKod(atr, price)`,
  `planRiskReward`'in ardinda (ikisi de `ta` diliminin ICINDE, yeni
  dilim GEREKMEDI). Ham sayi + sabit kumeli kod; emoji/toFixed/Turkce
  cumle YOK. `stopKat: [1.5, 2]` SAYI olarak tasiniyor.
- `tests/engine.mjs` EXPORTS += `atrVolKod`, `atrPlanKod`.
- `api/_motor.js` yeniden uretildi: 27 dilim / 3046 satir, imza
  `sha256:fd252418f593e084` (onceki `ba6e959caac2b10d`). `api/_ayar.js`
  DEGISMEDI (`sha256:75512c5271a89b33`).
- `api/_akis.js` `planKatmani` artik ALTI alan donuyor: `+oynaklik`,
  `+atrPlan`. Iki cagri noktasi (`recommendOne`, analiz yolu) -> hem
  `/api/recommend` hem `/api/analyze` tasiyor. Yeni fonksiyon YOK (12
  fonksiyon tavani korundu).
- `mobile/src/api/types.ts` + `PlanOynaklik`, `PlanAtrBandi`; `Plan`'a
  `oynaklik?`, `atrPlan?`.
- `mobile/src/lib/sozluk.ts` + `OYNAKLIK_SOZLUK` (3 kod),
  `OYNAKLIK_ROZET`, `ATR_PLAN_SOZLUK` (YALNIZ 2 kod - sessiz bandin
  girdisi BILEREK YOK, `sozluktenSec` null dondurunce ekrana cumle
  basilmiyor; web ile birebir).
- `mobile/src/components/detay/RiskOdulKart.tsx` oynaklik blogu
  (momentum blogunun oncesinde). ATR satiri bu kartta zaten basiliyordu.

UC HAL AYRI (kapiya cakildi): alan `undefined` = uc gondermedi -> hicbir
sey cizilmez · `null` = olcemedim -> "olculemedi" · `kod: null` = OLCTUM,
soylenecek sey yok -> SESSIZ, cumle basilmaz.

#### OLCULDU
- `node tests/uc-test.mjs` -> 1636 denetim gecti (1613 -> +23).
  Yeni (5)g bolumu: `planKatmani` govdesi metinden cakildi (alan kumesi
  ve sirasi), govdede ciplak sayi YOK, ve agsiz islevsel kosu her sinir
  icin: 4 / 3.99 / 2 / 1.99 / 1.5 / 1.49 / 0, null-atr, sifir-fiyat.
  IKI SORU AYRI oldugu cakildi: %2 -> vol 'orta' + plan SESSIZ;
  %1.2 -> 'dusuk' + 'sakin'. N3g olumsuz kontrol: iki islevin alan
  kumesi AYNI DEGIL.
- `node tests/uretim-test.mjs` -> 73 denetim gecti.
- `cd mobile && tsc --noEmit` -> cikti yok (temiz).
- `npx eslint` uc dosya -> cikti yok.
- `cd mobile && npm test` -> 79 denetim gecti.
- Politika grep: `Intl` yok, hex renk yok, yasak kelime yok.

#### OLCULMEDI (durustluk)
- EKRANDA GORULMEDI. Oynaklik blogu ne cihazda ne simulatorde
  basilmadi; Expo/Metro acilmadi, ekran goruntusu YOK. Tum native
  iddia tip/lint/politika/kapi kosusuna dayaniyor.
- CANLI ISTEK YOK. `oynaklik` / `atrPlan` alanlari gercek bir
  `/api/analyze` yanitinda GORULMEDI - yalniz elle kurulan fixture ile
  olculdu (kod deploy edilmedi, deploy kullanicida).
- Commit/push YOK (taze acik "evet" bekliyor).
- S8'de SIRADA: makro/nabiz (#1/#6/#4/#5) -> `agendaScore` (#2a) ->
  `c.note` (#12) EN SON, kendi parity kosusunda.

### 20.10 S8 #1/#6 ilk katman - gun ici nabiz (motor -> uc -> native)

#### NE YAPILDI
- `tests/engine.mjs`: iki yeni dilim (`nabiz-esik`, `nabiz-gunici`) ve
  `PULSE_TH` + `analyzeIntraday` + `pulseIsSudden` ihraci. Motor ucte
  artik gun ici cekirdegini TASIYOR.
- `api/chart.js`: `gunici` + `guniciKod` alanlari, saf ve ihrac edilmis
  `esikKumesiAnahtari(sym, market)` yardimcisi (CRYPTO/METAL/BIST/US
  YONLENDIRMESI; esik SAYISI motorda kaliyor). `spark` tele BILEREK
  cikmiyor - `mumlar[]` ayni seriyi zaten tasiyor.
- YALNIZ `interval=5m`: `analyzeIntraday` icindeki `ago = hi - 12`
  satiri "~60 dk (12 x 5dk)" demek. 15m/60m/1d adiminda ayni satir
  3 saatlik ya da 12 GUNLUK degisimi `hourChg` adiyla basardi.
  Uc yanlis etiketli sayi basmak yerine `null` donuyor ve NEDENI
  soyluyor: `adim_uygun_degil` (sormadim) / `mum_az` (olcemedim) /
  `null` (olctum).
- `mobile/src/api/types.ts`: `GuniciOlcum`, `GuniciEsik`, `GuniciKod`
  tipleri + `ChartResponse.gunici` / `.guniciKod`.
- `mobile/src/lib/sozluk.ts`: `GUNICI_SOZLUK` (3 kod),
  `GUNICI_SESSIZLIK_SOZLUK` (1 kod - `adim_uygun_degil` BILEREK YOK,
  sormadigimiz seye cumle yazilmaz) ve saf `guniciNabizKodu()`
  (boolean uclusu -> tek kod; hicbir esik karsilastirmasi yok).
- `mobile/src/app/(tabs)/bugun.tsx`: `ENDEKS_ADIM` `1d` -> `5m`.
  OLCULDU: iki native tuketici de (`analiz.tsx:182`, bu ekran) `1d`
  istiyordu, yani `gunici` CIHAZDA HER ZAMAN `null` olacakti - yeni
  katman olu koddu. Onbellek anahtari artik adimi da tasiyor.
- `mobile/src/components/bugun/EndeksNabziKarti.tsx`: gun degisimi
  ARTIK UCTAN (`gunici.dayChg`, tabani `chartPreviousClose` -> GECE
  BOSLUGU DAHIL); kartin kendi aritmetigi yalnizca `gunici === null`
  yedegi. Ek olarak nabiz cumlesi (sozlukten) ve ham `rvol` satiri.

#### OLCULEN KAPILAR
- `node tests/uc-test.mjs` -> 1669 denetim (1636 -> +33; yeni dizi h
  ve donmus alan kumesine `gunici`/`guniciKod` eklendi).
- `node tests/uretim-test.mjs` -> 73 denetim.
- `node --check api/chart.js` temiz.
- `cd mobile && tsc --noEmit` temiz; `npx eslint` (uc dosya) temiz;
  `cd mobile && npm test` -> 79 denetim.
- Politika grep: `Intl` yok, hex renk yok, yasak kelime yok.

#### OLCULMEDI (durustluk)
- EKRANDA GORULMEDI. Kart ne cihazda ne simulatorde basilmadi.
- CANLI ISTEK YOK: `gunici` yalnizca elle kurulan Yahoo fikstururyle
  olculdu. Ustkaynagin XU100/^GSPC/^IXIC/GC=F icin 5m mum DONDURUP
  DONDURMEDIGI OLCULMEDI - donmezse kart "bu aralikta mum yok" diye
  durustce yazar, ama bu hal canli dogrulanmadi.
- PAYLOAD BUYUDU: endeks basina 1 mum yerine ~78 mum (istek SAYISI
  ayni). Gercek bayt/sure OLCULMEDI.
- `analyzeIntraday` hala `poll.js` ~237 ve `worker/movers.mjs` ~72'de
  KOPYA duruyor (tele cikan artik motor kopyasi).
- Commit/push YOK (taze acik "evet" bekliyor).

### 20.11 S8 #1/#6 ikinci katman - FIYAT YALANLAMA (motor -> uc -> native)

NE: haber METNINDEN cikan makro durus, FIYATIN soyledigiyle celisiyor
mu? Celisiyorsa kart yonu tek basina kanit saymiyor.

#### OLCULDU
- `pulseMacroReality` KENDISI dilimlenemezdi (HTML uretiyor + modul
  durumu `macroBreadthSeen` okuyor). Olcum SAF cekirdege cikarildi:
  `pulseRealityCodes(g) -> { want, kaynaklar[], celiski[] }`. Web
  kabugu artik ayni donusten HTML oruyor; web CIKTISI BIREBIR AYNI.
- `tests/engine.mjs`: yeni dilim `nabiz-gerceklik`, `EXPORTS`'a yalniz
  `pulseRealityCodes`. ESIKLER DISA VERILMEDI - 45/55/30dk/6/0.70/1.0
  motorda kaldi, ucta ne okunuyor ne yaziliyor.
- `node tools/motor-uret.mjs` -> 30 dilim / 3142 satir; `_motor.js`
  3283 satir / 197410 bayt; `_ayar.js` DEGISMEDI (sha256:75512c52...).
- Motor safligi: `grep -c pulseMacroReality api/_motor.js` -> 0.
  (Ilk denemede dilim ICINDEKI bir YORUM bu adi tasidigi icin uc-test
  (13e) kirmizi yandi; testi degil YORUMU duzelttim.)
- `api/pulse.js`: `genislikYas` + `gunDegisimleri` govde girdileri
  (400 kodlari `bad_genislikYas` / `bad_gunDegisimleri` /
  `cok_gunDegisimleri`), cevaba `gerceklik` + `eksikGerceklik`.
  GIRDI EKSIKSE KAYNAK URETILMIYOR, varsayilan 50 KONULMUYOR.
- Cekirdek 8 halde GERCEK motorla davranis olarak dogrulandi:
  notr duruste `want: null`; 31 dk'lik genislik kaynak uretmiyor;
  `genislikYas` yoksa kaynak uretmiyor; 5 satir yetmiyor, 6 yetiyor;
  `celiski` tam olarak yonu tutmayan alt kume.
- `tests/uc-test.mjs`: (13d)/(13f) donmus alan kumesi guncellendi +
  5 yeni denetim (alan kumesi sabit, eksik girdi ACIKCA bildiriliyor,
  girdi eksikken kaynak uretilmiyor, govdede esik/cumle yok, sunucu
  yolunda da `eksikGerceklik` dolu) -> `node tests/uc-test.mjs`
  ✅ 1674 denetim.
- Native: `types.ts` `GerceklikKaynak`/`GerceklikOlcum` + iki alan;
  `sozluk.ts` `GERCEKLIK_SOZLUK` (4 kod) + `GERCEKLIK_EKSIK_SOZLUK`
  (3 kod); `client.ts` uc yeni 400 kodu; `bugun.tsx` MakroNabizKarti
  icinde DORT HAL AYRI cizildi: celiski var / `want === null` /
  `eksikGerceklik` dolu / olculdu-celismedi.
- EVREN DURUSTLUGU (onayli karar): cumleler "senin evrenin" demiyor,
  "olculen evren" diyor; izleme listesi her cagrida gonderilmiyor.
- Kapilar: `node --check app.js` temiz; `uretim-test.mjs` 73 denetim;
  `uc-test.mjs` 1674 denetim; `cd mobile && tsc --noEmit` temiz;
  `npx eslint` (dort dosya) temiz; `npm test` 79 denetim.
  Politika grep: format.ts disinda `Intl` yok, hex renk yok, yeni
  yasak kelime yok, native'de esik sayisi yok.

#### OLCULMEDI (durustluk)
- EKRANDA GORULMEDI. Hicbir sey cihazda/simulatorde basilmadi.
- CIHAZDA `gerceklik.kaynaklar` BOS GELECEK: `fetchPulse` hala yalniz
  `{q, haberPazari}` gonderiyor - `genislik` ve `gunDegisimleri`
  SUNUCU tarafi sabit-evren isi (ayri adim). Kart bunu uydurmuyor,
  `eksikGerceklik` ile ACIKCA yaziyor; "fiyat onayliyor" DEMIYOR.
- SABIT EVREN MALIYETI OLCULMEDI: sembol basina bir TA skor gecisinin
  `maxDuration 10` icine sigip sigmadigi bilinmiyor. Yerel DNS bozuk
  (bkz. 12) oldugu icin canli olcum ~13 sn sisiyor, guvenilmez.
- `/api/pulse` CANLI cagrilmadi; `gerceklik` canli govdede gorulmedi.
- `computePulseMacro` alanlarindan `headlines`, `bigHeadlines`,
  `lastTs`, `flip`, `hasData` HALA TELE CIKMIYOR.
- `pulseMacroComment` / `pulseMacroTag` henuz saf cekirdege
  ayrilmadi (bir sonraki adim).
- Commit/push YOK (taze acik "evet" bekliyor).

### 20.12 S8 #1/#6 ucuncu katman - MAKRO YORUM + ETIKET (motor -> uc -> native)

NE: web'in `pulseMacroComment` (makro durus cumlesi) ve
`pulseMacroTag` (ani-hareket satirinin makro etiketi) ciktilari
artik app'de de var - CUMLE degil KOD olarak tasiniyor.

#### OLCULDU
- Iki saf cekirdek `app.js` `nabiz-gerceklik` dilimine eklendi:
  `pulseMakroYorumKod(macro, rows) -> { kod, taze, inflIsinma,
  inflSoguma, uyumlu[] }` ve `pulseMakroEtiketKod(sembol, up,
  biasUp, biasDown) -> 'faiz_baski' | 'faiz_ruzgar' | null`.
  Web kabuklari (`pulseMacroComment`, `pulseMacroTag`) artik ayni
  donusten HTML oruyor; `pulseMacroTag` bir `PMAC_TAG_HTML`
  sozlugune indi.
- ADLANDIRMA KAPISI: cekirdek adlari `pulseMacroComment`/
  `pulseMacroTag` metnini ICERMEYECEK sekilde secildi (uc-test
  (13e) ALT DIZI araniyor; `pulseMacroCommentCodes` kirmiziya
  dusurmustu).
- WEB CIKTISI BIREBIR AYNI: eski islevler yedekten elle kopyalanip
  gercek motorla 180 girdi-cifti uzerinde karsilastirildi (12 makro
  hali x 5 satir kumesi + etiketler), esik kenarlari 0.15 / 0.1499
  DAHIL -> `OK 180 karsilastirma, FARK YOK`.
- `api/pulse.js`: istege bagli `satirlar: [{sembol, yukari}]` girdisi
  (`AZAMI_SATIR = 40`; 400 kodlari `bad_satirlar` / `cok_satir`).
  `yukari` KESIN boolean isteniyor - 0/1/'true' kabul edilse yon ters
  okunup etiket TERS basilabilirdi. Cevaba alti alan: `yorum`,
  `eksikYorum`, `etiketler`, `varMi`, `taze2g`, `sonManset`.
- DURUSTLUK AYRIMLARI (hepsi testle cakili):
  `etiketler === null` -> satir gonderilmedi, HIC OLCULMEDI;
  `etiketler === []`   -> olculdu, etiket cikmadi;
  `eksikYorum: ['satirlar']` -> `yorum.uyumlu` bosluğu "uyumlu sembol
  yok" demek DEGIL; `sonManset` tarihi okunamazsa `null` (0 DEGIL);
  `kod: 'sakin'` (manset YOK) ile `'notr'` (manset var, yon dengede)
  AYRI hal.
- `tests/uc-test.mjs`: (13d)/(13f) donmus alan kumesi 13 -> 19 anahtar;
  25 yeni denetim (15 adet (13c) `satirlar` girdi dogrulamasi + 12 adet
  (13d) yeni alan dogrulamasi) -> `node tests/uc-test.mjs`
  ✅ 1699 denetim (1674 -> 1699).
  Govde safligi regex ile kanitlandi: esik sayisi ve Turkce makro
  cumlesi (isinma/sahin/guvercin/ruzgar/baskisi/<b>) govdede YOK.
- Native: `types.ts` `MakroYorum` + `MakroEtiket` tipleri, alti yeni
  `PulseResponse` alani, `PulseErrorCode`'a `bad_satirlar`/`cok_satir`;
  `sozluk.ts` `MAKRO_YORUM_SOZLUK` (4 kod) + `MAKRO_YORUM_EK_SOZLUK`
  (taze/bayat/isinma/soguma) + `MAKRO_YORUM_EKSIK_SOZLUK` +
  `MAKRO_ETIKET_SOZLUK` (2 kod); `client.ts` iki yeni 400 kodu;
  `bugun.tsx` `makroYorumCumlesi()` + MakroNabizKarti icinde yorum
  rozeti, manset kunyesi ve UC AYRI etiket hali (null / bos / dolu).
- Kapilar: `uretim-test.mjs` 73; `uc-test.mjs` 1699; `cd mobile &&
  tsc --noEmit` temiz; `npx eslint` (dort dosya) temiz; `npm test` 79.
  Politika grep: format.ts disinda `Intl` yok, hex renk yok, yasak
  kelime yok, native'de ESIK SAYISI YOK (yorum satirlarindan da
  silindi).

#### OLCULMEDI (durustluk)
- EKRANDA GORULMEDI. Hicbir sey cihazda/simulatorde basilmadi.
- CIHAZDA `etiketler` NULL gelecek ve `yorum.uyumlu` BOS olacak:
  `fetchPulse` hala yalniz `{q, haberPazari}` gonderiyor, `satirlar`
  gondermiyor. Kart bunu `eksikYorum` ile ACIKCA yaziyor.
- `/api/pulse` CANLI cagrilmadi; yeni alanlar canli govdede gorulmedi.
- `computePulseMacro` alanlarindan `headlines` / `bigHeadlines` HALA
  TELE CIKMIYOR (`ayristirListe` `link`i bilerek dusuruyor - ayri
  adim); `flip` native tarafta onceki `durus.kod`dan uretilecek.
- `hasData` / `lastTs` / `fresh2d` ARTIK tele cikiyor (`varMi` /
  `sonManset` / `taze2g`).
- Commit/push YOK (taze acik "evet" bekliyor).


### 20.13 S8 #1/#6 dorduncu katman - MAKRO MANSETLER (`mansetler`)

NE: webin `headlines` blogu (app.js:12159-12171 + buildPulseMacroHtml 12383-12406)
uca ve native'e tasindi. Kullanici artik "sahin" yorumunun NEYE dayandigini
basligi okuyarak goruyor.

#### OLCULDU

- `guvenliBaglanti(v)` (api/pulse.js, disa aktarildi): YALNIZ http/https, 500
  bayt tavani, kirpma. Gecmezse `''` -> `HaberSatiri` o basligi TIKLANABILIR
  GOSTERMIYOR. 400 ATILMIYOR: baglanti olcumun parcasi degil.
  GEREKCE: `mansetler` baglantiyi tele geri koyuyor ve native onu
  `Linking.openURL` ile ACIYOR; `javascript:`/`data:`/`file:` bir semanin
  oraya varmasi, istemcinin kendi govdesine koydugu dizgiyi cihazda
  calistirilabilir kilardi. Istemci govdesi GUVENILMEZ.
- `ayristirListe` artik `link` (dogrulanmis) + `source` (80 bayt) tasiyor;
  `emoji` HALA atiliyor (hicbir yere gitmiyor).
- Sunucu yolu `cevir` fonksiyonu `m.link` + `m.source` geciriyor; ortak
  kapidan (`ayristirListe`) sema dogrulamasina giriyorlar.
- Cevap alani `mansetler`: `tumTaze` (= webin `allItems`i, iki taraf da
  `pulseFreshWithin(..., 14)` sonrasi birlesim) -> `title && link` -> tarihi
  okunabilenler -> en yeniden eskiye -> `AZAMI_MANSET = 3` (webin
  `.slice(0, 3)`u) -> `{title, link, pubDate, source}` = native `HaberMadde`.
- Govde alan kumesi 19 -> 20 anahtar; donmus iki alan-kumesi savi guncellendi.
- DONMUS SAV DEGISTI (bilerek, gerekcesi testin icinde yazili):
  uc-test ⑬c "baglanti/kaynak/emoji tasinmiyor" savi KALDIRILDI. O gun
  DOGRUYDU - cevabin hicbir alani manset metni dondurmuyordu, baglantiyi
  tasimak olu yuktu. `mansetler` eklendigi icin artik `link` + `source`
  tasinmak ZORUNDA. Yerine 3 sav + 11 sema savi + 9 manset savi geldi.
- Savlar: `uc-test.mjs` 1699 -> 1723 (+24). Olculenler: sema (https/HTTP/
  javascript:/data:/file:/semasiz/bosluk kirpma/null/500 bayt tavani/400
  atmiyor/source 80 bayt kirpma), icerik (dizi mi, baglantisiz manset listeye
  GIRMIYOR, tavan, alan kumesi, en yeniden eskiye sira, pencere DISI manset
  yok, Turkce cumle uretilmiyor).
- Native: `PulseResponse.mansetler?: HaberMadde[]`. OPSIYONEL OLMASI BILEREK:
  `undefined` = bu alani GONDERMEYEN eski uc surumuyle konusuluyor (OTA
  native'i sunucudan onde tasiyabilir) -> ekran HICBIR SEY CIZMIYOR. Bos
  dizi saymak "manset yok" YALANI olurdu. Suanki uc alani HER ZAMAN
  gonderiyor.
- `MakroNabizKarti` uc dal: `undefined` -> cizim yok · `[]` -> "gosterilebilir
  makro manset yok, pencerede okunan mansetlerin baglantisi gelmedi" ·
  dolu -> `HaberSatiri` (📰 kartlariyla AYNI bilesen). YENI AG TURU YOK.
- Kapilar: `node --check` ok · `uretim-test.mjs` ✅ 73 · `uc-test.mjs` ✅ 1723 ·
  `tsc --noEmit` temiz · `eslint` (2 dosya) temiz · `npm test` ✅ 79 ·
  politika grep'leri temiz (`Intl` yok, hex renk yok, yasak kelime yok,
  native'de esik sayisi yok).

#### OLCULMEDI (durustluk)

- CIHAZDA HICBIR SEY CIZILMEDI. Expo/Metro acilmadi, simulator yok,
  ekran goruntusu yok. Her native iddia tur/lint/politika/fikstur kapilarina
  dayaniyor.
- `/api/pulse` CANLI cagrilmadi; `mansetler` gercek bir beslemeden
  DOLU gelmis olarak hic gorulmedi.
- CIHAZDAKI YOL (duzeltme): `fetchPulse` govdeye YALNIZ `{q, haberPazari}`
  koyuyor -> `istemciVerdi(body)` false -> uc SUNUCU YOLUNU seciyor
  (api/pulse.js:595, `kaynak: 'sunucu'`) ve beslemeleri KENDISI cekiyor.
  Yani cihazda `mansetler` DOLU GELEBILIR. "Bos gelir" demek yanlis olurdu.
  TASIYICI KODDAN DOGRULANDI (yorumdan degil): `api/_haber.js:81`
  `MADDE_ALANLARI = ['title','link','pubDate','source','type','symbol']`
  ve `api/_haber.js:242` her maddeyi `{title, link, pubDate, source,
  type, symbol}` olarak push ediyor -> `cevir`in okudugu `m.link` /
  `m.source` GERCEK alanlar.
  OLCULMEYEN: bu kampanyada hicbir CANLI `/api/pulse` cagrisi yapilmadi;
  dolu `mansetler` HIC GORULMEDI. Besleme baglanti vermezse dizi bos
  doner ve ekran bunu acikca yazar - sayi UYDURULMAZ.
  Besleme baglanti vermezse `mansetler` bos dizi doner ve ekran bunu
  acikca yazar - sayi UYDURULMAZ.
- `bigHeadlines` (webin `pmBig` blogu) HALA YOK ve kod isi degil, MALIYET
  isi: ucun sunucu yolunda 3. besleme = 6 -> 7 paralel istek, `maxDuration 10`
  aritmetigini degistirir. §21'e alindi.
- Commit/push YOK (taze acik "evet" bekliyor).

---

### 20.14 Gundem katmani + gundem -> /api/causal koprusu (TAMAM)

NE: `/api/gundem` ucu (api/_gundem.js, proxy rewrite `__rota=gundem`) RSS
mansetlerini ve konsept/sektor/isi/ton olcumunu donduruyor. Native tarafta iki
tuketici var: Bugun sekmesinde `GundemKonseptKarti` (sunum) ve Kesfet
sekmesinde `NedenBesleyici` -> `NedenKart` (nedensellik girdisi).

Kopru: `mobile/src/api/neden.ts` -> `gundemdenKonseptler(konseptler)` ->
`{gundem, olcum}`. Saf eslesme; esik/agirlik/formul YOK.

OLCULDU:
- `tsc --noEmit` hatasiz; `npx eslint` (6 dosya) hatasiz; `mobile npm test` 79
  denetim; `tests/uc-test.mjs` 1780 denetim; `tests/uretim-test.mjs` 73.
- `GundemKonsept.sectors` demeti gevsek tipli (`NedenSektorYon | string`);
  `as` ile zorlamak kume disi yonu ucun kendi suzgecine (api/causal.js:184) yem
  ederdi -> OLCULEN sektor sessizce kaybolurdu. Yon BURADA daraltiliyor, dusen
  demet `olcum.sektorDusen` ile SAYILIYOR.
- `GundemBaslik.ageH` `number | null`, `NedenBaslikGirdi.ageH` zorunlu sayi.
  `0`a cevirmek "manset su an cikti" demek olurdu -> manset DUSUYOR,
  `olcum.basligiDusen` ile sayiliyor.
- `AZAMI_KONSEPT` (60) tavani: asan istek uctan 400 doner, bu yuzden kopru
  kirpiyor ama `olcum.kirpildi` ile soyluyor. Sessiz tavan yok.
- Besleyici kartin PROP'unu bozmuyor: `undefined` (olcum bitmedi) ile `[]`
  (olctum, konsept yok) AYRI kaliyor.
- `NedenKart` artik "iki girdi de yok" demiyor; `hareketlerSorulmadi` /
  `gundemSorulmadi` ayri ve kutu olcuLEN yariyi sayiyla yaziyor.
- `/api/gundem` IKINCI KEZ cagriliyor (Bugun + Kesfet). Paylasilan onbellek
  KURULMADI: tek onbellek, bir sekmedeki kapsam secimini otekinin olcumune
  sessizce tasirdi. Ucun kendi `onbellek` bayragi var; karar SUNUCUNUN.

OLCULMEDI (durustluk):
- `hareketler` yarisi HALA olculemiyor. `pct` kaynagi VAR (`/api/chart` ->
  `gunici.dayChg`, dort endeks), ama "belirgin" esigi (`notable`) HICBIR
  uctan gelmiyor; web onu kendi tablosunda tutuyor (app.js:11525-11528:
  1,0 / 0,6 / 0,8 / 0,8). O tablo motor-duzeyi ayar; native'e yazmak esigi
  ekrana tasimak olurdu.
- `gunici.esik.day` YERINE KOYULMADI: o `PULSE_TH` (3,0 US / 4,0 BIST /
  2,5 METAL) - ani hareket uyarisi esigi, causal `notable`in ~4-5 kati.
  Koymak iki ayri olcumu sessizce takas etmek, bagları da bosaltmak olurdu.
- Web'in besleme agirliklari (0,9-1,15) native'e TASINMADI; hepsi `w: 1`.
- `OlcumNotu` yerine `HaberOlcumEksikRozet` kullanildi: iki sayac sekli
  (`Sayac` vs `HaberSayac`) BILEREK uyumsuz (Durum.tsx:364-376).
- CANLI CAGRI YOK: `/api/gundem` bu kampanyada hic cagrilmadi, dolu bir
  `konseptler`/`mansetler` hic gozlenmedi (yerel DNS kirik, S12).
- CIHAZDA CIZILMEDI: Expo/Metro/simulator yok, ekran goruntusu yok. Tum
  native iddia tip/lint/politika/fikstur kapilarina dayaniyor.

SIRADAKI SERIT: endeks ayar tablosunu (kind + `notable` + `sharp`) motor
dilimine tasi ve uctan sun; sonra `hareketler`i native'de `/api/chart`
`gunici.dayChg` ile kur (XU100, ^GSPC, ^IXIC, GC=F).

### 20.15 `INDEX_ESIK` motora + `hareketler` native'de kuruldu (2026-11-03)

NE: 20.14'un "SIRADAKI SERIT"i KAPANDI. Nedensellik ucunun ikinci yarisi
(endeks hareketleri) artik gercekten olculuyor; esik istemciye HIC girmedi.

OLCULDU:
- ARIZA: `/api/causal` her hareket icin `notable` esigini ISTEMCIDEN zorunlu
  istiyordu (`ayristirGovde` -> 400 `bad_notable`). Esik yalnizca web
  ekraninin kendi tablosundaydi; native'in onu olcen kaynagi YOKTU, yazmak
  ise S5.1 ihlali (istemcide esik) olurdu. Serit bu yuzden ACILAMIYORDU.
- COZUM: esik tablosu MOTORA tasindi -> yeni dilim `endeks-esik`,
  `const INDEX_ESIK` (kind basina `notable` + `sharp`), motordan disa
  veriliyor. Motor artik 33 dilim, `sha256:c2e70c98e99840b3`.
- `/api/causal` tabloyu `ENG.INDEX_ESIK`ten okuyor; uc KENDI KOPYASINI
  TUTMUYOR (uc-test bunu regexle sabitliyor).
- GOVDE TABLOYU EZER: govdede `notable` varsa o kullaniliyor (web kendi
  olcumunu yollamaya devam edebilsin). Govdedeki `0` GECERLI bir esik ve
  tabloya DUSMUYOR; bozuk deger (dizgi/sonsuz) de tabloya DUSMUYOR ->
  yine `bad_notable`. Tabloda olmayan `kind` icin varsayilan SECILMIYOR.
- HATA KODU DEGISMEDI (`bad_notable`): bu sayede mevcut tek bir uc-test
  vektoru bile duzenlenmedi. +7 denetim (5 davranis `10c`, 2 saflik `10e`).
- NATIVE: yeni `mobile/src/api/hareket.ts` -> `fetchNedenHareketleri()`
  dort endeksi PARALEL okur (`/api/chart`, `range=1d`, `interval=5m`) ve
  `{kind, pct: gunici.dayChg}` kurar. `notable` GONDERILMIYOR.
  `interval=5m` ZORUNLU: `gunici` yalniz o adimda hesapliyor
  (api/chart.js:362); baska adimda uc `guniciKod='adim_uygun_degil'`.
- Pazar GONDERILMIYOR: bu dort kalem icin pazari sunucu sozlugu soyluyor
  (`cozEndeks`, api/_girdi.js:119-131); sorgudaki `market` onlara
  UYGULANMIYOR.
- SESSIZ KAYIP YOK: olculemeyen endeks `pct: 0` ile DOLDURULMUYOR; her
  dusen kalem `dusen[]` icinde makine koduyla sayiliyor ve kunye satirinda
  sembol + kod olarak YAZILIYOR. DORDU DE duserse sonuc `unmeasured`
  (bos `hareketler` dizisi "olctum, belirgin hareket yok" demek olurdu).
- `notable` istemci sozlesmesinde SECIMLIK oldu (`types.ts`); `client.ts`
  kapisi artik yalniz GONDERILMISSE denetliyor.
- `NedenBesleyici` IKI AYRI `useIstek` tasiyor (`neden-gundem:*`,
  `neden-hareket`): RSS yayincilari dusup Yahoo ayakta kalabilir, iki yari
  AYRI dusuyor. Her yari icin ayri kunye satiri basiliyor.
- `gunici.esik.day` (`PULSE_TH`) YINE yerine koyulmadi - gerekce 20.14'te.
- KAPILAR: `uretim-test` 73, `uc-test` 1787 (1780 -> +7), mobil `tsc`
  temiz, `eslint` temiz, mobil test 79, politika grep temiz (`hareket.ts`
  ve `NedenBesleyici.tsx` icinde `Intl.`/`toLocale`/`toFixed` yok).
- Bayatlayan uc yorum blogu DUZELTILDI: `NedenKart` basligi + onun
  `OlcemedimKutu` cumlesi, `NedenBesleyici` basligi, `kesfet.tsx` montaj
  yorumu. Hicbiri artik "esigi donduren bir uc yok" demiyor.

OLCULMEDI (durustluk):
- `fetchNedenHareketleri` CANLI `/api/chart`e hic kosulmadi (yerel DNS
  kirik, S12). Dolu bir `gunici.dayChg` bu kampanyada gozlenmedi.
- CIHAZDA CIZILMEDI: Expo/Metro/simulator yok, ekran goruntusu yok.
- `INDEX_ESIK`in `sharp` alani HICBIR istemci tarafindan kullanilmiyor;
  motorda duruyor, ucta okunmuyor. Olu alan degil ama CANLI DEGIL.
- `INDEX_PULSE` motora TASINMADI: ayri bir olcum (ani hareket uyarisi),
  bu seridin girdisi degil.

SIRADAKI SERIT: `/api/degisim`, `/api/kripto`, `/api/metal` - ucunun de
native baglantisi SIFIR (`ENDPOINTS`te yok). Once `ENDPOINTS` + cekici,
sonra kart.

## 21. ONAY / MALIYET BEKLEYENLER (yan liste - CANLI TUTULUYOR)

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

## 22. TEZ DEFTERI NATIVE'E TASINDI (OLCULDU 2026-11-03)

Webin `📓 Tez` sekmesinin (`index.html:163`, `app.js:9931-10230`) native
karsiligi YOKTU. Depo katmani ZATEN vardi (`sb:theses` anahtari, `Tez`
tipi, `tezSuz`, `tezlerDepo`, `useTezler`) ama YAZICI YOKTU: defteri
okuyan hicbir ekran acilamiyordu, cunku yazilacak hicbir yol yoktu.
Sekme `momentum` sonrasi kalan son acik web sekmesiydi.

**ÖLÇÜLDÜ**
- Yeni bolum `mobile/src/api/depo.ts` "10.b TEZ DEFTERI ISLEMLERI"
  (`// 11. NAKIT` ankrasindan hemen once; 1162 → 1395 satir, LF korundu).
  Yazicilar: `tezEkle`, `tezGuncelle`, `tezSil`, `tezDayanakDongu`,
  `tezGunlukEkle`, `tezGunlukSil`. Yardimcilar: `bugunYMD`,
  `metinSatirlari`, `katalizorSatirlari`, `sayiOku`, `type TezGirdi`.
  11 adin tamami `mobile/src/api/index.ts` barelinden ALFABETIK cikiyor.
- Anahtar BIREBIR ayni: web `TEZ_LS_KEY = 'sb:theses'` (`app.js:9931`),
  native `ANAHTARLAR.tezler = 'sb:theses'` (`depo.ts:100`). Ayri anahtar
  olsa kullanicinin webde yazdigi tez app'te YOK gorunurdu.
- Tarih YEREL takvim gunu: `bugunYMD` = `app.js:9939` `tzToday` birebir
  (`getFullYear`/`getMonth`/`getDate`). `toISOString()` KULLANILMADI —
  o UTC'ye kayar ve gece yarisi bir gun sasirtir.
- Dayanak durumu dongusu web ile AYNI sira: `['ok', 'watch', 'bad']`.
  Duzenlemede durum METIN eslesmesiyle KORUNUYOR (`app.js` `prevPill`),
  yeni dayanak `ok` basliyor.
- Yeni dosya `mobile/src/components/analiz/TezDefteriKart.tsx`: tez
  listesi + olustur/duzenle formu + dayanak durum dongusu (dokununca)
  + gunluk ekle/sil + iki dokunuslu silme + hisse sayfasini acma
  (`hisseAc`). Okuma `useTezler()` (yerel depo aboneligi, AG DEGIL);
  yazma yalniz `@/api` yazicilari uzerinden.
- **ISTEMCIDE HESAP YOK (§5.1).** Web o sekmede gostergeyi TARAYICIDA
  hesapliyor: `(price - stop) / (target - stop)` ve
  `(target - price) / price * 100`. Bu aritmetik native'e GIRMEDI;
  hedef/cikis kullanicinin yazdigi HAM fiyat olarak basiliyor, "hedefe
  yuzde kac kaldi" sayisi YOK. Kart bunu kullaniciya da SOYLUYOR
  ("o hesap motorun isi, istemcide yapilmiyor") — webin "yuzde
  uzakliklar otomatik hesaplanir" cumlesi KOPYALANMADI, cunku dogru
  olmazdi. Metin ayristirma (`sayiOku`) hesap degil.
- OLCULMEYEN SAYI BASILMIYOR: hedef/cikis `null` ise "yazilmadi"
  yaziliyor, `0` DEGIL (`0` gecerli bir fiyat olabilir). `sayiOku`
  gecersiz girdide `null` donuyor.
- Silme onayi IKI DOKUNUS (`silSoruldu`, `ListeBlogu.tsx` kalibi).
  `mobile/src` icinde hicbir yerde `Alert` YOK (olculdu) — webin
  `confirm()` cagrisinin native karsiligi bu.
- AG YOK, YENI UC YOK: kartta tek `fetch` yok. Vercel Hobby tavani
  (12 fonksiyon) ZATEN dolu; defter cihazda durdugu icin yuva
  harcanmadi (§21 M3'e dokunmuyor).
- Mount: `components/analiz/index.ts` barelinden ad ad export, Analiz
  ekraninda `<TemettuKart>` sonrasi ve "Piyasa seridi" basligi ONCESI.
  Gerekce: serit SECILEN SEMBOLDEN BAGIMSIZ sabit evrenler (kripto +
  maden); tez defteri secilen sembolle ILGILI, o yuzden seridin ustunde.
  Secili sembol `onerilenSembol` olarak forma on-dolgu gidiyor.
- Pazar alani forma YAZILMADI: kart `market: ''` gonderiyor, yazici
  sembolden cozuyor (`metin(girdi.market) || pazarOf(sembol)`). Iki
  yerde ayrisabilen iki pazar tanimi olmasin.
- Yeni uc-test bolumu `21 native tez defteri <-> webin #tab-tez
  sekmesi`: ayni anahtar · webin gosterge formulunun kartta ve
  yazicilarda YOKLUGU · `* 100` ve `formatPercent` yasagi · alti
  yazicinin varligi + barelden cikisi · kartin depoya kendi
  YAZMAMASI · `fetch` yoklugu · `bugunYMD`de `toISOString` yoklugu ·
  `null` → "yazilmadi" · iki dokunuslu silme · dongu sirasi · durumun
  DUZ DILLE de yazili olmasi (salt renk degil) · yasak vaat kelimeleri
  · export + mount + seridin ustunde olma.
  Kapilarda yorumlar `yorumsuz()` ile ayikliyor; ILK KOSUDA tam bu
  yuzden uc kapi kirmizi yandi (dosya basligi hem `sb:theses`i hem
  `Alert`i ALINTILIYOR) ve `tzToday` app.js'de `function` degil
  `const tzToday = () =>` olarak tanimli.
- Kapilar: `node tests/uc-test.mjs` 1836 → **✅ 1880**; `cd mobile &&
  npx tsc --noEmit` **0**; `npx eslint` (dokunulan bes dosya) **0**;
  `cd mobile && npm test` **✅ 79**; `node tests/uretim-test.mjs`
  **✅ 73**; `node tests/parity.mjs` **✅ FARK 0 / 29 nokta**. Motor
  dosyalarina DOKUNULMADI.

**ÖLÇÜLMEDİ**
- Kart CIHAZDA HIC CIZILMEDI. Ekran goruntusu yok (Expo/Metro kosmadi).
  Kapilar "kod dogru yeri okuyor" der, "ekranda dogru duruyor" DEMEZ.
- Hicbir tez CIHAZDA YAZILMADI: yazicilarin yalniz tip denetimi ve
  statik kapilari gecti; `tezlerDepo.yaz` basarisiz dondugunde kartin
  bildirim satirinin gercekten gorunup gorunmedigi test EDILMEDI.
- Webde yazilmis bir defterin app'te okundugu CANLI olarak gorulmedi:
  anahtarin ayni oldugu KOD UZERINDE olculdu, iki platformda yan yana
  DEGIL. Tipin de birebir oldugu `tezSuz` suzgecinden biliniyor, gercek
  bir web kaydiyla DENENMEDI.
- Cok satirli `TextInput` davranisi (klavye acikken formun kaymasi,
  `KeyboardAvoidingView` yoklugu) olculmedi — bu ekranda bes cok
  satirli alan var ve en alttaki alan klavyenin altinda kalabilir.
  TASARIM TURU 3'e dusen bir kalem.
- Webin tez sayisi siniri yok; bu kart da sinirsiz tez cizyor. Cok
  tezli bir defterin `ScrollView` icinde ne kadar agirlastigi
  olculmedi (sanallastirma YOK).
- Hedef/cikis icin "hedefe % kac kaldi" sayisi BILINCLI olarak yok. O
  hesabi motora tasiyacak bir uc yok; §21 #9'da FAZ 4 secenegi olarak
  duruyor. Kullanicinin bu eksikligi nasil karsiladigi SORULMADI.
- Senkron YOK: defter yalniz BU CIHAZDA. Cihaz degistiren kullanici
  tezlerini kaybeder (§21 #9: Supabase senkronu FAZ 4).

## 23. LISTE BILDIRIM BAYRAGI NATIVE'E TASINDI (OLCULDU 2026-11-04)

Webde bir listenin IKI ayri bayragi var ve iki ayri sey anlatiyorlar:
`inUniverse` ANALIZ evrenini kuruyor (hangi hisseler olculsun —
`evrenSemboller`, depo.ts:1036), `notify` ise PUSH evrenini
(`collectWatchlistPayload`, app.js:2244 `if (l.notify === false) return`).
Native tarafta `notify` OKUNUYORDU (depo.ts:143 alan, :419 goc) ama
YAZILAMIYORDU: kullanici webde kapattigi bildirimi app'te geri acamiyor,
app'te hic kapatamiyordu. Sessiz ariza: dugme olmadigi icin kimse fark
etmiyor, telefon titremeye devam ediyor. §6 kalem 6'daki
"`depo.ts` `listeBildirimAyarla` yazicisi" satiri bununla kapandi.

**ÖLÇÜLDÜ**
- YAZICI: `mobile/src/api/depo.ts` → `listeBildirimAyarla(id, acik)`.
  `listeEvreneAl` (depo.ts:974) kalibi: listede yoksa
  `{ ok: false, sebep: 'yok' }` donuyor — SESSIZ gecmiyor; yazilamazsa
  `sebep: 'yazilamadi'`. AG KODU YOK.
- IKI BAYRAK AYRI KALDI: yazici yalniz `notify` yaziyor, `inUniverse`a
  DOKUNMUYOR; `listeEvreneAl` de `notify`ye dokunmuyor. Tek yaziciya
  birlestirmek, bildirimi kapatan kullanicinin listesini SESSIZCE
  analiz evreninden de dusurmek olurdu. Kapi: 22b.
- SARMALAYICI: `mobile/src/api/liste.ts` — `listeBildirimAyarla as
  depoListeBildirimAyarla` ithali (s.45) + sarmalayici (s.255-257).
  ZINCIR UC KATMAN: `api/depo.ts` → `api/liste.ts` → komponent;
  `api/index.ts` BARIL'inde liste yazicilari YOK (olculdu: barilin
  `from './depo'` blogu yalniz depolari, kancalari, tipleri ve tez
  yazicilarini tasiyor). Gelecekteki her liste yazicisi bu yolu izler.
- KART: `mobile/src/components/liste/ListeBlogu.tsx` — "Evrene dahil"
  anahtarinin hemen altinda "Bildirim" anahtari. GERIYE DONUK
  VARSAYILAN ACIK: `kayit.notify !== false` (web app.js:8286 ile ayni).
  `=== true` olsaydi eski cihazlardaki listelerin bildirimi SESSIZCE
  kesilirdi. Kapi: 22d.
- DURUM METINLE DE YAZILI (renk tek ayirt edici degil): "Acik — bu
  listenin sembolleri bildirim evrenine dahil." / "Kapali — bu listeden
  bildirim istenmiyor." Kart bildirimi VAAT ETMIYOR. Kapi: 22f.
- ANAHTAR AG ISTEGI DOGURMUYOR: bayrak CIHAZDA duruyor; push evrenine
  donusu `/api/watchlist` POST'unda olur ve o tur BU EKRANDAN ATILMAZ.
  Kartta `watchlist`/`senkronYaz` cagrisi yok, yazicida `fetch` yok,
  kart `listelerDepo.yaz`i kendi cagirmiyor. Kapi: 22e.
- TASARIM TURU 2 TAMIRI: `Satir` alt komponentinin gezinmesi tek
  gezinme kalibina gecti — `router.push({...})` blogu yerine
  `hisseAc(sembol, bist ? 'BIST' : 'US')` (`lib/gezinme.ts`); dosyadan
  `import { router } from 'expo-router'` DUSTU. params AYNI.
- KAZA VE ONARIMI: `ListeBlogu.tsx` bir Python yazimi sirasinda 0 bayta
  DUSTU (BMP disi karakter surrogate cifti olarak yazildi;
  `io.open(p,'w')` dosyayi encode HATASINDAN ONCE kirpiyor). Dosya
  `git show HEAD:` kopyasindan yeniden kuruldu ve islenmemis
  calisma-agaci degisikligi (gezinme gocu) adli olarak geri getirildi.
  `git diff` tam olarak 37 ekleme / 9 silme — amaclanan iki delta,
  fazlasi yok. YENI KURAL: BMP disi karakter Python yukunde ASLA
  surrogate cifti olarak yazilmaz (`'\U0001F514'` bicimi kullanilir).
- KAPILAR: `tests/uc-test.mjs` §22 (19 denetim). Kaynak greplerinden
  once yorumlar SIYRILIYOR (`yorumsuzB`), yoksa gerekce metni kapiyi
  yanlis yere gecirirdi.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 1902 (1880 → +22) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0
  / 29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint` (uc dosya) 0
  · `mobile npm test` ✅ 79. Motor dosyalarina DOKUNULMADI.

**ÖLÇÜLMEDİ**
- Anahtar CIHAZDA HIC CEVRILMEDI, kart CIHAZDA HIC CIZILMEDI. Ekran
  goruntusu yok (Expo/Metro kosmadi). Kapilar "kod dogru yeri okuyor"
  der, "ekranda dogru duruyor" DEMEZ.
- `sb:lists` ortak anahtarinin web ↔ app arasinda gidip geldigi CANLI
  GORULMEDI: anahtarin ve tipin ayni oldugu KOD UZERINDE olculdu, iki
  platformda yan yana DEGIL.
- PUSH EVRENI HIC CALISTIRILMADI: bayragin gercekten bildirim kesip
  kesmedigi `/api/watchlist` POST'una bagli ve o cagri bu ekrandan
  atilmiyor; uca canli istek yapilmadi (yerel DNS, §12).
- `listelerDepo.yaz` basarisiz dondugunde kartin bildirim satirinin
  gorunup gorunmedigi CIHAZDA denenmedi.
- Bildirimin kendisi (gercek push) bu turda hic kurulmadi: `notify`
  bayragi yalniz bir NIYET kaydi; bildirim altyapisi ntfy tarafinda ve
  app'ten tetiklenmiyor.

## 24. LISTE SATIRINA DONEM YUZDESI GELDI (OLCULDU 2026-11-04)

Listeler sekmesindeki en buyuk gorsel bosluk: satirda FIYAT vardi,
DEGISIM yoktu. Web o yuzdeyi ISTEMCIDE hesapliyor (`changeFor`,
app.js:2037; cagri app.js:8330) — bu depoda istemci matematigi yasak.
Ham yuzde donduren uc zaten vardi ve adi bu yuzeyi aniyordu:
`/api/degisim` (`api/_degisim.js`, `_` onekli oldugu icin Vercel
fonksiyon kotasindan YEMIYOR). §6 kalem 6'daki "liste donem % ham ucu"
satiri bununla kapandi.

**ÖLÇÜLDÜ**
- KART: `mobile/src/components/liste/ListeBlogu.tsx` — acik listede
  alti dugmelik donem seridi (web `.list-periods`, app.js:8321) +
  satirin sagina `DonemYuzdesi`. Dosya 417 -> 625 satir.
- ISTEMCIDE HESAP YOK: yuzde uctan HAM geliyor. `…Pct` alanlari YUZDE
  PUANI (×100 UCTA), bu yuzden `formatPercent` dogru bicimleyici;
  kartta `* 100` ve `(a-b)/b` kalibi YOK. Kapi: 24c.
- TEK DONEM SORULUYOR (`donemler: [donem]`): uca `?donemler=`
  verilmezse ALTI donemi olcuyor = sembol basina alti ust-kaynak
  adresi, satirda bir tanesi gorunur, besi cope giderdi. Kapi: 24d.
- DONEM YALNIZ BELLEKTE, varsayilan `gunluk` — web de liste basina
  ayri tutuyor ve kalicilastirmiyor (`listActivePeriods`, app.js:8115).
  Depoya YAZILMIYOR. Kapi: 24d.
- IKI ISTEK AYRI ANAHTARDA: fiyat `/api/recommend` (anahtar sembol
  listesi), yuzde `/api/degisim` (anahtar `liste + '|' + donem`). Donem
  tiklamasi MOTORU YENIDEN KOSTURMUYOR. Yuzdenin hatasi fiyatin
  hatasini BASTIRMIYOR, kendi satirinda "Yuzdeyi yeniden olc" dugmesiyle
  duruyor. Ikisi de yalniz liste ACIKKEN atiliyor. Kapi: 24e.
- ESLESME SEMBOL **VE** PAZAR UZERINDEN: uc kodu SONEK SILEREK
  donduruyor (`symbol: hedef.sym`) ve ayni kod iki pazarda olabilir;
  yalniz sembole bakan eslesme yanlis satiri gosterirdi. Uca
  `KOD:PAZAR` gidiyor (`temizleSembol`, `api/_girdi.js:204` iki
  bicimi de kabul ediyor). Kapi: 24f.
- DORT DURUST HAL, DORT AYRI CUMLE: tur atilmadi -> "% sorulmadi";
  sembol cevapta yok -> "% cevapta yok"; alan GOVDEDE YOK -> HICBIR SEY
  cizilmiyor (uc o donemi olcmedi); alan `null` -> "% olculemedi".
  Olculmeyen sayi 0 olarak BASILMIYOR. Kapi: 24g.
- RENK TEK TASIYICI DEGIL: yon `▲ ▼ •` isaretiyle de yazili, gecikme
  uctan gelen `gecikmeli` bayragindan METINLE, secili donem dolu dugme
  bicimiyle (`variant="solid"`) ayrisiyor. Kapi: 24h.
- LISTE 8 SEMBOLLE SINIRLI (depo), ucun siniri 12 -> bu yuzeyden
  `cok_sembol` kapisi TETIKLENEMEZ.
- KAPILAR: `tests/uc-test.mjs` §24 (31 denetim); greplerden once
  yorumlar siyriliyor (`yorumsuz24`), yoksa gerekce metni kapiyi yanlis
  yere gecirirdi.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 1933 (1902 -> +31) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0
  / 29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint` 0 ·
  `mobile npm test` ✅ 79. Motor dosyalarina DOKUNULMADI.

**ÖLÇÜLMEDİ**
- SATIR CIHAZDA HIC CIZILMEDI, donem dugmesine HIC BASILMADI. Ekran
  goruntusu yok. Kapilar "kod dogru yeri okuyor" der, "ekranda dogru
  duruyor" DEMEZ.
- `/api/degisim` CANLI HIC CAGRILMADI (yerel DNS, §12): gercek govdenin
  alan adlari, `gecikmeli` bayragi ve `ok:false` hali kod uzerinde
  okundu, AGDAN DEGIL.
- Alti donemin hangisinin canlida gercekten doldugu bilinmiyor; `saatlik`
  BIST kapali saatlerde ne donduruyor OLCULMEDI.
- Dugme seridinin sekiz sembollu uzun listede satir kaydirmasini
  bozup bozmadigi CIHAZDA gorulmedi.
- Fiyat ile yuzdenin AYNI ANI gosterip gostermedigi (iki ayri tur, iki
  ayri `marketTs`) canlida karsilastirilmadi.

## 25. HISSE DETAYINDA "GELISMELER" KARTI (OLCULDU 2026-11-04)

Webdeki hisse sayfasinin `fillSpNews` bolumu (app.js:7923, baslik
"📰 Gelişmeler") native detay ekraninda KARSILIKSIZDI. Haber native'de
yalnizca Bugun sekmesinde, TAKIP LISTESI uzerinden vardi; listede
olmayan bir sembole (Arama sonucundan) gidildiginde kullanici o hissede
ne oldugunu HIC goremiyordu.

**ÖLÇÜLDÜ**
- YENI DOSYA: `mobile/src/components/detay/HaberKart.tsx`. Girisden
  (`detay/index.ts`) ad ad disa acildi ve `hisse/[sembol].tsx` ekraninda
  `TemettuKart`tan SONRA basiliyor: `<HaberKart sembol={sembol}
  market={satir.market} />`. Kapi: 25b.
- YENI UC YOK: var olan `/api/news` coklu-sembol kipi (`fetchHisseHaberleri`)
  TEK sembolle cagriliyor. Hobby 12-fonksiyon tavani (§21 M3) AYNI
  KALDI — bu kart tavana dokunmuyor. Kapi: 25c.
- `HisseHaberleriKarti` YENIDEN KULLANILMADI, GEREKCE OLCULDU: o kart
  `useListe()` okuyor, yani kullanicinin LISTESINI soruyor ve listedeki
  DIGER sembollerin manşetlerini de cekiyor. Detay sembolu listede
  OLMAYABILIR. Yeni kart liste deposuna HIC dokunmuyor. Kapi: 25d.
- PAZAR CIKARIMI YOK (onaylanmis karar): `market` cagirandan geliyor
  (`satir.market`), kart `.IS` tahmini ya da sabit pazar yazmiyor.
  Onbellek anahtari pazari TASIYOR (`'detay-haber:' + sembol + '|' +
  market + '|' + limit`), yoksa pazar degisince eski tur yapisirdi.
  Kapi: 25e.
- DORT DURUST HAL, DORT AYRI CUMLE, HEPSI UCTAN: `satir.tam === false`
  -> "olcemedim" rozeti + "'haber yok' DENMIYOR, olcum eksik kaldi";
  `tam && adet === 0` -> "Olculdu, manşet cikmadi — bu da OLCULMUS bir
  cevap"; uc satir hic dondurmediyse -> "Uc bu sembol icin satir
  dondurmedi"; dolu olcum -> `HaberSatiri` satirlari. Eksik tarama
  rozeti MANSETLERIN USTUNDE (yarim olcumu tam gibi sunmamak icin).
  Kapi: 25f.
- ISTEMCI MATEMATIGI YOK: kartta yuzde/puan hesabi yok, duyarlilik ucun
  `duyarlilik` katmanindan basiliyor ve YARIM taramada (`eksik`) HIC
  basilmiyor — yarim beslemenin puani sembolu temsil etmez. Kapi: 25g.
- KAP AYRIMI EKRANDA YAZILI: haber ucu `type: 'NEWS'` donduruyor, KAP
  `/api/takvim`den geliyor. Kart bunu alt notta soyluyor, yoksa
  kullanici "KAP yok" sanirdi. Yasal uyari kartta TEKRARLANMIYOR —
  `ScreenShell` basiyor. Kapi: 25h.
- KAPILAR: `tests/uc-test.mjs` §25 (29 denetim); greplerden once
  yorumlar siyriliyor (`yorumsuz25`), yoksa gerekce metni kapiyi yanlis
  yere gecirirdi.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 1962 (1933 -> +29) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0
  / 29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint` 0 ·
  `mobile npm test` ✅ 79. Motor dosyalarina DOKUNULMADI.

**ÖLÇÜLMEDİ**
- KART CIHAZDA HIC CIZILMEDI. Ekran goruntusu yok. Kapilar "kod dogru
  yeri okuyor" der, "ekranda dogru duruyor" DEMEZ.
- `/api/news` kip ② detay ekranindan CANLI HIC CAGRILMADI (yerel DNS,
  §12): gercek govdenin satir sayaclari (`semboller[].tam`, `.adet`),
  `duyarlilik` katmani ve `uyari` alani kod uzerinde okundu, AGDAN
  DEGIL. `duyarlilik` HENUZ DOLU GORULMEDI.
- Uc BIST sembolu icin hangi beslemeyi secip kac manşet dondurdugu
  olculmedi; `.IS` sonekli sembolun uctaki `PAZAR_ESLEME`den gecisi
  canlida dogrulanmadi.
- Manşet linkine basildiginda ne oldugu (harici tarayici) CIHAZDA
  denenmedi — `HaberSatiri` davranisi devralindi, yeniden olculmedi.
- Kartin detay ekranini ne kadar uzattigi ve `limit` varsayilaninin
  (uc tarafi) ekranda kac satir ettigi gorulmedi.

## 26. HISSE DETAYINDA YAZMA EYLEMLERI + KALICI KIYAS SETI (OLCULDU 2026-11-04)

Webde hisse sayfasinin ust seridinde iki yazma eylemi var (`listAddSymbol`,
hisse sayfasi dugmesi `spListBtn` app.js:7705; kalici kiyas seti `sb:compare`
app.js:12238). Native'de listeye ekleme YALNIZ Arama sekmesindeydi
(`arama.tsx:296/345`). KIYAS SETINE EKLEME HIC YOKTU: `kiyasaEkle`
(`mobile/src/api/depo.ts:1345`) yazilmis duruyordu ama HICBIR ekran
cagirmiyordu ve `src/api/index.ts` onu disa bile acmiyordu — yani kullanici
kalici karsilastirma kumesini native'de hic KURAMIYORDU. Analiz sekmesi
yalniz 🏭 Sektor koprusunden gelen `?kiyas=` parametresiyle doluyordu;
`useKiyas()` hicbir ekranda tuketilmiyordu.

**ÖLÇÜLDÜ**
- YENI DOSYA: `mobile/src/components/detay/DetayEylemler.tsx` — iki dugme
  (`Listeye ekle`, `Karşılaştırmaya ekle`), etiketler eklenince `Listede` /
  `Karşılaştırmada`ya donuyor ve dugme kapaniyor. Girisden ad ad disa
  acildi, ekranda `<DetayBasligi>`in HEMEN ALTINA basiliyor. Kapi: 26b.
- YENI UC YOK, YENI BAGIMLILIK YOK: iki eylem de YEREL depo yazicisi
  (`ekle`, `kiyasaEkle`). Hobby 12-fonksiyon tavani (§21 M3) AYNI KALDI.
  Kapi: 26c.
- `src/api/index.ts` artik `kiyasaEkle`yi disa aciyor (once acmiyordu, bu
  yuzden hicbir ekran cagiramazdi). Kapi: 26c.
- SINIR DEPODA: slot sayisi `AZAMI_KIYAS` (= 8, `depo.ts:122`, kaynagi
  app.js:12722) kartta YENIDEN YAZILMADI; `>= 8` gibi cikplak esik yok.
  Dolu kume dugmeyi kapatiyor ve slot sayisi ekranda yazili
  (`Karşılaştırma seti: N / 8 slot`) — dugme neden kapali gorunuyor. Kapi: 26d.
- BASARISIZLIK SESSIZ KALMIYOR: depo `ok:false` + `mesaj` donduruyor
  (`zaten_var` / `dolu` / `yazilamadi`), o mesaj OLDUGU GIBI basiliyor;
  kart kendi hata cumlesini UYDURMUYOR. `kiyasaEkle` `async` oldugu icin
  cumle yalniz `then` icinde, sonuc gelince basiliyor. Kapi: 26e.
- PAZAR CIKARIMI YOK (onaylanmis karar): `market` cagirandan
  (`satir.market`). "Zaten var" denetimi pazari da kiyasliyor cunku
  `KiyasOge` sembol VE pazar tutuyor (ayni kod iki pazarda olabilir).
  Kapi: 26f.
- ANALIZ SEKMESI KAYNAK SIRASI, EKRANDA YAZILI: ① `?kiyas=` koprusu
  ② kalici set (`sb:compare`) ③ takip listesi. Ucuncu basamak ESKI
  davranis — kimse set kurmadiysa hicbir sey degismiyor. Ustteki cumle
  artik HANGI kaynaktan kostugunu soyluyor, ve kirpilan sembol sayisi
  (uc siniri `AZAMI_SEMBOL`) kopru DISINDAKI kaynak icin de sayiliyor.
  Kapi: 26g.
- KAPILAR: `tests/uc-test.mjs` §26 (35 denetim); greplerden once yorumlar
  siyriliyor (`yorumsuz26`).
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 1997 (1962 -> +35) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0 /
  29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint` 0 ·
  `mobile npm test` ✅ 79. Motor dosyalarina ve uclara DOKUNULMADI.

**ÖLÇÜLMEDİ**
- HICBIR DUGMEYE CIHAZDA BASILMADI. Ekran goruntusu yok. Kapilar "kod
  dogru yaziciyi cagiriyor" der, "dugme ekranda calisiyor" DEMEZ.
- `sb:compare` GIDIS-DONUSU hic gorulmedi: yazma -> `useKiyas` aboneligi ->
  Analiz sekmesinin ayni turda kumeyi gormesi zinciri cihazda denenmedi.
  `kiyasDepo.yaz()` basarisiz dondugunde cikan cumle de gorulmedi.
- `/api/compare` KALICI SETLE CANLI HIC CAGRILMADI (yerel DNS, §12): 8
  sembollu bir setin uc tarafindaki `AZAMI_SEMBOL` kirpmasi ve kart
  govdesi olculmedi.
- Dolu kume (8/8) hali gercekten uretilmedi; "dolu" mesajinin ekranda
  nasil sardigi gorulmedi.
- Listeye ekleme Arama sekmesindeki yolla AYNI yaziciyi kullaniyor ama
  iki yuzeyin ayni anda ayni sembolu yazmasi denenmedi.
- Kartin detay ekranini ne kadar uzattigi ve dugmelerin kucuk ekranda
  (`flexWrap`) nasil kirildigi gorulmedi.

## 27. SIRKET PROFILI KARTI — "SIRKET NE YAPIYOR?" (OLCULDU 2026-11-04)

Webde hisse sayfasinda `fillSpBiz` (app.js, kutu `id="spBiz"`, baslik
"🏢 Şirket ne yapıyor?") sektor ETIKETININ otesinde sirketin ne is yaptigini
yazan bir bolum var. Native detay ekraninda bunun KARSILIGI YOKTU: skor,
teknik, temel, tez, risk-odul, backtest, temettu, haber vardi ama "bu sirket
ne yapiyor?" sorusunun cevabi yoktu — arama sonucundan gelen kullanici
TANIMADIGI bir sembolde skoru okuyordu.

**ÖLÇÜLDÜ**
- YENI DOSYA: `mobile/src/components/detay/SirketKart.tsx`. Detay girisinden
  ad ad disa acildi, ekranda `<TeknikKart>`tan ONCE basiliyor (webde de
  bolum ust tarafta). Kapi: 27b.
- YENI UC YOK, YENI BAGIMLILIK YOK, TIP DEGISIKLIGI YOK: var olan
  `/api/yfin` kunye turu kullaniliyor (`api/_yfin.js` → `bizSummary` ·
  `sector` · `industry` · `website`) ve `YfinKunye` bu dort alani ZATEN
  tutuyordu. Hobby 12-fonksiyon tavani (§21 M3) AYNI KALDI. Kapi: 27a/27c.
- `deep: false`: profil alanlari `assetProfile` modulunde; `deep`un
  getirdigi takvim/kazanc modulleri istenmiyor — gereksiz modul uc turunu
  uzatirdi. Kapi: 27c.
- Onbellek anahtari DIZGI (`sembol + '|sirket'`), ayni sembolun temettu
  turuyla CAKISMIYOR; bos sembolde tur atilmiyor (`etkin`). Kapi: 27c.
- TERS PIYASA DENEMESI YOK (onaylanmis karar): web profil bos gelirse
  sembolu `otherMarket(market)` ile DIGER pazarda tekrar deniyor
  (app.js:7809). Native BUNU YAPMIYOR — kart `market` props'u bile ALMIYOR,
  ekran pazar GECIRMIYOR, dosyada tek bir `fetchYfin(` cagrisi var. Sessizce
  baska bir pazarin sirketini basmak, kullaniciya yanlis sirketi dogru sanma
  riski verirdi. Kapi: 27d.
- DORT DURUST HAL, DORDU AYRI CUMLE: ① tur kayit getirmedi ② `ok:false` →
  "olculemedi" (veri yok DEMIYOR) ③ metin yok ama sektor etiketi var →
  etiket basiliyor ve "profil metni bu kunyede YOK" deniyor ④ ikisi de bos.
  Yukleniyor/hata/bos tek `Durum` govdesinden. Kapi: 27e.
- METIN SESSIZCE KIRPILMIYOR: ilk cumle ayriliyor, KALAN atilmiyor —
  `<Katlanir baslik="Tam profili oku">` icinde duruyor (webin `<details>`
  karsiligi, varsayilan KAPALI). Cumle sinirini bulamazsa TUM metin
  basiliyor; hicbir yerde "…" ile kesme yok. Kapi: 27f.
- HESAP YOK, PUAN YOK, SKORA GIRMIYOR: kartta yuzde/oran/`toFixed` yok,
  esik/agirlik sabiti yok. "skora girmez" rozeti ve "teknik ya da temel
  skora GİRMEZ" satiri EKRANDA yazili. Metnin INGILIZCE geldigi ve
  CEVRILMEDIGI de ekranda yazili — cevrilmis gibi sunulmuyor. Kapi: 27g.
- Dis bag (`website`) kullanicinin tarayicisina gidiyor, basarisizlikta
  sessiz dusuyor; adres ucun verdigi metin, kartta dogrulanmiyor. Kapi: 27h.
- KAPILAR: `tests/uc-test.mjs` §27 (35 denetim); greplerden once yorumlar
  siyriliyor (`yorumsuz27`) — kart basligi `otherMarket` adini ALINTILIYOR,
  siyrilmasa "ters pazar yok" kapisi kendi gerekcesine takilirdi.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 2032 (1997 -> +35) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0 /
  29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint` 0 ·
  `mobile npm test` ✅ 79. Motor dosyalarina, uclara ve app.js'e
  DOKUNULMADI.

**ÖLÇÜLMEDİ**
- KART CIHAZDA HIC CIZILMEDI. Ekran goruntusu yok. Kapilar "kod dogru ucu
  dogru parametreyle cagiriyor" der, "kart ekranda okunuyor" DEMEZ.
- `/api/yfin` DETAY EKRANINDAN CANLI HIC CAGRILMADI (yerel DNS, §12):
  `bizSummary` dolu HIC gorulmedi. Dort halden hicbiri gercek cevapla
  dogrulanmadi — hangi BIST sembollerinde profil metni gelip gelmedigi
  BILINMIYOR (Yahoo'nun BIST profilleri cogu zaman zayif, bu OLCULMEDI).
- `ilkCumle` gercek bir profil metniyle denenmedi: "Inc."/"U.S." gibi
  kisaltmalarin cumleyi erken bitirdigi hal gorulmedi (kalan metin
  katlanirda durdugu icin kayip yok, ama ilk paragrafin ne kadar kisa
  ciktigi olculmedi).
- `Katlanir` acildiginda uzun metnin detay ekranini ne kadar uzattigi ve
  kaydirmanin nasil davrandigi gorulmedi.
- `website` bagina HIC basilmadi; adresin gecerli olup olmadigi (ucun
  dondurdugu metin dogrulanmiyor) olculmedi.
- Kartin ekledigi EK UC TURUNUN maliyeti olculmedi: detay ekrani acilista
  artik `analyze` + `backtest` + `temettu` + `haber` + `sirket` turu
  atiyor; `sirket` ve `temettu` AYNI uca iki ayri tur yapiyor (biri
  `deep:true`, biri `deep:false`) — birlestirme firsati var, OLCULMEDI,
  §21.2'ye maliyet kalemi olarak yazilmadi cunku ikisi de ucretsiz
  kademede.

## 28. BILDIRIM SENKRONU — LISTELER BULUTA, ISCIYE (OLCULDU 2026-11-04)

Native'de her listenin "bildirim" anahtari ZATEN cevriliyordu
(`ListeBlogu.tsx:259`), ama deger CIHAZDAN CIKMIYORDU: `/api/watchlist` ne
okunuyor ne yaziliyordu, `fetchWatchlist`/`pushWatchlist` sarmallari
CAGRISIZ duruyordu. Bildirimi atan isci (`worker/poll.mjs` →
`worker/watchlist.mjs`) ayni kodun altindaki KV kaydini okudugu icin app'te
yapilan hicbir degisiklik telefona ulasmiyordu — anahtar pratikte sustu.

**ÖLÇÜLDÜ**
- YENI DOSYA: `mobile/src/components/liste/SenkronKart.tsx`. Liste girisinden
  ad ad disa acildi (`liste/index.ts`), `ListelerKart` icinde `YeniListeKart`
  SONRASINA basiliyor. SEKME EKRANI DEGISMEDI — `(tabs)/index.tsx` zaten
  `ListelerKart` basiyordu. Kapi: 28g.
- YENI UC YOK, YENI BAGIMLILIK YOK: var olan `/api/watchlist` ve var olan
  `client.ts` sarmallari kullaniliyor. `api/` altinda hala TAM 12 rota
  dosyasi var; Hobby 12-fonksiyon tavani (§21 M3) AYNI KALDI. Kapi: 28d.
- KOD KAYNAGA GOMULMEDI (onaylanmis karar degil, benim kararim): web kodu
  gomuyor (`app.js:2235` `SYNC_CODE = 'atahan-bulten-9f3c'`). Ucta KIMLIK
  DOGRULAMA YOK (`api/watchlist.js` icinde `authorization`/`token`/`secret`
  HIC gecmiyor — greple olculdu) ve kod PAYLASILAN BIR SIR. Gomulu kod, App
  Store'dan inen her kuruluma ayni kisinin listesini okutup UZERINE
  YAZDIRIRDI. Native kodu kullanicidan aliyor, native'e ozel `sb:senkron`
  anahtarina yaziyor, varsayilan BOS ve bos = senkron KAPALI (istek
  atilmiyor). Kapi: 28e.
- KOD GERI BASILMIYOR: kayitli kod ne ekranda ne hata cumlesinde; kart kendi
  hata cumlesini de uydurmuyor, depo/uc mesajini OLDUGU GIBI basiyor.
  Kapi: 28e.
- OKUMA SALT GOSTERIM: web `adoptRemoteState` (app.js:2285) ile uzaktan
  geleni localStorage'a yaziyor; native BUNU YAPMIYOR — `ui` sekli webin ic
  durumu ve native tarafinda HIC olculmedi. `ui` GONDERILMIYOR da; govde
  yalniz `{ list, portfolio: [] }`. Bulut ozetinin uygulanmadigi EKRANDA
  yazili. Kapi: 28f.
- SESSIZ KIRPMA YOK: gonderilmeyen her kayit ekranda sayiyla — `kapali`
  (bildirimi kapali liste), `tekrar` (ayni sembol+pazar), `pazarsiz`
  (BIST/US disi, ucun `cleanList`i sessizce dusurur). Ucu de ayri cumle.
  Kapi: 28c.
- DEPO native'e OZEL: `sb:senkron` ne `ANAHTARLAR` kumesinde ne `TUMU`
  listesinde (o ikisi weble birebir); kaydi kartin kendisi okutuyor
  (`senkronYukle`). "Hic yazilmadi" `null`, `0` DEGIL. Kod bicimi
  sozlesmeden geliyor (`WATCHLIST_CODE_BICIM`, depoda yeniden yazilmiyor).
  Kapi: 28b.
- HESAP YOK: kartta yuzde/oran/`toFixed`/esik sabiti yok. TEK birim cevrimi
  var — `updatedAt` MILISANIYE, `formatGunAySaat` SANIYE ister — tek yerde
  (`anMetni`) ve "birim cevrimi, hesap degil" diye yorumlu. Kapi: 28h.
- KAPILAR: `tests/uc-test.mjs` §28 (43 denetim); greplerden once yorumlar
  siyriliyor (`yorumsuz28`) — hem kart hem `senkron.ts` basliklari
  `SYNC_CODE` ve `adoptRemoteState` adlarini ALINTILIYOR, siyrilmasa
  "gomulu kod yok" kapisi kendi gerekcesine takilirdi.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 2075 (2032 → +43) ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0 /
  29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint src` 0 ·
  `mobile npm test` ✅ 79. Motor dosyalarina, uclara, `app.js`e ve
  `worker/**`a DOKUNULMADI.

**ÖLÇÜLMEDİ**
- KARTA CIHAZDA HIC BASILMADI. Ekran goruntusu yok. Hicbir dugmeye
  dokunulmadi; `TextInput`a kod girilmedi.
- `/api/watchlist` NATIVE'DEN CANLI HIC CAGRILMADI (yerel DNS, §12). Ne
  yazma ne okuma gercek cevapla gorulmedi: `count`in gonderilenden kucuk
  ciktigi hal (ucun kendi temizligi) HIC gozlenmedi.
- ANAHTAR → BULUT → ISCI → TELEFON zinciri UCTAN UCA HIC izlenmedi. App'te
  bildirimi kapatmanin ntfy bildirimini gercekten kestigi OLCULMEDI.
- `sb:senkron` kaydinin cihazda gidip geldigi (yaz → uygulamayi kapat → oku)
  HIC gorulmedi; `senkronZamanYaz` sonrasi `sonYazma` ekranda dolu HIC
  gorulmedi.
- Gecersiz kod hali denenmedi: `WATCHLIST_CODE_BICIM` reddinin ekranda hangi
  cumleyi bastigi gorulmedi.
- EŞ ZAMANLI YAZMA olculmedi: web ve app ayni kodu paylasirsa son-yazan-kazanir
  (`api/watchlist.js` `updatedAt: Date.now()`); app `list` yazarken
  `portfolio: []` gonderiyor — webin portfoyunu SIFIRLAYIP sifirlamadigi
  UCUN KODUNDAN OKUNDU ama CANLI DOGRULANMADI. Ayni kodu hem webde hem app'te
  kullanmak PLANLANMIYOR; kullanilirsa bu olculmeli.
- Kodun ekranda yazili olmasina ragmen kullanicinin kodu nereden alacagi
  (uretim/paylasim akisi) TASARLANMADI — FAZ 4 (Supabase kimlik) kalemi.

## 29. GUNDEM SOZLUGUNE SIYASET/SECIM KAVRAMI (OLCULDU 2026-11-04)

Kullanici webdeki Gundem bolumunde ABD secimleriyle ilgili HIC haber
gormedigini bildirdi. Olculen sebep: veri eksigi DEGIL, SOZLUK eksigi.
`AGENDA_LEXICON` 22 kavram tasiyordu ve icinde siyaset/secim/butce kavrami
YOKTU; Gundem kartlari yalnizca bir kavramla ESLESEN basliklardan kuruluyor
(`app.js` `agendaScore`, `p.matched`), eslesmeyen baslik ekrana HIC ulasmiyor.
Besleme tarafinda haber VARDI (`tr-top` genel + `us-world`), tek kacis yolu
olan "yukselen" patikasi ise ayni >=5 harfli belirteci >=4 baslikta ve >=2
agirlikta ister; ustune `AGENDA_STOP` `trump` ve `biden` belirteclerini
dogrudan engelliyor. Yani secim haberi yapisal olarak GORUNMEZDI.
Kullanici "eklememiz lazim, bu tarz olaylarin borsalar ile direkt ilgisi var"
dedi — kavram onayla eklendi.

**ÖLÇÜLDÜ**
- TEK YERE DOKUNULDU: `app.js` `AGENDA_LEXICON` sonuna `politics` kavrami
  (emoji 🗳️, etiket 'Secim / Siyaset / Butce'). 22 → 23 kavram.
- `risk` ALANI BILEREK YOK: oteki 22 kavramda `risk: 'on'|'off'` var, burada
  yok. Secim/butce basliginin yonu olculemez. Alan bos oldugu icin
  `riskOn`/`riskOff` sayimina OY KULLANMIYOR (`app.js` tally yalniz `it.risk`
  doluysa sayiyor) — uydurma yon basmak yerine oy kullanmamak.
- `sectors: []` BILEREK BOS: etkilenen sektor yonu uydurulmadi. Bos listenin
  uctan uca guvenli oldugu iki tuketim yerinde okundu: `app.js:11634`
  (`(it.sectors || []).map`, etki satiri hic basilmiyor) ve `app.js:11844`
  (`agendaMatchedStocks`, hisse satiri hic basilmiyor).
- UC KATMANLI KABUL kurali kullanildi (`agendaAdmit`): belirsiz Turkce
  anahtarlar (`secim`, `butce`, `vergi`, `kongre`, `senato`, `parlamento`,
  `kabine`, `election`, `congress`, `senate`) `weak` listesinde ve PIYASA
  baglami sart; kesin anahtarlar (`midterm`, `government shutdown`,
  `debt ceiling`, `exit poll`, `vergi paketi`, `butce acigi`, `impeachment`,
  `referandum`, `tax bill`, `tax cut`, `fiscal policy` …) tek basina kabul.
- `ctx` icine `butce`/`maliye` KONULMADI (ilk tasarimda vardi, cikarildi):
  ayni belirtec hem `weak` hem `ctx` olursa kelime KENDINI dogrular ve weak
  kapisi anlamsiz hale gelirdi.
- TURKCE EKLESME OLCULDU: `agendaKwHit` anahtarin IKI yaninda da sinir
  istiyor, bu yuzden "secim sonuclari" basligi 'secim sonuc' anahtarini
  TUTMUYOR. Cekim bicimleri acikca eklendi: 'ara secimi', 'baskanlik secimi',
  'genel secimi', 'yerel secimi', 'secim sonucu', 'secim sonuclari',
  'sandik sonuclari'. (`veto`/`weak`/`ctx` govde esleseni kullandigi icin
  onlarda bu sorun yok.)
- SPOR/YARISMA ANLAMLARI VETOLANDI: 'kadro secim', 'oyuncu secim', 'juri',
  'yarisma', 'guzellik secim', 'milli takim', 'sampiyona', 'transfer',
  'kura cekim', 'sarki secim'. `earnings` kavramindaki ayni disiplin
  ('bilanco' = deprem bilancosu tuzagi) ornek alindi.
- 11 BASLIKLA DENENDI (yerel, agsiz; `tests/engine.mjs` `buildEngine` ile):
  7 gercek siyaset/butce basligi KABUL (ABD ara secimi, government shutdown
  + debt ceiling, "Secim sonuclari sonrasi Borsa Istanbul…", "Vergi paketi
  Meclis gundeminde", "Kongre yeni vergi duzenlemesini tartisiyor…",
  "Baskanlik secimi icin sandik basina gidiliyor", "Butce acigi beklentinin
  uzerinde geldi"), 4 tuzak basligi RED (kadro secimi, juri secimi, sarki
  secimi, transfer secimleri).
- NATIVE AYNASI GUNCELLENDI: `mobile/src/lib/sozluk.ts`
  `GUNDEM_KONSEPT_SOZLUK`'e `politics: 'Secim / Siyaset / Butce'` eklendi —
  sozluk motorun `AGENDA_LEXICON` anahtarlarini BIREBIR aynalamak zorunda,
  eksik anahtar native'de kavram etiketsiz kalirdi.
- MOTOR YENIDEN URETILDI: `node tools/motor-uret.mjs` → `IMZA`
  `sha256:1d4641571813deea` → **`sha256:f2117df120d4def7`**; `_ayar.js`
  imzasi DEGISMEDI (`sha256:75512c5271a89b33`). Kavram `gundem-sozluk`
  diliminin icinde kaldi, dilim sayisi 33 AYNI.
- YENI UC YOK, YENI BAGIMLILIK YOK, YENI DOSYA YOK. `api/` altinda hala TAM
  12 rota dosyasi — Hobby 12-fonksiyon tavani (§21 M3) AYNI.
- Takim sonuclari: `node tests/uretim-test.mjs` ✅ 73 ·
  `node tests/uc-test.mjs` ✅ 2075 · `node tests/parity.mjs` ✅ FARK 0 /
  29 nokta · `mobile` `npx tsc --noEmit` 0 · `npx eslint src` 0.
  `worker/**`, uclar ve `tests/baseline.json` DOKUNULMADI.

**ÖLÇÜLMEDİ**
- CANLI BESLEME ILE HIC DENENMEDI (yerel DNS, §12): gercek Google News RSS
  basliklarindan kac tanesinin bu kavrama dustugu, kartin "sicak/ilik/soguk"
  isisinin ne olacagi ve `heads` basliklarinin nasil gorunecegi
  OLCULMEDI. Denemeler ELLE YAZILMIS 11 baslikla yapildi.
- EKRANDA HIC GORULMEDI: ne webde ne cihazda. Sektor satirinin ve hisse
  satirinin bos `sectors` ile gercekten basilmadigi KODDAN okundu, EKRANDA
  dogrulanmadi.
- `risk` bos kavramin ruh hali (`mood`) hesabini nasil etkiledigi canli
  veriyle gorulmedi — kodda oy kullanmadigi okundu, gercek bir gunun
  risk sayimi izlenmedi.
- YANLIS POZITIF ORANI BILINMIYOR: 'vergi' ve 'butce' Turkce haberde cok
  genis gecer; piyasa baglami sarti yeterli mi, ancak canli akista olculur.
  Tersi de gecerli — ctx listesi fazla dar olup gercek secim haberini
  dusurebilir.
- ABD secim takvimi (ara secim/baskanlik tarihleri) kavrama GIRMEDI: takvim
  ucu (`/api/takvim`) ile baglanti KURULMADI, bu kavram yalniz HABER
  basligindan besleniyor.

## 30. SEPET KARTI NATIVE'E TASINDI (OLCULDU 2026-11-04)

Webde Listeler/portfoy tarafindaki sepet (`sb:basket`) native'de HIC
gorunmuyordu. Kart yazildi, fiyat katmani ayri dosyaya kondu ve §30 kapi
blogu `tests/uc-test.mjs`'ye eklendi.

**ÖLÇÜLDÜ**
- IKI YENI DOSYA: `mobile/src/api/sepet.ts` (fiyat katmani) +
  `mobile/src/components/liste/SepetKart.tsx` (kart). Kart
  `ListelerKart.tsx`'e TAKILI (`<SepetKart />`), barrel adiyla disa
  aciyor, `src/api/index.ts` fiyat turlerini disa aciyor.
- YENI UC YOK, YENI BAGIMLILIK YOK: yalniz var olan `fetchDegisim` ve
  `fetchKripto` sarmallari cagriliyor. `api/` altinda hala TAM 12 rota —
  Hobby 12-fonksiyon tavani (§21 M3) AYNI.
- `sepetDepo` zaten `TUMU` kumesindeydi; kendi yukleyicisi KURULMADI,
  kayitlari fiyat katmani KENDI okuyor (`sepetDepo.al()`), kart tasimiyor.
- MALIYET KARARI `donemler: ['gunluk']`: ucun varsayilani ALTI donem =
  sembol basina UC adres (`api/_degisim.js:330`); buraya yalniz `price`
  gerekiyor ve o her donemde geliyor. Tek donem = tek adres.
- DILIM TAVANLARI SOZLESMEDEN: `DEGISIM_AZAMI_SEMBOL` / `KRIPTO_AZAMI_ID`
  ice alindi, ciplak sayi YAZILMADI, burada YENIDEN TANIMLANMADI.
- WEBDEN BILEREK AYRILAN UC NOKTA (hepsi uc eksikligi, uydurma yapilmadi):
  (1) METAL: web gram altin/gumus/platini truncgil onbelleginden okuyor
      (`app.js` `loadRates`), UCU YOK. Elde olan `/api/degisim` yalniz
      `GC=F` cozuyor ve o ONS/USD; cihazdaki kayit GRAM/TRY. Cevrim
      uydurmak yerine kalem KAYNAKSIZ sayildi.
  (2) DOVIZ: `USDTRY=X` sembol sozlugunde YOK, sembol kapisindan da
      gecmiyor (`=` tasiyor). `fx` kalemleri KAYNAKSIZ.
  (3) FON (TEFAS): uc yok (bot engeli); yalniz kullanicinin kendi girdigi
      `manualPrice` kullaniliyor ve kaynak 'elle' diye ISARETLI — olculmus
      fiyatla karismasin.
- SESSIZ KIRPMA YOK: dusen her kayit sayiliyor ve EKRANDA basiliyor —
  "soruldu ama olculemedi" sayisi ayri, kaynaksiz kalemler gerekce basina
  SAYIYLA (gerekce tekillestirildi ama sayisi yazili), ucun kendi `uyari`
  metni OLDUGU GIBI.
- TOPLAM BASILMIYOR (benim karari): satir degerleri farkli para biriminde
  (BIST/TRY · ABD+kripto/USD), bir kismi olculemiyor, kur cevrimi ucu YOK.
  Tek bir "sepet toplami" olculmus fiyati elle girilenle ve eksik satirla
  ayni sayida eritmek olurdu. Gerekce EKRANDA yazili.
- TEK HESAP YERI `muhasebe()` (kartin icinde): `adet x fiyat` ve maliyete
  gore FARK. `fark` YALNIZ maliyetin para birimi fiyatinkiyle AYNIYSA
  cikariliyor. Fiyat katmaninda carpma/toplama YOK, `toFixed` YOK, esik /
  agirlik / formul YOK. Olculmeyen her hal `null`, `0` DEGIL.
- SEPET BULUTA GITMIYOR: bildirim senkronu govdesi (§28) yalniz takip
  listesini tasiyor. Ne fiyat katmani ne kart `./senkron`u cagiriyor ve
  bu durum EKRANDA yazili ("Sepet kaydi buluta GONDERILMIYOR…").
- ERTELENEN MAKINE webde DURUYOR, port EDILMEDI: `BASKET_WINDOWS`,
  `basketWindowFlow`, anlik goruntu gecmisi,
  `renderBasketWindows`/`renderBasketMoves`. Bunlar MOTOR isi — donem
  tabani secip giris/cikis akisini fiyat degisiminden AYIRIYOR; ucta
  karsiligi yok, istemciye kurmak §5.1'in yasakladigi sey olurdu.
- PORTFOY SEKMESI app-web BOSLUGU DEGIL: web tarafinda o sekme
  KALDIRILDI; sepet Listeler altinda yasiyor.
- §30 KAPI BLOGU EKLENDI (`tests/uc-test.mjs`, `yorumsuz30` siyiricisi,
  tek `bitir();` oncesine): 33 yeni denetim — oncul/varlik/bagli, depo,
  maliyet karari, ham sayi kurali, sessiz kirpma yok, toplam yok.
  2075 → **2108 denetim**.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ 2108.

**ÖLÇÜLMEDİ**
- CANLI HIC CALISTIRILMADI (yerel DNS, §12): `/api/degisim` ve
  `/api/kripto` bu dosyadan HIC cagrilmadi; dilim sayisi, gercek gecikme
  ve istek maliyeti OLCULMEDI.
- EKRANDA HIC GORULMEDI: ne kalem satiri, ne kaynaksiz gerekce satirlari,
  ne "Fiyatlari olc" dugmesi bir cihazda basildi. Sepet kaydi OLAN bir
  cihaz hic denenmedi — kart bos durumda bile gorulmedi.
- `sb:basket` kaydinin web ile AYNI SEKILDE cozuldugu (alan adlari,
  `cls` degerleri, `unit`/`costCur`) yalniz KODDAN okundu, gercek bir web
  kaydi native'de acilmadi.
- Metal/doviz/fon icin uc EKLENMEDI: karar degil eksiklik. Metal icin
  gram/TRY ucu, doviz icin `USDTRY` ucu gerekir; ikisi de yeni rota
  demek (§21 M3 tavani).
- `sepetGecmis` (`sb:basket:history`) ve `hamleler` (`sb:basket:moves`)
  kayitlari native'de HIC OKUNMUYOR — depo turleri var, ekran yok.
- Kripto `priceUsd` ile BIST/TRY satirlarinin yan yana okunabilirligi
  (kullanicinin kafasi karisir mi) EKRANDA denenmedi.

## 31. UST FIYAT SERIDI NATIVE'E TASINDI + /api/kur ACILDI (OLCULDU 2026-11-05)

Webin sayfa basindaki fiyat seridi (`app.js:2517`, `TICKER_BUILTIN_META`)
native'de HIC gorunmuyordu; ustelik gram altin/doviz icin UC DA YOKTU.
Bu tur `/api/kur` acildi (truncgil `today.json`), fiyat katmani ayri
dosyaya kondu, kart Bugun sekmesine takildi, §31 kapi blogu eklendi ve
§⑰ kapisi BESINCI tasiyiciya genisletildi.

**ÖLÇÜLDÜ**
- UC YENI DOSYA: `api/_kur.js` (uc) + `mobile/src/api/serit.ts` (fiyat
  katmani) + `mobile/src/components/bugun/SeritKart.tsx` (kart). Kart
  `(tabs)/bugun.tsx`'e TAKILI (`<SeritKart />`), barrel adiyla disa
  aciyor, `src/api/index.ts` serit turlerini disa aciyor.
- HOBBY 12-FONKSIYON TAVANI KORUNDU (karar 1A): yeni uc `_` onekli,
  `vercel.json` yeniden-yazimi `/api/kur` → `/api/proxy?__rota=kur`.
  `api/` altinda hala TAM 12 yol dosyasi; kapi 31b bunu `readdirSync` ile
  SAYARAK olcuyor, elle yazmiyor. YENI BAGIMLILIK YOK.
- TASIYICI TABLOSU LITERAL: `proxy.js` icinde
  `kur: () => import('./_kur.js')`. Degiskenle `import(x)` Vercel
  derleyicisi tarafindan IZLENMEZ — dosya pakete girmez ve uc canlida
  404 verir. Kapi 31b literal satiri ariyor.
- TURKCE SAYI BICIMI UCTA COZULUYOR, ISTEMCIDE DEGIL: truncgil
  `today.json` "4.123,45" bicimi veriyor; cozum `_kur.js` icinde
  (`sayiTr`). §5.1 geregi istemciye tasinamazdi.
- KOD SAYISINDAN BAGIMSIZ TEK UST ISTEK (`AZAMI_UST_ISTEK = 1`): uc
  `today.json`un TAMAMINI tek istekte aliyor, kod basina istek YOK.
  Istemci tavani `AZAMI_KOD = 40`, sozlesmeden (`KUR_AZAMI_KOD`) okunuyor.
- ACILIS EN COK UC ISTEK, KALEM SAYISINDAN BAGIMSIZ: `serit.ts` tum
  kalemleri uc basina TEK cagriya topluyor (kur · kripto · degisim).
  Degisim ucundan yalniz `donemler: ['gunluk']` isteniyor (maliyet
  karari, §30 ile ayni gerekce).
- KARTIN KENDI `fetch`I YOK (components icinde `fetch` yasak): olcumu
  `seritFiyatlari()` derliyor — `SepetKart` ile AYNI kalip. Kart yalniz
  basiyor; fiyat katmaninda `toFixed` YOK, esik/agirlik/formul YOK.
- ACILISTA KENDI OLCUYOR (SepetKart'tan BILEREK AYRILAN nokta): web de
  seridi sayfa acilisinda yukluyor (`loadRates`), dugmeye basmiyor. Ekran
  kapanirsa istek `AbortController` ile kesiliyor. Mesgul hali
  TURETILMIS (`sonuc === null`), etkide `setState` yok.
- YERLESIK KUME WEB ILE BIREBIR: gram · usd · eur · gbp · btc · eth.
  Gram altinin webdeki DUSUSU de tasindi: `gram-altin` yoksa `GRA`
  (`app.js:121`). Ozel metal/doviz kaleminin anahtari KAYDIN SEMBOLU
  (`app.js:2493`). Ozel gosterge tavani 4 (`AZAMI_GOSTERGE`,
  `app.js:2521`), cihazdaki gizleme kaydi (`sb:ticker:hidden`) OKUNUYOR.
- SESSIZ KIRPMA YOK: fiyati cozulemeyen kalem listeden ATILMIYOR — "—"
  basiliyor, gerekce tekillestirilip SAYISIYLA yazili (uc sustu · fon
  ucu yok · sembolsuz kayit · CoinGecko kimligi yok), ucun kendi uyari
  metni OLDUGU GIBI, ekranda `olculen/toplam` sayaci var.
- TOPLAM BASILMIYOR (benim karari): kalemler farkli para biriminde
  (kurlar TRY, BTC/ETH USD) ve kur cevrimi ucu yok. Gerekce EKRANDA.
- NAKIT TANIM GEREGI 1, olcum degil — kaynagi `nakit` diye ISARETLI.
- §31 KAPI BLOGU EKLENDI (`tests/uc-test.mjs`, `yorumsuz31` siyiricisi,
  tek `bitir();` oncesine): on grup (31a-31j) — oncul/uc/istemci/bagli,
  yerlesik kume, depo, istek sayisi, ham sayi kurali, sessiz kirpma yok,
  ekran davranisi.
- §⑰ KAPISI GENISLETILDI (ONCEKI TURDAN KALAN KIRIK): `proxy.js`
  tasiyici tablosu DORTTEN BESE cikmisti, ⑰ blogu hala dort rota
  yaziyordu — `MOD.kur` tanimsiz oldugu icin takim `uc-test.mjs:6106`'da
  COKUYORDU. `KUR` ice aktarmasi, `kaynaklar`/`MOD`/`YOL`/`H` kalemleri,
  rota kumesi dizgisi ve iki regex besinciye genisletildi; ayrica AGA
  VARMADAN uc yeni 400 kapisi (`kur_kod_yok` · `cok_kod` · `bad_kod`,
  gerekce: dogrulama onbellek anahtarindan ONCE donuyor).
  BU YUZDEN onceki turda bildirilen "2108 denetim" ESKIMISTI.
- IKI YANLIS POZITIF KENDI KAPIMDA DUZELTILDI: `ESIK_` probu
  `SERIT_YERLESIK_IDLER` icindeki `...YERLESIK_`e takiliyordu; web
  cagrisinin degisken adi `truncgilCache`.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ **2169** ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0
  (29 nokta) · `mobile` `npx tsc --noEmit` 0 · `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- `/api/kur` CANLI HIC CAGRILMADI (yerel DNS, §12). `today.json`un
  GERCEK alan adlari, `Tur`/`Degisim`/`Update_Date` alanlarinin varligi
  ve `GRA` takma adi YALNIZ `app.js`'den okundu, canli cevapta
  GORULMEDI. Gercek gecikme ve istek maliyeti OLCULMEDI.
- EKRANDA HIC GORULMEDI: ne serit kutulari, ne gerekce satirlari, ne
  `olculen/toplam` sayaci bir cihazda basildi. Ozel gostergesi OLAN bir
  cihaz hic denenmedi.
- GOSTERGE EKLEME/CIKARMA/GIZLEME EKRANI NATIVE'DE YOK: kayit webde
  yapiliyor ve bu cihaza GELMEZ (gosterge kaydi buluta gonderilmiyor).
  Bu durum kartta YAZILI ama app-web bosluğu olarak ACIK.
- `sb:tickers` ve `sb:ticker:hidden` kayitlarinin web ile AYNI SEKILDE
  cozuldugu yalniz KODDAN okundu; gercek bir web kaydi native'de
  acilmadi.
- FON (TEFAS) kalemi icin fiyat ucu HALA YOK (bot engeli) — kalem
  listede kaliyor, gerekcesi basiliyor.
- SEPET KARTI (§30) metal/doviz kalemleri artik `/api/kur` ile
  FIYATLANABILIR HALE GELDI ama DEGISTIRILMEDI: §30 kapi blogu o
  dosyanin mevcut dizgilerini (`SEBEP_METAL`, `if (k.cls === 'metal')`)
  olcuyor; ikisi AYNI turda birlikte guncellenmeli. SIRADA.
- `api/_kur.js` dosyasi git'te HALA IZLENMIYOR (`??`) — `_gundem`,
  `_degisim`, `_kripto`, `_metal` ile ayni durumda. Deploy oncesi
  eklenmeleri gerekiyor.

## 32. SEPETIN METAL/DOVIZ KALEMLERI FIYATLANDI (OLCULDU 2026-11-05)

§31'de `/api/kur` acildigi icin sepet kartinin "ucu yok" diye KAYNAKSIZ
saydigi iki sinif (metal · doviz) artik web ile AYNI yerden fiyatlaniyor.
`mobile/src/api/sepet.ts` ve §30 kapi blogu AYNI turda guncellendi.

**ÖLÇÜLDÜ**
- WEB ILE BIREBIR: `app.js:2483` `basketPrice` ikisini tek cagriyla
  cozuyor — `truncgilGet(truncgilCache, h.symbol)`, para birimi `'TRY'`.
  Native de ayni anahtari soruyor: KAYDIN SEMBOLU, KUCULTULMEDEN (ust
  kaynagin anahtarlari karisik kipte: `USD` buyuk, `gram-altin` kucuk).
- UCUNCU UC TURU EKLENDI (`fetchKur`), dilim tavani sozlesmeden
  (`KUR_AZAMI_KOD`). Uc kod sayisindan BAGIMSIZ tek ust istek yaptigi
  icin (`_kur.js` `AZAMI_UST_ISTEK = 1`) sepet acilisinin maliyeti
  kalem sayisiyla ARTMIYOR: en cok uc istek (degisim · kripto · kur).
- `SepetFiyat['kaynak']` kumesine `'kur'` girdi; kartta adi YAZILI
  (`KAYNAK_ADI.kur = 'ölçülen fiyat'`) — elle girilen fiyatla ve
  "tanim geregi 1" nakitle KARISMIYOR.
- BOZUK KOD UCA CIKMADAN AYIKLANIYOR: tek gecersiz kod ucu 400'e
  dusurup DILIMIN TAMAMINI yakardi; `KUR_KOD_BICIM`'den gecmeyen kayit
  kaynaksiz sayiliyor, gerekcesi ekranda. `SEBEP_METAL`/`SEBEP_FX`
  metinleri bu yeni gerekceye gore YENIDEN YAZILDI ("uc yok" DEGIL,
  "kod bicimi tutmuyor").
- SESSIZ KIRPMA YOK (degismedi): tanimayan kodu uc 200 ile ama SATIRSIZ
  donduruyor; o kalem `olculemedi`ye giriyor, ekranda SAYISIYLA yazili.
- HAM SAYI KURALI KORUNDU: fiyat katmaninda carpma/toplama yok,
  `toFixed` yok, esik/agirlik yok; uctan gelen `fiyatTry` OLDUGU GIBI.
- §30 KAPISI GUNCELLENDI (ayni tur): 30d ucuncu sarmali ve ucuncu dilim
  tavanini olcuyor; 30f'in "uc sinifin ucu de KAYNAKSIZ" iddiasi ARTIK
  DOGRU DEGILDI, yerine bes yeni kapi — ayni uca soruluyor · anahtar
  kucultulmuyor · bozuk kod aga varmadan ayiklaniyor · kaynaksiz kalan
  tek sinif FON · birim TRY · kaynagin adi ekranda.
- Takim sonuclari: `node tests/uc-test.mjs` ✅ **2174** ·
  `node tests/uretim-test.mjs` ✅ 73 · `node tests/parity.mjs` ✅ FARK 0
  (29 nokta) · `mobile` `npx tsc --noEmit` 0 · `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- CANLI HIC DENENMEDI (yerel DNS, §12): `/api/kur` bir kez de
  cagrilmadi; cihazdaki bir metal/doviz kaydinin sembolunun ust
  kaynaktaki anahtarla GERCEKTEN eslestigi GORULMEDI. Webin kaydi
  `gram-altin` gibi bir anahtar tasiyorsa eslesir, baska bir sey
  tasiyorsa kalem `olculemedi` olarak basilir — ikisi de ekranda dogru
  gorunur ama HANGISI oldugu olculmedi.
- GRAM ALTIN YEDEGI SEPETTE YOK: serit katmaninda `gram-altin` → `GRA`
  dususu var (§31), sepette YOK — cunku web de sepette o dususu
  yapmiyor (`basketPrice` yalniz `h.symbol`). BILINCLI birebirlik.
- EKRANDA HIC GORULMEDI: ne yeni fiyat satirlari ne yeni gerekce
  metinleri bir cihazda basildi.
- FON (TEFAS) kalemi icin fiyat ucu HALA YOK.

## 33. ICERIDEN ISLEMLER KARTI NATIVE'E TASINDI (OLCULDU 2026-11-05)

Webin hisse sayfasindaki "Iceriden islemler" bilgi panelinin
(`app.js:5127`) native karsiligi yoktu. Bu turda EKRAN tarafi kapandi:
sozluk + kart + giris + ekran baglantisi. Uc tarafi (`/api/iceriden`,
rota · 400'ler · 12 dosya tavani) onceki turda acilmisti.

**ÖLÇÜLDÜ**
- INVARYANT KORUNDU: panel **TEMEL SKORA DAHIL DEGIL** (kullanici
  tercihi 2026-08-15, `app.js:5131`). Kart ne `buildMotor` ne skor ucu
  cagiriyor, onbellek anahtarinda motor imzasi YOK; "skora girmez"
  rozeti ve cerceve satiri EKRANDA yazili.
- PAZAR CIKARIMI YOK: `pazar` cagirandan geliyor
  (`<IceridenKart sembol={sembol} pazar={satir.market} />`), web de
  ayni sekilde arguman aliyor (`fillInsider(symbol, market, req)`).
- US VE BIST AYRI GOVDE: Form 4 adet/tutar tasiyor, KAP bildirimi
  YAPISAL SAYI TASIMIYOR. BIST govdesi adet/tutar/yon alanlarina HIC
  dokunmuyor; sayinin neden olmadigi EKRANDA yazili (uydurma `0` yok).
- HAM SAYI KURALI (§5.1): kartta `fetch(` yok, esik/agirlik/formul adi
  yok, `toFixed` yok. Net tutar UCTA hesaplaniyor
  (`t.netTutar = t.alisTutar - t.satisTutar`, `api/_iceriden.js:612`).
  Turkce cumle TEK YERDE: `mobile/src/lib/sozluk.ts` (dort kapali kod
  kumesi). Olculmeyen sayi `EMPTY`, asla `0`.
- SOZLUK ANAHTARLARI SOZLESMEYLE BIREBIR: kapi `ICERIDEN_*_SOZLUK`
  anahtar kumelerini `types.ts` birlesimleriyle VE ucun gercekten
  bastigi kod dizgileriyle karsilastiriyor; kume kayarsa ekranda
  `undefined` basilacakti.
- SESSIZ KIRPMA YOK: US'te `bildirimSayisi` (secilen) ve `okunan`
  (basilan), BIST'te `bulunan` ve `maddeSayisi` AYRI AYRI ekranda.
  Acik piyasa DISI adet (hibe/opsiyon) ayri satirda, tutarsiz.
  Ucun kendi `uyari` metni OLDUGU GIBI basiliyor.
- TAKIM YESIL: uc-test **2242** (+40, kapi blogu 32), uretim 73,
  parite FARK 0 (29), `npx tsc --noEmit` 0, `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- CANLI CAGRI YOK: `/api/iceriden` bugune kadar HIC canli cagrilmadi
  (yerel DNS kirik, §12). `api/_iceriden.js`'nin Form 4 duzenli ifade
  ayristirmasi GERCEK bir SEC belgesi gormedi.
- EKRANDA HIC GORULMEDI: kart bir cihazda basilmadi; US/BIST
  gecisi, baglanti dokunusu ve bos haller elle denenmedi.
- KAP YEDEGI OLCULMEDI: `kaynakKodu` = `haber` / `kap_haber` dallari
  canli beslemeyle hic tetiklenmedi; yanlis esleme orani BILINMIYOR.
- PARA BIRIMI CEVRILMIYOR: Form 4 tutarlari ust kaynagin biriminde
  basiliyor, birim ADIYLA yazili ama sembol basilmiyor. BILINCLI.
- `IceridenKart.tsx` HALA IZLENMEYEN dosya (`??`) — deploy oncesi
  `git add -- <yol>` gerekiyor.

## 34. "NEDEN HAREKET EDIYOR?" NATIVE'E TASINDI (OLCULDU 2026-11-05)

Webin "Neden hareket ediyor?" bolumu esikleri ve karar agacini
TARAYICIDA tutuyordu (`fillSpWhy`, satir ici `const BIG = 3.0, MOD = 1.2`).
Native istemci hesap YAPMAZ — karar MOTORA, hesap `/api/neden` ucuna
tasindi. Onaylanan 2A geregi onbellek BASTAN kurulu.

**ÖLÇÜLDÜ**
- MOTOR (tek esik yeri): `app.js` haber-skor dilimine `WHY_SERT = 3.0`,
  `WHY_BELIRGIN = 1.2`, `WHY_HABER_ESIK = 0.12` ve `whyGunlukYuzde`,
  `whyHareketKod`, `whyYonKod`, `whyHaberYonKod`, `whyUzlasmaKod`,
  `whyKutupKod` + bes `WHY_*_KODLARI` kumesi girdi. `fillSpWhy` artik
  SAYI karsilastirmiyor, KOD'a bakiyor; satir ici `BIG`/`MOD` SILINDI.
  Uretilmis `api/_motor.js` birebir ayni (uretim 73 yesil).
- UC: `api/_neden.js` — `GET /api/neden?symbol=&pazar=`. YENI VERCEL
  FONKSIYONU YOK: `_` onek + `vercel.json` yonlendirmesi (karar 1A),
  `api/proxy.js` tasiyici sayisi 7 (`neden` dahil), rota dosyasi
  sayisi hala 12. Uc HAM KOD basiyor; icinde esik SAYISI yok (tek
  gecen yer `api/_neden.js:19` baslik yorumu).
- SOZLESME: `mobile/src/api/types.ts:3040-3145` — `NedenResponse` +
  bes kapali kod birlesimi. Istemci: `fetchNeden`, `neden: '/api/neden'`.
- TURKCE TEK YERDE: `mobile/src/lib/sozluk.ts:474-525`, bes sozluk.
  Icinde SAYI yok.
- KART: `mobile/src/components/detay/HareketKart.tsx`. Ad `HareketKart`,
  cunku `components/kesfet/NedenKart.tsx` BASKA ozellik (nedensel
  baglantilar). Hisse detayinda `TemettuKart`tan SONRA, `HaberKart`tan
  ONCE — bugunku hareketin ozeti, mansetleri okumadan once.
  `pazar` PROP; kart pazar CIKARIMI yapmiyor.
- SKORA GIRMEZ: kart motoru/skoru hic cagirmiyor; "skora girmez"
  rozeti + cerceve satiri EKRANDA.
- NEDENSELLIK IDDIASI YOK: "haber_uyumlu" = yonler AYNI TARAFTA
  demek, haberin fiyati oynattigi demek DEGIL — bu cumle hem sozlukte
  hem kartin kapanis satirinda yazili.
- HAM SAYI KURALI (§5.1): kartta `fetch(` yok, esik/agirlik adi yok,
  `Math.abs`/sayi karsilastirmasi yok. `toFixed` TEK yerde ve yalniz
  sunum yardimcisinda (`yuzdeMetni`). Olculmeyen sayi `EMPTY`, asla `0`.
- SESSIZ KIRPMA YOK: `atilan` (listeye girmeyen manset) ve IKI kaynak
  sayaci (fiyat + haber, basari/istek) ekranda. `tam === false` ise
  "bu olcum EKSIK" yazili. Ucun `uyari` metni OLDUGU GIBI geciyor.
  Duyarlilik olculemediyse sifir puan BASILMIYOR, "OLCULEMEDI" deniyor.
- TAKIM YESIL: uc-test **2303** (+42, kapi blogu 33), uretim 73,
  parite FARK 0 (29), `npx tsc --noEmit` 0, `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- CANLI CAGRI YOK: `/api/neden` bugune kadar HIC canli cagrilmadi
  (yerel DNS kirik, §12). Onbellek isabet orani ve GERCEK maliyet
  BILINMIYOR — 2A'nin olcum adimi deploy sonrasina kaldi.
- EKRANDA HIC GORULMEDI: kart bir cihazda basilmadi.
- PUANLANAN ALAN SAPMASI: uc yalniz MANSETI puanliyor, web manset
  ozetini de okuyordu; bu yuzden `puan` web surumunden SAPABILIR.
  Sapmanin BUYUKLUGU olculmedi — kart bunu ekranda yaziyor.
- `HareketKart.tsx` ve `api/_neden.js` HALA IZLENMEYEN dosya (`??`) —
  deploy oncesi `git add -- <yol>` gerekiyor.

## 35. KATALIZOR / RISK KARTI NATIVE'E TASINDI (OLCULDU 2026-11-05)

Webin "Katalizor / Risk" satiri (`fillCatalysts`) gun farkini ve
`days <= 45` esigini TARAYICIDA tutuyordu. Native istemci hesap YAPMAZ,
esik TASIMAZ — karar MOTORA, hesap `/api/katalizor` ucuna tasindi.
Onaylanan 2A geregi onbellek BASTAN kurulu.

**UC BACAK, BILINCLI BOLUNME** (webdeki tek satir uc sey yaziyordu):
1. OYNAKLIK -> kartta YOK. `/api/analyze` `oynaklik` + `atrPlan`
   kodlarini ZATEN getiriyor, `RiskOdulKart` ZATEN basiyor. Ikinci
   cagri acmak ayni ATR'yi iki kez olcmek olurdu.
2. YAKLASAN TEMETTU -> `KatalizorKart` (bu bolumun konusu).
3. HABER UYARISI -> OLCUM DEGIL, sabit cumle: `lib/sozluk.ts` icinde
   (`KATALIZOR_HABER_UYARISI`). Uctan tasimak serbest Turkce metin
   tasimak olurdu (HAM SAYI KURALI §5.1).

**ÖLÇÜLDÜ**
- MOTOR (tek esik yeri): `app.js:1561-1580` — `KAT_TEMETTU_GUN = 45`,
  `KAT_TEMETTU_KODLARI = ['yakin','uzak','gecti']`, `katGunFarki`,
  `katTemettuKod`. `fillCatalysts` artik SAYI karsilastirmiyor
  (`katTemettuKod(days) === 'yakin'`); uc satir ici esik kopyasinin
  UCU DE silindi. Uretilmis `api/_motor.js` birebir ayni —
  IMZA `sha256:4dc3809a91adbc51`, 125 simge (uretim 73 yesil).
- UC: `api/_katalizor.js` — `GET /api/katalizor?sembol=&pazar=`.
  YENI VERCEL FONKSIYONU YOK: `_` onek + `vercel.json` yonlendirmesi
  (karar 1A). `api/proxy.js` tasiyici sayisi 7 -> 8 (`katalizor`),
  `vercel.json` yonlendirme sayisi 16, rota dosyasi sayisi HALA 12.
  Uc icinde esik SAYISI yok; `ENG.katGunFarki` / `ENG.katTemettuKod` /
  `ENG.KAT_TEMETTU_KODLARI` cagiriyor. Turkce gecen TEK satir yasal
  `UYARI` sabiti.
- IKI KAYNAK, IKI AYRI GUN: BIST ayagi temettu takvimini (ODEME gunu),
  US ayagi `_yfin.js` `kunyeCek` kunyesini (birincil olarak KESILME /
  ex gunu) okuyor. Hangisi olculduyse `tarihTuru` ile cevapta ve
  EKRANDA yazili — ikisini "temettu tarihi" diye birlestirmek iki
  farkli gunu ayni gun gostermek olurdu.
- `kunyeCek` `_yfin.js`ten DISA ACILDI (yfinHandler'dan ayristirildi).
  Yan kazanc: §27'deki `sirket` + `temettu` turlarini birlestirme
  kalemi artik daha kolay.
- SOZLESME: `mobile/src/api/types.ts:3170-3242` — `KatalizorResponse`,
  `KatalizorTemettu`, iki kapali kod birlesimi, hata kodlari. Icinde
  esik SAYISI yok. Istemci: `fetchKatalizor`, `katalizor: '/api/katalizor'`,
  `katalizor_alinamadi` cumlesi.
- BARREL EDITI GEREKMEDI (olculdu, varsayilmadi):
  `mobile/src/api/index.ts:20` `export * from './client'` ve
  `client.ts:130` `export * from './types'` zinciri `fetchKatalizor` ve
  tum `Katalizor*` tiplerini ZATEN disa aciyor.
- TURKCE TEK YERDE: `mobile/src/lib/sozluk.ts:543-569` —
  `KATALIZOR_TEMETTU_SOZLUK` (uc kod), `KATALIZOR_TARIH_TURU_SOZLUK`,
  `KATALIZOR_HABER_UYARISI`. Icinde SAYI yok (45 gun BU DOSYADA DEGIL).
- BILGI KAYBI KAPANDI: web yalniz `yakin` kodunda yaziyordu; "temettu
  var ama uzak" ile "temettu YOK" ekranda AYNI gorunuyordu. Native
  ucunu de (`yakin` / `uzak` / `gecti`) cumleli basiyor.
- KART: `mobile/src/components/detay/KatalizorKart.tsx`. Hisse
  detayinda `TemettuKart`in HEMEN ALTINDA — ham tarihler yukarida,
  en yakin tarih + kac gun kaldi + bant burada. `pazar` PROP; kart
  pazar CIKARIMI yapmiyor.
- `TemettuKart` ILE CAKISMIYOR (olculdu): o kart `/api/yfin`
  kunyesinin HAM tarihlerini basiyor, gun farki ya da bant
  TASIMIYOR; BIST ayaginda kaynak da baska.
- HAM SAYI KURALI (§5.1): kartta `fetch(` yok, esik adi/sayisi yok,
  gun farki hesabi yok (`Date.now()`/`new Date(` yok), oran-yuzde
  donusumu yok (`*100`/`/100` yok), motor/skor cagrisi yok.
- OLCULMEYEN SAYI BASILMIYOR: bos deger `EMPTY`, asla `0` — cunku
  `0 gun` GECERLI bir olcum (temettu BUGUN) ve ayri basiliyor
  ("bugun"). `tutar` / `verimYuzde` / `odendi` olculmediyse SATIR HIC
  CIKMIYOR. US kunyesi yaklasan tek odemenin TUTARINI vermiyor
  (`dividendRate` YILLIK), o ayakta bu satirlar yok.
- SESSIZ KIRPMA YOK: `atilan` (ekranda olmayan ileri tarih) ve
  `tarihiOkunamayan` sayilari ekranda; `tam === false` ise "olcum
  eksik olabilir" yazili. Ucun `uyari` metni OLDUGU GIBI geciyor.
- SKORA GIRMEZ: rozet + cerceve satiri EKRANDA; yasal uyari kartta.
- TAKIM YESIL: uc-test **2372** (+69, kapi blogu 34), uretim 73,
  parite FARK 0 (29), `npx tsc --noEmit` 0, `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- CANLI CAGRI YOK: `/api/katalizor` bugune kadar HIC canli cagrilmadi
  (yerel DNS kirik, §12). Onbellek isabet orani ve GERCEK maliyet
  BILINMIYOR — 2A'nin olcum adimi deploy sonrasina kaldi.
- BIST AYAGININ MALIYETI: tek sembol icin TUM temettu takvimi sayfasi
  cekiliyor. Sayfa BOYUTU ve GECIKMESI olculmedi; onbellek bu yuzden
  bastan kurulu, ama isabetsiz ilk istegin suresi bilinmiyor.
- EKRANDA HIC GORULMEDI: kart bir cihazda basilmadi.
- `tarihTuru` DAGILIMI: US ayaginda gercek kunyelerde ne kadar sik
  `odeme` yerine `kesilme` dondugu canli veriyle olculmedi.
- `KatalizorKart.tsx` ve `api/_katalizor.js` HALA IZLENMEYEN dosya
  (`??`) — deploy oncesi `git add -- <yol>` gerekiyor.

## 36. VADE SECICI NATIVE'E GELDI (OLCULDU 2026-11-05)

Motor DORT vade penceresi tasiyor (`api/_ayar.js` VADELER:
gunici · kisa · orta · uzun). Native istemci bu alani ALTI cagri
yerinde `'orta'` SABITLEMISTI — motorun uc penceresi ekrana HIC
ulasmiyordu. Secim artik kullanicida.

**ÖLÇÜLDÜ**
- YENI UC YOK, YENI VERCEL FONKSIYONU YOK, `vercel.json` DEGISMEDI:
  `/api/analyze`, `/api/compare` ve `/api/backtest` `vade` alanini
  ZATEN aliyordu. Serit tamamen UCRETSIZ (karar 1A'ya dokunmuyor).
- KOMPONENT: `mobile/src/components/VadeSecici.tsx` (yeni, LF).
  `Dugme`yi tekrar kullaniyor — ikinci bir Pressable / dokunma hedefi
  tanimi YOK. Secili dugme `solid`+`gold`, otekiler `outline`+`neutral`.
- TURKCE TEK YERDE: `mobile/src/lib/sozluk.ts` sonuna `VADE_SIRASI`,
  `VADE_SOZLUK`, `VADE_NOTU`. Ucunde de SAYI YOK (HAM SAYI KURALI
  §5.1) — hangi vadede hangi agirligin degistigi native'de yazili degil.
- `Record<Vade, string>`: motor BESINCI bir vade eklerse `tsc` kirilir,
  ekranda sessizce bos etiket cikmaz. Sira `VADE_SIRASI`dan, nesne
  anahtar sirasindan DEGIL.
- BARREL SATIRI GEREKTI (olculdu): `mobile/src/components/index.ts`
  isim-isim yazilmis, `*` kasitli yasak — `VadeSecici` satiri eklendi.
  Buna karsin `Vade` tipi `@/api`den zincirle ZATEN geliyor
  (`api/index.ts:20` -> `client.ts:130` -> `types.ts`).
- EKRAN 1 — `mobile/src/app/hisse/[sembol].tsx` (CRLF): `useState<Vade>`,
  `fetchAnalyze(..., { vade })`, `BacktestKart vade={vade}`.
  Secici `Durum`dan ONCE basiliyor; analiz turu 45-55 sn surdugu icin
  iskeletin ARKASINDA kalsa kullanici bekleme boyunca vadeyi
  degistiremezdi.
- EKRAN 2 — `mobile/src/app/(tabs)/analiz.tsx` (LF): TEK durum, IKI tur
  — derin dalis ve ⚖️ Karsilastir AYNI vadeyi kullaniyor. Ayri iki
  secici, ayni ekranda iki farkli pencereden gelen sayilari yan yana
  gostermek olurdu.
- ONBELLEK ZEHIRLENMESI KAPANDI (yayina girmeden yakalandi): iki ekran
  da `useIstek` anahtarini ciplak sembolle kuruyordu
  (`sembol ?? ''` ve `'compare:' + liste.join(',')`). Vade degisince
  ONCEKI vadenin onbellekli satiri basilir, ekran yeni vadeyi
  gosterdigini SANIRDI. Anahtarlar `'|' + vade` tasiyor; gerekcesi
  kaynak yorumunda yazili.
- YANLIS OLAN KAYNAK YORUMU DEGISTIRILDI: `[sembol].tsx` basligi sabit
  vadeyi SAVUNUYORDU ("vade secici Analiz sekmesinin isi"). Birakilsa
  dosya kendi davranisinin aleyhine konusurdu.
- GUN ICI DURUSTLUGU: `'gunici'` vadede motor teknik ayagi kosturmuyor,
  teknik skor ve plan `null` geliyor. Bu secimin ALTINDA yazili
  (`VADE_NOTU.gunici`) — bos kart ariza sanilmasin.
- WEB PARITESI OLCULDU: webin TEK vade secicisi
  `index.html:331-335` `<select id="taVade">`, teknik sekmede
  (`app.js:3659 / 3677 / 3817`). Bu, native'in Analiz sekmesine
  karsilik geliyor. Kalan dort `'orta'` yeri — `(tabs)/arama.tsx:159`,
  `(tabs)/bugun.tsx:215`, `(tabs)/index.tsx:101`,
  `(tabs)/kesfet.tsx:96` — LISTE ekranlarini besliyor ve WEBDE DE
  secici YOK; sabit kalmasi parite-dogru, EKSIK DEGIL.
- `app.js`te kalan vade bagli sayilar (`buyReach`/`sellReach`
  1282-1283, `zMult` 1296, `gapTh` 1408, `pull` 1412) `computeVadeScore`
  / `momentumInfo` ICINDE — motor ic isleri, arayuz degil. Native'e
  esik SIZMADI.
- VARSAYILAN KORUNDU: iki ekran da `'orta'` ile aciliyor; secim
  yapilmazsa eski davranis BIREBIR ayni.
- TAKIM YESIL: uc-test **2372**, uretim 73, parite FARK 0 (29),
  `npx tsc --noEmit` 0, `npx eslint src` 0.

**ÖLÇÜLMEDİ**
- CIHAZDA HIC GORULMEDI: secici bir ekranda basilmadi; dugme sarmasi
  (dort etiket tek satira sigiyor mu) ve notun yuksekligi olculmedi.
- CANLI CAGRI YOK: `/api/analyze` ve `/api/backtest` bugune kadar
  `'orta'` DISINDA bir vade ile HIC canli cagrilmadi (yerel DNS kirik,
  §12). `'gunici'` cevabinin gercekten teknik ayagi bos dondurdugu
  CANLI dogrulanmadi — yalniz motor kaynagindan okundu.
- MALIYET: vade degistikce ayni sembol icin AYRI onbellek satiri
  olusuyor; en kotu durumda bir sembol icin DORT tur. Gercek istek
  artisi ve fatura etkisi olculmedi — 2A'nin olcum adimi deploy
  sonrasina kaldi.
- `VadeSecici.tsx` HALA IZLENMEYEN dosya (`??`) — deploy oncesi
  `git add -- mobile/src/components/VadeSecici.tsx` gerekiyor.

## 37. SEPETE YAZMA + NAKIT + HAMLE GUNLUGU NATIVE'E GELDI (OLCULDU 2026-11-06)

**ÖLÇÜLDÜ**
- ARIZA: `mobile/src/api/depo.ts` sepet turu native'de OKUNUYORDU
  (`SepetKart`, §30) ama ona YAZAN hicbir ekran yoktu. Sepet kaydi
  buluta da gonderilmiyor (senkron govdesi yalniz takip listesini
  tasiyor), yani telefonda sepet kurmanin HICBIR yolu yoktu. Eksik olan
  EKRAN, veri degil.
- `depo.ts` 13. bolum eklendi: `AZAMI_SEPET = 200`, `SepetGirdi`,
  `sepeteEkle`, `sepettenCikar`, `nakitAyarla`. Ucunun hepsi
  `hamleEkle`den geciyor — o fonksiyon bugune kadar CAGIRANI OLMAYAN
  olu koddu.
- WEB PARITESI OLCULDU: `bmAddHolding` app.js:3303-3340,
  `removeBasketHolding` app.js:3341-3360, `adjustCash`/`setCash`
  app.js:3380-3404, `logMove` app.js:2452 (yedi cagri yeri, dort `type`
  degeri: `add`/`remove` 3331/3357/3397, `buy`/`sell` 3166/3202/3221).
- AG YOK, BILINCLI AYRILIK: web ekleme ANINDA canli fiyat cekip
  `addPrice`/`valTRY`/`pl`/`basketFlow` alanlarini doldururyor. `depo.ts`
  aga CIKMIYOR, bu yuzden native o alanlari `null` biraktiyor ve fiyat
  `SepetKart`taki "Fiyatlari olc" turunda geliyor. TEK ISTISNA TRY
  nakit: birimi 1 oldugu icin degisim miktarinin kendisi TL karsiligidir
  (cevrim YOK). OLCULMEYEN SAYI BASILMADI.
- SESSIZ KIRPMA YOK: web `saveBasket` (app.js:2501) sinirsiz, `sepetDepo`
  da sinirsiz KALDI. Sinir YAZMA fonksiyonunda: 200. kalemden sonra
  `sebep:'dolu'` ile GORUNUR ret (`listeyeEkle`/`AZAMI_SEMBOL` kalibi).
- TURKCE TEK YERDE: `SepetKart.tsx` icindeki YEREL `SINIF_ADI` sabiti
  `lib/sozluk.ts`e `VARLIK_SINIFI_SOZLUK` olarak tasindi; yanina
  `SEPET_SINIF_SIRASI` (`cash` YOK, cunku `sepeteEkle` onu reddediyor)
  ve `HAMLE_TURU_SOZLUK` eklendi.
- UC YENI KART: `liste/SepetEkleKart.tsx` (sinif secici + sembol/adet/
  maliyet/para birimi, fon icin elle TL fiyat alani),
  `liste/NakitKart.tsx` (TRY/USD; `nakitBakiye` `null` dondurursek
  "girilmemis" yaziliyor, 0 YAZILMIYOR), `liste/HamleKart.tsx`
  (SALT OKUNUR gunluk, `useHamleler`in ILK tuketicisi).
- `SepetKart` satirlarina "Cikar" dugmesi geldi; onay SORULMUYOR cunku
  web de sormuyor ve islem hamle gunlugune dusuyor.
- HATA METNI UYDURULMADI: her ret `YazSonuc.mesaj` olarak basiliyor.
- 5'LI MENU DEGISMEDI, yeni sekme acilmadi; uc kart Listeler sekmesinde
  `SepetKart` ile `SenkronKart` arasinda.
- TAKIM: `npx tsc --noEmit` 0, `npx eslint src/components/liste` 0.

**ÖLÇÜLMEDİ**
- CIHAZDA HIC GORULMEDI: uc kart da bir ekranda basilmadi. Klavye
  acikken formun kaymasi, sinif dugmelerinin sarmasi ve gunlugun 50
  satirda kaydirma davranisi OLCULMEDI.
- NODE TAKIMI BU SERITTE KOSTURULMADI: `uc-test` / `uretim-test` /
  `parity` bu degisiklikten etkilenmiyor (hicbir `api/` ya da `tests/`
  dosyasina dokunulmadi) ve o anda baska seritler `api/` icinde
  calisiyordu — tam takim serit birlesiminden SONRA kosturulacak.
- CANLI CAGRI YOK (yerel DNS kirik, §12): "Fiyatlari olc" turunun yeni
  eklenen kalemi gercekten fiyatlandirdigi canli DOGRULANMADI.
- `AZAMI_SEPET = 200` NATIVE'E OZEL bir koruma; webde karsiligi YOK ve
  OLCULMUS bir esik DEGIL. 200'un dogru sayi oldugu olculmedi.
- HESAP YAPILMADI, bilincli: sepet toplami, kur cevrimi, portfoy agirligi
  ve gerceklesen kar/zarar hicbir yerde uretilmiyor.
- IZLENMEYEN DOSYALAR (`??`) — deploy oncesi tek tek
  `git add -- <yol>`: `mobile/src/components/liste/SepetEkleKart.tsx`,
  `mobile/src/components/liste/NakitKart.tsx`,
  `mobile/src/components/liste/HamleKart.tsx`.

## 38. SERIDE GOSTERGE IGNELEME NATIVE'E GELDI (OLCULDU 2026-11-06)

OLCULDU
- `mobile/src/components/bugun/GostergeKart.tsx` (yeni) — webin
  `tickerModal` kipinin (`tkAdd` / `tkRenderPinned`, app.js:2665-2712)
  native karsiligi: kullanici ust fiyat seridine kendi sembolunu
  igneliyor ve kaldiriyor.
- EKSIK OLAN EKRANDI, VERI DEGIL: `gostergeEkle` (`mobile/src/api/depo.ts:1379`)
  native'de ZATEN vardi ve HICBIR CAGIRANI YOKTU; `SeritKart` kaydi
  yalniz OKUYORDU (`useGostergeler`). Yani kullanici igneli kaydi
  goruyor, ama ne ekleyebiliyor ne kaldirabiliyordu.
- CIKARMA YAZICISI bu turda ayni depo dosyasina eklendi:
  `gostergeCikar` (`depo.ts:1418`). Sinir `AZAMI_GOSTERGE = 4`
  (`depo.ts:124`, web `tickerCustomMax()` ile ayni sayi) — sayi IKINCI
  KEZ YAZILMADI.
- KARTTA HESAP YOK, AG YOK: esik/agirlik/formul yok, `fetch` yok.
  Kart yalniz cihaz deposuna yaziyor; ignelenen kalemin FIYATI burada
  OLCULMUYOR, onu `SeritKart` kendi turunda `seritFiyatlari()` ile
  olcuyor.
- HATA CUMLESI UYDURULMUYOR: her ret `YazSonuc.mesaj` oldugu gibi
  basiliyor (sinir dolu, zaten var, yazilamadi).
- Turkce TEK YERDE: `VARLIK_SINIFI_SOZLUK`, `GOSTERGE_SINIF_SIRASI`
  (`mobile/src/lib/sozluk.ts`). Kart kendi etiket sozlugunu KURMUYOR.
- Ekrana baglandi: `mobile/src/app/(tabs)/bugun.tsx:245` (`<GostergeKart />`,
  `<SeritKart />` hemen ustunde). YENI SEKME ACILMADI, 5'li menu
  degismedi.
- Barrel: `mobile/src/components/bugun/index.ts:73` (ad ad, `*` degil).

OLCULMEDI
- Gosterge kaydi BULUTA GONDERILMIYOR (senkron govdesi yalniz takip
  listesini tasiyor) — yani webde ignelenen kalem bu cihaza GELMIYOR,
  telefonda ignelenen de webe gitmiyor. Iki yonlu senkron bu turda
  OLCULMEDI.
- Cihazda render + ekran goruntusu: native build gerektiriyor, bu
  oturumda ALINMADI.
- IZLENMEYEN DOSYA (`??`) — deploy oncesi `git add -- <yol>`:
  `mobile/src/components/bugun/GostergeKart.tsx`.

## 39. ANI HAREKET UCU YAZILDI, BAGLANTISI BEKLIYOR (OLCULDU 2026-11-06)

OLCULDU
- `api/_hareket.js` (yeni tasiyici, `ROTA = 'hareket'`) — webin
  ⚡ Nabiz gun ici taramasinin (`pulseScan`, app.js:12843) sunucu ikizi.
  `GET /api/hareket?semboller=THYAO:BIST,AAPL`.
- NIYE YENI UC: `/api/pulse` MAKRO nabiz (faiz/enflasyon mansetinden
  durus). Gun ici hareket taramasi orada YOK — olculdu 2026-11-06,
  `grep -n "PULSE_TH\|analyzeIntraday\|pulseIsSudden\|hourChg\|rvol\|
  breakout\|sudden" api/pulse.js` → 0 eslesme, 855 satir. Yani
  native'in ⚡ satirlarini besleyecek hicbir uc yoktu; olcum yalniz
  TARAYICIDA yasiyordu.
- MOTOR URETIMI GEREKMEDI: `PULSE_TH` (api/_motor.js:2422),
  `analyzeIntraday` (:2431), `pulseIsSudden` (:2451) ZATEN motor
  disa-aktarma listesinde (:3922). `app.js` ACILMADI,
  `tools/motor-uret.mjs` KOSTURULMADI. Esik IKINCI KEZ YAZILMADI.
- KENDI OHLCV AYRISTIRICISI (`ayristirGunici`): `_degisim.js`in
  `ayristirSeri`si yalniz `{time, close}` donduruyor (:225) ama
  `analyzeIntraday` `high` ve `volume` da istiyor (:2440-2443) —
  eksik alanla cagirmak `rvol`u 0, `priorHigh`i `NaN` yapardi, yani
  OLCULMEMIS sayiyi olculmus gibi gosterirdi. Suzme web
  `fetchYahooOHLC` (app.js:567) ile AYNI: open/high/low/close dordu
  dolu olmayan bar duser.
- ADIM 5 DAKIKA OLMAK ZORUNDA: motor "~60 dk" hesabini 12 bar geriye
  giderek yapiyor (:2438); baska adimda o yorum yanlis olurdu.
  `range=1d&interval=5m`.
- HAM SAYI KURALI: uc TURKCE CUMLE DONDURMUYOR. Karar kapali kod
  kumesinden (`ani`, `buyuk_gun`, `kirilma`), gerisi ham sayi
  (`gunYuzde`, `saatYuzde`, `rvol`, `price`, `prevClose`, `mumSayisi`).
  Tek Turkce alan `uyari`.
- ESIK CEVABA GIRMIYOR: `pulseIsSudden` donusundeki `th` BILINCLI
  OLARAK disa verilmiyor — istemciye gondermek ikinci bir karar yeri
  dogururdu.
- Ag ve onbellek `_degisim.js` ile BIREBIR: 8000 ms AbortController,
  konak sirayla (query1 → query2, ayni konaga ikinci vurus YOK),
  kisa govde esigi 256 bayt (200 ama kisa govde = ariza), azami 12
  sembol (SESSIZ KIRPMA YOK → 400 `cok_sembol`), eszamanli 4,
  `TTL_FIYAT` = 300 sn, `X-Onbellek: isabet|iska`.
- EKSIK TUR ONBELLEGE GIRMIYOR: `tam === false` ise yazilmiyor —
  yarim olcum 5 dakika boyunca tam olcum gibi dagitilirdi.
- SEMBOL SIRASI BOZULMUYOR: `Promise.allSettled`, reddedilen sembol de
  `ok:false` + butun sayilar `null` olan satir uretiyor. 0 YAZILMIYOR.
- Motor kurulumu `_neden.js` / `_kesif.js` ile ayni: `buildMotor(AG.H)`
  try icinde, `motorHazir()`, kurulamadiysa `502 motor_yok` +
  `console.error`. Surum imzasi govdede (`{ motor: IMZA, ayar: IMZA_AYAR }`).
- `node --check api/_hareket.js` → GECTI. Satir sonu LF (416 LF, 0 CRLF).

OLCULMEDI
- HACIM YORUMU YOK: web ekrani `r.a.rvol >= 1.5` diye bir EKRAN esigi
  tasiyor (app.js:12887 → "🔊 Hacim …×"). O esik MOTORDA YOK; uca
  kopyalamak §5.1'i kirardi (ucta esik yok), native'e koymak da
  (native'de matematik yok). Uc `rvol`u HAM donduruyor, kod
  URETMIYOR. Yorum motora bir kod eklendiginde gelecek.
- KRIPTO VE MADEN KAPSAM DISI: `api/_girdi.js:73`
  `PAZARLAR = ['US','BIST']`, kriptonun Yahoo sembolu `-USD` ekiyle
  kuruluyor (`BM_CRYPTO`), madenin `ysym`i `METAL_SPOT` katalogundan
  geliyor; ikisi de bu ucta tanimli degil. `PULSE_TH` ikisi icin de
  satir tasiyor (CRYPTO 6.0/3.5, METAL 2.5/1.5) ama uydurma esleme
  yazmak yerine kapsam disi birakildi.
- `spark` (sembol basina ~78 nokta) cevapta YOK: 12 sembolde ~936
  nokta govdeyi sisirirdi ve ⚡ satiri grafik cizmiyor. Grafik
  `/api/chart` ucunda.
- CANLI MALIYET/GECIKME OLCUMU YAPILMADI: bu makinede DNS bozuk
  (§12), uc hic cagrilmadi. Yahoo chart cagri sayisi = sembol sayisi
  (12 sembol → en cok 12 istek, konak yedegi dusunce 24).
- NATIVE YUZEY YOK: `client.ts` / `types.ts` sozlesmesi,
  `lib/sozluk.ts` cumleleri ve kart dosyasi bu turda YAZILMADI —
  ayni dosyalar baska bir is parcasinda acik.
- `worker/movers.mjs` AYNI taramayi sunucuda yapiyor ve gercek ntfy
  bildirimi gonderiyor; bu ucla TEKILLESTIRILMEDI (esiklerin
  bayt-bayt ayni kalmasi gerekiyor, `buildMotor(H)` icin konak
  araligi lazim).
- IZLENMEYEN DOSYA (`??`) — deploy oncesi `git add -- <yol>`:
  `api/_hareket.js`.

---

### 39b. ANI HAREKET UCU BAGLANDI, SUITLER YESIL (OLCULDU 2026-11-06)

OLCULDU:

- `api/proxy.js` `TASIYICILAR` tablosuna `hareket: () => import('./_hareket.js')`
  LITERAL belirtecle eklendi (degiskenli import'u Vercel'in paket izleyicisi
  izlemez, uc canlida 404 verir). Olculdu: `TASIYICI_ROTALARI.join(',')` ->
  `degisim,gundem,hareket,iceriden,katalizor,kripto,kur,mali,metal,neden`
  (ON rota). `node --check api/proxy.js` GECTI.
- `vercel.json`: `{ "source": "/api/hareket", "destination": "/api/proxy?__rota=hareket" }`
  eklendi; rewrite sayisi 16 -> 17. `JSON.parse` GECTI. 1A kurali korundu:
  `api/*.js` uc dosyasi sayisi HALA 12, Hobby 12-fonksiyon tavani
  DEGISMEDI (⑰b kapisi bunu her kosuda sayiyor).
- `tests/uc-test.mjs` ⑰ kapisinin DORT tablosu ayni turda genisledi:
  `kaynaklar`, `MOD`, `YOL` ve ⑰d `H`. Yaninda: `HAREKET_PATH` sabiti,
  `import * as HAREKET` satiri + gerekce yorumu, ⑰a rota dizisi iddiasi
  (dokuz -> on), ⑰b uc-dosyasi ve `functions` sizinti suzgecleri, ⑰b
  elle-`if` suzgeci, basari bandi. Tek tablo eksik kalsa
  `TypeError: h is not a function` olurdu; dordu birlikte buyudu.
- KONAK IZIN LISTESI IKIZLIGI: `api/_hareket.js` artik `IZINLI_KONAK` ve
  `izinliAdres`i YENIDEN DISA ACIYOR — kendi listesini uydurmuyor,
  `_degisim.js`in listesini oldugu gibi geciriyor. Boylece ⑰c'nin ikizlik
  denetimi ve tek-`fetch` + AbortController denetimi `hareket`i de
  kapsiyor: iki dongu artik `['degisim','kripto','iceriden','mali','hareket']`.
- SUITLER YESIL (bu turda kosuldu): `node tests/uc-test.mjs` -> 2422
  denetim gecti. `node tests/uretim-test.mjs` -> 73 denetim gecti
  (_motor.js <-> app.js, _ayar.js <-> config.js birebir).
  `node tests/parity.mjs` -> FARK 0, 29 karsilastirma noktasi birebir.

OLCULMEDI:

- CANLI ISTEK YOK: yerel DNS kirik (bkz. 12), bu yuzden `/api/hareket`
  gercek bir Yahoo cevabiyla HIC denenmedi. Olculen sey yalniz sozlesme
  ve kapi; gercek gecikme/maliyet deploy sonrasi olculecek (2A kurali).
- NATIVE YUZEY YOK: `mobile/src/api/client.ts` rota girisi, `types.ts`
  sozlesmesi, `lib/sozluk.ts` cumleleri (`ani` / `buyuk_gun` / `kirilma`)
  ve kart + barrel satiri HENUZ YAZILMADI. O dosyalar su an baska bir is
  parcasinda acik.
- `mobile/` yarisinda `npx tsc --noEmit` / `npx eslint src` bu turda
  KOSULMADI (mobile dosyalari baska parcada acik, yarim durumu olcmek
  yanlis kirmizi uretirdi).
- `git add --` BEKLIYOR: `api/_hareket.js` hala izlenmeyen dosya.

---

### 40. MALI TABLOLAR UCU + ANALIZ KARTI (OLCULDU 2026-11-06)

OLCULDU (kendi diff okumasiyla dogrulandi, alt-gorev raporuna GUVENILMEDI):

- YENI `api/_mali.js` (31798 bayt, LF): SEC XBRL `companyconcept` (US) +
  Is Yatirim `MaliTablo` XI_29 (BIST), 4 yillik donem, 19 kalem kodu,
  tek `fetch(` kapisi, `SEC_ARALIK_MS=125` (~8 istek/sn, SEC siniri),
  `ROTA='mali'` + donmus `HANDLERLAR`. Olculemeyen alan `null`, asla `0`.
  Tek Turkce alan `uyari`. Yeni ust konak GEREKMEDI (uc konak `proxy.js`te
  zaten izinliydi) — 1A korundu, uc dosyasi sayisi 12.
- YENI `mobile/src/components/analiz/MaliTablolarKart.tsx` (9084 bayt):
  kendi istegini atan kart (`useIstek` + `fetchMali`), `<Card>` + `<Durum>`,
  "skora girmez" rozeti, yasal not. `donemIstenen` vs `donemler.length`
  AYRI yazili; `tam === false` iken sayac dokumu EKRANDA.
- Baglanti dogrulandi: `fetchMali` (`api/client.ts:2928`), barrel
  (`components/analiz/index.ts:31`), ekran (`(tabs)/analiz.tsx:142` ve
  `:492`), sozluk (`lib/sozluk.ts:710` `MALI_KALEM_SOZLUK`). Yeni SEKME
  acilmadi, `(tabs)/_layout.tsx` ACILMADI, 5'li menu degismedi.
- SOZLUK CAKISMASI OLMADI: ayni dosyada serit 3'un
  `GOSTERGE_SINIF_SIRASI` (satir 664) ile serit 4'un `MALI_*` sozlukleri
  (satir 710+) YAN YANA duruyor; elle birlestirme gerekmedi.
- `hareket` baglantisi EZILMEDI (bu riski olctum): `grep -c hareket` ->
  `api/proxy.js` 3, `vercel.json` 1, `tests/uc-test.mjs` 51.
- BIRLESIK KOSU YESIL: `node tests/uc-test.mjs` -> 2422 denetim gecti
  (band hem `/api/hareket` hem `/api/mali` iceriyor).
  `cd mobile && npx tsc --noEmit` -> cikis 0. `npx eslint src` -> cikis 0.

OLCULMEDI:

- CANLI AG YOK (yerel DNS kirik, bkz. 12): SEC etiketleri ve Is Yatirim
  `itemCode` listeleri yalniz `app.js` kaynak okumasiyla kuruldu, canli
  yanitla DOGRULANMADI. `/api/mali` canli 200 ALINMADI.
- Cihazda cizilmedi, ekran goruntusu yok.
- SAPMA KAYDI: gorev metni karti `BilancoKart.tsx`e baglamayi soyluyordu;
  o kart sunum-salt oldugu icin kart `detay/IceridenKart.tsx` kalibiyla
  KENDI istegini atacak sekilde yazildi. Sapma kabul edildi.
- `git add --` BEKLIYOR: `api/_mali.js`, `MaliTablolarKart.tsx`.

## 41. YATIRIM TEZI ZATEN PORTLUYDU — YANLIS EKSIK IDDIASI DUZELTILDI (OLCULDU 2026-11-06)

ONCEKI TURDA KULLANICIYA "tez tek eksik ozellik" DENDI. YANLISTI.
Yanlisin kaynagi: parite olcumu `grep fetchTez mobile/src` ile yapildi,
sonuc 0 cikti ve "port yok" diye okundu. Oysa tez defteri UC OZELLIGI
DEGIL: web tarafinda da sunucuya hic cikmiyor.

### OLCULDU
- Web kaynagi yerel: `app.js:10058` `const TEZ_LS_KEY = 'sb:theses';`
  (`// Task D4: Tez Defteri — SALT BILGI, skora dokunmaz`). Canli fiyat
  ve bilanco tarihi ZATEN portlu `/api/yfin`den geliyor (`fetchTezLive`,
  10'luk gruplar). YENI UC GEREKMIYOR — 1A/2A maliyet sorusu bu ozellik
  icin HIC DOGMUYOR.
- Depo katmani TAM: `mobile/src/api/depo.ts` (1849 satir) icinde
  `ANAHTARLAR.tezler = 'sb:theses'` (web ile AYNI anahtar), tipler
  `Tez`/`TezDayanak`/`TezKatalizor`/`TezGunluk` (193-212), suzgecler
  (513-541), tur `tezlerDepo` (737), kanca `useTezler` (815), yazicilar
  `tezEkle`/`tezGuncelle`/`tezSil`/`tezDayanakDongu`/`tezGunlukEkle`/
  `tezGunlukSil` + `katalizorSatirlari` (1092-1290).
- Barrel TAM: `mobile/src/api/index.ts:163-169` yedi adi AD AD disa
  aciyor (depo.ts `export *` ile gelmiyor, kural dogru uygulanmis).
- Ekran TAM: `components/analiz/TezDefteriKart.tsx` (701 satir) ve
  `components/detay/TezKart.tsx` (153 satir); barrel `analiz/index.ts:34`
  ve `detay/index.ts:60`; montaj `(tabs)/analiz.tsx:145` + `:556`
  (`<TezDefteriKart onerilenSembol={sembol ?? undefined} />`) ve
  `hisse/[sembol].tsx:88` + `:209`.
- ACIK KALAN TASARIM SORUSU DA KAPANMIS: `tezGauge` aritmetigi
  (`f = (price - stop) / (target - stop)` ve `(target - price)/price*100`)
  karta GIRMEMIS; karttaki not 19-21 ve 358. satirda gerekcesiyle yazili,
  hedef/cikis HAM deger olarak basiliyor, yazilmayan `null` → "yazilmadi",
  `0` BASILMIYOR. Standart kural ("native'de matematik yok") korunmus.
- Kart sayisi 52 (`mobile/src/components/*/*.tsx`); webin 17 sekmesinin
  hepsinin native karsiligi var.

### OLCULMEDI
- Cihazda render YOK; `mobile` tipi/eslint BU TURDA kostulmadi (serit 5
  `types.ts`/`client.ts`/`sozluk.ts`/`bugun/index.ts`/`(tabs)/bugun.tsx`
  dosyalarini ACIK TUTUYOR, yaris kacinildi).
- IGNELENMIS GOSTERGE SENKRONU HALA ACIK VE BU BIR KULLANICI KARARI:
  `mobile/src/api/senkron.ts` govdede yalniz `list`/`portfolio` tasiyor;
  `ui` BILEREK gonderilmiyor ve uzaktan gelen `ui` BENIMSENMIYOR
  (dosya basligindaki iki gerekce). Webin `ui` sekli hic olculmedi, onu
  benimsemek cihazdaki listeleri bilinmeyen bir sekille EZME riski.
  KARAR SORUSU: telefonda igneledigin gosterge webde de gorunsun mu?
  Evet derse `ui` sekli once olculur, sonra tasinir.
- `git add --` BEKLIYOR: `mobile/src/components/analiz/TezDefteriKart.tsx`.

## 42. ANI HAREKET KARTI BAGLANDI — WEBIN SON OZELLIGI TELEFONDA (OLCULDU 2026-11-06)

### OLCULDU (serit 5'in raporu KABUL EDILMEDI, kendim olctum)
- `mobile/src/components/bugun/AniHareketKart.tsx` diskte, 16802 bayt,
  CRLF 0 / LF 432.
- Barrel `components/bugun/index.ts:79` adli export (LF 79).
- Montaj `(tabs)/bugun.tsx:122` import + `:365` `<AniHareketKart
  onSembol={hisseAc} />` (LF 1049).
- Istemci `client.ts:249` `hareket: '/api/hareket'`, `:3002`
  `fetchHareket` (LF 3037). Tipler `types.ts` (LF 3476).
- CAPRAZ EZME YOK: `sozluk.ts`te uc sozluk birlikte duruyor
  (`GOSTERGE_SINIF_SIRASI` + `MALI_KALEM_SOZLUK` + `ANI_HAREKET_SOZLUK`,
  grep 3); `client.ts`te `fetchMali` + `fetchHareket` birlikte (grep 3).
  Serit 3/4/5 ayni dosyalari acmasina ragmen kayip yok.
- Alti dosyanin hepsi saf LF, hicbirinde CRLF kirlenmesi yok.
- DORT TAKIM YESIL (kendi kostugum):
  `node tests/uc-test.mjs` → 2422 (basligi 27 uc sayiyor, `/api/hareket`
  dahil); `node tests/uretim-test.mjs` → 73; `node tests/parity.mjs` →
  FARK 0 (29 nokta); `mobile`: `npx tsc --noEmit` → 0, `npx eslint src`
  → 0.
- SERIT 5'IN IKI KARARI ONAYLANDI: (1) `marketTs` BASILMIYOR — uc
  milisaniye veriyor, `format.ts` saniye aliyor; birim cevirisi native'e
  sayi islemi sokardi, ikinci bicimleyici yazmak ikinci bicim kaynagi
  acardi. (2) `rvol` ham sayi + "kat" birimi, renk/esik YOK — webin 1.5
  esigi KOPYALANMADI (esik uca ait).

### OLCULMEDI
- Canli ag istegi YOK (yerel DNS bozuk, §12) — uretim govdesinin
  yazilan tiplere oturdugu DOGRULANMADI; tipler `api/_hareket.js`
  kaynagindan okundu.
- Cihazda render YOK: yerlesim, tasma, uzun sembol satir kirilmasi,
  tema kontrasti GORULMEDI. `tam:false`, `ok:false`, `gecikmeli`, bos
  `kodlar`, `sayac` dokumu hallerinin ekranda nasil durdugu VARSAYIM.
- `tests/capture.mjs` ve `tests/duman.mjs` kosturulmadi; `baseline.json`
  elle duzenlenmedi.

### DURUM: WEB = APP (OZELLIK KAPSAMI)
Webin 17 sekmesinin hepsinin telefonda karsiligi var; 53 kart.
Kalan isler ARTIK OZELLIK DEGIL: (a) deploy — kullanici yapacak,
`git add --` listesi §39b/§40/§41 + bu bolumde; (b) tasarim/yerlesim;
(c) TestFlight; (d) optimizasyon (FAZ 4-6).
BEKLEYEN KULLANICI KARARLARI: igneli gosterge senkronu (§41),
`expo-notifications` bagimliligi (cihaz bildirimi icin).
- `git add --` BEKLIYOR: `mobile/src/components/bugun/AniHareketKart.tsx`.

## 43. BILDIRIM ARTIK APP'IN KENDISINDEN GIDIYOR (OLCULDU 2026-11-07)

Kullanici istegi: "onceden ntfy ile webden mobile bildirim gonderiyorduk ama
artik direkt app uzerinden bildirimler gidecek."

### Ne yapildi — uc serit

**Serit A · sunucu ucu: `api/_bildirim.js` (YENI)**
- `_` onekli, `vercel.json` rewrite + `api/proxy.js` dalinda devrediliyor.
  `api/*.js` rota dosyasi sayisi HALA 12 (Hobby tavani). Kapi (18)a kilitliyor.
- Uc mod:
  1. `POST /api/bildirim` → cihaz jetonu kaydet. Yanit: `{ok, sayi, updatedAt}`.
  2. `GET  /api/bildirim?code=...` → `{sayi, updatedAt}`. **Jeton listesi ASLA
     donmuyor.**
  3. `POST /api/bildirim?mod=gonder` → Expo'ya gonder. `x-push-secret`
     BASLIGINDA sir ister. Yanit: `{ok, gonderildi, elendi}`.
- KV anahtari **`push:<kod>`** — kendi anahtari.
  KARAR GEREKCESI (olculdu): `api/watchlist.js:282` `kv.set(key, payload)` ile
  tum kaydi eziyor (`payload = {list, portfolio, updatedAt}`). Jetonlar
  `wl:<kod>` icinde yasarsa HER liste eslemesinde silinirdi.
  `api/watchlist.js` bu yuzden HIC ELLENMEDI; kapi (18)e iki yari da kilitliyor.
- `TASIYICILAR` tablosuna GIRMEDI. GEREKCE (olculdu): kapi (17)d o tablodaki
  on rotanin HER BIRI icin `POST → 405 method_not_allowed` bekliyor; bu uc POST
  ile yaziyor. Bu yuzden `yfin` ile ayni kalipta ayri `__rota` dali.
- Cihaz tavani `AZAMI_JETON = 10`; yeni jeton eklenince en ESKI dusuyor, ayni
  jeton iki kez gelirse kopya uretmiyor, kaydi tazeliyor.
- Hiz freni: 60 sn penceresinde kimlik basina 20 kayit (`429 rate_limited`).
  IP hicbir yere YAZILMIYOR.
- 401 sebebi AYRISTIRILMIYOR (sir-yok / sir-yanlis ayni `yetki_yok`).

**Serit B · telefon yuzu**
- `mobile/src/api/bildirim.ts` (YENI): `bildirimDurumOku`, `bildirimIzniIste`,
  `pushJetonAl`, `pushKur`.
- `mobile/src/api/depo.ts`: `ANAHTARLAR.push = 'sb:push'`, `usePush`,
  `pushIzinYaz`, `pushJetonYaz`.
- `mobile/src/components/liste/BildirimKart.tsx` (YENI) → Listeler sekmesinde,
  `ListelerKart`'in altinda. **Jeton ekrana ASLA basilmiyor.**
- `mobile/app.json`: `expo-notifications` eklentisi.

**Serit C · isci gondericisi**
- `worker/bildirim.mjs` (YENI): `pushGonder({baslik, mesaj, url, oncelik})`
  → `{ok, gonderildi, elendi}`; `oncelikCevir(priority)`.
- `worker/poll.mjs` + `worker/movers.mjs`: `notify()` once native'e gonderiyor,
  `NTFY_TOPIC` tanimliysa ntfy'ye de. `true/false` sozlesmesi DEGISMEDI, bu
  yuzden `.seen.json` davranisi ve `MAX_PUSH` aynen korundu.
  Sert cikis artik IKI kanalin da yoklugunu istiyor.

### OLCULDU
- `node tests/uc-test.mjs` → **2451 denetim gecti**, 0 basarisiz (kapi (18)
  a–f dahil: 29 yeni denetim).
- `node tests/uretim-test.mjs` → 73 denetim gecti.
- `node tests/parity.mjs` → FARK 0, 29 karsilastirma noktasi birebir.
- `mobile/`: `npx tsc --noEmit` → 0 hata; `npx eslint src` → 0 hata.
- `node --check`: `worker/bildirim.mjs`, `worker/poll.mjs`, `worker/movers.mjs`,
  `api/_bildirim.js`, `api/proxy.js` → hepsi gecti.
- Isci esikleri HEAD ile karsilastirildi: `MAX_PUSH = 10`, `pushedForTicker >= 3`,
  `macroPushed >= 4`, `WINDOW_MS`, `slice(-1000)`, movers `TH` govdesi `diff` ile
  BIREBIR AYNI.
- `vercel.json` rewrite sayisi 18 → 19 (`/api/bildirim`).
- Sizinti taramasi: `api/_bildirim.js` icinde hic `console.*` yok; sir yalniz
  `req.headers['x-push-secret']`'ten okunuyor, URL/query'de yok.

### OLCULMEDI (gercek cihaz / kullanici onayi gerekiyor)
- **Gercek bildirim HIC GONDERILMEDI.** Isci canli kosturulmadi (kural).
- `expo-notifications` NATIVE modul. **OTA (`eas update`) bunu TASIYAMAZ** —
  yeni `eas build` sart. iOS uzaktan bildirim icin ayrica APNs anahtari
  kullanicinin kendi Apple hesabinda uretilmeli (girisi kullanici kendi yapar).
- `PUSH_SECRET` henuz tanimli degil:
  1. Vercel ortam degiskeni,
  2. GitHub Actions deposu sirri,
  3. `.github/workflows/poll-kap.yml` icindeki "Run poll (haber)" ve
     "Run movers (fiyat sicramasi)" adimlarina `env:` satiri
     (serit C is akisina DOKUNMADI — bu adim elde).
  ASLA `EXPO_PUBLIC_` olamaz, ASLA loglanmaz.
- `expo-notifications` eklentisinde `mode` anahtari BILEREK bos: `aps-environment`
  yaziyor, `production` dev-client denemesini kirar → EAS yapi profiline birakildi.
- Android kucuk ikon `icon.png` 96x96 tumu-beyaz bicim DEGIL; dolu kare
  gorunebilir. Yayinda duzeltilecek.

## 44. WEBDEKI LISTELER TELEFONA AKTARILIYOR (OLCULDU 2026-11-07)

Kullanici: "webdeki listelerimi aktar." §41'de native uzak `ui` yukunu
BILEREK benimsemiyordu; o kapi bu istekle acildi.

### §41 engeli NIYE dustu — olcum
- Web liste kaydi (`app.js:2126` `createList`):
  `{ id, name, items: [{symbol, market, query}], inUniverse, notify }`
- Native `ListeKaydi` (`mobile/src/api/depo.ts:146`): ALAN ALAN AYNI.
- Iki taraf AYNI anahtari kullaniyor: `sb:lists` (`app.js:2120` /
  `ANAHTARLAR.listeler`).
- §41'deki gerekce "sekli native tarafinda HIC olculmedi" idi; olculdu,
  birebir ayni cikti.

### Kararlar
- **EZME YOK, BIRLESTIRME VAR.** Ayni `id` gelirse uzak kayit yaziliyor
  (web o listenin dogruluk kaynagi), cihazda OLUP bulutta OLMAYAN liste
  KORUNUYOR. Web `adoptRemoteState` (`app.js:2131`) localStorage'i
  topluca eziyor; ayni sey burada telefonda acilmis listeleri sessizce
  silerdi.
- **KENDILIGINDEN KOSMUYOR.** `senkronCek` hala SALT GOSTERIM. Aktarma
  yalniz kullanicinin bastigi dugmeyle, ustelik IKI BASISLA. Gerekce: kod
  PAYLASILAN bir sir ve ucta kimlik dogrulama yok (§21.3).
- **HAM GIRDIYE GUVENILMIYOR.** Gelen deger cihazin kendi
  `listelerSuz`/`listeKaydiSuz` suzgecinden geciyor → sembol normali,
  pazar esleme, liste basina 8 sembol (`AZAMI_SEMBOL`). Budama SESSIZ
  DEGIL: `budandi` kullaniciya yaziliyor.
- **BOS GELEN YAZMAZ.** `lists: []` "webde liste yok" da olabilir, bozuk
  kayit da; ayirt edemedigimiz icin cihaza DOKUNMUYOR.
- **SURUM KAPISI.** Web `SYNC_STATE_V = 1` ↔ native `UI_SURUM = 1`.
  Eslesmezse hicbir sey benimsenmiyor.

### Dokunulan dosyalar
- `mobile/src/api/depo.ts` — `ListeAktarSonuc`, `listeleriAktar(ham)`.
- `mobile/src/api/liste.ts` — sarmalayici + `duzTazele()` (iki yazar ayni
  anahtari paylasiyor).
- `mobile/src/api/senkron.ts` — `UI_SURUM`, `uiListeleriCikar` (SAF),
  `senkronListeAktar`. `senkronGonder`/`senkronCek` DEGISMEDI.
- `mobile/src/api/index.ts` — bariyer genisledi.
- `mobile/src/components/liste/SenkronKart.tsx` — "Webdeki listeleri
  getir" dugmesi (iki basis) + sonuc sayilari.
- `tests/uc-test.mjs` — KAPI ⑲ (18 denetim). Eski ㉘f iddiasi
  ("benimseme YOK") artik yanlis oldugu icin YENI kurala cevrildi:
  benimseme var ama KENDILIGINDEN kosmuyor. Ikinci ㉘f greb'i
  daraltildi — `ui:` taramasi yalniz `senkronGonder` govdesinde.

### OLCULDU
- `node tests/uc-test.mjs` → ✅ 2469 denetim, KAPI ⑲ 18/18.
- `node tests/uretim-test.mjs` → ✅ 73 denetim.
- `node tests/parity.mjs` → ✅ FARK 0, 29 nokta.
- `mobile/`: `npx tsc --noEmit` → 0 hata, `npx eslint src` → 0 hata.
- POST govdesi DEGISMEDI: `{ list: evren.kayitlar, portfolio: [] }` —
  telefon hala buluta `ui` GONDERMIYOR (yalniz OKUYOR).

### OLCULMEDI
- Aktarma GERCEK cihazda, CANLI ucla hic denenmedi — yalniz metin kapisi
  ve tur denetimi var.
- Bulutta `ui.v !== 1` ya da `ui: null` olan gercek bir kayitla
  denenmedi.
- Budama yolu (8 sembolu asan gercek web listesi) canli denenmedi.
- Aktarmadan sonra "Bugun"/"Kesfet" seritlerinin yeni listelerle
  tazelenme suresi olculmedi.

## 45. TUM DEPLOYLAR + iOS YAPI HATASI COZULDU (OLCULDU 2026-11-07)

Kullanici: "bildirim kurulumu kismini erteleyelim, test flightta yapariz.
... tum deploylari yap, her sey hazir olsun."

### KARAR · bildirim KURULUMU TestFlight adimina ERTELENDI
Bildirim KODU gonderildi (bkz. §43, commit e851677 + 1be5ef9). Ertelenen
yalniz KURULUM:
- Vercel'de `PUSH_SECRET` ortam degiskeni,
- GitHub Actions depo sirri olarak ayni deger,
- Apple tarafinda APNs anahtari.
Bunlar TestFlight adiminda, kullanicinin kendi hesabiyla yapilacak. O ana
kadar bildirim gitmez; uygulamanin geri kalani etkilenmez.

### WEB DEPLOY · zaten canli
- Vercel GitHub tumlesmesi her `git push`ta Production deploy aciyor.
  c334d15 icin deploy 05:20:48Z, "success".
- **TUZAK:** calisma kopyasi `app.js` CRLF (869451 bayt), git nesnesi LF.
  `git show HEAD:app.js | wc -c` = 855026 = CANLI boyut. Canliyla
  KIYASLARKEN daima `git show HEAD:<yol>` kullan, calisma dosyasini ASLA.
- Vercel CLI OTURUMU KAPALI (`vercel whoami` → "Logged out"). Gerek de
  yok; giris etkilesimli, kullanicinin isi.
- Dagitim basina deploy adresleri koruma duvarinin arkasinda (263 bayt
  doner). Yalnizca `https://day-starter.vercel.app` gercek icerigi verir.

### iOS YAPI HATASI · kok neden ve cozum
Yapi `3ffe87dd` ERRORED, 84s: "Unknown error. See logs of the Configure
expo-updates build phase". Gunlugun tamami:
- EAS gunluk dosyasi **brotli** sikistirilmis JSONL'dir (`Content-Encoding:
  br`). Python'da brotli yok → `node -e "zlib.brotliDecompressSync(...)"`
  ile acilir. utf-8 metin olarak indirmek dosyayi BOZAR.
- Gercek hata: `Runtime version calculated on local machine not equal to
  runtime version calculated during build.`
  - yerel: `e30cbde6...`  ·  EAS: `b28838fb...`
  - parmak izi farkinin BASI: `{"op":"added","filePath":"ios",
    "reasons":["bareNativeDir"]}` — EAS prebuild'de `ios/` dizinini
    uretiyor, yerelde `ios/` YOK (`.gitignore:43`). `fingerprint`
    politikasinda bu fark her yapiyi dusuruyor.
  - ikincil fark: `node_modules/@expo/log-box` ve
    `react-native-worklets` hash'leri (EAS taze kurulum, farkli yama).
- **COZUM:** `mobile/app.json` → `expo.ios.runtimeVersion.policy`
  `fingerprint` → **`appVersion`**. Android zaten `appVersion`. Artik iki
  platform TEK calisma surumu: `1.0.0`.
  - Bedeli: ayni `version` ile native bagimlilik degisirse OTA, o modulu
    tasimayan yapiya gidebilir. KURAL: native paket eklendiginde/
    kaldirildiginda `expo.version` YUKSELTILECEK.
- Yan onarim: `expo doctor` 1 denetimden dusuyordu (`expo-updates`
  ~57.0.26, beklenen ~57.0.27). `npx expo install expo-updates@~57.0.27`
  ile hizalandi.

### EAS · olculen bayraklar
- `eas device:list` etkilesimsiz calismaz; `--apple-team-id K79M286U78`
  sart. Kayitli tek iPhone: UDID `00008110-000848A614D1401E`.
- `eas update --non-interactive` `--environment` ister
  (development|preview|production).
- `eas build:view <id> --json` HICBIR SEY basmaz. `eas build:list
  --limit 1 --non-interactive --json` kullan; kaydinda `error`,
  `fingerprint`, `logFiles[]` (15 dakikalik imzali GCS adresi) var.
- Apple sifresi/2FA GEREKMEDI: dagitim sertifikasi (bitis 2027-06-25) ve
  profil `S4264TB2H3` EAS'ta hazir — "All credentials are ready to build".

### OLCULDU
- `node tests/uc-test.mjs` → ✅ 2469 denetim.
- `node tests/uretim-test.mjs` → ✅ 73 denetim.
- `node tests/parity.mjs` → ✅ FARK 0, 29 nokta.
- `mobile/`: `npx tsc --noEmit` → 0, `npx eslint src` → 0.
- OTA yayinlandi: dal `cihaz`, calisma surumu **1.0.0**, iOS+Android tek
  grup `0db3bb4f-a63c-460f-87ed-e03e1e8dc9b6`.
- Yeni iOS yapisi baslatildi: `3b0650fb-0ec2-42ef-9658-7eb49438a091`.

### OLCULMEDI
- Yeni yapinin SONUCU (bu satir yazilirken kuyrukta).
- Uygulama gercek iPhone'a KURULMADI; hicbir ozellik cihazda denenmedi.
- `appVersion` politikasiyla OTA'nin gercek cihaza DUSTUGU gorulmedi.
- Bildirim hic denenmedi (kurulum ertelendi — yukari bak).
