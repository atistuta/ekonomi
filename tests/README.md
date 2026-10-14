# Skor Paritesi Testi

**Ne işe yarar:** Motor kodu taşınırken/parçalanırken **skorun kaymadığını** kanıtlar.

`/api/score` çıkarımı sırasında bir hissenin skoru 73'ten 71'e kayarsa bunu elle gözle
fark etmek imkânsızdır — ekranda ikisi de makul görünür. Bu test, taşımadan **önce**
dondurulmuş "doğru cevap"la karşılaştırma yapar ve kaymayı yol adıyla söyler.

> **FAZ 1 kapısı:** 20 sembol (10 BIST + 10 ABD) referans anlık görüntüsü → `/api/score`
> çıktısı ile **fark 0** olmalı. Taşıma bu test geçmeden bitmez.

---

## Çalıştırma

```bash
node tests/capture.mjs      # 1) ham girdileri ağdan çeker ve dondurur (bir kez)
node tests/baseline.mjs     # 2) "doğru cevap"ı üretir → tests/baseline.json
node tests/parity.mjs       # 3) her değişiklikten sonra: FARK 0 olmalı
node tests/uretim-test.mjs  # 4) üretilmiş dosyalar kaynaklarının şu anki hali mi?
node tests/uc-test.mjs      # 5) /api/score kapısı: doğrulama + hata yolu (ağsız)
```

Günlük kullanımda **3., 4. ve 5. komut** çalıştırılır. 1 ve 2 bir kez koşar; `capture`
var olan fikstürleri atlar, `baseline` var olan referansın üstüne **yazmaz**.

Beklenen çıktı:

```
✅ FARK 0 — parite tam. 29 karşılaştırma noktası birebir aynı.
✅ 55 denetim geçti — api/_motor.js ↔ app.js, api/_ayar.js ↔ config.js birebir.
```

Çıkış kodu 0 = geçti, 1 = kaydı.

---

## Dosyalar

| Dosya | Rolü |
|---|---|
| `symbols.json` | Test evreni: 10 BIST + 10 ABD sembolü, vade=orta |
| `capture.mjs` | Ham girdileri ağdan çeker → `fixtures/` |
| `fixtures/` | **Dondurulmuş HAM GİRDİ** (Yahoo mum JSON, İş Yatırım yanıtı, SEC concept JSON) |
| `engine.mjs` | `app.js`'ten motor dilimlerini **kopyalamadan** çıkarır |
| `score.mjs` | Tek sembolü skorlar (TA / FA / bileşke) |
| `run.mjs` | **Tek koşucu** — anlık görüntü nesnesini üretir |
| `baseline.mjs` | `run.mjs` çıktısını diske yazar |
| `baseline.json` | **Dondurulmuş ÇIKTI** — doğru cevap. Elle düzenlenmez. |
| `parity.mjs` | Aynı çıktıyı yeniden üretip `baseline.json` ile karşılaştırır |
| `metin.mjs` | **Metin biçimi** (FAZ 1/3) — belirteç dizisi ⇄ HTML / RN / düz metin |
| `metin-test.mjs` | Biçim kanıtı — 46 gerçek cümle bayt bayt geri dönüyor mu |
| `uretim-test.mjs` | **Üretim kanıtı** — `_motor.js` + `_ayar.js` kaynaklarının **şu anki** hali mi |
| `uc-test.mjs` | **Uç kanıtı** — `/api/score` doğrulaması ve hata yolu; AĞA ÇIKMAZ |

---

## Mimari — neden bu şekilde

### 1. Motorun kopyası çıkarılmadı

`engine.mjs`, `app.js`'i **her koşuda yeniden okur**, başlangıç/bitiş imleriyle kaynak
dilimlerini kesip `new Function` ile kurar. Motorun ikinci bir kopyası **yok**.

Kopya çıkarılsaydı test, `app.js` değiştikten sonra da eski kopyayı ölçmeye devam eder
ve yeşil yanardı — yani hiçbir şey ölçmezdi. Her im `app.js`'te **tam bir kez** geçmek
zorunda; geçmezse test sessizce yanlış kod ölçmek yerine gürültüyle durur.

**`app.js` bu testler tarafından asla değiştirilmez.** Tek doğru kaynak odur.

### 2. Fikstür GİRDİ tutar, referans ÇIKTI tutar

- `fixtures/` → ham **girdi** (ağdan ne geldiyse o)
- `baseline.json` → motorun o girdilere verdiği **çıktı**

Parite = dondurulmuş girdileri motora yeniden ver, çıktıyı referansla karşılaştır.
Yarın `/api/score` yazıldığında ona **aynı ham girdiler** verilir ve `baseline.json`'u
birebir üretmesi beklenir. Fikstür çıktı tutsaydı test yalnız kendi kaydını okur,
motoru hiç koşturmazdı.

### 3. Tek koşucu kuralı

`runAll()` yalnızca `run.mjs`'te tanımlıdır. `baseline.mjs` onu yazar, `parity.mjs` onu
yeniden üretir. Her birinin kendi koşucusu olsaydı test, kendi iki kopyasını
karşılaştırır ve motordan bağımsız olarak hep geçerdi.

### 4. Ağa çıkış yok

`makeOfflineFetch` yalnız `fixtures/` altını servis eder; kayıtta olmayan tek bir istek
testi **patlatır**. Böylece şu sahte başarı imkânsız hale gelir:

> veri çekilemedi → skor `null` → iki taraf da `null` → `null == null` → "geçti"

---

## Neyi donduruyoruz, neyi dondurmuyoruz

**Donduruluyor:** skorlar, ağırlıklar, bant adları, sınıf etiketleri (`band.l`, `band.c`,
`growthNote.cls`), kriter kırılımları, `conf` bayrakları.

**Dondurulmuyor:** kurulmuş cümleler (`parts[].note`, `growthNote.txt`).

Sebep: FAZ 1/3'te bu metinler token dizisine çevrilecek. Cümle biçimini dondurmak,
tamamen zararsız bir biçim değişikliğinde testi kırmızı yakar — ve sürekli kırmızı yanan
bir test, görmezden gelinen bir testtir.

### Hassasiyet: `round6`

Tüm sayısal alanlar `Math.round(v * 1e6) / 1e6` ile 6 ondalığa yuvarlanır.

6 ondalık, kullanıcının gördüğü her şeyden **çok daha ince** (ekranda 1 ondalık, bantlar
tam sayı). Yani gerçek kayma hâlâ yakalanır, ama kayan noktalı toplama sırası gürültüsü
sahte başarısızlık üretemez.

### Neden tam hassasiyetli `blended` de donduruldu

Negatif kontrol sırasında ölçüldü: BIST ROE ağırlığı 0.10 → 0.20 bozulduğunda **THYAO ve
BIMAS'ın ekranda görünen bileşke skoru hiç değişmedi** (53 ve 60 olarak kaldı) — yuvarlama
kaymayı yuttu. Yalnız kullanıcıya görünen tam sayı dondurulsaydı, 10 BIST sembolünün 2'si
gerçek bir regresyonu **geçmiş** sayılacaktı. Bu yüzden `blended` (tam hassasiyet) ve
`blendedShown` (ekran) **ikisi birlikte** donduruluyor.

---

## Negatif kontrol — testin gerçekten kırmızı yandığı kanıtı

Hep yeşil yanan bir test hiçbir şey ölçmez. `PARITE_APP` ortam değişkeni, motoru başka
bir `app.js`'e yöneltir; böylece canlı dosyaya **dokunmadan** bozulmuş bir kopya ölçülür:

```bash
# app.js'in bir kopyasını al, tek bir ağırlığı boz, sonra:
PARITE_APP=/yol/app-bozuk.js node tests/parity.mjs
```

Ölçülmüş sonuç (BIST ROE ağırlığı 0.10 → 0.20):

```
✗ 10 BIST sembolü          — 44 fark
      fa.criteria[2].weight       0.1  →  0.2        ← SEBEP
      fa.score                    62.340295 → 62.367894
      composite.blended           53.17227  → 53.187449
✓ 10 ABD sembolü           — etkilenmedi
✓ 9 bileşke vektörü        — etkilenmedi
❌ PARİTE BOZUK — 44 fark.   (çıkış kodu 1)
```

Test yalnız "bir şey kaydı" demiyor: **sebebi** (`criteria[2].weight`) adıyla gösteriyor
ve etkilenmeyen 10 ABD sembolünü yeşil bırakıyor. Yani fark raporu yerel, gürültü değil.

`PARITE_APP`'in ikinci işi: `/api/score` taşıması sırasında aday motoru canlıya
dokunmadan ölçmek.

---

## Test kırmızı yandığında

1. **Yol adını oku.** `fa.criteria[2].weight` gibi bir yol, hangi göstergenin/kriterin
   kaydığını doğrudan söyler.
2. **Kayma istenmiyorsa** → `app.js`'teki değişikliği geri al.
3. **Kayma bilinçli bir iyileştirmeyse** → `node tests/baseline.mjs --zorla`

`--zorla` olmadan `baseline.json` **ezilmez**. Bu koruma kasıtlı: parite kırmızı yanınca
refleks olarak referansı yenilemek, gerçek bir skor kaymasını "yeni doğru" ilan etmek
demektir — yani testi sessizce iptal etmek. `--zorla` yazmak zorunda olmak, o anı bir
**karar** haline getirir.

### Uyarı ≠ hata

`⚠ motor kaynağı değişmiş: 1405 → 1412 satır` bir **uyarı**dır, hata değil. Test
"kaynak değişmedi" demez, "**skor** değişmedi" der. Dilimler büyüyüp skorlar aynı
kaldıysa sorun yok — düzenleme skoru etkilememiş demektir.

---

## Fikstür toplama kuralları

**Taşıma hatası veri değildir.** Ağ hatası alan sembolün fikstürü **yazılmaz**. Aksi
halde bir kesinti sırasında `null` veri kalıcı olarak "doğru cevap" diye dondurulur ve
test ondan sonra sessizce hiçbir şey ölçmez.

**Bankadaki metne güven, bankadaki `null`'u yeniden doğrula.** `capture.mjs` dolu
fikstürleri atlar ama `null` kayıtları her koşuda yeniden sorar — çünkü bir `null`
"gerçekten yok" da olabilir, "o gün çekemedim" de.

Ölçülmüş taşıma gerçekleri:

- **SEC:** doğrudan erişim çalışır (vekil gerekmez). E-postasız `User-Agent` → HTTP 200.
  Gerçekten olmayan bir us-gaap etiketi temiz **404** döner, yani 404 ≠ taşıma hatası.
  Limit 10 istek/sn → ~120 ms aralık güvenli.
- **İş Yatırım:** MaliTablo uç noktası **doğrudan** çalışır (tarayıcı başlıklarıyla).
  Yalnız ana sayfa bağlantı zaman aşımına uğruyor.
- `secGet` istisnaları `null`'a yutar → taşınan sunucu işlevi **404'ü taşıma
  hatasından açıkça ayırmak zorunda**.

---

## Metin biçimi kanıtı — `metin-test.mjs`

Yukarıda cümlelerin **neden dondurulmadığı** yazıyor: FAZ 1/3'te belirteç dizisine
çevrilecekler. Bu ikinci test, o dönüşümün web çıktısını **değiştirmediğini** kanıtlar.

```bash
node tests/metin-test.mjs
```

Ölçülmüş sonuç (2026-10-11):

```
dağarcık (açılış etiketi): b:53  em:1  i:1  br:2
tur: 46/46 birebir
✅ 31 doğrulama geçti
```

- **46 gerçek cümle** `app.js`'ten **okunarak** alınıyor (kopya yok — parite testiyle
  aynı kural). Belirtece çevrilip geri render edildiğinde **bayt bayt aynı** HTML
  çıkıyor; fark olursa test ilk ayrışan baytı gösteriyor.
- Motorun kendi cümleleri de ölçülüyor: canlı `COMPOSITE_MATRIX`'in 9 hücresinden
  **2'si** etiketli — yani skor motorundaki metin işi **2 satır**.
- Biçim etiket adı değil **rol** taşıyor. `<b>` üçe ayrıldı (`v` vurgu / `e` etiket /
  `s` sayı): web üçünü de `<b>` yapar ama mobilde sayı yuvası `tabular-nums` ister,
  yoksa rakamlar zıplar. `<em>` → `d` (soluk), çünkü bu projede `<em>` italik **değil**
  (`styles.css:710` → `font-style: normal`). Naif bir etiket→stil eşlemesi mobilde
  yanlış görünürdü.
- `v`/`e`/`s` HTML'de **ayırt edilemez** (üçü de `<b>X</b>`), bu yüzden dönüşüm
  fonksiyon fonksiyon yapılabilir; `tokensToHtml` düz dizeyi aynen geçirir.
- **9 negatif kontrol** reddedilmek zorunda (iç içe etiket, kapanmayan etiket,
  bilinmeyen rol, `</br>`, eksik metin…) — yoksa test hiçbir şey ölçmez.

Parite bu dönüşümden **etkilenmez**: `baseline.json`'da etiketli tek bir dize yok.

---

## Motor taşıyıcısı kanıtı — `uretim-test.mjs`

Sunucuda motor `engine.mjs` gibi kurulamaz: Vercel'de `tests/` yayına gönderilmiyor
(`.vercelignore`) ve `app.js` bir tarayıcı varlığı. Bu yüzden motor sunucu tarafı için
**tek bir ESM modülüne üretiliyor**:

```bash
node tools/motor-uret.mjs            # app.js → _motor.js · config.js → _ayar.js
node tools/motor-uret.mjs --denetle  # yalnız denetle: fark varsa çıkış 1
node tests/uretim-test.mjs           # kanıt: 77 denetim (ölçüldü)
```

| Dosya | Rolü |
|---|---|
| `../tools/motor-uret.mjs` | Üretici — `app.js`'i dilimler, `buildMotor(H)` gövdesine sarar |
| `../api/_motor.js` | **Üretilmiş** motor: 1.405 satır / 9 dilim, 23 sembol, `IMZA` gömülü |
| `../api/_ayar.js` | **Üretilmiş** ayar: `TA_WEIGHTS` · `TA_BENCHMARK` · `VADELER`, `IMZA_AYAR` gömülü |

`_` önekli dosyaları Vercel uç noktaya çevirmez → `api/_motor.js` ve `api/_ayar.js`
birer **rota değil**, yalnızca `/api/score`'un içe alacağı modüller.

### Neden kopya değil

`engine.mjs`'in baştaki yasağı hâlâ geçerli: *"motor kopyalanırsa iki sürüm doğar ve
parite testi kendi kopyasını doğrular — yani hiçbir şeyi."* Üretilen dosya o yasağı
şöyle aşıyor: metin **elle yazılmıyor**, her seferinde `app.js`'ten türetiliyor ve
üretim testi her koşuda metni **bellekte yeniden üretip** diskteki ile karşılaştırıyor.
Elle düzenleme ya da `app.js`'in kayması testi kırmızı yakar. Yani dosya bir kopya
değil, aynı metnin ikinci **taşıyıcısı**.

İki tasarım kararı bunu ayakta tutuyor:

- **Başlık tarihsiz olmak zorunda.** Üretim tarihi yazılsa dosya ertesi gün kendi
  kendine "sürüklenmiş" görünür ve test her gün kırmızı yanardı. Başlıktaki her satır
  yalnız `app.js`'ten türeyen belirlenimci bilgi taşıyor (dilim adları, satır
  sayıları, sembol sayısı, imza).
- **İki ayrı karşılaştırma.** Kanonik biçim **LF** (`api/proxy.js` örneği), ama depoda
  `.gitattributes` yok → taze klonda `core.autocrlf` dosyayı CRLF'e çevirebilir ve bu
  bir sürüklenme **değildir**. Bu yüzden **denetim** satır sonuna duyarsız
  (`\r\n` → `\n` normalleştirerek), **yazma kararı** ise **bayt bayt**; tek bir
  karşılaştırma kullanılsaydı bir satır sonu düzeltmesi "değişiklik yok" diye atlanırdı.

Ölçülmüş sonuç (2026-10-12) — 55 denetimin özeti:

```
① Dosya ve biçim           satır sonu tek tip (lf 1483 / crlf 0) · başlık tarihsiz
② Sürüklenme               bellekte yeniden üretilen metin diskteki ile aynı (1483 satır)
③ İmza                     sha256:7049fb1cd9c44c9a — belirlenimci, tek karaktere duyarlı
④ Dilim tablosu            canlı sliceInfo() ile birebir (9 / 9 · toplam 1405 satır)
⑤ Modül yükü               buildMotor (function) · IMZA (string) · DILIMLER (array)
⑥ Motor yüzeyi             EXPORTS sembollerinin hepsi var (23 sembol)
⑦ Davranış eşitliği        faInterp 1827 nokta · faBand/taBand 442 nokta ·
                           computeHolisticScore 9/9 vektör (tam sonuç, cümleler dahil)
⑧ Olumsuz denetim          N1 metin · N2 eksik sembol · N3 dilim · N4 1e-9 → hepsi reddedildi
⑨ Ayar taşıyıcısı          api/_ayar.js = config.js el ağırlıkları · DERİN eşitlik ·
                           sızma denetimi (44 aday değer · 8 yasak ad) · N5 + N6

✅ 55 denetim geçti — api/_motor.js ↔ app.js, api/_ayar.js ↔ config.js birebir.
```

⑦ burada **cümleleri de** karşılaştırıyor — `baseline.json`'ın bilerek dondurmadığı
şeyi. Çelişki değil: orada cümle dondurmak FAZ 1/3 belirteç dönüşümünü gereksiz yere
kırardı, burada ise iki taraf **aynı kaynaktan** türüyor, yani bir fark biçim tercihi
olamaz — ancak gerçek bir bozulma olabilir.

### Ayar taşıyıcısı — `api/_ayar.js`

Motor sunucuda kurulurken **el ağırlıklarına** ihtiyaç duyuyor: `TA_WEIGHTS` (vade
başına gösterge ağırlıkları) ve `TA_BENCHMARK` (göreli güç için karşılaştırma
endeksi). Bunlar `config.js`'te, ama `config.js` bir tarayıcı varlığı — `window.X = …`
yazıyor, dışa aktarmıyor.

Üç seçenek vardı, ikisi elendi:

| Seçenek | Neden olmadı |
|---|---|
| Ağırlıkları `api/score.js`'e **kopyala** | İki doğruluk kaynağı doğar. `config.js`'te bir ağırlık değişir, sunucu eski sayıyla skorlar ve **hiçbir test bunu görmez** — motor kopyası yasağının aynısı. |
| `config.js`'i uçta **çalışma anında oku** | Vercel'in dosya izleyicisi (node-file-trace) `config.js`'i işleve paketler mi? `import` grafiğinde görünmediği için **belli değil** — ve bu ancak dağıtımdan sonra anlaşılır. Yerelde doğrulanamayan bir kurulum kabul edilmedi. |
| **Üret** → `api/_ayar.js` | `_motor.js` ile aynı ilke: kopyalanmıyor, `config.js`'ten türetiliyor, her koşuda sürüklenme testinden geçiyor. Yerelde doğrulanabilir. |

Üretici tek: `config.js`'i okuyan `new Function('window', …)` kalıbı `engine.mjs`'te
**bir kez** duruyor (`loadConfig()`), `tools/motor-uret.mjs` onu içe alıyor. Test de
aynı işlevi kullanıyor — yani karşılaştırmanın iki tarafı da tek okuyucudan geliyor.

#### Neden metin karşılaştırması yetmiyor — derin eşitlik

Üretici ağırlıkları `JSON.stringify` ile gömüyor. Sürüklenme denetimi dosyayı
**bellekte yeniden üretip** diskteki ile karşılaştırıyor; bu elle düzenlemeyi yakalar
ama bir şeyi **yakalamaz**: `JSON.stringify` bir alanı sessizce düşürürse (bir
`undefined`, bir fonksiyon, bir `NaN`) iki taraf da **aynı eksik metni** üretir ve
denetim yeşil kalır.

Bu yüzden ⑨ bölümü üretilen modülü **gerçekten yükleyip** (`await import`) çıktısını
`config.js`'in canlı değerleriyle **derin eşitlikle** karşılaştırıyor — alan alan,
sayı sayı. `VADELER` sırası da ayrıca denetleniyor: ağırlık sırası skoru etkilemiyor
ama arayüzdeki vade sekmelerinin sırasını belirliyor.

`N5` bu denetimin boş olmadığını kanıtlıyor: bir el ağırlığına `1e-9` eklenince derin
eşitlik **kırmızı** yanıyor.

#### Sızma denetimi — ne alınmıyor

`config.js` yalnız ağırlık tutmuyor: bildirim konusu (paylaşılan bir sır gibi
davranıyor), vekil adresleri ve haber besleme listeleri de orada. Üretilen dosya
bunların **hiçbirini** taşımıyor; başlıkta bu bilerek yazılı:

```
Alınmayan: NTFY_TOPIC, MY_PROXY, CORS_PROXY, besleme listeleri.
```

Denetim bu sözü iki yönden tahsil ediyor ve **kendi kendini sürdürüyor** — izin
verilen iki anahtar dışındaki **bütün** `window.*` anahtarları çalışma anında
`config.js`'ten okunuyor, yani yarın oraya yeni bir sır eklenirse testi elle
güncellemek gerekmiyor:

- **Değerler**: izin verilmeyen her anahtarın içindeki dizeler özyinelemeli
  toplanıyor, 10 karakterden kısa olanlar atılıyor (hisse kodu gibi parçalar yanlış
  alarm üretir), izin verilen iki anahtarda da geçenler aday sayılmıyor. Kalan **44
  aday** üretilen dosyada aranıyor. **Sır değerleri teste yazılmıyor** —
  `config.js`'ten okunuyor, ve başarısızlık iletisinde de basılmıyor, yalnız
  **sayısı** bildiriliyor.
- **Adlar**: **8 yasak anahtar adı** dosyanın **gövdesinde** aranıyor — başlıkta
  bulunmaları gerekiyor (yukarıdaki satır), gövdede bulunmamaları.

`N6` burada da boşluk denetimi: metne ekilmiş bir sır gerçekten yakalanıyor mu.

### Üretilmiş motor parite şeridi

Parite testi iki şeritte koşuyor, ikisi de **aynı** `baseline.json`'a karşı:

```bash
node tests/parity.mjs                          # şerit A: app.js dilimlenerek (bellekte)
PARITE_MOTOR=uretilmis node tests/parity.mjs   # şerit B: api/_motor.js diskten
```

İkisi de `✅ FARK 0 — parite tam. 29 karşılaştırma noktası birebir aynı.` veriyor.
Asıl önemli olan **şerit B**: `/api/score`'un sunucuda diskten yükleyeceği dosya,
20 sembolün 20'sini ve 9 sentetik vektörün 9'unu **dondurulmuş cevapla aynı** skorluyor.

**Negatif kontrol** — yalnız içteki 4 olumsuz denetime güvenilmedi, testin gerçek bir
sürüklenmede kırmızı yandığı uçtan uca gösterildi: üretilmiş dosyadaki `taBand` eşiği
`54` → `55` yapıldı. Test iki yerden **birbirinden bağımsız** yakaladı — ② metin farkı
(*ilk farklı satır: 912*) ve ⑦ davranış farkı (`taBand(54)`: `"hi"` ≠ `"mid"`) — çıkış
kodu **1**. Dosya geri yüklendi, imza değişmedi.

Aynı uçtan uca kanıt **ayar dosyası** için de koşuldu — içteki `N5`/`N6` kontrollerine
güvenilmedi, çünkü onlar testin kendi içinde yaşıyor. `config.js`'teki bildirim konusu
(değeri çalışma anında okunup, hiçbir yere yazılmadan — yalnız uzunluğu bildirildi)
`api/_ayar.js`'in sonuna bir yorum satırı olarak ekildi. Test iki yerden
**birbirinden bağımsız** yakaladı — sürüklenme (*ilk farklı satır: 145*) ve sızma
denetimi (*1 değer sızmış*) — çıkış kodu **1**. `node tools/motor-uret.mjs` dosyayı
yeniden üretti, imza (`sha256:75512c5271a89b33`) değişmedi, 55 denetim yeşile döndü.

---

## Taşıma bulguları (`/api/score` için)

Test yazılırken ölçülen, taşımayı doğrudan etkileyen bağımlılıklar — ayrıntısı
`BAGIMLILIK_GRAFIGI.md` §5'te:

1. **Temel model kurucuları ekran biçimlendiricilerine bağlı.** ABD tarafı `fmtUSD`,
   BIST tarafı `fmtTRY` çağırıyor. → `/api/score` **ham sayı** döndürmeli, `tr-TR` /
   `en-US` biçimlendirmesi istemcide kalmalı.
2. **Değerleme (F/K) kriteri üç yerde tekrarlanıyor** (`app.js:5648`, `:7449`, `:11876`;
   yalnız ABD — BIST'te yok).
3. **Bileşke ağırlığı `0.55*fa + 0.45*ta` üç yerde** (`app.js:4781`, `:5256`, `:12023`;
   sonuncusu `const` olmadan).
4. **`computeHolisticScore` → `buildGrowthNote`** (`app.js:5159`) çağırıyor; büyüme notu
   sınıflandırıcısı holistik skorlayıcıyla **birlikte** taşınmak zorunda.

Motor dilimi toplamı: **1.405 satır / 9 dilim.**

---

*Bilgi amaçlıdır, yatırım tavsiyesi değildir.*
