# Ekran görüntüleri — App Store gereksinimleri

**Durum: ekran görüntüleri HENÜZ ÇEKİLMEDİ.** Bu dosya ne gerektiğini
ve neyin çekileceğini yazar; `magaza/` altında tek bir `.png` yok.
Uygulama bugüne kadar hiçbir gerçek iPhone'da çalıştırılmadığı için
(bkz. `mobile/README.md` → Dürüst eksikler) gerçek cihaz görüntüsü de
alınamadı.

Yayın hedefi yalnız **Apple App Store**.

---

## 1. Ölçüler — kaynaktan doğrulandı

Kaynak: Apple, *App Store Connect — Screenshot specifications*
<https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/>
(okundu: 26 Ekim 2026)

| Ekran boyutu | Dikey (portrait) | Yatay (landscape) | Kapsadığı cihazlar |
|---|---|---|---|
| **6.7"** | **1290 × 2796 px** | 2796 × 1290 px | iPhone 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max |
| 6.9" | 1320 × 2868 px | 2868 × 1320 px | iPhone 18 Pro Max, 17 Pro Max, 16 Pro Max |
| 6.5" | 1284 × 2778 px | 2778 × 1284 px | iPhone 14 Plus, 13 Pro Max, 12 Pro Max, 11 Pro Max |
| 6.5" (eski) | 1242 × 2688 px | 2688 × 1242 px | iPhone 11 Pro Max, 11, XS Max, XR |

Apple'ın sayfası bu grupları "6.7 inç" gibi adlandırmıyor; *iPhone with
Dynamic Island (large display)* / *(medium display)* ve *iPhone with
Face ID* diye yazıyor. Yukarıdaki inç etiketleri sayfadaki cihaz
listelerinden ve bölüm simge adlarından **çıkarsandı** — ölçüler ise
sayfada yazıldığı gibi birebir.

### Hangi boyut gerçekten zorunlu

Ölçümün dürüst hâli şu: sayfa **"6.7 inç zorunludur"** demiyor.

- **Kesin zorunlu:** *Dynamic Island (medium display)* grubundan en az
  bir görüntü — **1179 × 2556** veya **1206 × 2622** px (dikey).
- **Koşullu zorunlu:** *Face ID (large)* grubu, *Dynamic Island (large)*
  görüntüleri verilmediyse gerekli oluyor.
- **Diğer iPhone boyutları:** isteğe bağlı; verilmeyen boyut için
  App Store Connect başka boyuttan **ölçekliyor**
  (large ↔ large arası, medium ise large'dan).

**Pratik karar:** arayüz tüm boyutlarda aynı olduğu için en yüksek
gerekli çözünürlükten tek takım yüklemek yeterli; panel aşağıya
ölçekliyor. Bu yüzden takım **1290 × 2796 (6.7", dikey)** olarak
hazırlanıyor — hem *large* grubunu doldurur hem medium'a ölçeklenir.
Takip edilmesi gereken tek risk, panelin medium grubunu yine de
ayrıca istemesi; o durumda **1206 × 2622** ikinci bir takım çekilir.

### Adet ve biçim

- En az **1**, en çok **10** görüntü (her cihaz boyutu için).
- Biçim: `.png`, `.jpg` veya `.jpeg`.
- **Alfa kanalı / saydamlık YASAK** — dışa aktarırken saydamlık
  kapatılmalı.
- Uygulama `app.json`'da `orientation: "portrait"` olduğu için **yatay
  görüntü çekilmeyecek**; yalnız dikey takım hazırlanır.
- `ios.supportsTablet: false` olduğundan iPad takımı **gerekmiyor**.

### İleri tarihli gereksinim (şimdiden not)

Apple sayfası, **iOS 27.1 SDK** veya sonrasıyla derlenen uygulamalar
için **Nisan 2027**'den itibaren "iPhone Duo" görüntülerini zorunlu
kılıyor: **1398 × 2034** ve **2007 × 2853** px (ve yatay karşılıkları).
İlk sürüm için gerekmiyor, ama SDK yükseltmesinde bu satır yeniden
okunmalı.

---

## 2. Çekilecek beş ekran

Sıra, mağaza listesinde göründüğü sıradır; ilk iki görüntü arama
sonuçlarında küçük olarak görünür, bu yüzden en okunur iki ekran başa
kondu.

| # | Ekran | Neden bu | Hangi veriyle |
|---|---|---|---|
| 1 | **Listeler** (1. sekme) | Ürünün tek cümlesi bu ekran: takip listesi + fiyat + teknik/temel ölçüm + hesaplanan bant, hepsi bir arada. | Başlangıç listesinin dolu hâli; en az 5-6 satır görünsün. |
| 2 | **Analiz** (4. sekme) | Derin bakışın kanıtı: teknik ayak, temel ayak, üç direk ve fiyat grafiği. | Verisi tam gelen bir sembol (ör. büyük bir ABD sembolü) + 1 aylık grafik. |
| 3 | **Keşfet** (3. sekme) | Tek turdan üç yüzey — radar, risk/ödül dizilimi, ölçüt süzgeci. | Tarama süzgeci açık, birkaç satır süzülmüş hâlde. |
| 4 | **Bugün** (2. sekme) | Listenin tek bakışta kıyası + makro gündem özeti. | Motorun `sira` dizisi dolu; ⚡ Makro Nabız kartı yüklü. |
| 5 | **Hisse detay** (`/hisse/[sembol]`) | Künye şeridi + teknik/temel/tez/risk-ödül kartları; en altta yasal uyarı görünür. | BIST sembolü seçilsin — ikinci pazarın da desteklendiği görünsün. |

Yedek (bir ekran kullanılamazsa): **Arama** sekmesi — sembol ölçümü ve
tema keşfi. Şu an tema ucu sunucu anahtarı beklediği için ekranda
"ölçemedim" durumu görünür; mağaza görüntüsü olarak **uygun değil**.

### Çekim kuralları

- Her görüntüde **gerçek ekran** kullanılacak; arayüz çizimi, kurgu
  tasarım ya da elle yazılmış sayı **yok**. Uydurma veriyle çekilmiş
  görüntü, uygulamanın "uydurma sayı yoktur" sözünü ilk anda bozar.
- Hiçbir görüntüde ölçülemeyen bir kriter "dengeli" görünmeyecek;
  "ölçemedim" durumundaki kart kadraja girmeyecek.
- Üstüne yazılacak tanıtım metinleri de `app-store-metinleri.md`'deki
  uyumluluk kuralına tabi: *kazandırır · al/sat sinyali · garanti ·
  kâr · öneri · tavsiye* ifadeleri **görüntülerin üzerinde de**
  kullanılmaz.
- Durum çubuğu temiz olsun: tam şarj, tam sinyal, saat sabit.
- Koyu tema varsayılan (`userInterfaceStyle: "dark"`) — takım tutarlı
  olsun, bir görüntü açık temada olmasın.

---

## 3. Nasıl çekilecek (henüz yapılmadı)

Bugünkü durumda cihaz yok ve simülatör çalıştırılmadı. Kullanılabilir
iki yol:

1. **iOS Simülatörü** — `npm --prefix mobile run ios` ile açılan
   simülatörde 6.7" sınıfı bir cihaz seçilir ve sistemin kendi
   görüntü alma işlevi kullanılır. Simülatör çıktısı tam piksel
   ölçüsünde gelir, yeniden ölçeklemeye gerek kalmaz.
2. **Gerçek iPhone + TestFlight** — iç test derlemesi cihaza kurulur,
   görüntüler cihazdan alınır. Daha güvenilir, çünkü güvenli alan ve
   dokunma hedefleri de aynı anda ölçülmüş olur.

İkisinden hangisi yapılırsa, çıktının **tam 1290 × 2796** olduğu
yüklemeden önce doğrulanacak; yanlış ölçü panelin reddettiği en sık
hata.

---

Bilgi amaçlıdır, yatırım tavsiyesi değildir.
