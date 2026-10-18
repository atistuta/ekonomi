# Sabah Bülteni — Elit Native Uygulama Yol Haritası

> Durum: PLANLAMA. Hedef: web PWA prototipinden App Store / Play Store'da
> yayınlanan, akıcı ve elit hisli bir **native mobil uygulamaya** geçiş.
> Tarih: 2026-10-10. Bu dosya yaşayan bir belgedir — ilerledikçe güncellenir.

---

## 0. Çalışma düzeni (ikimizin rolü)

- **Kullanıcı (sen):** Web PWA'yı (`day-starter.vercel.app`) **laboratuvar** olarak
  kullanmaya devam edersin — fikir/düzeltme/eklenti notları biriktirirsin. Bazı
  oturumlar bu web notlarını uygularız (motor + özellik geliştirme burada hızlı).
- **Claude (ben):** Native göçü + elit kabuk işini yürütürüm (aşağıdaki fazlar).
- **İki iş paralel ilerler** ve birbirini besler: web'de olgunlaşan her özellik,
  motor API'ye bağlı olduğu için native app'e "bedavaya" gelir.

---

## 1. Mimari ilke — MOTOR / KABUK AYRIMI (her şeyin temeli)

Projenin asıl değeri **motor**: TA skoru, FA/Temel skoru, bileşke, öneri motoru,
nedensellik ("günün nedeni"), tematik keşif. Bu hazır ve "moat".

- **Motor = API.** Vercel serverless uçları (bir kısmı zaten var: `api/yfin`,
  `api/theme`, `api/watchlist`). Native app bunları çağıran **ince istemci** olur.
- **Kabuk = yeniden yazılır.** ~12k satırlık `app.js` motor + DOM iç içe. **Matematik/skor
  mantığı temiz portlanır; sadece DOM (ekrana çizme) atılır.**
- **Tek doğruluk kaynağı:** skor motoru API. Web PWA da, native app de aynı uca vurur.

### Değişmez kurallar (tüm fazlar boyunca)
- [ ] Motor / skor / bileşke **dokunulmaz** — yeni özellik skoru değiştirmez.
- [ ] 5-menü düzeni korunur: Listeler · Bugün · Keşfet · Analiz · Arama.
- [ ] Her yeni kullanıcı ekranında **"Bilgi amaçlıdır, yatırım tavsiyesi değildir."**
- [ ] SPK çerçevesi: ürün "bilgi/analiz/araştırma" olarak konumlanır, "al X" tavsiyesi değil.

---

## FAZ 1 — Ayrım & iskelet

**Amaç:** motoru API'ye çıkar, Expo projesini ve tasarım sistemini kur.

- [x] **Motor envanteri:** `app.js` içinde saf motor fonksiyonları (TA, FA, öneri,
      nedensellik, tematik, karşılaştırma) vs DOM kodu listesi çıkar.
      → **[MOTOR_ENVANTER.md](MOTOR_ENVANTER.md)** (2026-10-11). Ölçüm: saf motor
      223 fn / 3.544 satır · ağ 17 fn · **DOM 203 fn / 5.901 satır (atılacak)**.
- [x] **Metin biçimi kararı (envanterden çıktı, FAZ 1 içinde verilmeli):** motor
      metinlerinde `<b>`/`<i>` gömülü — RN bunu render etmez. API düz `text` yerine
      **belirteç dizisi** dönmeli (öneri B).
      → **[tests/metin.mjs](tests/metin.mjs)** + **[tests/metin-test.mjs](tests/metin-test.mjs)**
      (2026-10-11). Sonuç: `node tests/metin-test.mjs` → **31 doğrulama geçti**;
      `app.js`'teki **46 gerçek cümle bayt bayt** geri döndü, etiket dağarcığı 4
      (`b`/`em`/`i`/`br`). Biçim etiket adı değil **rol** taşıyor: `<b>` üçe ayrıldı
      (`v` vurgu / `e` etiket / `s` sayı — sayı yuvası mobilde `tabular-nums` ister),
      `<em>` → `d` (soluk) çünkü bu projede `font-style: normal` (`styles.css:710`).
      **Ölçüm maddenin "40 fonksiyon" varsayımını düzeltti:** skor motoru neredeyse
      etiketsiz — o günkü 1.405 satırlık 9 dilimde **2 satır / 4 etiket**, ikisi de statik
      `COMPOSITE_MATRIX` verisi. Cümle kurma işi `/api/analyze` + `/api/recommend`'e
      ait, `/api/score`'a değil.
- [x] **Bağımlılık grafiği:** motor fonksiyonları hangi DOM fonksiyonlarını çağırıyor
      (`computeVadeScore` gibi sınır vakalarını ayrıştırmak için).
      → **[BAGIMLILIK_GRAFIGI.md](BAGIMLILIK_GRAFIGI.md)** (2026-10-11). Sonuç: 3 arayüz
      çevrilince **taşınabilir 254 fn / 4.579 satır**, ekrana bağlı yalnız 9 fn / 94 satır.
      `/api/score` kapanışı **52 fn / 1.307 satır**. `computeVadeScore` DOM değil, yapılandırma.
- [x] **Skor paritesi testi:** 20 sembol (10 BIST + 10 ABD) referans anlık görüntüsü →
      `/api/score` çıktısı ile **fark 0** olmalı. Taşıma bu test geçmeden bitmez.
      → **[tests/README.md](tests/README.md)** (2026-10-11). Sonuç: `node tests/parity.mjs`
      → **FARK 0**, 29 karşılaştırma noktası (20 sembol + 9 sentetik bileşke vektörü),
      63 fikstür / 8,5 MB dondurulmuş **ham girdi**, ağa çıkış yok. Motorun kopyası
      çıkarılmadı — test `app.js`'i her koşuda yeniden dilimliyor (1.463 satır / 9 dilim).
      **Negatif kontrol:** BIST ROE ağırlığı 0.10→0.20 bozulunca test 44 farkla kırmızı
      yandı ve sebebi (`fa.criteria[2].weight`) adıyla gösterdi; 10 ABD sembolü
      etkilenmedi. Aday motor `PARITE_APP=` ile canlıya dokunmadan ölçülebilir.
- [ ] Motor mantığını `/api/*` uçlarına böl: `score`, `recommend`, `analyze`,
      `theme`, `causal`, `compare`. Vercel KV ile cache.
      → **DURUM (2026-10-18): 6/6 uç indi** — `/api/score` ✓ · `/api/recommend` ✓ ·
      `/api/analyze` ✓ · `/api/theme` ✓ · `/api/compare` ✓ · `/api/causal` ✓.
      **Son iki uç İNDİ** (2026-10-18), ikisi de AYNI kabukta (method kapısı +
      `Allow`, `AZAMI_SORGU`/`AZAMI_SEMBOL` `_girdi.js`ten, `max-age=30` hata
      yolu, gövdede `uyari`, iç hata metni yok + `console.error`).
      ① **`/api/compare`** — zincirin dördüncü halkası
      (`scoreOne ⊂ recommendOne ⊂ analyzeOne ⊂ compare`): analyze'ın
      döndürdüğü her şey + `sira` (alım bandına uzaklık sıralaması,
      `app.js:12615`ten BİREBİR, yeni eşik UYDURULMADI). Kendine ait tek yeni
      kural `ASGARI_SEMBOL = 2` (tek sembol kıyaslanamaz).
      ② **`/api/causal`** — haber ⇄ piyasa nedenselliği. **VARSAYIM: POST** —
      girdisi (endeks hareketleri + gündem konseptleri) `AZAMI_SORGU=128`e
      ilk konseptte sığmıyor; bu yüzden tek uç olarak `POST, OPTIONS`.
      Ağa HİÇ çıkmıyor (`maxDuration` 10, 60 kopyalanmadı).
      **Mantık uçta DEĞİL:** app.js'in nedensellik bölgesi `tests/engine.mjs`e
      **onuncu dilim** olarak eklenip `tools/motor-uret.mjs` ile motor yeniden
      üretildi (`CAUSAL_INDEX_AFFINITY` · `causalAlign` · `computeCausalLinks`;
      `imza sha256:1435e93c3382a93e → sha256:0654972f8af6435b`, 1.683 satır).
      DOM (`renderCausalLinks`) ve LLM (`causalExplainLLM`) dilimin DIŞINDA
      kaldı — denetimle bekçileniyor. `causalAlign`ın `why` serbest Türkçesi
      HAM SAYI kuralı gereği tele çıkmıyor; istemci cümleyi `key`den kuruyor.
      **Bekçi:** `tests/uc-test.mjs` ⑨ + ⑩ bölümleri, **259 → 383 denetim
      (+124)**, ağa çıkmıyor. **Negatif kontrol:** `ASGARI_SEMBOL` 2→1
      yapılınca 3 denetim kırmızı (ve uç gerçekten ağa çıktı — kapının CI'yı
      çevrimdışı tutan şey olduğu ölçüldü); `notable` doğrulaması sökülünce
      2 denetim kırmızı. İkisi de geri alındı.
      **Skor DEĞİŞMEDİ:** motor imzası değişti ama `parity.mjs` ve
      `PARITE_MOTOR=uretilmis parity.mjs` ikisi de **FARK 0**.
      **`api/theme.js` motor şeridine alındı** (2026-10-18): dosya zaten
      yayındaydı ama **eski kabuktan** geliyordu. Sekiz sapma ÖLÇÜLDÜ ve
      kapatıldı — ① hiçbir gövdede `uyari` yoktu · ② method kapısı yoktu
      (POST düpedüz GET gibi işleniyordu) · ③ önbellek iki farklı sayı
      kullanıyordu (60 / 30 → tek sabit `max-age=30`) · ④ `AZAMI_SORGU`
      yerel kopyası sürüklenmişti (120 vs `_girdi.js` 128 → içe alındı,
      tek kaynak) · ⑤ `detail: e.message` iç hata metnini istemciye
      sızdırıyordu (söküldü, yalnız `console.error`) · ⑥ hata yolunda hiç
      log yoktu · ⑦ LLM fetch'inde zaman aşımı freni yoktu
      (`LLM_ISTEK_MS` 20 sn < maxDuration 30 sn) · ⑧ `14` adlandırılmamış
      gömülü sayıydı (`AZAMI_ADAY`). **`reason` serbest metni BİLEREK
      KALDI**: HAM SAYI kuralı *sayı biçimleme* kuralıdır, metin yasağı
      değil — ve bu uçta cümle sayının sunumu değil ucun ÜRÜNÜ; çit
      metnin kendisine kondu (SYSTEM'de al/sat dili yasak, 140 krk kırpma,
      gövdede `uyari`). İstemci sözleşmesi KIRILMADI (app.js `themeFetchLLM`
      yalnız `candidates` + `error` okur). **Bekçi:** `tests/parity.mjs`
      theme'i KORUMAZ (skor şeridi değil) → `tests/uc-test.mjs` ⑧ bölümü
      eklendi, **186 → 259 denetim (+73)**, ağa çıkmıyor (`globalThis.fetch`
      bölüm boyunca patlayan sahte ile değiştiriliyor, 0 deneme ölçüldü).
      **Negatif kontrol:** method kapısı ve önbellek sabiti kasten bozulunca
      test 6 farkla kırmızı yandı. **Skor DEĞİŞMEDİ:** `parity.mjs` ve
      `PARITE_MOTOR=uretilmis parity.mjs` ikisi de **FARK 0**.
      **Vercel KV önbelleği henüz hiçbir uçta YOK** — bu maddenin ikinci
      yarısı tamamen açık.
      → **Sürüyor** (2026-10-12). İlk uç `/api/score`. **Taşıyıcı hazır:** motor
      artık `app.js`'ten **üretiliyor** → `api/_motor.js` (1.463 satır / 9 dilim,
      tek ESM modülü, girişi `buildMotor(H)`; `_` öneki Vercel rotasını engelliyor).
      **El ağırlıkları da aynı ilkeyle üretiliyor** → `api/_ayar.js` (`TA_WEIGHTS` ·
      `TA_BENCHMARK`, `config.js`'ten türetilmiş; bildirim konusu, vekiller ve
      besleme listeleri **alınmıyor** — sızma denetimi bunu her koşuda tahsil ediyor).
      Kopya **değil** — `tools/motor-uret.mjs` her seferinde `app.js`'i yeniden
      dilimliyor, `tests/uretim-test.mjs` (64 denetim) "bu dosyalar kaynaklarının
      ŞU ANKİ hali mi?" diye soruyor. **Kanıt:** üretilmiş motor aynı fikstürlerle **FARK 0**
      (`PARITE_MOTOR=uretilmis node tests/parity.mjs`); `taBand` eşiği kurcalanınca
      test metin **ve** davranış farkını yakalayıp çıkış 1 verdi.
      **Uç noktası hazır** (2026-10-14): `api/score.js` — `/api/score?symbols=…&vade=…`
      bir veya daha çok sembol için **ham** TA/FA/bileşke döndürüyor. Motor mantığı
      taşımıyor, dört hazır parçayı birleştiriyor (`_motor` · `_ayar` · `_ag` ·
      `_akis`). Yeni iki taşıyıcı: `api/_ag.js` (canlı ağ + `H` konağı +
      adres izin listesi + SEC 125 ms aralığı + `yok`/`kesinti` sayacı) ve
      `api/_akis.js` (çağrı sırası; `tests/score.mjs` artık onu çağırıyor — tek
      akış, iki şerit: uçta canlı ağ, testte fikstür).
      **Boşluk kapandı (Commit C, 2026-10-14):** motorun döndürdüğü FA skoru ile
      kullanıcının **gördüğü** skor artık aynı sayı. Ekran katmanı araya iki şey
      sokuyordu — F/K "Değerleme" kriteri (`app.js`'te **üç** kopya) ve FA/TA
      harmanı (yine **üç** kopya). İkisi de motora devredildi (`FA_PE` /
      `faPeCriterion` · `COMPOSITE_BLEND` / `compositeBlend`; dışa verilen sembol
      23 → **27**), app.js'teki altı kopya tek tanıma indi, geçici üçüncü taşıyıcı
      `api/_ekran.js` **silindi** (üretilen dosya 3 → **2**) ve `api/_akis.js`'in
      sabit taşıyan ikinci argümanı (`K`) kalktı. **İSTEMCİ SÖZLEŞMESİ:**
      `/api/score` yanıtındaki `surum.ekran` alanı **kaldırıldı** — `surum` artık
      `{ motor, ayar }`. Motor metni büyüdü (`fa-core` 26 → 63, `composite`
      15 → 36 satır) ama **skor değişmedi**: parite bunun kanıtı.
      **Ölçülen:** `node tests/uretim-test.mjs` → **64 denetim geçti**
      (`_ekran.js` bölümü gidince 77 → 64; devredilen sabitler artık motorda
      denetleniyor — iki motorda derin eşitlik, `FA_PE.bp` artan, harman 1'e
      tamamlanıyor, silinen dosya geri gelmemiş);
      `node tests/parity.mjs` → **FARK 0** (29 karşılaştırma noktası), üretilmiş
      motor şeridinde de (`PARITE_MOTOR=uretilmis`) **FARK 0**;
      `node tests/uc-test.mjs` → **58 denetim geçti** (ağsız: girdi doğrulaması,
      CORS/405/4xx gövdeleri, yığın izi sızdırmama, HAM SAYI kuralı).
      **Dürüst sınır:** sembol tavanı 8 (istemcinin Karşılaştır tavanıyla aynı),
      45 sn'lik bütçe freni yeni sembole *başlamadan* bakıyor — başlamış bir
      sembol kesilemiyor, çünkü zaman aşımları motorun ve konağın içinde. Tek bir
      BIST sembolü en kötü halde (3 × 7 sn İş Yatırım + mumlar) platform
      bütçesini yiyebilir; istemci kesilen isteği `kesinti` gibi ele almalı.
      **Canlı koşu O GÜN yapılmamıştı** — `vercel.json`'daki 1024 MB bellek
      TAHMİNDİ. **Sonradan ÖLÇÜLDÜ** (`tests/duman.mjs`, 2026-10-14) ve
      **512**'ye indi; sayılar aşağıda. Semboller SIRAYLA işleniyor
      (paralel değil); hız gerekirse ölçülüp ayrıca ele alınacak.
      **Açık uç KAPANDI** (2026-10-14): `tests/capture.mjs` artık UA/başlık
      sabitlerinin kendi kopyasını tutmuyor, `api/_ag.js`'ten içe alıyor
      (`SEC_ARALIK_MS` · `yahooBaslik` · `secBaslik` · `isYatirimBaslik`).
      Repo genelinde arama: UA literalleri artık YALNIZ `api/_ag.js`'te.
      `SEC_TRY = 3` bilerek capture'da kaldı — "ne kadar sabırlı deneriz"
      POLİTİKA, çağırana ait; paylaşılan şey BİLGİ. **Ölçülmedi:** SEC istek
      aralığı 120 → **125 ms** oldu (ikisi de 10 istek/sn sınırının altında,
      fark ölçülmedi, dosyaya yorum olarak yazıldı). `tests/capture.mjs`
      KOŞULMADI (canlı ağa çıkar, fikstürlerin üzerine yazar) — kanıt,
      başlıkların eskisiyle **birebir aynı** olması (9/9 karşılaştırma).
      **İkinci uç İNDİ** (2026-10-14): `api/recommend.js` —
      `/api/recommend?symbols=…&vade=…` skorun ÜSTÜNE plan katmanı koyuyor:
      `seviye` (destek/direnç/alım bandı), `yakinlik` (banda uzaklık),
      `momentum` (trend-devam rejimi), `riskOdul`. **Beşinci taşıyıcı
      açılmadı** — aynı dört parça.
      **Önce motora indirildi:** `momentumInfo` · `buyZoneProximity` ·
      `planRiskReward` (`computeCompareVerdict`'in sayısal çekirdeği) artık
      `app.js`'in motor diliminde; `_akis.js`'in `planKatmani()`'si yalnız
      motoru çağırıyor — akışta tek bir eşik veya çarpan yok. CÜMLE çağrı
      noktasında kaldı (Commit C deseni).
      **HAM SAYI:** yanıtta `Intl`/`toFixed`/`toLocaleString`/emoji/para
      simgesi yok; `buyZoneProximity`'nin `txt` alanı (emoji + `toFixed`)
      motora da girmedi, tele de çıkmıyor.
      **İSTEMCİ SÖZLEŞMESİ:** `levels.anchorSrc` (serbest Türkçe metin)
      yanıtta YOK — kaliteyi `anchorKind` (sabit kümeli makine kodu) taşıyor.
      `/api/score`'un sözleşmesi DEĞİŞMEDİ (`surum` = `{ motor, ayar }`).
      **Ölçülen:** `node tests/uc-test.mjs` → **106 denetim geçti** (58 → 106:
      yeni ⑤ bölümü iki ucun yüzeyini, 25 sorgu vektöründe `ayristir()`'ların
      bayt-eşitliğini, kapıyı ve KOPYA kapının 61 kod satırlık sürüklenme
      kilidini ölçüyor); `node tests/uretim-test.mjs` → **73 denetim geçti**
      (64 → 73: motora inen üç fonksiyon artık orada denetleniyor);
      `node tests/parity.mjs` → **FARK 0** (29 nokta), `PARITE_MOTOR=uretilmis`
      şeridinde de **FARK 0** — yani **skor değişmedi**, kapı budur.
      **Canlı koşu O GÜN yapılmamıştı**, sonra yapıldı: `tests/duman.mjs`
      `/api/recommend`'i gerçek ağla çağırdı (sayılar aşağıda).
      `vercel.json`'daki 1024 MB tahmini ölçümle **512**'ye indi, 60 sn
      ölçüm sonucu KALDI. Doğrulama bölgesi
      `api/score.js` ile **bilerek kopya** (Vercel'de her uç kendi lambda'sı:
      kendi motoru, kendi SEC önbelleği, ortak modül durumu YOK); sessiz
      ayrışmayı `tests/uc-test.mjs` ⑤b/⑤e bekçiliyor.
      **CANLI DUMAN TESTİ İNDİ** (2026-10-14, `tests/duman.mjs`): iki ucun
      `handler`'ı sahte `req`/`res` ile, **gerçek ağ üzerinden** çağrıldı.
      Elle koşulur, CI'da koşmaz, fikstüre yazmaz. **Ölçülen** (AAPL+ASELS.IS,
      tek çağrı): `/api/score` 30,6 sn · `/api/recommend` 28,7 sn · tepe
      `heapUsed` 17,1 MB · tepe `rss` **95,3 MB**. Tek ABD sembolüyle 7,2 sn /
      88,3 MB. **Sonuç:** `vercel.json`'daki tahmin 1024 → **512** (ölçülen
      tepenin ~5 katı; 256'ya inilmedi çünkü tepe örneklemeyle alındı, yani
      alt sınır). **Bilinen taviz:** Vercel'de bellek kademesi vCPU'yu da
      ölçekliyor — bu iş yükü İO-ağırlıklı (7,2 sn'nin ~3,9 sn'si SEC
      125 ms aralığında saf bekleme), o yüzden CPU darboğaz değil; dağıtımdan
      sonra süre uzarsa ilk bakılacak yer burası.
      **ÖLÇÜLEMEYEN:** BIST ayağı (İş Yatırım) o koşuda TCP düzeyinde
      bağlanamadı — BIST mali tablosu hiç inmedi, **BIST yolunun bellek
      tepesi hâlâ ÖLÇÜLMEDİ**.
      **ÜÇÜNCÜ UÇ İNDİ** (2026-10-14): `api/analyze.js` —
      `/api/analyze?symbols=…&vade=…` planın ÜSTÜNE bütüncül okumayı
      koyuyor: `faKarar` (FA sözel kararı) + `butunculluk` (0-10 skor, band,
      üç direk `k`/`w`/`v`/`conf`, `coreSoft`, `buyumeCls`). Üç uç İÇ İÇE:
      `scoreOne ⊂ recommendOne ⊂ analyzeOne`. **Beşinci taşıyıcı yine
      açılmadı** — aynı dört parça.
      **MOTORA TAŞIMA YAPILMADI, çünkü GEREKMEDİ:** önce ölçüldü —
      `computeHolisticScore` · `faVerdict` · `COMPOSITE_MATRIX` motor
      diliminde ZATEN vardı ve `app.js`'in iki tüketicisi (`fillResultPlan`,
      `compareVerdict`) yalnız onları çağırıyordu. Yani bu uç bir ÇAĞRI
      SIRASI; `app.js`/`config.js` ellenmedi, `tools/motor-uret.mjs` yeniden
      koşmadı, üretilmiş taşıyıcılar bayt olarak aynı kaldı.
      **HAM SAYI:** motorun serbest Türkçe metinleri (`parts[].note`,
      `growthNote.txt`, `COMPOSITE_MATRIX[...].txt`) tele ÇIKMIYOR; yalnız
      sabit kümeli kod geçiyor (`faKarar.label`, `band.l`/`band.c`,
      `direkler[].k`, `buyumeCls`). `thematic` alanı BİLEREK dışarıda:
      sabit `false` göndermek "tematik değil" diye okunurdu, gerçek ise
      "bilinmiyor".
      **Ölçülen (canlı, tek ABD sembolü):** duvar saati 7.405 ms (aynı sorguda
      `/api/score` 7.213 ms) · tepe `rss` 88,3 MB (score ile AYNI) · **0 ek ağ
      isteği**. Yani bütüncül katman saf hesap: +192 ms (%2,7), +0 MB. Bu,
      analyze'ın recommend'i SARMASI kararını da doğruluyor — istemci iki uç
      çağırsa mumlar ve SEC modeli (31 istek) İKİNCİ KEZ inecekti.
      **Ölçülen (kapılar):** `node tests/uc-test.mjs` → **160 denetim geçti**
      (106 → 160: yeni ⑥ bölümü üçüncü ucun yüzeyini/kapısını ve bütüncül
      katmanın HAM SAYI disiplinini ölçüyor; ⑤e kopya kilidi artık ÜÇ YÖNLÜ —
      61 kod satırı / 2.401 karakter üç dosyada birebir); `uretim-test` →
      **73**; `parity` → **FARK 0** (29 nokta), `PARITE_MOTOR=uretilmis`
      şeridinde de **FARK 0** — **skor değişmedi**, kapı budur.
      **AÇIK KALAN → KAPANDI (2026-10-14, aşağıdaki süre tavanı maddesi):**
      bozuk ağda TEK ÇAĞRI 76,3 sn sürüyordu; fren artık sembol İÇİNDE de
      duruyor ve aynı koşum **50,0 sn**.
      **Üçüncü KOPYA borcu → KAPANDI (2026-10-14, aşağıdaki girdi kapısı
      maddesi):** doğrulama bölgesi `api/_girdi.js`e taşındı, üç uç aynı
      fonksiyon nesnesini içe alıyor.
      **Sırada: dördüncü uç** — `theme` (tematik keşif; `api/theme.js` VAR ama
      eski şeritten, beş taşıyıcının üstünde durmuyor), ardından `causal` ve
      `compare` + `pulse` (⚡ Nabız). Aynı beş taşıyıcı, aynı kural: SAYI
      motora, CÜMLE çağrı noktasına. KV önbelleği ölçülmeden eklenmeyecek.
- [x] **SÜRE TAVANI — ölçülen açık kapatıldı** (2026-10-14, FAZ 1/5-F):
      üç ucun ORTAK açığıydı; `maxDuration` 60 aşılıyordu, istemci gövdesiz
      504 görürdü.
      **① Önce KIRMIZI:** açık belirlenimci olarak yeniden üretildi —
      `tests/sure.mjs` (ağsız; `globalThis.fetch` yerine iptale uyan bir KARA
      DELİK). Bozuk ağ beklenmedi. Ölçülen: **76,0 sn** (canlı
      `tests/duman.mjs` 76,3 sn ile tutarlı → araç sadık). Aynı koşum
      `atlanan: []` gösterdi: `BUTCE_MS` o senaryoda HİÇ ateşlenmemişti —
      semboller arası fren, sembol İÇİNDEKİ aşımı göremez.
      **② Sonra tavan:** `api/_ag.js`e tur başına **MUTLAK SON TARİH**
      (`TUR_TAVAN_MS` 50000, `TUR_BUTCE_MS` 45000). Tur durumu (`yeniTur`)
      zaten oradaydı, ağa çıkan TEK yer orası ve `cek()`in zaman aşımı da
      orada — sayı bu yüzden motora/taşıyıcıya kondu, **üç uca
      KOPYALANMADI**: uçlar `const BUTCE_MS` taşımıyor, `AG.butceDoldu()`
      soruyor. Her istek penceresi kalan süreye KISILIYOR; kalan süre
      `ASGARI_ISTEK_MS`in altındaysa ağa HİÇ çıkılmıyor (soket açılmıyor).
      Niye 50 < 60: tavandan sonrası saf hesap, ölçülen ≈3,3 sn → 50+3,3≈53,
      ~7 sn pay. Niye BÜTÇE < TAVAN: 45'ten sonra yeni sembole başlanmaz,
      kalan 5 sn BAŞLAMIŞ sembolün toparlanmasına kalır.
      **Ölçülen SONUÇ:** aynı belirlenimci koşum **76,0 sn → 50,0 sn**, ÜÇ
      UÇTA DA (`score` · `recommend` · `analyze`). HTTP **200** korundu,
      etkilenen sembol `tam: false`, sayaçlar `yahoo 4/4kes · sec 1/0yok/1kes
      · bist 3/3kes`. Kara delik ağında açılan istek **9 → 6**: üç istek
      soket açılmadan reddedildi, yani sembol içi fren GÖRÜNÜR.
      **Sözleşme:** tavana çarpmak **arıza değil**, frenin işini yapması.
      `tam:false` (= "ölçemedim") ile `score:null` + `tam:true` (= "ölçtüm,
      veri yok") KARIŞTIRILMIYOR; 404 hâlâ `yok` (veri cevabı), tavan
      `kesinti`. Sessiz sıfır yok.
      **Bekçi:** `uc-test` ⑦ (ölçekli, milisaniyelerde biter, kapıda koşar) ·
      `tests/sure.mjs` (üretim sabitleriyle ~50 sn/uç, ELLE, kapı dörtlüsünün
      DIŞINDA). `uc-test` 160 → **176 denetim**.
- [x] **GİRDİ KAPISI — ÜÇ KOPYA borcu kapandı** (2026-10-14, FAZ 1/5-G):
      beşinci taşıyıcı `api/_girdi.js` (**ELLE YAZILMIŞTIR**, üretilmiş
      değil — `_motor.js`/`_ayar.js` üretilmiş, `_ag.js`/`_akis.js`/`_girdi.js`
      elle). `_` öneki Vercel'de yol açılmasını engelliyor.
      **Önce ÖLÇÜM:** doğrulama bölgesi (sınırlar + `ayristir` +
      `temizleSembol`) üç dosyada **61 kod satırı / 2.401 karakter**, yorumlar
      çıkarıldığında **birebir aynı** → parametrelenecek fark YOKTU, taşıma
      kör yapılmadı. En ucuz an: üç uç da henüz **yayında değildi**
      (`origin/main`de yoklar), sözleşme donmamıştı.
      **Ne taşındı:** `AZAMI_SEMBOL` · `PAZARLAR` · `VARSAYILAN_VADE` ·
      `AZAMI_SORGU` · `SEMBOL_BICIM` · `ayristir()` · `temizleSembol()`.
      **Ne BİLEREK kaldı:** modül düzeyi konak/motor kurulumu (`canliAg` +
      `buildMotor`) — o sıcak lambda durumu, uç başına, doğrulama değil.
      **Tuzak (önce KIRMIZI):** `export { X } from './mod.js'` TEK BAŞINA
      yetmiyor — yeniden dışa aktarır ama YEREL BAĞLAMA yaratmaz; handler
      `ayristir`i çağırdığı için `ReferenceError: ayristir is not defined`
      ile kırmızı yandı. Üç uçta `import` + `export` birlikte, gerekçe kodda.
      **Kilit METİNDEN KİMLİĞE çıktı:** eski ⑤e üç dosyanın bölgesini METİN
      olarak karşılaştırıyordu (2 denetim: N9 + ⑤e). Kopya kalkınca metin
      karşılaştırması anlamsız — üç BOŞ ayıklama "eşit" çıkar, tam olarak
      N9'un engellediği sessiz yeşil. Yerine **12 denetim**: ① statik
      `import` denetimi · ② 7 desenli "yerel kopya DİRİLMEDİ" taraması
      (yorumlar çıkarılarak: gerekçede `const PAZARLAR` geçmesi suç değil) ·
      ③ `ayristir` AYNI FONKSİYON NESNESİ + `AZAMI_SEMBOL` kimliği +
      **19 girdili vektör eşitliği** (sarmayı yakalar) · ④ taşıyıcı saflığı
      (yalnız `_ayar.js`, ağ yok, HAM SAYI). Denetim sayısı **176 → 186**
      (−2 eski metin denetimi, +12 kimlik denetimi).
      **MUTASYON SINANDI (ölçülen):** ⓐ `score.js`e yerel
      `AZAMI_SEMBOL = 5` dirildi → **6 KIRMIZI** (⑤e② "DİRİLEN:
      AZAMI_SEMBOL sabiti" + ⑤e③ kimlik + ⑤a/⑥a/①/② eşitlik); geri alındı,
      186 yeşil. ⓑ `recommend.js` taşıyıcının `ayristir`ini SARDI (3
      sembolde kırpan sarmalayıcı) → **4 KIRMIZI** (⑤e③ kimlik + ⑤e③ vektör
      eşitliği + ⑤b + ⑥b); geri alındı, 186 yeşil. ⓑ'yi ESKİ metin kilidi
      YAKALAYAMAZDI — hiçbir sabit yeniden tanımlanmıyor; kimlik denetimi
      bu yüzden metinden güçlü.
- [x] **Expo projesi** kuruldu (2026-10-14, `mobile/`): TypeScript + expo-router +
      Supabase client. expo ~57.0.28 · react-native 0.86.3 · react 19.2.3 ·
      expo-router ~57.0.26 · typescript ~6.0.3. **Elle eklenen TEK paket**
      `@supabase/supabase-js` ^2.117.3 — UI/ikon/state/grafik kütüphanesi
      kurulmadı (her bağımlılık bir bakım borcu). `mobile/` `.vercelignore`da:
      web dağıtımına girmiyor. Ayrıntı ve gerekçeler `mobile/MOBIL_NOTLAR.md`.
      **Supabase anahtarı YOK ve uydurulmadı** — `supabase.ts` çökmüyor, dürüst
      "yapılandırılmadı" durumu döndürüyor; `.env.example` üç değişkeni **boş**
      listeliyor ve `service_role`un neden orada yer almayacağını yazıyor.
- [x] **Tasarım sistemi** kuruldu: `mobile/src/theme/` (colors · typography ·
      layout · signal). Web paletinden native'e eşleme **MOBIL_NOTLAR.md**'de
      tablo halinde: `--bg #0a0e1a`→`#0F1522`, `--gold #fbbf24`→`#D4A24E`,
      `--green #22d39a`→`#3FBF8F`, `--red #ff5e7e`→`#EF7060`; mor `--accent`
      **bilerek taşınmadı** (altın tek vurgu rengi olsun diye). Komponentlerde
      sabit hex yok, `tabular-nums` tek yerde, açık tema token yapısı hazır.
      **Renk körlüğü yapısal:** `signal.ts`'in `signalOf()`'u tek nesnede
      `{tone, arrow, word, a11yLabel}` döndürüyor — "yalnız renk" kullanmak için
      fonksiyonun dışına çıkmak gerekir (kural koda gömüldü, yoruma kalmadı).
- [x] **Çekirdek komponentler** (7 + 1): `Card`, `Pill/Badge`, `ScoreGauge`,
      `TickerRow`, `SectorChip`, `Disclaimer`, `Skeleton` — hepsi Analiz
      sekmesindeki vitrinde **gözle görüldü**. 8.'si `ScreenShell`: disclaimer'ı
      her ekranın dibine **yapısal** koyuyor (`DISCLAIMER_TEXT` sabiti), yani
      "her ekrana eklemeyi unutma" diye bir kural kalmadı.
      **"Veri yok" ≠ "ölçemedim"** istemci tarafında da ayrı: `types.ts`
      `kesintiSayisi()` / `olcumEksik()`; vitrinde ScoreGauge ikisini ayrı
      gösteriyor (`72/100` ile `—/100 ölçülemedi`).
- [x] **5-sekmeli tab navigasyon iskeleti**: `mobile/src/app/(tabs)/` —
      Listeler · Bugün · Keşfet · Analiz · Arama, **web'deki sırayla birebir**.
      Beş yol da açıldı, sekme çubuğundan tıklama geziniyor, `tr-TR` biçimleme
      doğru (`$182,40` · `₺61,85` · `▲ +2,14%` · `▼ −1,37%` U+2212, boşta `—`),
      konsolda hata yok, 375×812 ve masaüstünde düzen bozulmuyor.
      **Uydurma veri yok:** semboller `ÖRNEK.A/B/C`, kartlar `İSKELET`/`ÖRNEK`
      rozetli — iskelet olduğu ekranda görünüyor.
      **YEŞİL OLMAYANLAR (örtülmedi):** ① tüm görsel ölçüm
      **react-native-web** üzerinde — simülatör/emülatör koşulmadı, iOS/Android
      derlemesi denenmedi, yani hiçbir şey gerçek native'de doğrulanmadı.
      ② `npx tsc --noEmit` temiz (exit 0), ama `npx expo-doctor` **19/21**: iki
      düşen denetim de Expo sunucusuna bağlanıyor (ağ kaynaklı, proje kusuru
      değil — erişim varken 20/21 geçmişti), yine de "21/21" denemez.
      ③ sekme ikonları **emoji** (vektör set yeni bağımlılık demekti); web'de
      sekme metni emojiyi iki kez çiziyor — react-navigation artefaktı, kozmetik.
      ④ uygulama ikonu/splash görseli hâlâ **Expo şablonunun sanatı**; Android
      `adaptiveIcon.backgroundColor` şablon değerinde kaldı. ⑤ `expo lint`
      koşulmadı (`mobile/`da eslint config yok; koşmak "yalnız şablon + Supabase"
      kuralını delerdi). ⑥ Şablondan gelip kullanılmayan paketler
      (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-image`,
      `expo-device`, `expo-web-browser`) **silinmedi** — reanimated/
      gesture-handler/screens/safe-area expo-router'ın çalışma zamanı
      bağımlılığı, diğerlerini sökmek SDK-uyum denetimini ve kilit dosyasını
      riske atardı; FAZ 2'de ölçerek ayıklanabilir.
      ⑦ **Veri bağlama, kimlik doğrulama, test altyapısı yok** — FAZ 2.

## FAZ 2 — Çekirdek ekranlar

**Amaç:** dört ana ekranın native hali, veriyi motor API'den çeker.

- [ ] **Bugün (dashboard):** konjonktür kartı · piyasa nabzı · öne çıkan sektör ·
      günün fırsatları (yukarıdaki mockup bu ekranın hedefi).
- [ ] **Analiz:** tek hisse derin dalış — TA + FA + bileşke skor + grafik.
- [ ] **Listeler:** portföy / izleme listeleri, **Supabase ile cihazlar arası senkron**.
- [ ] **Arama + Keşfet:** sembol arama + 🔭 tematik keşif + 🤖 radar/gündem.
- [ ] Her listede **FlashList** (virtualizasyon); skeleton + optimistic + pull-to-refresh.

## FAZ 3 — Elit cila (sürekli, bitmeyen)

**Amaç:** "native" ile "elit" arasındaki farkı kapatmak. AldınGitti'nin eksiğiydi.

- [ ] 60fps geçişler (Reanimated), **haptik** mikro-etkileşim, spring animasyon.
- [ ] Tasarlanmış **boş / hata / offline / yükleniyor** durumları (sonradan akla gelen değil).
- [ ] Native grafikler (victory-native / Skia).
- [ ] Koyu/açık tema; erişilebilirlik; renk körü için ▲/▼ ok (renge bağlı kalma).
- [ ] **Performans bütçesi:** liste jank yok, hızlı TTI, algılanan anında-açılış (cache).

## FAZ 4 — Kimlik & para (Faz 2–3 ile paralel)

**Amaç:** free/premium ayrımı ve store IAP.

- [ ] **Supabase auth** (Apple ile giriş + Google). "Kendi appstore hesaplarıyla girer."
- [ ] **RevenueCat** + App Store / Play IAP → free vs **premium** kapısı.
- [ ] **Premium kapsamı:** sınırsız analiz · LLM "günün nedeni" + tematik Yol B ·
      ⚡ Nabız push bildirimleri · Karşılaştır · gelişmiş radar.
- [ ] **Free kapsamı:** temel skorlar, listeler, günde sınırlı analiz.
- [ ] Faturalama dili **SPK-uyumlu**: "analiz/bilgi aboneliği", tavsiye servisi değil.

## FAZ 5 — LLM akıllı katman (ANTHROPIC_API_KEY gelince)

**Amaç:** bekleyen Tier-B LLM işini açmak. (Şu an pasif: `CAUSAL_LLM.enabled:false`,
`api/theme.js` Yol B.)

- [ ] Anahtar Vercel env'e eklenince: nedensellik "günün nedeni" + tematik Yol B aktif.
- [ ] **Maliyet kontrolü:** Haiku modeli + KV cache (6–24s) + kullanıcı/gün limiti.
- [ ] Premium'a bağla — maliyeti ödeyen, faydalanan kullanıcı olur.
- [ ] Motor skoruna DOKUNMAZ (yalnız açıklama/keşif katmanı).
- [ ] **Sürpriz / konsensüs boyutu (bilinen boşluk — 2026-10-14):** ⚡ Makro Nabız
      "beklenenden sıcak" ayrımını YAPAMIYOR; yalnız manşet yönünü okur. Doğru ölçüm
      gerçek makro konsensüs verisi ister (TÜFE beklentisi vs gerçekleşen); depoda böyle
      bir kaynak YOK (hisse tarafındaki Yahoo `earningsTrend` makroyu kapsamaz). Kaynak
      eklenmedi, konsensüs UYDURULMADI — bilinçli kapsam dışı. Bu faza ait.

## FAZ 6 — Store'a çıkış

- [ ] **EAS Build + Submit** (Expo CI → store).
- [ ] App Store / Play listeleme: ekran görüntüleri, gizlilik beyanı, SPK-uyumlu metin.
- [ ] TestFlight / Play internal test → prod yayın.
- [ ] Apple Developer ($99/yıl) + Google Play ($25 tek sefer) hesapları (AldınGitti'den var olabilir).

---

## Elit kalite kontrol listesi (her sürümde geç)

- [ ] Her scroll / geçiş 60fps
- [ ] Tüm uzun listeler virtualize (FlashList)
- [ ] Skeleton / optimistic UI — bekleme boş görünmüyor
- [ ] Haptik + spring mikro-etkileşim
- [ ] Boş / hata / offline durumları tasarlanmış
- [ ] Offline'da anlamlı çalışır (cache)
- [ ] Disclaimer her ekranda
- [ ] Motor skoru değişmedi (regresyon yok)

---

## Teknoloji yığını (AldınGitti ile aynı — öğrenme eğrisi yok)

| Katman | Seçim | Not |
|---|---|---|
| Native | **React Native + Expo** | AldınGitti'de kullanıldı |
| Navigasyon | **expo-router** | tab + stack mimarisi |
| Listeler | **FlashList** | virtualizasyon = akıcılık |
| Animasyon | **Reanimated** | 60fps, haptik |
| Backend/auth | **Supabase** | auth + kullanıcı verisi senkron |
| Motor | **Vercel serverless** | mevcut; skor/analiz API'leri |
| IAP | **RevenueCat** | free/premium, Apple+Google soyutlama |
| Grafik | victory-native / Skia | native çizim |
| CI/yayın | **EAS Build/Submit** | store'a otomatik |

---

## AldınGitti dersi (neden bu plan böyle)

AldınGitti **zaten native'di** (RN/Expo + Supabase, App Store'a çıktı) ama "profesyonel
değil" hissetti. Sorun framework değil **execution/cila**'ydı: navigasyon mimarisi,
liste virtualizasyonu, algılanan hız, mikro-etkileşimler. Bu yüzden FAZ 3 ("elit cila")
ve kalite kontrol listesi bu planın kalbidir — teknoloji seçimi değil, disiplin.

---

## Web geri bildirim günlüğü (laboratuvar → ürün)

Web PWA artık **geliştirme laboratuvarı**: canlı kullanımda yakalanan hata burada
ölçülür, düzeltilir, kalıcı testle çivilenir; native istemci bu düzeltilmiş motoru
devralır. Sıra kullanıcının kararı: **web optimizasyonları yönü belirler, motor/API
portu sonra gelir.**

### 2026-10-14 · ⚡ Makro Nabız yönü ters okuyordu (app.js ekran katmanı)

**Belirti (canlı web kullanımı):** ABD aylık enflasyonu beklentiden sıcak geldi,
piyasa çakıldı; Nabız "🕊️ Gevşeme / güvercin rüzgârı" dedi. Enflasyon satırı olayı
DOĞRU okudu, faiz satırı TAM TERSİNİ okudu, genel duruş yanlış olanı izledi.

**Kök neden (ölçüldü, üretildi):** `rateDirection()` yalnız "rate cut / faiz indirimi"
ifadesinin GEÇİP geçmediğine bakıyordu, o ifadeye NE YAPILDIĞINA bakmıyordu. Sıcak-TÜFE
günü manşetleri birebir "rate cut hopes **died**" biçiminde; beşi de güvercin sayıldı.
Ağırlık hatayı büyütüyordu: `pressure = rateDir*0,6 + inflDir*0,4` — bozuk sinyal 0,6,
doğru sinyal 0,4.

| | önce (hatalı) | sonra (düzeltilmiş) |
|---|---|---|
| `rateDir` | **−0,833** (güvercin) | **+0,833** (şahin) |
| `inflDir` | +0,500 | +0,571 (`consumer price` eklendi) |
| `pressure` | **−0,300** → 🕊️ GEVŞEME | **+0,729** → 🦅 SIKILAŞMA |

Eşik ±0,12. Aynı beş manşet, aynı motor; yalnız yön matematiği düzeldi.

**Yapılan üç düzeltme (hepsi ANAHTARSIZ — LLM çağrısı YOK, `CAUSAL_LLM.enabled:false`):**

1. **Olumsuzlama kapısı** (`FADE_HARD` / `FADE_SOFT` / `FADE_TR` + `fadedAround`,
   ifadenin İKİ yanında ±72 karakter): beklentiyi ÖLDÜREN fiil varsa oy TERS çevrilir.
   **İki yönlü:** olumsuzlanan indirim şahin, olumsuzlanan artırım ("rate hike fears
   fade") güvercin — tek yanlı düzeltme yeni yanlılık üretirdi. Çift anlamlı fiiller
   (`slash`/`lower`/`cut back`) yalnız bir BEKLENTİ nesnesiyle (`bets|odds|hopes|…`)
   olumsuzlama sayılır; yoksa gerçek indirim haberi ters çevrilirdi.
2. **Fiyat yalanlama şeridi** (`pulseMacroReality`, `.pmac-conflict`): duruş fiyat
   gerçekliğiyle ÇELİŞİYORSA kullanıcıya açıkça söylenir ("haber akışı X okuyor, ancak
   piyasa tersini söylüyor — yön teyit edilmedi"). Duruş **sessizce nötrlenmez** —
   bilgi yok edilmez, çelişki görünür kılınır. Genişlik eşiği `45` ÖLÇÜLDÜ (çevrim dışı
   fikstür, 20 sembol: ortalama 57,89 · sembol-başı sd 13,05 · ortalamanın standart
   hatası 2,92 → 45 ≈ nötr 50'nin 1,7 SE altı, deponun kendi resesyon kapısının hemen
   üstü). İzlenen-satır eşiği GEREKÇELİ, ölçülmüş DEĞİL (kodda böyle yazılı).
3. **Tazelik ağırlığı** (`FRESH_H=48s`, `FRESH_W=2,5`): yön matematiği 14 güne bakıyor,
   bugünün şoku 14 günün bir oyuydu. Son 48 saat 2,5× ağırlıklı (14 gün ≈ yedi 48s
   kovası → bugün oyların ~%29'u; 1,0 = eski bozuk davranış, 7,0 ≈ "yalnız bugün").

**Kalıcı test:** `tests/nabiz-yon-test.mjs` — ağa çıkmaz, kaynağı app.js'ten DİLİMLER
(kopyalamaz; kopya test kendi kopyasını doğrular, yani hiçbir şeyi). 40 denetim.
**Mutasyonla sınandı:** kapı kaldırıldı → 22 denetim KIRMIZI ve hata birebir geri geldi
(`rateDir −0,833`, `pressure −0,271` → güvercin); kapı geri kondu → 40/40 YEŞİL.

**Skor DEĞİŞMEDİ (kanıtlandı):** bu katman BİLGİ AMAÇLI, motor skoruna dahil değil.
`node tools/motor-uret.mjs` sonrası `git diff -- api/_motor.js api/_ayar.js` BOŞ;
dört kapı: üretim 73 ✓ · uç 186 ✓ · parite FARK 0 ✓ · üretilmiş-motor parite FARK 0 ✓.

**Kapsam dışı bırakıldı:** sürpriz/konsensüs boyutu → FAZ 5 (yukarıda, bilinen boşluk).
