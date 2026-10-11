# Motor Envanteri — `app.js` ayrıştırma haritası

> FAZ 1 / Adım 1 çıktısı. Tarih: 2026-10-11. Kaynak: `app.js` @ 12.707 satır (v95).
> Amaç: native göçten önce **motor (matematik/skor)** ile **kabuk (DOM/çizim)**
> sınırını tahminle değil **ölçerek** çizmek. `ELITE_ROADMAP.md` FAZ 1'i besler.
>
> **Bu envanter hiçbir skoru değiştirmez** — yalnızca mevcut kodun haritasıdır.

---

## Yöntem (ve sınırları)

Tek seferlik bir tarama script'i ile:

1. Her fonksiyon bildirimi bulundu (`function X(`, `const X = (`, `async` dahil).
2. Gövde sınırı **süslü parantez eşleştirmesiyle** saptandı → satır sayısı gerçek gövde.
3. Her gövde iki ölçütle tarandı:
   - **DOM teması:** `document.`, `innerHTML`, `querySelector`, `appendChild`,
     `addEventListener`, `classList`, `createElement`, `.style.`, `localStorage` …
   - **Ağ teması:** `fetch(`, `XMLHttpRequest`
4. Ne DOM ne ağ içerenler "saf aday" sayıldı, sonra bir tarama daha:
   gövdede **gerçek HTML etiketi** var mı (`</b>`, `<div class=`, bilinen boş etiketler).

**Dürüst uyarılar — bu sayılar neyi söylemez:**

- `app.js` tek bir dev **IIFE** (`(() => { … })()`). Bu yüzden "modül seviyesi" =
  **girinti 2**. Girinti 0'da *hiçbir* fonksiyon yok; ilk ölçümüm bu yüzden 0 döndürdü.
  Aşağıdaki tablolar girinti 2'deki 483 fonksiyonu kapsar (iç içe yardımcılarla
  birlikte toplam 762 bildirim var; taşıma kararı modül seviyesinden verilir).
- Sınıflandırma **isme değil gövdeye** bakar — ama yine de statik bir tarama.
  Bir fonksiyon DOM'a *dolaylı* (başka fonksiyon çağırarak) dokunuyorsa "saf"
  görünebilir. Örnek: `fetchRSS` / `fetchKAP` "ağ" kümesinde değil, çünkü `fetch(`
  yerine kendi sarmalayıcısı `fetchVia`'yı çağırıyorlar. Taşımada her fonksiyon
  tek tek doğrulanacak.
- Önce isim-regex'iyle gruplamayı denedim; `util` kovasına 392 fonksiyon düştü, yani
  işe yaramazdı. Bu yüzden isim değil **yapı** ölçüldü. Sayılar script çıktısıdır,
  elle düzeltilmedi.

---

## Ölçüm sonucu

| Katman | Fonksiyon | Satır | Kader |
|---|---:|---:|---|
| **Saf motor** (DOM yok, ağ yok, HTML yok) | **223** | **3.544** | → `/api/*` olarak taşınır |
| **Gizli sunum** (saf ama metninde HTML var) | **40** | **1.129** | → motor; metin biçimi kararı şart |
| **Ağ katmanı** (DOM yok, `fetch` var) | **17** | **264** | → sunucuya taşınır |
| **DOM'a bağlı** (kabuk) | **203** | **5.901** | → **atılır**, native'de yeniden yazılır |
| *Toplam (modül seviyesi)* | *483* | *~10,8k* | |

**Okunuşu:** motor tarafı ~3,5k satır; kabuk tarafı ~5,9k satır. Yani
**`app.js`'in yarısından fazlası ekrana çizme kodudur ve native'e hiç taşınmaz.**
Taşınacak matematik korkulandan küçük: ~3.500 satır.

---

## ⚠️ En kritik bulgu: motor metinlerinde gömülü HTML

40 fonksiyon "saf matematik" gibi görünüyor ama **ürettiği Türkçe açıklama metninin
içine `<b>` / `<i>` etiketleri gömülü.** Bunlar sunum fonksiyonu **değil** — gerçek
motor kararları (karar matrisi, mum formasyonu, karşılaştırma verdict'i):

| Fonksiyon | Satır | Ne üretir |
|---|---:|---|
| `computeCompareVerdict` | 115 | Karşılaştır "dürüst değerlendirme" metni |
| `detectCandlePattern` | 60 | Mum formasyonu + Türkçe yorum |
| `buildConjunctureNote` | 49 | Konjonktür notu |
| `faBand`/`taBand` + `COMPOSITE_MATRIX` | 25 | 3×3 bileşke karar matrisi (9 metin) |
| `insiderUS` / `insiderBIST` | 76 | İçeriden işlem özeti |
| `buildPulseMacroHtml`, `pulseMacroComment` | 53 | Nabız makro yorumu |
| `tezCardHtml`, `earnCardHtml`, `sekCardHtml`, `dcfCardHTML` … | ~250 | Kart metinleri |

Örnek (`COMPOSITE_MATRIX`, `app.js:4616`):
`'hi:hi' → 'Temel sağlam <b>ve</b> teknik olumlu — …'`

**Neden kritik:** React Native `<Text>` içinde `<b>` **render edilmez** — ekrana
düz düz "`<b>`" yazar. Yani motoru API'ye taşırken bir karar şart:

- **(A) Düz metin** — API `text` döner, vurgu kaybolur. En kolay, en zayıf.
- **(B) Belirteç dizisi (önerilen)** — `[{t:'Temel sağlam '},{t:'ve',b:true},…]`;
  web `<b>` basar, native `<Text style={bold}>` basar. Metin motorda tek yerde kalır.
- **(C) Markdown** — `**ve**` döner, iki istemci de parse eder. Orta yol.

**Öneri: (B).** Tek kaynaktan hem web hem native beslenir, metin motorda kalır,
hiçbir skora dokunulmaz. Karar **FAZ 1'de** verilmeli — sonradan 40 fonksiyona geri
dönmek pahalı olur.

---

## Uç nokta haritası (motor → `/api/*`)

### `/api/score` — TA + FA skor çekirdeği *(en büyük, en değerli)*

- **TA göstergeleri (ham):** `calcSMA` `calcEMA` `calcRSI` `calcMACD` `calcBollinger`
  `calcTR` `calcATR` `calcADX` `calcStochastic` `calcOBV` `calcIchimoku`
  `calcFibonacci` `calcVolumeProfile` `calcOrderFlow` `resampleCandles`
- **TA skor katmanı:** `taNormalize` (:987, 131 satır — **skorun kalbi**),
  `taTFIndicators` `taRegime` `taRelStrength` `taVolConfirm` `taTrendTemplate` `taAdxFactor`
- **S/R & bölge:** `rankedSRZones` (:1324, 76 satır) `makeSRZonesPrimitive` `makeBuyZonePrimitive`
- **FA çekirdek:** `computeFaScore` `faScoreSig` `faNum` `faPctIn` `faInterp` `faSD`
  `faVerdict` `faAlive` `mergeCriteria`
- **BIST temel:** `fetchIsYatirimMali` `parseIsMali` `bistFundamentalModel` (:5719, 125 satır)
  `fetchBistMarketCap` `bistValuation`
- **ABD/SEC temel:** `secFetchModel` (:6078, 164 satır — **en büyük tek fonksiyon**)
  `secResolveCik` `secConcept` `secBatches` `secAnnualSeries` `secBsSeries` `secTTM`
  `secInstSeries` `secInstYrAgo` `secPickByDur` `secUniqPeriods` `secAnnualsList` `secDur`
- **Bileşke:** `computeHolisticScore` (:5081, 74 satır) · `faBand`/`taBand` +
  `COMPOSITE_MATRIX` ⚠️HTML

### `/api/recommend` — öneri / bölge / plan

`momentumInfo` `buyZoneProximity` `scanScore` `scanBlend` `scanTag` `scanCrit`
`oppTag` `priceOppAdj` `scoreBand` `scoreSymbolList` `scanMomentumUniverse`
`momListsFor` `recommendUniverse` `radarUniverse`
· doğrulama: `computeBacktest` (:3955, 70 satır) `spearmanIC`

### `/api/analyze` — tek hisse derin dalış

`computeDCF` `dcfPerShare` `computeWACC` `annualizedVol` `usDcfIn` `buildGrowthNote`
`earnScenario` `fetchEarnBatch` `analyzeIntraday` `fetchIntradaySeries`
`ensureDailyCandles` `getDailyCandlesCached`
· ⚠️HTML: `detectCandlePattern` `insiderUS` `insiderBIST` `dcfCardHTML` `earnCardHtml`

### `/api/theme` — tematik keşif *(uç zaten var)*

`themeNorm` `themeFetchNews` `themeMatchNews` `themePrice` `themeHeat`
`fetchThemesData` `scoreHeadline` `computeNewsSentiment` `sentiLabel`
`candScore` `resolveAsset` `resolveOne` `candKey` `trNorm` `trIndustry`

### `/api/causal` — nedensellik + gündem + makro

`indexWhyFactors` `causalAlign` `computeCausalLinks` `computeAgenda` (:10156, 122 satır)
`agendaKwHit` `agendaMatchedStocks` `agendaCleanTitle` `computeMacro` `rateDirection`
`computeMetalMacro` `metalMacroInputs` `pulseSymbols` `pulseWhyThemes` `pulseIsSudden`
`inflDirection` `pulseRecentCount`
· ⚠️HTML: `computePulseMacro` (:10893, 68 satır) `pulseMacroComment` `buildPulseMacroHtml`

### `/api/compare` — karşılaştırma

`faModelFor` `buildAtahanNotes` `fetchCompareBatch` `rowExtrema` `otherMarket`
`sekBuildGroups` `sekSortGroups` `sekMedian` `sekPe` `sekPct` `sekPeg` `fetchSekBatch`
· ⚠️HTML: `computeCompareVerdict` (:11585, 115 satır)

### Ağ katmanı → sunucu (17 fn / 264 satır, **ölçülmüş tam liste**)

`fetchYahooDividends` (:1438) `fetchYahooChart` (:426) `fetchVia` (:16)
`fetchYahooOHLC` (:555) `pullWatchlistSync` (:1992) `stockResolve` (:7876)
`cryptoResolve` (:7857) `pushWatchlistSync` (:1961) `cryptoPrices` (:2163)
`cryptoMarkets` (:6582) `earnPct0` (:8715) `cryptoDetail` (:6728)
`yfinQueryDeep` (:8717) `yfinQuery` (:11411) `themeFetchLLM` (:8035)
`cgGlobal` (:6597) `causalExplainLLM` (:10585)

**Yan kazanç:** `fetchVia` sunucuya geçince `PROXIES` dizisi (üç farklı üçüncü-parti
CORS proxy: corsproxy.io, allorigins, codetabs) **tamamen gereksizleşir.** Şu anda
kullanıcı istekleri yabancı proxy'lerden geçiyor; API'ye taşınınca hem hız, hem
gizlilik, hem güvenilirlik kazanılır.

**Not:** `themeFetchLLM` + `causalExplainLLM` zaten burada duruyor ve pasif
(`CAUSAL_LLM.enabled:false`). FAZ 5'te anahtar gelince açılacak yer tam olarak bu
iki fonksiyon — API'ye taşıma onları *yerinde* bırakmalı ki anahtar sunucuda kalsın
(istemciye asla gömülmez).

---

## Kabukta kalan (203 fn / 5.901 satır — native'de yeniden yazılacak)

Yeniden yazım iş yükü sırası:

| Fonksiyon | Satır | Hedef native ekran |
|---|---:|---|
| `paintCompare` | 343 | Karşılaştır |
| `renderTAIndicators` | 275 | Analiz / TA |
| `fillResultPlan` | 243 | Analiz / Sonuç planı |
| `computeVadeScore` | 153 | Analiz *(sınır vakası — aşağıya bak)* |
| `renderCalendar` | 147 | Bugün / takvim |
| `renderToday` | 143 | **Bugün (dashboard)** |
| `renderMacro` | 141 | Keşfet / makro |
| `renderBasket` | 130 | Listeler / portföy |
| `renderRadar` | 130 | Keşfet / radar |
| `renderOpportunities` | 124 | Bugün / fırsatlar |
| `renderPulse` | 109 | ⚡ Nabız |
| `loadTechnical` | 106 | Analiz |
| `renderVadeScore` | 103 | Analiz / vade skoru |
| `renderComparePicker` | 87 | Karşılaştır |
| `txnSave` | 81 | Listeler / işlem |
| `drawTAChart` + `drawBasketLine` | 146 | → victory-native / Skia |
| `renderScan` | 74 | Keşfet / tarama |
| `fillSpFa` | 73 | Analiz / temel |

**Sınır vakası — `computeVadeScore` (:1165, 153 satır):** adı motor, gövdesi DOM'a
dokunuyor. Taşımada matematiği ayırıp `/api/score`'a, çizimi native'e bölmek gerekir.
Aynı dikkat `loadTechnical` ve `fillSpFa` için de geçerli: içlerinde hesap var.

---

## Taşıma sırası (önerilen)

1. **`/api/score`** — en değerli ve en çok bağımlı olan. Bu çıkmazsa gerisi anlamsız.
2. **`/api/analyze`** — score'un üstüne oturur, tek hisse ekranını açar.
3. **`/api/recommend`** — Bugün dashboard'unu besler.
4. **`/api/compare`** + **`/api/causal`** — bağımsız, paralel gidebilir.
5. `/api/theme` zaten var; yalnız ağ katmanı temizlenir.

### Değişmez şart: skor eşitliği (parite) testi

Motor API'ye taşınırken **skor birebir aynı kalmalı.** Yöntem:

1. Sabit sembol seti belirle (20 sembol: 10 BIST + 10 ABD).
2. Mevcut web `app.js`'ten TA / FA / bileşke skorlarını dök (referans anlık görüntü).
3. Aynı seti yeni `/api/score`'dan çek.
4. **Fark 0 olmalı.** Değilse taşıma hatalı — API değil port düzeltilir.

Bu, `ELITE_ROADMAP.md` kalite listesindeki *"Motor skoru değişmedi (regresyon yok)"*
maddesinin somut karşılığıdır. **Taşıma bu test geçmeden bitmiş sayılmaz.**

### Ağırlıklar nereye gidiyor

`config.js` (141 satır) içindeki `window.TA_WEIGHTS` (:103, `app.js`'te **7 referans**)
ve `window.TA_BENCHMARK` (:141, `{ BIST:'XU100.IS', US:'^GSPC' }`) elle ayarlanmış
ağırlıklardır — **motorun gizli sosu.** Bunlar tarayıcı global'i olarak yaşıyor;
serverless/native dünyada `window` yok. API'ye taşınırken sunucu tarafında
**tek doğruluk kaynağı** olmalı: web de native de aynı ağırlığı çağırmalı,
kopyalamamalı. Aksi halde iki istemci farklı skor üretir.

---

## Bu envanterin söylemediği

- **Bağımlılık grafiği** çıkarılmadı (hangi motor fonksiyonu hangi DOM fonksiyonunu
  çağırıyor). `/api/score` taşınırken bu gerekecek — ilk somut iş bu.
- `localStorage` bağımlılıkları sayılmadı; portföy/liste durumu native'de
  Supabase + AsyncStorage'a geçecek (FAZ 2 / FAZ 4).
- Performans ölçümü yok; "hangi fonksiyon yavaş" sorusu FAZ 3'ün işi.

---

*Bilgi amaçlıdır, yatırım tavsiyesi değildir.*
