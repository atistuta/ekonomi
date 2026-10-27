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
| `node tools/motor-uret.mjs` | "degisiklik yok" (iki dosya) |
| `node tests/parite-test.mjs` | FARK 0 / 29 nokta |
| `node tests/uretim-test.mjs` | 73 |
| `node tests/uc-test.mjs` | 1088 (14 uc) |
| `node tests/nabiz-yon-test.mjs 2>&1 \| tail -4` | 40 |
| `node tests/nabiz-alan-test.mjs 2>&1 \| tail -4` | 128 |
| mobile typecheck | EXIT 0 |

Test cikti tuzagi: her test en sona feragatname basar; `tail -1` onu yakalar.
Nabiz testlerinde `grep` de yaniltir -> `tail -4` kullan.
`tests/baseline.json` ASLA elle duzenlenmez (duzenlemek testi muhre cevirir).
`tests/capture.mjs` ASLA kosturulmaz (canli ag + fikstur uzerine yazar).
`tests/duman.mjs` tek canli-ag testi, elle, CI'da degil, fikstur yazmaz.

## 4. Durum — dürüst (2026-10-27 olcumu)
SAGLAM: 21 saf motor dilimi, parite FARK 0, 14 uc / 1088 denetim, 73 uretim denetimi.
Skor degeri hic kaymadi.

ASIL BOSLUK native taraf:
- Web'de **17 sekme** var. Hic native karsiligi olmayan 5: `sektor`, `calendar`,
  `earn`, `momentum`, `general`. `pulse` yalniz `EndeksNabziKarti` kadar var.
- Yeni 5 uc (`tarama/sektor/radar/backtest/deger`) icin `mobile/src/api/client.ts`'te
  **tek bir fetch islevi yok** -> uclar hic cagrilmiyor.
- `RadarKart`/`FirsatlarKart`/`TaramaKart` ucu birden `kesfet.tsx:74`teki TEK
  `fetchRecommend(liste,{vade:'orta'})` cevabini yerelde dilimliyor. Evren kullanicinin
  kendi listesi; web'deki tum-evren taramasi degil.
- **Hicbir React bileseni hic render edilmedi.** iOS hic derlenmedi, hic cihaza kurulmadi.
- FAZ 4-6 hic baslamadi: Supabase auth, RevenueCat/IAP, LLM katmani, EAS Submit.

Bilinen onarilmamis arizalar: `/api/watchlist` kimlik dogrulamasi yok (paylasimli
tahmin edilebilir `code`, yazma dahil, CORS `*`) · BIST temel bacagi kirik
(ASELS `/api/analyze` -> `fa=null`) · T24 RSS 403, dort vekil de dusuk ·
`lightweight-charts@4.2.0` unpkg'den yuklenemedi · `/api/theme` yolunda istemci basina
hiz siniri yok.

## 5. Itilmemis is
`main`, `origin/main`'in **6 commit** onunde: `475468a 5d7c263 a0fcc50 a358f01 659fa43 9b2dfad`.
Kullanici push ONAYI VERMEDI -> taze acik "evet" gerekir. **Asla force-push yok.**
Bot commit'i (`poll-kap.yml`) yalniz `worker/.movers.json` + `worker/.seen.json` dokunur;
once fetch, dosya cakismasi yok dogrula, sonra rebase.

## 6. Siradaki dalga — dosya sahipligine gore seritler
- **D/E** — tek sahibi `api/_akis.js` + `tests/uc-test.mjs`, YALNIZ tasima.
  TA: ham gosterge degerleri, `levels`, `cfg.blend` -> `taYuzey` (`api/_akis.js:96`).
  FA: `tiles[]`, olcut `group`, `dcfIn`, `pb`/`mcap`/`shares` -> `scoreFaUS`/`scoreFaBIST`.
  Uca esik/formul/Turkce cumle GIRMEZ (HAM SAYI KURALI, `BAGIMLILIK_GRAFIGI.md` §5.1).
  Motor sembolu ihrac edilmemisse app.js'e DOKUNMA, bildir.
  NOT: **mum formasyonu motorda YOK** (olculdu) -> D'den cikar ya da once motor cikarimi yap.
- **F** — yalniz `mobile/**`. 5 ucu `client.ts`'e yaz, uc kesif kartini kendi uclarina
  bagla, eksik 5 sekmeyi ac, `kesfet.tsx` icindeki yerel haber satirini
  `components/kesfet/HaberSatiri.tsx` ile tekillestir.
- **G** (ben) — `app.js`, `config.js`, uretilen motor, `tests/engine.mjs`. Diger seritlerin
  ihtiyaci olan motor ihracatini ARALARINDA eklerim; onlar kosarken calisma agacina dokunmam.
- Serit kurali: tarayici/preview erisimi EN FAZLA bir seride. Subagent JSONL ciktisi
  kabuktan OKUNMAZ (baglam tasar). Subagent onay VEREMEZ.

## 7. Kullanicinin kendi yapacaklari (her biri bir cumle)
1. `ANTHROPIC_API_KEY`'i Vercel'e ekle (§10).
2. `cd mobile && npx expo install --fix` ile SDK 57 yamalarini al
   (expo 57.0.28->31, expo-router 57.0.26->29, @expo/ui 57.0.23->26,
   expo-constants 57.0.21->22, expo-linking 57.0.12->13).
3. `eas login` ile Expo hesabina gir (ben giremem).
4. `eas build -p ios --profile preview` ile ilk iOS yapisini al.
5. App Store Connect'te uygulamayi olustur; kategori **Finance**.
6. Gizlilik URL'si `https://day-starter.vercel.app/gizlilik`, destek URL'si `.../destek`.
7. App Privacy anketi: Other User Content -> Collected **Yes**, App Functionality,
   **Not Linked to You**, **Not Used for Tracking** (senkron `code`'unda kimlik dogrulama yok).
8. TestFlight'ta Internal Testing grubu olustur ve kendini ekle.

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
