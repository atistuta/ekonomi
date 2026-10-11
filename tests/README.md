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
node tests/capture.mjs    # 1) ham girdileri ağdan çeker ve dondurur (bir kez)
node tests/baseline.mjs   # 2) "doğru cevap"ı üretir → tests/baseline.json
node tests/parity.mjs     # 3) her değişiklikten sonra: FARK 0 olmalı
```

Günlük kullanımda yalnız **3. komut** çalıştırılır. 1 ve 2 bir kez koşar; `capture`
var olan fikstürleri atlar, `baseline` var olan referansın üstüne **yazmaz**.

Beklenen çıktı:

```
✅ FARK 0 — parite tam. 29 karşılaştırma noktası birebir aynı.
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

## Taşıma bulguları (`/api/score` için)

Test yazılırken ölçülen, taşımayı doğrudan etkileyen bağımlılıklar — ayrıntısı
`BAGIMLILIK_GRAFIGI.md` §4'te:

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
