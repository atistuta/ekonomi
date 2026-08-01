# KAP Push Worker

Bu klasör, portföyündeki BIST hisseleri için yeni KAP duyurularını tarayan ve telefonuna push bildirimi atan GitHub Actions worker'ını içerir.

## Kurulum (tek seferlik)

1. **Bu projeyi GitHub'a push'la** (private repo da olur).

2. **ntfy konunu seç:** `config.js` ve `worker/portfolio.json` aynı topic'i kullanmalı. Tahmin edilemez bir şey seç (ör: `bulten-x9f3k2p`).

3. **Telefonuna ntfy uygulamasını kur:**
   - Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy
   - iOS: https://apps.apple.com/app/ntfy/id1625396347
   - Uygulamada "Subscribe to topic" → konu adını gir → bitti.

4. **GitHub Secret ekle:**
   - Repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `NTFY_TOPIC`
   - Value: konu adın (örn. `bulten-x9f3k2p`)

5. **Workflow'u test et:**
   - Repo → Actions → "KAP Poller" → "Run workflow"
   - Loglara bak; ilk çalıştırmada `.seen.json` boş olduğu için potansiyel olarak çok bildirim atabilir. İstersen önce manuel olarak `worker/.seen.json` dosyasını `[]` ile değil mevcut tüm duyuruları içerecek şekilde seed'leyebilirsin (opsiyonel).

6. **Cron otomatik çalışır:** Her 15 dakikada bir. GitHub Actions ücretsiz katmanı bunun için fazlasıyla yeterli (aylık ~3000 dk).

## Portföyü değiştirmek

- `worker/portfolio.json` içindeki `tickers` dizisini güncelle ve commit'le.
- Frontend portföyü ile aynı tutmayı unutma (`config.js`).

## Nasıl çalışır

```
Cron (15 dk) → checkout → npm install fast-xml-parser
              → fetch KAP RSS
              → portföydeki ticker'lar için yeni duyuruları bul (.seen.json'a göre)
              → her biri için ntfy.sh POST → telefon bildirimi
              → .seen.json'u güncelle + commit
```

## Sınırlar

- KAP RSS bazen yavaş veya boş dönebilir; worker hatasız geçer, bir sonraki run'da tekrar dener.
- ntfy.sh ücretsiz ve hesap gerekmez ama konu adın *gizli* olmalı — link'i bilen herkes mesajlarını görür.
- Birden fazla cihaz: aynı konuya birden fazla telefondan abone olabilirsin.
