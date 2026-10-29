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
  takvim. `momentum` ve `earn` icin yeni uc gerekmedi (`/api/recommend` `plan.momentum`,
  `/api/yfin?deep=1` `earnings`).
- `takvim` icin YENI uc: `/api/takvim` (tasiyici `api/_takvim.js` + `vercel.json`
  yeniden-yazimi; yeni Vercel fonksiyonu YOK).
- `makro` PORTLANAMAZ: web'in makro blogu bastan sona istemci esigi/agirligi/karar
  agaci; HAM SAYI KURALI ile uyumsuz. Olculmus yuzey `/api/pulse` Bugun'de zaten cizili.

ACIK BOSLUKLAR (hepsi bilerek acik, veri uydurulmadi):
- `/api/causal` girdisini (`hareketler`, `gundem`) ureten uc YOK -> `NedenKart`
  "olcemedim" dalinda.
- `YfinKunye` tipi ucun donddurdugu 9 temettu alanini bildirmiyor
  (`dividendRate, payoutRatio, dividendYield5y, trailingAnnualDividendRate,
  trailingAnnualDividendYield, lastDividendValue, lastDividendTs, exDividendTs,
  dividendTs`). **`dividendYield5y` yuzde puani, oran degil** -> `formatOran` ile
  basmak 100 kat yanlis olur.
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
hiz siniri yok.

## 5. Itilmemis is
OLCULDU 2026-10-29: calisma agaci temiz, `main` ile `origin/main` ESIT.
Push onayi VERILDI ve KULLANILDI: `a9068c8` "web -> native port: 6 serit,
/api/takvim ucu, 11 yeni native kart", 27 yol acik `git add -- <yol>` ile
sahnelendi; `git push origin main` -> `34eb385..a9068c8`.

ONAY KAPSAMI: o onay YALNIZ `a9068c8` icindi. **Yeni degisiklikler icin AYRI,
taze, acik "evet" gerekir.** **Asla force-push yok, rebase yok.**
`git add -A` / `git add .` ASLA; yalniz `git add -- <yol>`.
Izlenmeyen ve git'e GIRMEYECEK olanlar: iki PDF, bir DOCX,
`financial-services-main/`, `total motor fikir/`.
Bot commit'i (`poll-kap.yml`) yalniz `worker/.movers.json` + `worker/.seen.json`
dokunur; once fetch, dosya cakismasi yok dogrula, sonra birlestir (rebase degil —
CRLF dosyalar icin `git -c core.safecrlf=false` ile).

**DEPLOY ONAYI YOK.** Vercel'e deploy kullanici acikca "evet" demeden yapilmaz.

## 6. Siradaki is — siraya gore
1. ~~Deploy~~ TAMAM: push otomatik deploy tetikliyor, `/api/takvim` + `/api/arama`
   uretimde olculdu (§4). Elle `vercel --prod` GEREKMEDI.
2. **Yeni ad-hoc yapi** (`eas build -p ios --profile cihaz`) ki her ekranda veri olsun.
3. Kullanicinin cihaz geri bildirimini topla -> cila/optimizasyon listesi.
4. TestFlight: App Store Connect uygulama kaydi, `submit.production.ios` icin
   `ascAppId` (uygulama var olmadan olculemez), `eas submit`.
5. Adli bosluklar: `/api/causal` girdi ucu · `YfinKunye` 9 temettu alani ·
   liste donem % ham ucu · `depo.ts` `listeBildirimAyarla` yazicisi ·
   `app.js:255` regex karari · ucuz yalniz-TA momentum ikizi (maliyet olcumu).
6. Ucretli katman maliyet hesabi (`/api/theme` LLM bacagi) — "ucretsiz kur,
   parali kisimlari hesapla ve sat" politikasi geregi.
7. FAZ 4-6: Supabase auth, RevenueCat/IAP, LLM anahtari.

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
2. Deploy karari KAPANDI (onay verildi, otomatik deploy ile uretimde dogrulandi).
   Siradaki tikayici karar: yeni ad-hoc iOS yapisina "evet".
3. `ANTHROPIC_API_KEY`'i Vercel'e ekle (§10).
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

Komut (depo kokunde, anahtar istendiginde yapistirilir — sohbete YAZILMAZ):

    vercel env add ANTHROPIC_API_KEY production

Sonra `preview` ve `development` icin ayni komut tekrarlanir, ardindan
`vercel --prod` ile yeniden yayina alinir. Yerel deneme icin `.env.local`
(git tarafindan yoksayiliyor; `.gitignore:33`).
