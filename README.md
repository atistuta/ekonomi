# Sabah Bülteni

Kişisel yatırım portföyü + KAP + ekonomi haber paneli. Build adımı yok, doğrudan tarayıcıda çalışır. PWA olarak telefon ana ekranına eklenebilir.

## Özellikler

- **Üst bar:** Gram altın, USD/TRY, EUR/TRY, GBP/TRY (5 dk'da bir tazelenir)
- **Portföy sekmesi:** Her hisse/ETF için ayrı kart
  - BIST hisselerinde KAP duyuruları (filtrelenmiş)
  - Tümünde Google News son haberleri
- **Takvim sekmesi:**
  - Bilanço Takvimi: KAP'tan finansal rapor duyuruları (BIST)
  - Temettü Takvimi: KAP'tan kar payı duyuruları (BIST) + Yahoo Finance temettü geçmişi (ABD ETF)
- **Genel sekmesi:** Bloomberg HT, Dünya, NTV, Reuters, BBC, CNBC, FT — TR/Dünya filtreli
- **Push bildirimi:** Yeni KAP duyurusu geldiğinde telefona push (ntfy.sh + GitHub Actions worker)

## Çalıştırma

**PC'de:** `index.html`'i çift tıkla.

**Telefonda erişim:** Klasörü Vercel veya Netlify'a sürükle-bırak deploy et. Aldığın URL'yi telefonda aç → "Ana ekrana ekle" → PWA gibi çalışır.

## Konfigürasyon

- **Portföy:** `config.js` → `PORTFOLIO` dizisi
- **Genel haber kaynakları:** `config.js` → `GENERAL_FEEDS`
- **Push konusu:** `config.js` → `NTFY_TOPIC` (worker/portfolio.json ile aynı olmalı)

## Push bildirimi kurulumu

Adım adım yönerge için: [worker/README.md](./worker/README.md)

Özet:
1. Telefonuna ntfy uygulamasını kur ve konuya abone ol.
2. GitHub'a push'la, repo secret olarak `NTFY_TOPIC` ekle.
3. Actions otomatik 15 dk'da bir KAP'ı tarar, yeni duyuruları push'lar.

## Veri kaynakları

| Veri | Kaynak | Maliyet |
|---|---|---|
| Döviz/Altın | finans.truncgil.com | Ücretsiz |
| Portföy haberleri | Google News RSS (via rss2json) | Ücretsiz (10k/gün) |
| KAP duyuruları | kap.org.tr RSS (via corsproxy) | Ücretsiz |
| ABD ETF temettü | Yahoo Finance (via corsproxy) | Ücretsiz |
| Genel haberler | Bloomberg HT, Reuters vb. RSS | Ücretsiz |
| Push bildirimi | ntfy.sh + GitHub Actions | Ücretsiz |

## Sınırlar

- rss2json ücretsiz katmanı: saat başına ~60 istek. Portföyün ~10 sembolle bu sınır içinde rahat.
- KAP duyuruları yalnızca son ~200 kayıt; daha geriye gitmek için ayrı endpoint gerekir.
- Yahoo Finance unofficial endpoint — ara sıra başarısız olabilir, otomatik retry yok.
- Push bildirimi yalnızca BIST KAP duyuruları için (US ETF için eklemek istersen worker'a Yahoo polling ekleyebiliriz).
