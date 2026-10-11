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
      etiketsiz — 1.405 satırlık 9 dilimde **2 satır / 4 etiket**, ikisi de statik
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
      çıkarılmadı — test `app.js`'i her koşuda yeniden dilimliyor (1.405 satır / 9 dilim).
      **Negatif kontrol:** BIST ROE ağırlığı 0.10→0.20 bozulunca test 44 farkla kırmızı
      yandı ve sebebi (`fa.criteria[2].weight`) adıyla gösterdi; 10 ABD sembolü
      etkilenmedi. Aday motor `PARITE_APP=` ile canlıya dokunmadan ölçülebilir.
- [ ] Motor mantığını `/api/*` uçlarına böl: `score`, `recommend`, `analyze`,
      `theme`, `causal`, `compare`. Vercel KV ile cache.
      → **Sürüyor** (2026-10-12). İlk uç `/api/score`. **Taşıyıcı hazır:** motor
      artık `app.js`'ten **üretiliyor** → `api/_motor.js` (1.405 satır / 9 dilim,
      tek ESM modülü, girişi `buildMotor(H)`; `_` öneki Vercel rotasını engelliyor).
      Kopya **değil** — `tools/motor-uret.mjs` her seferinde `app.js`'i yeniden
      dilimliyor, `tests/uretim-test.mjs` (34 denetim) "bu dosya app.js'in ŞU ANKİ
      hali mi?" diye soruyor. **Kanıt:** üretilmiş motor aynı fikstürlerle **FARK 0**
      (`PARITE_MOTOR=uretilmis node tests/parity.mjs`); `taBand` eşiği kurcalanınca
      test metin **ve** davranış farkını yakalayıp çıkış 1 verdi.
      **Sırada:** `api/score.js` uç noktası + F/K kriterinin üç ekran kopyasının
      (`app.js:5648/:7449/:11876`) motora devri.
- [ ] **Expo projesi** kur: TypeScript + expo-router + Supabase client.
- [ ] **Tasarım sistemi:** renk token (koyu mürekkep `#0F1522` + altın `#D4A24E` +
      yeşil/mercan sinyal), tipografi (2 ağırlık), spacing, `tabular-nums`.
- [ ] Çekirdek komponentler: `Card`, `Pill/Badge`, `ScoreGauge`, `TickerRow`,
      `SectorChip`, `Disclaimer`, `Skeleton`.
- [ ] 5-sekmeli **tab navigasyon iskeleti** (boş ekranlar + disclaimer footer).

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
