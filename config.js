// Portföyünü buradan düzenle.
// BIST: { symbol, query, market: 'BIST' }
// ABD ETF/hisseleri: { symbol, query, market: 'US' }

window.PORTFOLIO = [
  // --- BIST ---
  { symbol: 'DOAS',  query: 'DOAS Doğuş Otomotiv',     market: 'BIST' },
  { symbol: 'BIMAS', query: 'BIMAS BIM',               market: 'BIST' },
  { symbol: 'HLGYO', query: 'HLGYO Halk GYO',          market: 'BIST' },
  { symbol: 'TUPRS', query: 'TUPRS Tüpraş',            market: 'BIST' },
  { symbol: 'ENJSA', query: 'ENJSA Enerjisa',          market: 'BIST' },

  // --- ABD ETF ---
  { symbol: 'SOXX',  query: 'SOXX semiconductor ETF',  market: 'US' },
  { symbol: 'UFO',   query: 'UFO Procure Space ETF',   market: 'US' },
  { symbol: 'VGT',   query: 'VGT Vanguard Technology', market: 'US' },
  { symbol: 'QCLN',  query: 'QCLN clean energy ETF',   market: 'US' },
  { symbol: 'VXUS',  query: 'VXUS Vanguard Total International', market: 'US' },
  { symbol: 'ARKG',  query: 'ARKG ARK Genomic ETF',    market: 'US' },

];

// İzleme listesi (sahip değilsin ama takip etmek istediklerin)
window.WATCHLIST = [
  // Örnek: kendi izleme listenle değiştir
  { symbol: 'ASELS', query: 'ASELS Aselsan', market: 'BIST' },
  { symbol: 'KCHOL', query: 'KCHOL Koç Holding', market: 'BIST' },
  { symbol: 'NVDA',  query: 'NVDA Nvidia', market: 'US' },
];

// Madenler — ayrı bölüm
window.METALS = [
  {
    symbol: 'ALTIN',
    name: 'Altın',
    truncgilKey: 'gram-altin',
    queryTR: 'altın fiyat piyasa',
    queryWORLD: 'gold price market',
  },
  {
    symbol: 'GÜMÜŞ',
    name: 'Gümüş',
    truncgilKey: 'gumus',
    queryTR: 'gümüş fiyat piyasa',
    queryWORLD: 'silver price market',
  },
  {
    symbol: 'PLATİN',
    name: 'Platin',
    truncgilKey: 'platin',
    queryTR: 'platin fiyat piyasa',
    queryWORLD: 'platinum price market',
  },
];

// Genel ekonomi haberleri için RSS kaynakları
window.GENERAL_FEEDS = [
  // Türkiye — bağımsız / muhalif ekonomi kaynakları
  { name: 'Bloomberg HT',     url: 'https://www.bloomberght.com/rss',                   region: 'TR' },
  { name: 'Dünya Gazetesi',   url: 'https://www.dunya.com/rss?dunya',                   region: 'TR' },
  { name: 'T24 Ekonomi',      url: 'https://t24.com.tr/rss/category/ekonomi',           region: 'TR' },
  { name: 'Cumhuriyet Ekonomi', url: 'https://www.cumhuriyet.com.tr/rss/4.xml',         region: 'TR' },
  { name: 'Sözcü Ekonomi',    url: 'https://www.sozcu.com.tr/rss/ekonomi.xml',          region: 'TR' },
  { name: 'DW Türkçe Ekonomi', url: 'https://rss.dw.com/rdf/rss-tur-eco',               region: 'TR' },

  // Dünya
  { name: 'Reuters Business', url: 'https://news.google.com/rss/search?q=site:reuters.com+business&hl=en-US&gl=US&ceid=US:en', region: 'WORLD' },
  { name: 'BBC Business',     url: 'https://feeds.bbci.co.uk/news/business/rss.xml',    region: 'WORLD' },
  { name: 'CNBC Top News',    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', region: 'WORLD' },
  { name: 'Financial Times',  url: 'https://news.google.com/rss/search?q=site:ft.com&hl=en-US&gl=US&ceid=US:en', region: 'WORLD' },
];

// KAP (Türkiye - tüm portföy için ortak feed; cardlarda ticker'a göre filtrelenir)
window.KAP_RSS = 'https://www.kap.org.tr/tr/api/disclosures/rss';

// CORS proxy — KAP, Yahoo, isyatirim gibi CORS engelli kaynaklar için
window.CORS_PROXY = 'https://corsproxy.io/?';

// ⭐ KENDİ PROXY'N (Vercel'e deploy ettikten sonra buraya yapıştır)
// Örnek: 'https://sabah-bulteni-abc.vercel.app/api/proxy?url='
// Boş bırakırsan halka açık proxy'lere düşer (güvenilir değil).
window.MY_PROXY = 'https://day-starter.vercel.app/api/proxy?url=';

// Push bildirimleri için ntfy.sh konu adı (benzersiz olmalı, tahmin edilemez)
// Telefonunda ntfy uygulamasını kur, bu konuya abone ol: https://ntfy.sh/<KONU>
window.NTFY_TOPIC = 'sabah-bulteni-7f3k9d2x'; // BENZERSIZ değiştir!

// ===== Teknik Analiz: Vade-bazlı skorlama ağırlıkları =====
// 0–100 skor: 50 üstü AL, 50 altı SAT. Her vade kendi zaman dilimi karışımını (confluence)
// ve gösterge ağırlıklarını kullanır. Ağırlıklar araştırma temelli başlangıç değerleridir
// (kısa vade: reversal + hacim; uzun vade: trend dominant). Kod ağırlıkları mevcut
// göstergelere göre normalize eder — toplamın tam 1.0 olması şart değil.
// interp: 'reversal' (RSI/Stokastik/Bollinger aşırı alım-satım okunur) | 'momentum' | 'trend'
//   NOT: v64 ile RSI/Stokastik REJİM-KOŞULLU okunur — güçlü trendde (ADX≥22 & fiyat>SMA50>SMA200)
//   'reversal' otomatik 'momentum'a döner (RSI 70 artık "sat" değil, momentum teyidi; sadece
//   negatif uyumsuzluk cezalandırılır). Yataylaşan piyasada (ADX<18) klasik reversal korunur.
//   Buradaki interp yalnızca "varsayılan/nötr rejim" okumasıdır.
// blend: hangi zaman diliminden ne kadar (D=günlük, W=haftalık, M=aylık, H1=saatlik, M15=15dk)
// intraday:true olan vade günlük yerine saatlik/15dk veri çeker; order flow gün içinde
// gerçekten değerli olduğu için ağırlığı burada yüksektir (araştırma: OF yalnız intraday'de öncü).
// Yeni göstergeler (v64): rs = Göreli Güç (endekse karşı, O'Neil/Minervini), volconf = Hacim Teyidi
// (kırılım hacimle mi? sahte kırılım filtresi), ttmpl = Trend Şablonu (Minervini kalite kapısı).
window.TA_WEIGHTS = {
  gunici: {
    label: 'Gün içi',
    desc: '≈ 1–5 gün ufuk · 60dk + 15dk · order flow ağırlıklı',
    intraday: true,
    blend: [ { tf: 'H1', w: 0.55 }, { tf: 'M15', w: 0.45 } ],
    interp: 'reversal',
    adxTf: 'H1',
    weights: { trend: 0.06, macd: 0.13, rsi: 0.13, stoch: 0.13, boll: 0.11, obv: 0.08, vp: 0.12, oflow: 0.16, volconf: 0.08 },
  },
  kisa: {
    label: 'Kısa vade',
    desc: '≈ 1–3 ay ufuk · günlük ağırlıklı',
    blend: [ { tf: 'D', w: 0.70 }, { tf: 'W', w: 0.30 } ],
    interp: 'reversal',
    adxTf: 'D',
    weights: { trend: 0.10, ichimoku: 0.05, macd: 0.11, rsi: 0.15, stoch: 0.11, boll: 0.11, obv: 0.07, vp: 0.12, oflow: 0.06, rs: 0.07, volconf: 0.05 },
  },
  orta: {
    label: 'Orta-uzun vade',
    desc: '≈ 6–12 ay ufuk · günlük + haftalık',
    blend: [ { tf: 'D', w: 0.50 }, { tf: 'W', w: 0.50 } ],
    interp: 'momentum',
    adxTf: 'D',
    weights: { trend: 0.18, ichimoku: 0.13, macd: 0.17, rsi: 0.10, stoch: 0.04, boll: 0.05, obv: 0.10, vp: 0.09, rs: 0.09, ttmpl: 0.05 },
  },
  uzun: {
    label: 'Uzun vade',
    desc: '≈ 1–3 yıl ufuk · haftalık + aylık',
    blend: [ { tf: 'W', w: 0.60 }, { tf: 'M', w: 0.40 } ],
    interp: 'trend',
    adxTf: 'W',
    weights: { trend: 0.25, ichimoku: 0.20, macd: 0.16, rsi: 0.08, obv: 0.10, vp: 0.09, rs: 0.07, ttmpl: 0.05 },
  },
};

// Göreli Güç (RS) için karşılaştırma endeksi (Yahoo sembolü). BIST için XU100, ABD için S&P500.
// yahooSymbol() BIST'e '.IS' ekler; endeks zaten tam sembol verildiği için market='RAW' ile ham geçilir.
window.TA_BENCHMARK = { BIST: 'XU100.IS', US: '^GSPC' };
