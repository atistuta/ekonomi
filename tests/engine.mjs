// =====================================================================
//  SKOR MOTORU DİLİMLEYİCİ  (tests/engine.mjs)
// ---------------------------------------------------------------------
//  app.js'i DEĞİŞTİRMEDEN, skor motorunun kaynak dilimlerini çıkarır ve
//  Node içinde çalıştırılabilir hale getirir. Amaç: motoru kopyalamadan,
//  "tek doğru kaynak" app.js kalırken dışarıdan ölçebilmek.
//
//  NEDEN KOPYALAMA YOK: motor kopyalanırsa iki sürüm doğar ve parite
//  testi kendi kopyasını doğrular — yani hiçbir şeyi. Dilimleme, test
//  her koşuda app.js'in O ANKİ halini okumaya zorlar.
//
//  ÖLÇÜLMÜŞ GERÇEK (2026-10-11): altı dilimin tamamında ekran (document/
//  innerHTML) ve depo (cacheGet/loadLists) referansı YOK. Tek istisna
//  localStorage → taScoreIndVis (gösterge aç/kapa). Motor ayrıca ZAMANDAN
//  BAĞIMSIZ: Date.now() yalnız fetchYahooOHLC'nin cache-bust satırında
//  (taşıma katmanı), new Date() yalnız KAYITLI tarihleri ayrıştırırken.
//  → Bu yüzden parite testi birebir deterministik olabiliyor.
//
//  EKRAN SABİTLERİ ARTIK YOK (2026-10-14): burada bir readRenderConstants()
//  duruyordu — app.js'teki F/K kriterini ve FA/TA harmanını REGEX ile okur,
//  üç ekran kopyasının ayrışmadığını denetlerdi. Kriter ve harman motora
//  devredildiği gün okunacak bir “ekran sabiti” kalmadı: ikisi de artık
//  EXPORTS'tan geliyor (FA_PE / faPeCriterion · COMPOSITE_BLEND /
//  compositeBlend) ve api/_ekran.js SİLİNDİ. Geri getirmeye gerek yok —
//  üç ekran kopyası kalmadığı için ayrışacak bir şey de kalmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TESTS = path.join(ROOT, 'tests');
export const FIX = path.join(TESTS, 'fixtures');

// PARITE_APP ile baska bir app.js'e yoneltilebilir. Iki isi var:
//   1) NEGATIF KONTROL: kopyada bir agirligi bozup testin GERCEKTEN
//      kirmizi yandigini kanitlamak (hep yesil yanan test hicbir sey olcmez).
//   2) Aday motoru (/api/score tasimasi) canliya dokunmadan olcmek.
// Varsayilan HER ZAMAN depodaki app.js — ortam degiskeni yoksa davranis aynidir.
const APP_PATH = process.env.PARITE_APP
  ? path.resolve(process.env.PARITE_APP)
  : path.join(ROOT, 'app.js');
const CFG_PATH = path.join(ROOT, 'config.js');

// PARITE_MOTOR=uretilmis → motor app.js'ten dilimlenmek yerine ÜRETİLMİŞ
// dosyadan yüklenir. Amacı: /api/score'un sunucuda koşturacağı dosyayı,
// canlıya dokunmadan aynı parite kapısından geçirmek.
const MOTOR_PATH = path.join(ROOT, 'api', '_motor.js');
const URETILMIS = process.env.PARITE_MOTOR === 'uretilmis';

// ---------------------------------------------------------------------
// Dilim imleri. Her im app.js'te TAM BİR KEZ geçmeli — geçmezse test
// sessizce yanlış kod ölçmek yerine gürültüyle durur.
// ---------------------------------------------------------------------
export const SLICES = [
  // fmtTRY/fmtTime, fmtDate'in 11 satir ustunde — bistFundamentalModel
  // fmtTRY'yi cagiriyor (fmtUSD ile ayni bagimlilik), bu yuzden dilim
  // yukari genisletildi.
  ['util', "  const fmtTRY = (n) => new Intl.NumberFormat('tr-TR', {", '  // ===== Döviz / Altın ====='],
  ['ysym', '  function yahooSymbol(symbol, market) {', '  async function fetchYahooChart('],
  // fetchYahooOHLC + 23 indikatör fonksiyonu + computeVadeScore: tek bitişik blok
  ['ta', '  // ===== Teknik analiz: OHLCV + indikatörler =====', '  function rankedSRZones(daily, opts) {'],
  // Mum formasyonu (G1, 2026-10-29): detectCandlePattern `ta` diliminin DIŞINDA
  // kalmıştı, bu yüzden motorda yoktu ve uç mum formasyonunu döndüremiyordu.
  // ÖLÇÜLDÜ: gövdede document/innerHTML/localStorage/fetch YOK — saf girdi-çıktı
  // (yalnız candles okur). Skora GİRMEZ (computeVadeScore onu çağırmaz); yalnız
  // taHamGostergeler ondan `code` + `sig` makine kodunu alır. Bitiş imi
  // renderTAIndicators'tan ÖNCE — o DOM yazar, dilimin dışında kaldı.
  ['mum', '  function detectCandlePattern(candles) {', '  function renderTAIndicators(symbol, market, closes, ind) {'],
  ['fa-core', '  function faInterp(x, pts) {', '  const FA_GROUPS = ['],
  // fmtTL / fmtUSD: FA modelleri NOT metinlerini bunlarla kuruyor. Skora
  // GIRMEZ ama fonksiyon yoksa model hic kurulamaz (olculdu: secFetchModel
  // 'fmtUSD is not defined' ile patliyor). Kopyalamak yerine dilimliyoruz.
  ['fmt', '  const fmtTL = (n) => {', '  // Skorlu temel panel: skor'],
  ['composite', "  const faBand = (s) => s >= 60 ? 'hi' : s < 45 ? 'lo' : 'mid';", '  async function fillComposite('],
  // Son sinir buildGrowthNote'un DEVAMINDA: computeHolisticScore onu cagiriyor,
  // yani buyume notu sinifi (cls) ayni dilimde olmak zorunda.
  ['holistic', '  function computeHolisticScore(o) {', '  function buildConjunctureNote(o) {'],
  ['fa-bist', '  async function fetchIsYatirimMali(symbol) {', '  const bistMcapCache = {};'],
  ['fa-us', '  async function secGet(url, timeout = 12000) {', '  // ===== Genel sekmesi ====='],
  // Nedensellik (📉 Gunun Nedeni) cekirdegi: CAUSAL_INDEX_AFFINITY +
  // causalAlign + computeCausalLinks. OLCULDU (2026-10-18): bu bolgede
  // document/innerHTML/fetch/localStorage YOK — saf, girdi-cikti. DOM'a
  // dokunan renderCausalLinks ve LLM stub'i causalExplainLLM dilimin
  // DISINDA kaldi (bitis imi onlardan once). /api/causal bu yuzden
  // app.js'teki mantigi YENIDEN YAZMIYOR, motordan cagiriyor.
  ['causal', '  const CAUSAL_INDEX_AFFINITY = {', '  // Faz B stub — anahtar gelince'],
  // ⚖️ Makro faz + nabiz yonu: /api/pulse icin 2026-10-19'da devredildi.
  // OLCULDU: iki bolgede de document/innerHTML/fetch/localStorage/proxy/
  // setDiag YOK — hepsi girdi-cikti. AGA CIKAN computeMacro ve
  // computePulseMacro bitis imlerinin DISINDA kaldi; bu yuzden ucun
  // esikleri YENIDEN YAZMASI gerekmiyor, motordan cagiriyor.
  ['makro-faz', '  const CYCLE_PHASES = {', '  // Makro nabzını hesapla'],
  ['nabiz-yon', "  const RATE_SENSITIVE = ['tech'", '  async function computePulseMacro(force) {'],

  // --- Nabiz gun-ici cekirdegi (2026-11-03, S8 #1/#6) ---
  // SORUN: `analyzeIntraday` app.js 11973'te, poll.js 237'de ve
  // worker/movers.mjs 72'de UC KEZ yaziliydi (olculdu: ayni formuller,
  // yedi kucuk fark - girdi sekli, `<3` korumasinin yeri, `||` vs `??`,
  // `prevClose` zinciri, `breakout`/`spark` yalniz app'te). Ucunden de
  // UCA cikan sayi YOK: `/api/chart` yalniz ham `mumlar[]` donduruyordu,
  // yani native `dayChg`/`hourChg`/`rvol`/`breakout` goremiyordu.
  //
  // IKI DILIM, CUNKU ARALARI KIRLI: 11944 `pulseSymbols` getPortfolio/
  // loadLists okuyor, 11999 `pulseWhyThemes` modul durumu (`pulseThemes`)
  // okuyor. Ikisi de dilimlerin DISINDA kaldi; esikler ile saf gun-ici
  // hesabi ayri ayri alindi.
  //
  // OLCULDU: iki bolgede de document./innerHTML/getElementById/
  // localStorage/fetch/proxy/setDiag/taAllSymbols/getPortfolio/loadLists
  // desenlerinin HICBIRI yok.
  ['nabiz-esik', '  const PULSE_TH = {', '  function pulseSymbols() {'],
  ['nabiz-gunici', '  function analyzeIntraday(candles, meta) {',
    '  // Neden yükseldi/düştü? → sembolün sektörünü etkileyen SICAK gündem temaları'],

  // FIYAT-YALANLAMA CEKIRDEGI (2026-11-03, S8 #1/#6 ikinci katman).
  // `pulseMacroReality` KENDISI dilimlenemez: HTML uretiyor ve modul
  // durumu (`macroBreadthSeen`) okuyor. O yuzden olcum `pulseRealityCodes`
  // adli SAF cekirdege cikarildi; web kabugu artik ondan HTML oruyor
  // (cikti birebir ayni). Dilim PMAC esikleriyle BASLIYOR cunku
  // karsilastirma sayilari cekirdekle AYNI YERDE durmali.
  // OLCULDU: bolgede document./innerHTML/getElementById/localStorage/
  // fetch/proxy/macroBreadthSeen desenlerinin HICBIRI yok.
  ['nabiz-gerceklik', '  const PMAC_BREADTH_WEAK = 45,',
    '  // ---- WEB KABUGU (dilim burada biter) ----'],

  // --- B1 (2026-10-26): sekiz SAF blok daha devredildi. Hepsinde OLCULDU:
  // document./innerHTML/getElementById/querySelector/localStorage/
  // addEventListener/fetchRSS/proxy(/setDiag/taAllSymbols/getPortfolio/
  // loadLists desenlerinin HICBIRI yok. app.js mantigina dokunulmadi —
  // yalniz dilim sinirlari eklendi, motorun urettigi sayilar aynidir.

  // Backtest cekirdegi. Sinir YUKARI genisletildi: computeBacktest
  // TA_HORIZON + BT_CFG + spearmanIC'i cagiriyor, ucu dilimde olmazsa
  // fonksiyon kurulur ama cagrilinca patlar. Bitis imi runBacktest'ten
  // ONCE: runBacktest panel DOM'u yazar, dilimin DISINDA kaldi.
  ['backtest', '  // ===== Doğruluk testi (backtest) =====', '  async function runBacktest(symbol, market, vade) {'],

  // shortNum: kripto NOT metinlerini bununla kuruyor (fmt dilimindeki
  // fmtTL/fmtUSD ile ayni gerekce — skora GIRMEZ ama yoksa model hic
  // kurulamaz). Kendi dilimi, cunku 6800-6930 arasi kripto EKRANI (DOM).
  ['fmt-kisa', '  const shortNum = (v) => {', "  // CoinGecko piyasa verisi (market cap / hacim / arz / ATH) — cache'li"],

  // Kripto deger/tokenomik skoru. Sinir YUKARI genisletildi: scoreBand ve
  // cryptoCategory computeCryptoValue'nun on kosulu. Bitis imi
  // valuePanelHTML'den ONCE — panel HTML'i dilimin disinda.
  ['crypto', '  function scoreBand(s, labels) {', '  function valuePanelHTML(title, res, srcNote, tailNote) {'],

  // Maden makro rejimi. Sinir YUKARI genisletildi: METAL_MACRO_W agirliklari
  // ve computeMetalMacro (asil skorlayici) iceride. metalMacroInputs de
  // iceride ama DISA VERILMIYOR: changeFor/getQuote tasima katmanini
  // cagiriyor, onlar motorda yok — girdi uca `d` olarak gelir.
  ['metal', '  const METAL_MACRO_W = {', '  function metalMacroHTML(key, d) {'],

  // Haber duygu sozlugu + basliga puan. Sinir YUKARI genisletildi:
  // SENTI_POS/SENTI_NEG sozlukleri olmadan scoreHeadline calismaz.
  // Bitis imi computeNewsSentiment'tan ONCE — o RSS'e gidiyor.
  ['haber-skor', '  const SENTI_POS = {', "  // Bir hisse için haber duyarlılık skoru (cache'li, 30 dk)"],

  // Firsat etiketi + fiyat uygunlugu puani. priceOppChip de iceride ama
  // DISA VERILMIYOR: bandUzaklikTxt (5089) dilimin cok disinda ve chip
  // zaten HTML uretir. Bitis imi renderOpportunities'ten ONCE.
  ['firsat', '  function oppTag(score) {', '  async function renderOpportunities(force) {'],

  // Tarama (Deger/Buyume/Kalite) presetleri + alt-skorlar. Tek dis
  // bagimliligi faInterp — fa-core diliminde zaten var. Bitis imi
  // initScan'den ONCE: initScan chip'lere olay bagliyor.
  ['scan', '  const SCAN_PRESETS = {', '  function initScan() {'],

  // Sektor gruplama/siralama. Sinir YUKARI genisletildi: SEK_META +
  // sekMedian + sekClassify olmadan gruplar kurulamaz. sekBuildGroups
  // DISA VERILMIYOR: modul seviyesindeki sekMem onbellegini okur, motorda
  // o onbellek bos kalir — uca sessizce bos liste donmesin.
  ['sektor', '  const SEK_META = {', '  function sekMiniHtml(g, lead) {'],

  // Radar sozlukleri: SECTORS + SYMBOL_SECTORS + RADAR_THEMES. Dilim
  // 10303'te BITER. 10304'teki radarUniverse/recommendUniverse
  // taAllSymbols() ile KULLANICININ listesini okuyor; motor kullanici
  // verisi okumaz, evren uca `symbols` parametresi olarak gelir.
  ['radar', '  const SECTORS = {', '  function radarUniverse() {'],

  // S8 #10a (2026-10-31): kiyas tablosunda satir bazli en iyi/en kotu
  // sutunu bulan SAF karsilastirma. Dilim YALNIZ rowExtrema'yi aliyor;
  // COMPARE_ROWS (12595) BILEREK DISARIDA — icinde `xf: trIndustry`
  // fonksiyon referansi ve Turkce `label`/`hint` metni var, ikisi de
  // motora girmemeli (ReferenceError + HAM SAYI kurali). Satir tarifi
  // (key/type/dir) uca ait makine tablosu olarak kaliyor. Bitis imi
  // yfinQuery'den ONCE: o aga gidiyor.
  ['kiyas-uc', '  function rowExtrema(row, metrics) {', '  async function yfinQuery(ysyms) {'],

  // S8 #11 (2026-10-31): bilanco senaryosu (Boga/Baz/Ayi). ENVANTER
  // NOTU YANLIS CIKTI: api/_kesif.js:1061 "Senaryo matematigi
  // (`earnScenario`) BICIMLEME, uca girmez" diyordu — OLCULDU, icinde
  // K=2.0 tepki katsayisi, CAP=0.40 tavani ve dagilim aritmetigi var
  // (app.js:9535-9549). Bicimleme degil, ISTEMCI FORMULU; §5.1 geregi
  // motora tasindi. Dilim YALNIZ earnScenario'yu aliyor; bitis imi
  // initEarn'den ONCE (o DOM'a olay bagliyor).
  ['earn-senaryo', '  function earnScenario(res) {', '  function initEarn() {'],

  // S8 #8a (2026-11-02): tema adayi <-> haber eslesmesi. OLCULDU: web bu
  // isi TARAYICIDA yapiyor ve icinde ESIK var — anlamli sozcuk >=4 harf,
  // TEMA_TASIYICI durak sozcuk listesi, sembol kelime-siniri regexi.
  // `/api/news?q=` ilgi suzgeci UYGULAMIYOR (olculdu: api/_haber.js
  // icinde temaBaslikIlgili yok), yani ince istemci ya bu kurali
  // kopyalayacak (S5.1 ihlali) ya da tema haberleri eksik kalacakti.
  //
  // UC DILIM, BIR OZELLIK: aradaki `themeFetchLLM` ve `themeFetchNews`
  // AG CAGIRAN islevler — dilime GIRMEZ (motorda `fetch` yok). Bu yuzden
  // bitisik bir bolge kesilemedi.
  ['tema-norm', '  // LLM adayı → {base, market, yahoo} normalize',
    '  // Semantik adayları Claude ucundan al'],
  ['tema-ilgi', '  // NE: Google News RSS,',
    '  // Google News (US+TR) → birleşik başlık listesi'],
  ['tema-kanit', '  // Bir adayın haberde geçip geçmediğini sapta',
    '  // NE: insan-okunur Google Haberler SAYFASI (RSS DEĞİL).'],

  // GUNDEM (agendaScore) — "Gunun Gundemi" kavram motoru. IKI DILIM,
  // BIR OZELLIK: aradaki `let agendaBusy = false;` bir EKRAN KILIDI
  // (iki istegin ayni anda yenilemesini onluyor) — motorda mutable
  // modul durumu tutmanin anlami yok, bu yuzden ikiye bolundu.
  //
  // OLCULDU: iki dilimde document/innerHTML/fetch/cacheGet YOK; tek
  // `localStorage` ve `cacheGet/cacheSet` gecisi YORUM icinde (app.js
  // 11278 ve 11385) — kod degil.
  //
  // BAGIMLILIK: agendaScore `scoreHeadline` + `sentiLabel` cagiriyor,
  // ikisi de 'haber-skor' diliminde ve ONCE geliyor.
  //
  // DISA VERILMEYEN: `computeAgenda` (AGA CIKIYOR: fetchRSS + cache) ve
  // `agendaMatchedStocks` (KULLANICI EVRENINE bakiyor → saf degil).
  // Cekme isi `api/_gundem.js`in, evren isi cagiranin.
  ['gundem-sozluk', '  const AGENDA_LEXICON = [', '  let agendaBusy = false;'],
  ['gundem-skor', '  function agendaCleanTitle(t) {', '  async function computeAgenda(force) {'],
  // S8 #1/#6 beşinci katman (2026-11-03): ENDEKS EŞİK TABLOSU.
  // SORUN ÖLÇÜLDÜ: `/api/causal` `hareketler[].notable` alanını
  // İSTEMCİDEN zorunlu istiyordu (api/causal.js:170), ama `notable`
  // app.js'te bir ekran sabiti olarak duruyordu (INDEX_PULSE) ve
  // HİÇBİR uç onu döndürmüyordu — yani native istemci ya eşiği kendi
  // iline yazacak (§5.1 ihlali) ya da nedensellik bağlarını hiç
  // isteyemeyecekti. §5.1 gereği eşik motora taşındı.
  // Dilim YALNIZ `INDEX_ESIK`i alıyor; `INDEX_PULSE` BİLEREK DIŞARIDA —
  // içinde emoji, Türkçe `name` ve pazar kodu var, üçü de SUNUM.
  // Bitiş imi `INDEX_PULSE` bildiriminin kendisi.
  ['endeks-esik', '  const INDEX_ESIK = {', '  const INDEX_PULSE = ['],
];

// Dilimlerden dışarı verilecek motor sembolleri.
export const EXPORTS = [
  'fetchYahooOHLC', 'yahooSymbol', 'resampleCandles', 'taTFIndicators', 'taRegime',
  'taNormalize', 'computeVadeScore', 'setTaScoreInd',
  'faInterp', 'faSD', 'faScoreSig', 'computeFaScore', 'faVerdict',
  // Ekran katmanından 2026-10-14'te devredildi (Commit C): F/K kriteri ve
  // FA/TA harmanı. Önceden app.js'te üçer kopyaydılar ve motorun
  // dışında kaldıkları için /api/score kullanıcının GÖRDÜĞÜ skoru
  // döndüremiyordu.
  'FA_PE', 'faPeCriterion', 'faKriterKod', 'faKriterIsaretle',
  'faBand', 'taBand', 'COMPOSITE_MATRIX', 'COMPOSITE_BLEND', 'compositeBlend',
  'computeHolisticScore',
  // Plan katmanı: 2026-10-14'te ekran katmanından devredildi (D1).
  // momentumInfo + buyZoneProximity app.js'in sunum bölgesindeydi, risk/ödül
  // çekirdeği computeCompareVerdict'in içine gömülüydü; motor seviyeleri
  // (levels) üretiyordu ama PLANI üretmiyordu, yani /api/recommend kullanıcının
  // GÖRDÜĞÜ planı döndüremezdi. Türkçe cümleler çağrı noktasında kaldı.
  'momentumInfo', 'buyZoneProximity', 'planRiskReward',
  // #14 (2026-11-03): `atr / price * 100` app.js'te IKI YERDE hesaplaniyordu
  // ve IKI FARKLI soruya cevap veriyordu (uc kademeli oynaklik sinifi ile
  // SESSIZ ORTA BANDI olan plan/stop uyarisi). Ikisini tek kazanana
  // indirmek webdeki bir davranisi sessizce silerdi; bu yuzden IKI AYRI
  // makine kodu. Ikisi de `ta` diliminin ICINDE (planRiskReward'in
  // ardinda) - yeni dilim GEREKMEDI.
  'atrVolKod', 'atrPlanKod',
  // (G) 2026-11-05: katalizor/risk satirinin YAKLASAN TEMETTU bacagi.
  // Esik (45 gun) ve gun farki hesabi webde TARAYICIDA duruyordu
  // (fillCatalysts). Native istemci hesap yapmaz, esik tasimaz -> karar
  // motora, hesap /api/katalizor ucuna tasindi. Gun farki ile esik
  // karari AYRI iki soru oldugu icin AYRI iki fonksiyon.
  'KAT_TEMETTU_GUN', 'KAT_TEMETTU_KODLARI', 'katGunFarki', 'katTemettuKod',
  // G1 (2026-10-29): ham gösterge sözlüğü. /api/score + /api/analyze bu iki
  // sembol olmadan ekranın bastığı HAM sayıları döndüremiyordu (ölçüldü: hiçbir
  // uç ema20/rsi/macd/boll/obv/ichimoku ham değerini taşımıyordu). detectCandlePattern
  // DIŞA VERİLMİYOR: Türkçe `name`/`txt` üretir — uca yalnız `code` + `sig` gider,
  // onu da taHamGostergeler taşıyor (HAM SAYI kuralı).
  'taHamGostergeler', 'taHamUcGostergeler',
  'fetchIsYatirimMali', 'parseIsMali', 'bistFundamentalModel',
  'secGet', 'secResolveCik', 'secFetchModel',
  // Nedensellik katmani: 2026-10-18'de /api/causal icin devredildi.
  // SKORA DOKUNMAZ — composite/vade skorunu ne okur ne yazar; yalniz
  // "hangi gundem konsepti bu endeks hareketiyle hizali" korelasyon
  // okumasidir. Turkce cumle yine cagri noktasinda.
  'CAUSAL_INDEX_AFFINITY', 'causalAlign', 'computeCausalLinks',
  // S8 #1/#6 beşinci katman: endeks "belirgin"/"sert" eşikleri.
  // Ucun `notable`ı istemciden istemek zorunda kalmaması için dışa
  // verildi — eşik motorda kalır, istemci yalnız `kind` + `pct` yollar.
  'INDEX_ESIK',
  // Makro/nabiz katmani: 2026-10-19'da /api/pulse icin devredildi.
  // SKORA DOKUNMAZ. Turkce cumleler (CYCLE_PHASES.label, PMAC_STANCE_TR)
  // BILEREK dısarı verilmiyor — HAM SAYI kurali: uc yalniz kod dondurur.
  'CYCLE_PHASES', 'macroGrowth', 'macroPhase',
  // B5 (2026-10-27): computeMacro'nun ICINDEN cikarilan iki SAF baski
  // hesabi. Esik (0.15), bolen (10) ve ton artisi (0.15) DEGISMEDI —
  // yalniz artik dilimlenebilir bir fonksiyon govdesinde. Ucun kendi
  // enflasyon/risk sayisini uretebilmesi icin disa verilmeleri gerekti.
  'macroInflPressure', 'macroRiskPressure',
  // Tema isisi: /api/theme + /api/radar ayni isi iki yerde yapmasin diye.
  'themeHeat',
  // S8 #10a: kiyas satiri ekstremi. Motorda cunku "en iyi/en kotu" bir
  // KARSILASTIRMA KURALI — istemcide esik/kiyas yasak (§5.1). Uc yalniz
  // satir tarifini verip sonucu tasiyor.
  'rowExtrema',
  // S8 #11: bilanco senaryosu — tepki katsayisi/tavan motorda.
  'earnScenario',
  // S8 #8a: tema haber eslesmesi — esik (>=4 harf) ve durak sozcuk
  // listesi motorda.
  'themeNorm',
  'temaSorguSozcukleri',
  'temaBaslikIlgili',
  'themeMatchNews',
  'themeNewsHits',
  'FADE_WIN', 'fadedAround', 'rateDirection', 'inflDirection',
  'RATE_SENSITIVE', 'pulseRecentCount',
  'PULSE_FRESH_H', 'PULSE_FRESH_W', 'pulseFreshWithin', 'pulseFreshWeight', 'pulseStance',
  // S8 #1/#6 (2026-11-03): gun-ici nabiz cekirdegi. `PULSE_TH` disa
  // veriliyor cunku `pulseIsSudden` donusunde `th`'yi ZATEN tasiyor —
  // uc esikleri YENIDEN YAZMASIN diye motordan okuyor.
  'PULSE_TH', 'analyzeIntraday', 'pulseIsSudden',
  // S8 #1/#6 ikinci katman: fiyat-yalanlama. Esikler (45/55/30dk/6/0.70/
  // 1.0) DISA VERILMIYOR — uc onlari ne okuyor ne yaziyor; yalniz
  // `pulseRealityCodes` donusundeki `kod`lari tasiyor.
  'pulseRealityCodes',
  // Makro yorumun KODLARI ve ani-hareket satirinin makro etiketi:
  // cumle/HTML uretmiyorlar, web kabugu ve uc ayni kodlardan okuyor.
  'pulseMakroEtiketKod',
  'pulseMakroYorumKod',
  // B1 (2026-10-26) sekiz yeni dilimden DISA VERILENLER. Hicbiri skoru
  // degistirmez — composite/vade skorunu ne okur ne yazar. Disa VERILMEYENLER
  // ve nedenleri dilim yorumlarinda yazili (metalMacroInputs, priceOppChip,
  // sekBuildGroups, scanCrit, valuePanelHTML tarafi).
  'TA_HORIZON', 'BT_CFG', 'spearmanIC', 'computeBacktest',
  'shortNum',
  'scoreBand', 'cryptoCategory', 'computeCryptoValue',
  'METAL_MACRO_W', 'computeMetalMacro',
  'SENTI_POS', 'SENTI_NEG', 'scoreHeadline', 'sentiLabel', 'sentiAggregate',
  // "Neden hareket ediyor?" ham kod katmani (S34). Skora GIRMEZ: hareketi
  // haber akisiyla uzlastiran yorum katmani. Turkce cumle DONDURMEZ,
  // yalniz kapali kod kumesi — cumle web ekraninda / sozluk.ts'te secilir.
  'WHY_SERT', 'WHY_BELIRGIN', 'WHY_HABER_ESIK',
  'WHY_HAREKET_KODLARI', 'WHY_YON_KODLARI', 'WHY_HABER_YON_KODLARI',
  'WHY_UZLASMA_KODLARI', 'WHY_KUTUP_KODLARI',
  'whyGunlukYuzde', 'whyHareketKod', 'whyYonKod', 'whyHaberYonKod',
  'whyUzlasmaKod', 'whyKutupKod',
  'oppTag', 'priceOppAdj', 'oppCombined',
  'SCAN_PRESETS', 'scanBlend', 'scanScore', 'scanTag',
  'SEK_META', 'sekMedian', 'sekClassify', 'sekSortGroups',
  'SECTORS', 'SYMBOL_SECTORS', 'RADAR_THEMES',
  // Gundem motoru (S20.14). Hicbiri skoru degistirmez: TA/FA/bileske
  // ne okuyor ne yaziyor — sunum + haber katmani.
  'AGENDA_LEXICON', 'AGENDA_STOP', 'AGENDA_VALUE_SECTORS',
  'agendaKwHit', 'agendaStemHit', 'agendaAdmit', 'agendaCleanTitle',
  'agendaScore',
];

function countOf(src, needle) {
  let n = 0, i = 0;
  for (;;) {
    const k = src.indexOf(needle, i);
    if (k < 0) return n;
    n++; i = k + 1;
  }
}

function sliceOne(src, name, from, to) {
  const cf = countOf(src, from), ct = countOf(src, to);
  if (cf !== 1) throw new Error(`dilim "${name}": baslangic imi ${cf} kez gecti (1 beklenir)\n  im: ${from}`);
  if (ct !== 1) throw new Error(`dilim "${name}": bitis imi ${ct} kez gecti (1 beklenir)\n  im: ${to}`);
  const a = src.indexOf(from), b = src.indexOf(to);
  if (b <= a) throw new Error(`dilim "${name}": bitis imi baslangictan ONCE geliyor`);
  return src.slice(a, b);
}

// config.js'i (window.TA_WEIGHTS / TA_BENCHMARK) tarayıcı olmadan yükle.
// DIŞA VERİLİ: tools/motor-uret.mjs api/_ayar.js'ü bundan üretiyor. İkinci bir
// uygulama yazılırsa iki ayar okuyucu doğar ve üretim testi kendi kopyasını
// doğrular — motor metninde olduğu gibi burada da tek kurulum yeri var.
export function loadConfig() {
  const w = {};
  const src = fs.readFileSync(CFG_PATH, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + src)(w);
  if (!w.TA_WEIGHTS) throw new Error('config.js: window.TA_WEIGHTS yuklenemedi');
  if (!w.TA_BENCHMARK) throw new Error('config.js: window.TA_BENCHMARK yuklenemedi');
  return w;
}

// Ekran erişimi olursa sessizce undefined dönmesin — adıyla patlasın.
function deadProxy(label) {
  return new Proxy({}, {
    get(_t, k) { throw new Error(`motor dilimi ekrana dokundu: ${label}.${String(k)} — dilim sinirlari yanlis`); },
    set(_t, k) { throw new Error(`motor dilimi ekrana yazdi: ${label}.${String(k)} — dilim sinirlari yanlis`); },
  });
}

// ---------------------------------------------------------------------
//  MOTOR METNİ — tek kurulum yeri.
//  Hem test (bellek içinde `new Function`) hem üretici
//  (tools/motor-uret.mjs → api/_motor.js) AYNI metni buradan kurar. İkisi
//  metni ayrı ayrı kurarsa iki motor doğar ve üretim testi kendi kopyasını
//  doğrular — yani hiçbir şeyi.
// ---------------------------------------------------------------------
export const PREAMBLE = [
  '"use strict";',
  '// --- konak kabukları: motor bunları yalnız ÇAĞIRIR, içeriğini bilmez ---',
  'const window = H.window;',
  'const localStorage = H.localStorage;',
  'const fetch = (...a) => H.fetch(...a);',
  'const fetchVia = (...a) => H.fetchVia(...a);',
  'const proxy = (url) => url;              // Node\'da CORS yok → vekil gereksiz',
  'const setDiag = () => {};                // tanı rozetleri ekrana aittir',
  'const document = H.dead("document");     // erişilirse adıyla patlar',
  'const navigator = H.dead("navigator");',
  '',
].join('\n');

/** Depodaki app.js'i oku (PARITE_APP ile başka bir adaya yöneltilebilir). */
export function readApp() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

/**
 * app.js metninden motor gövdesini kur — dilimle, başa kabukları koy, sonuna
 * `return {...}` ekle.
 * @returns {{parts:{name:string,code:string}[], body:string, tail:string, govde:string}}
 *   `govde` iki yerde AYNEN kullanılabilir: `new Function('H', govde)` ve
 *   `function buildMotor(H) { <govde> }` — çünkü bir `return` ile bitiyor.
 */
export function engineSource(app) {
  const parts = SLICES.map(([n, a, b]) => ({ name: n, code: sliceOne(app, n, a, b) }));
  const body = parts.map((p) => `// ===== dilim: ${p.name} =====\n${p.code}`).join('\n');
  const tail = `\nreturn { ${EXPORTS.join(', ')} };\n`;
  return { parts, body, tail, govde: PREAMBLE + body + tail };
}

/** Dilim adı + satır sayısı. api/_motor.js bunu gömülü taşır (app.js okumadan). */
export function sliceInfo(parts) {
  return parts.map((p) => ({ name: p.name, lines: p.code.split('\n').length }));
}

/**
 * Konak kabuğu: motorun dışarıdan gördüğü HER ŞEY. Motor bunları yalnız
 * ÇAĞIRIR, içeriğini bilmez — aynı motor bu yüzden testte fikstürle,
 * sunucuda gerçek ağla koşabiliyor.
 * @param {object} opt
 * @param {(url:string)=>Promise<Response>} [opt.fetch]    ağ kabuğu (fetchYahooOHLC + secGet kullanır)
 * @param {(url:string,o?:object)=>Promise<string>} [opt.fetchVia]  İş Yatırım metin kabuğu
 * @param {object} [opt.taScoreInd]  gösterge aç/kapa (varsayılan: hepsi açık = {})
 */
export function makeHost(opt = {}) {
  const noNet = async () => { throw new Error('ag kabugu verilmedi: parite kosusunda canli istek YASAK'); };
  let cfg = null;
  const CFG = () => (cfg || (cfg = loadConfig()));   // config.js yalnız gerekirse okunur
  return {
    window: {
      TA_WEIGHTS: opt.window?.TA_WEIGHTS ?? CFG().TA_WEIGHTS,
      TA_BENCHMARK: opt.window?.TA_BENCHMARK ?? CFG().TA_BENCHMARK,
      // secGet: `if (!base) return null` — BOŞ OLAMAZ. Varsayılan önek, kabuğun
      // decodeURIComponent ile gerçek URL'yi geri çıkarması için bir işaretçidir.
      MY_PROXY: opt.myProxy ?? 'fixture:',
    },
    localStorage: {
      getItem: () => (opt.taScoreInd ? JSON.stringify(opt.taScoreInd) : null),
      setItem: () => {},
    },
    fetch: opt.fetch || noNet,
    fetchVia: opt.fetchVia || noNet,
    dead: deadProxy,
  };
}

/**
 * Motoru kur ve sembollerini döndür.
 *
 * İKİ ŞERİT — ikisi de AYNI motor metnini koşturur:
  *   · varsayılan              → app.js dilimlenir, `new Function` ile derlenir
  *   · PARITE_MOTOR=uretilmis  → api/_motor.js DOSYASI yüklenir
 *
 * İkinci şerit /api/score'un sunucuda koşturacağı dosyayı ölçer. O dosya
 * app.js'ten ÜRETİLDİĞİ ve tests/uretim-test.mjs eşitliğini kanıtladığı için
 * bir kopya değil, aynı metnin ikinci taşıyıcısıdır.
 */
export function buildEngine(opt = {}) {
  const host = makeHost(opt);

  let api, dilimler;
  if (URETILMIS) {
    // createRequire: senkron require ile ESM yüklenebiliyor (Node 24, ölçüldü).
    // buildEngine'in SENKRON kalması zorunlu — dört çağrı yerinin hepsi öyle,
    // bu yüzden `await import` kullanılamıyor. Çapa Windows mutlak yolu olmak
    // zorunda: file:/// URL çapası reddediliyor.
    const req = createRequire(path.join(ROOT, 'package.json'));
    let mod;
    try {
      mod = req(MOTOR_PATH);
    } catch (e) {
      throw new Error(`uretilmis motor yuklenemedi: ${MOTOR_PATH}\n  ${e.message}\n  once uret: node tools/motor-uret.mjs`);
    }
    if (typeof mod.buildMotor !== 'function') throw new Error('uretilmis motor buildMotor() disa vermiyor');
    api = mod.buildMotor(host);
    dilimler = mod.DILIMLER;
  } else {
    const src = engineSource(readApp());
    try {
      // eslint-disable-next-line no-new-func
      api = new Function('H', src.govde)(host);
    } catch (e) {
      throw new Error('motor dilimleri derlenemedi: ' + e.message);
    }
    dilimler = sliceInfo(src.parts);
  }

  for (const k of EXPORTS) {
    if (api[k] === undefined) throw new Error(`motor sembolu bulunamadi: ${k} — dilim imleri kaymis olabilir`);
  }
  api._slices = dilimler;
  api._weights = host.window.TA_WEIGHTS;
  api._bench = host.window.TA_BENCHMARK;
  api._serit = URETILMIS ? 'uretilmis' : 'dilim';
  return api;
}

export function readSymbols() {
  const j = JSON.parse(fs.readFileSync(path.join(TESTS, 'symbols.json'), 'utf8'));
  return {
    vade: j.vade,
    rows: [
      ...j.bist.map((r) => ({ ...r, market: 'BIST' })),
      ...j.us.map((r) => ({ ...r, market: 'US' })),
    ],
  };
}

// Kendi kendini sınama: `node tests/engine.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const e = buildEngine();
  const total = e._slices.reduce((a, s) => a + s.lines, 0);
  console.log(`serit: ${e._serit}`);
  console.log('dilimler:');
  for (const s of e._slices) console.log(`  ${s.name.padEnd(10)} ${String(s.lines).padStart(5)} satir`);
  console.log(`  ${'TOPLAM'.padEnd(10)} ${String(total).padStart(5)} satir`);
  console.log(`motor sembolu: ${EXPORTS.length} adet, hepsi bulundu`);
  console.log(`TA_WEIGHTS vadeleri: ${Object.keys(e._weights).join(', ')}`);
  console.log(`TA_BENCHMARK: ${JSON.stringify(e._bench)}`);
  const s = readSymbols();
  console.log(`referans evreni: ${s.rows.length} sembol (vade=${s.vade})`);
}
