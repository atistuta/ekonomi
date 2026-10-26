# Apple kontrol listesi — kullanıcının kendi yapması gerekenler

Bu adımlar koddan yapılamaz: Apple Developer hesabına ve App Store
Connect paneline giriş gerektiriyor. Aşağıdakiler **senin** elinle
yapılacak işler; her birinin yanında neyi geri getirmen gerektiği
yazıyor, çünkü o değerler yapılandırmaya girecek.

Yayın hedefi yalnız **Apple App Store**.

---

## 0. Önkoşul

- [ ] Apple Developer Program üyeliği etkin (yıllık ücret ödenmiş).
- [ ] Panelde rolün **Account Holder** veya **Admin** — App Manager
      rolü uygulama oluşturmaya yetmiyor.

---

## 1. Bundle ID kaydı

- [ ] <https://developer.apple.com/account/resources/identifiers> →
      **Identifiers** → `+` → **App IDs** → **App**
- [ ] Bundle ID türü: **Explicit**
- [ ] Bundle ID: **`com.sabahbulteni.app`**

Bu değer `mobile/app.json` → `ios.bundleIdentifier` içinde aynen yazılı
(ölçüldü). Panelde **birebir** aynı yazılmalı; tek harf farkı derlemeyi
imza aşamasında durdurur. Bundle ID kaydedildikten sonra
**değiştirilemez**.

- [ ] Capability (yetenek) **seçme**. Uygulama ağ erişimi dışında bir
      şey istemiyor; push, iCloud, Sign in with Apple, konum **yok**.
      Gereksiz yetenek açmak hem imza profilini karmaşıklaştırır hem
      App Privacy anketinde açıklanacak yeni satır doğurur.

---

## 2. App Store Connect'te uygulama kaydı

- [ ] <https://appstoreconnect.apple.com/apps> → `+` → **New App**
- [ ] Platform: **iOS**
- [ ] Ad: **Sabah Bülteni — Borsa Takibi** (28 karakter;
      `app-store-metinleri.md` §1)
- [ ] Birincil dil: **Türkçe**
- [ ] Bundle ID: listeden `com.sabahbulteni.app`
- [ ] SKU: serbest bir iç kod, ör. `sabah-bulteni-ios-01`

### Geri getirmen gereken iki değer

| Değer | Nerede bulunur | Nereye yazılacak |
|---|---|---|
| **`ascAppId`** — sayısal App Store Connect uygulama kimliği (10 haneli, ör. `6123456789`) | Uygulama sayfası → **App Information** → *Apple ID* alanı. URL'de de görünür. | `mobile/eas.json` → `submit.production` |
| **`appleTeamId`** — 10 karakterli ekip kimliği (ör. `A1B2C3D4E5`) | <https://developer.apple.com/account> → **Membership details** → *Team ID* | `mobile/eas.json` → `submit.production` |

**Ölçüldü (26 Ekim 2026):** `mobile/eas.json` içinde
`submit.production.ios` **boş bir nesne** (`{}`) — yani gönderim profili
hazır ama `ascAppId` ve `appleTeamId` **yazılmamış**. Bu iki değer sen
getirdikten sonra oraya eklenecek; o dosya bu görevin şeridinde olmadığı
için burada yalnız not düşülüyor, değişiklik yapılmadı.

Eklenecek şekil:

```json
"submit": {
  "production": {
    "ios": {
      "appleTeamId": "<10 karakterli ekip kimliği>",
      "ascAppId": "<10 haneli sayısal kimlik>"
    }
  }
}
```

---

## 3. Kategori ve URL'ler

- [ ] **App Information** → Birincil kategori: **Finans** (Finance)
- [ ] İkincil kategori: boş bırak (zorunlu değil; yanlış ikincil
      kategori inceleme sorusu doğuruyor)
- [ ] Telif hakkı: `2026 Sabah Bülteni`
- [ ] **Gizlilik politikası URL'i:**
      `https://day-starter.vercel.app/gizlilik`
- [ ] **Destek URL'i:** `https://day-starter.vercel.app/destek`

> **NOT — destek sayfası henüz canlı değil.** `destek.html` depoda
> duruyor ve yayına alınıyor, ama bu satırın yazıldığı an itibarıyla
> adres doğrulanmadı. Panele yazmadan önce tarayıcıda açıp **200
> döndüğünü gör**; Apple inceleme sırasında bu URL'yi açıyor ve açılmayan
> destek adresi tek başına ret gerekçesi oluyor. Gizlilik sayfası
> (`gizlilik.html`) ise depoda tam hâliyle duruyor.

`vercel.json` içinde `cleanUrls: true` olduğu için `/gizlilik` ve
`/destek` uzantısız adresler olarak çalışıyor (ölçüldü) — adreslere
`.html` eklemek gerekmiyor.

---

## 4. App Privacy anketi — EN DİKKATLİ ADIM

Panelde: uygulama → **App Privacy** → *Data Collection*.

Anket, `/gizlilik` sayfasıyla **ÇELİŞMEMELİ.** O sayfa Apple
inceleyicisinin açtığı ilk bağlantılardan biri; ankette "veri
toplamıyoruz" deyip sayfada sunucuya yazılan bir liste anlatmak,
inceleme reddinden daha kötüsünü getirir — yanlış beyan kaydı.

Gizlilik sayfasında **açıkça yazan** ve ankette **gizlenmemesi gereken**
şey:

> Senkronizasyon kodu isteğe bağlıdır; kullanılırsa sembol listesi,
> kullanıcının seçtiği kodun altında sunucu tarafındaki anahtar–değer
> deposunda saklanır. **Kodu bilen herkes o listeyi görebilir ve
> değiştirebilir** — bu bir kimlik doğrulaması değil, bir kolaylıktır.

Bunu ankette sakla**ma**. Doğrusu:

- [ ] **Other User Content** (ya da panelin sunduğu en yakın başlık) →
      *Collected: Yes* · amaç **App Functionality** ·
      **kimliğe bağlı DEĞİL** (Not Linked to You) ·
      **izleme için kullanılmıyor** (Not Used for Tracking).
      Açıklama: senkron kodu kullanıldığında sembol listesi sunucuda
      saklanıyor; kod kullanıcı tarafından seçiliyor ve kimlik
      doğrulaması içermiyor.
- [ ] **Identifiers → Device ID / Advertising ID:** *Collected: No*.
      Gizlilik sayfası IDFA okunmadığını yazıyor.
- [ ] **Usage Data / Analytics:** *Collected: No*. Analitik aracı yok.
- [ ] **Contact Info (ad, e-posta, telefon):** *Collected: No*. Hesap
      açılmıyor.
- [ ] **Location · Contacts · Photos · Health · Financial Info:**
      *Collected: No*. Uygulama bu izinleri hiç istemiyor.
- [ ] **Diagnostics:** sunucu kayıtları (IP, user-agent) barındırma
      sağlayıcısının standart kaydı. Panelin hangi başlığa oturttuğunu
      okuyarak işaretle; gizlilik sayfası §3 bunları **yazıyor**, yani
      ankette "hiçbir şey yok" demek çelişki olur.
- [ ] **Tracking:** uygulama izleme yapmıyor → App Tracking Transparency
      izni **istenmiyor**, "Used for Tracking" hiçbir satırda
      işaretlenmiyor.

Anketi doldurduktan sonra `/gizlilik` sayfasını yanında açıp **satır
satır karşılaştır.** Yeni bir veri akışı eklendiğinde hem sayfa hem bu
anket güncellenir — gizlilik sayfasının kendi yorum bloğu da bunu
söylüyor.

### Yan alan: şifreleme beyanı

`mobile/app.json` içinde
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false` yazılı (ölçüldü).
Bu sayede panel her yüklemede ihracat şifreleme sorusunu tekrar
sormuyor. Uygulamaya ileride kendi şifreleme kodu eklenirse bu değer
yeniden değerlendirilir.

---

## 5. Yaş sınırı ve içerik

- [ ] **Age Rating** anketini doldur. Uygulamada kumar, şiddet,
      kullanıcı içeriği, sohbet ve sınırsız web erişimi **yok**.
- [ ] Gizlilik sayfası uygulamanın 13 yaşın (AB'de 16) altındakilere
      yönelik olmadığını yazıyor — yaş anketinde "Kids" kategorisi
      **seçilmeyecek**.

---

## 6. `eas login` ve derleme

Terminalde, `mobile/` dizininde:

- [ ] `npx eas-cli@latest login` — Apple hesabıyla değil, **Expo**
      hesabıyla giriş. `app.json` → `owner: "atahanpharma"` (ölçüldü),
      yani giriş yapılan Expo hesabı bu hesaba erişebilmeli.
- [ ] `npx eas-cli@latest whoami` ile doğrula.
- [ ] `npx eas-cli@latest build --platform ios --profile production`
      Bu komut sırasında EAS, Apple hesabına giriş isteyip imza
      sertifikası ve profil üretecek — **o adımı sen onaylayacaksın**,
      iki aşamalı doğrulama kodunu da sen gireceksin.

`eas.json` ölçüldü: `cli.appVersionSource: "remote"`, yani sürüm numarası
EAS tarafında tutuluyor ve `production` profilinde `autoIncrement: true`
var. `app.json`'daki `version: "1.0.0"` mağazada görünen sürüm adı
olarak kalıyor.

**`npm install` çalıştırma** — bağımlılıklar kurulu ve kilitli; gerekçe
`mobile/README.md` §6'da.

---

## 7. TestFlight iç test grubu

- [ ] Panelde **TestFlight** → **Internal Testing** → `+` ile grup
      oluştur, ör. ad: `İç Test`
- [ ] Kendini (App Store Connect kullanıcın) gruba ekle. İç test
      kullanıcıları panelde zaten tanımlı kişiler olmak zorunda; iç test
      **Beta App Review beklemez**, yükleme biter bitmez kurulabilir.
- [ ] Derlemeyi gruba ata:
      `npx eas-cli@latest submit --platform ios --profile production`
      (ya da panelden yüklenen derlemeyi elle ata)
- [ ] Telefonda TestFlight ile kur ve **ilk gerçek cihaz ölçümünü yap** —
      bugüne kadar uygulama hiçbir gerçek iPhone'da çalıştırılmadı
      (`mobile/README.md` → Dürüst eksikler). Bakılacaklar: güvenli alan,
      sekme çubuğu, dokunma hedefleri, kaydırma akıcılığı, ekranların
      beşinin de veri getirmesi.

---

## 8. Göndermeden önce son geçiş

- [ ] `magaza/app-store-metinleri.md` içindeki altı alan panele
      kopyalandı; karakter sayıları sınır altında.
- [ ] Ekran görüntüleri yüklendi — **şu an YOK**
      (`magaza/ekran-goruntuleri.md`).
- [ ] `/gizlilik` ve `/destek` adresleri tarayıcıda açıldı ve açıldığı
      görüldü.
- [ ] App Privacy anketi `/gizlilik` ile satır satır karşılaştırıldı.
- [ ] Kategori **Finans**.
- [ ] İnceleme notuna (App Review Information → Notes) şu bilgi yazıldı:
      uygulama hesap açılmasını gerektirmiyor, giriş bilgisi gerekmez;
      tüm veriler kamuya açık kaynaklardan derlenen ölçümlerdir ve
      uygulama yatırım danışmanlığı sunmaz.
- [ ] İletişim: inceleme formundaki iletişim alanı panelin kendi alanı —
      mağaza **metinlerine** e-posta adresi konmadı, konmayacak.

---

Bilgi amaçlıdır, yatırım tavsiyesi değildir.
