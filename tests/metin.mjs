// =====================================================================
//  BELİRTEÇ DİZİSİ — metin biçimi  (tests/metin.mjs)          FAZ 1/3
// ---------------------------------------------------------------------
//  SORUN: motor Türkçe cümlelere `<b>` / `<i>` / `<em>` / `<br>` gömüyor.
//  React Native bir dizeyi HTML olarak render ETMEZ — mobilde bu etiketler
//  ya ham metin olarak görünür ya da üçüncü parti bir HTML ayrıştırıcı
//  gerektirir. Yani metin biçimi, taşımadan ÖNCE kararlaştırılmalı.
//
//  KARAR: motor HTML değil, BELİRTEÇ DİZİSİ (token array) döndürür.
//  Her hedef kendi render'ını yapar: web `<b>`, RN `<Text style>`.
//
//  ── Biçim ───────────────────────────────────────────────────────────
//    'düz metin'       → metin, aynen
//    ['v', 'metin']    → vurgu           web <b>   RN fontWeight 700
//    ['e', 'Not:']     → etiket öneki    web <b>   RN fontWeight 700
//    ['s', '₺12,40']   → sayı / değer    web <b>   RN 700 + tabular-nums
//    ['d', '+1,4%']    → soluk ikincil   web <em>  RN opacity .85 + tabular
//    ['i', 'olabilir'] → italik          web <i>   RN fontStyle italic
//    ['br']            → satır sonu      web <br>  RN '\n'
//
//  ── NEDEN 'b' YERİNE ÜÇ ROL (v / e / s) ─────────────────────────────
//  Ölçüldü (2026-10-11): cümle korpusundaki 53 `<b>` üç AYRI iş yapıyor:
//    1. vurgu      — `<b>olası dönüş</b>`, `<b>net değil</b>`
//    2. etiket     — `<b>Not:</b>`, `<b>Çelişki:</b>`, `<b>Pozitif uyumsuzluk:</b>`
//    3. sayı yuvası— `<b>${fmtRange(lvl.buyZone)}</b>`, `<b>${earnEps(...)}</b>`
//  Üçü web'de aynı etikete çıkıyor ama MOBİLDE aynı DEĞİL: sayı yuvası
//  `tabular-nums` istiyor (yoksa rakamlar zıplar), etiket öneki ileride
//  ayrı renk alabilir. Tek bir 'b' belirteci bu üç işi geri döndürülemez
//  biçimde aynı kovaya atardı — ve ayrım bir daha kurtarılamazdı.
//
//  ── NEDEN 'd' (soluk) 'i' (italik) DEĞİL ────────────────────────────
//  Bu projede `<em>` italik DEĞİL. Ölçüldü — styles.css:710
//      .ta-zone-l em { font-style: normal; font-variant-numeric: tabular-nums; opacity: .85; }
//  Aynısı styles.css:866 (.ta-si-chip em), :1057, :1108, :1420. Yani `<em>`
//  "soluk, hizalı ikincil değer" anlamında kullanılıyor. Naif bir
//  em→italik eşlemesi mobilde yanlış görünürdü.
//
//  ── ROL İNCELTMESİ HTML'DE GÖRÜNMEZ ─────────────────────────────────
//  v / e / s üçü de web'de `<b>` üretir (metin-test.mjs bunu doğruluyor).
//  Yani bir metni önce ['v',…] ile taşıyıp sonra ['s',…] olarak
//  incelteceksek, web çıktısı BAYT BAYT aynı kalır. Dönüşüm kademeli
//  yapılabilir; tek seferlik büyük bir geçiş gerekmiyor.
//
//  ── PARİTE ──────────────────────────────────────────────────────────
//  baseline.json'da etiketli TEK BİR dize yok (ölçüldü): kurulmuş
//  cümleler (`parts[].note`, `growthNote.txt`) bilinçli olarak
//  dondurulmadı — tam olarak bu dönüşüm için. Bu yüzden belirteç geçişi
//  skor paritesini KIRAMAZ. Ayrıntı: tests/README.md.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Belirteç rolü → web etiketi. v/e/s bilinçli olarak aynı etikete çıkar. */
export const WEB_TAG = { v: 'b', e: 'b', s: 'b', d: 'em', i: 'i' };

/** Belirteç rolü → React Native stil nesnesi. */
export const RN_STYLE = {
  v: { fontWeight: '700' },
  e: { fontWeight: '700' },
  s: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  d: { opacity: 0.85, fontVariant: ['tabular-nums'] },
  i: { fontStyle: 'italic' },
};

/** Boş (içeriksiz) roller — kapanış etiketi beklenmez. */
const VOID_ROLE = new Set(['br']);

function badToken(t) {
  return new Error('geçersiz belirteç: ' + JSON.stringify(t));
}

/**
 * Belirteç dizisi → HTML. WEB PWA'nın render yolu.
 *
 * Geçiş dönemi kolaylığı: düz bir dize verilirse aynen döner. Böylece
 * motor fonksiyonları TEK TEK belirtece çevrilebilir; çağrı yerleri
 * hepsi bitmeden bozulmaz.
 */
export function tokensToHtml(toks) {
  if (typeof toks === 'string') return toks;
  if (toks == null) return '';
  if (!Array.isArray(toks)) throw badToken(toks);

  let out = '';
  for (const t of toks) {
    if (typeof t === 'string') { out += t; continue; }
    if (!Array.isArray(t) || t.length < 1) throw badToken(t);

    const rol = t[0];
    if (VOID_ROLE.has(rol)) {
      if (t.length !== 1) throw badToken(t);
      out += '<br>';
      continue;
    }
    const tag = WEB_TAG[rol];
    if (!tag) throw new Error(`bilinmeyen belirteç rolü: ${JSON.stringify(rol)} — biçim tests/metin.mjs başlığında`);
    if (t.length !== 2 || typeof t[1] !== 'string') throw badToken(t);
    out += `<${tag}>${t[1]}</${tag}>`;
  }
  return out;
}

/**
 * Belirteç dizisi → React Native parça listesi.
 *
 * Node'da RN yok; bu yüzden ELEMENT değil TARİF döndürür:
 *   [{ text: 'Temel sağlam ' }, { text: 've', style: {fontWeight:'700'} }, …]
 * RN tarafında tek satır:
 *   <Text>{parts.map((p,i) => <Text key={i} style={p.style}>{p.text}</Text>)}</Text>
 *
 * Böylece biçim kararı Node'da test edilebiliyor ve Expo projesi
 * kurulmadan önce kanıtlanabiliyor.
 */
export function tokensToRN(toks) {
  if (typeof toks === 'string') return toks ? [{ text: toks }] : [];
  if (toks == null) return [];
  if (!Array.isArray(toks)) throw badToken(toks);

  const parts = [];
  for (const t of toks) {
    if (typeof t === 'string') { if (t) parts.push({ text: t }); continue; }
    if (!Array.isArray(t) || t.length < 1) throw badToken(t);

    const rol = t[0];
    if (VOID_ROLE.has(rol)) {
      if (t.length !== 1) throw badToken(t);
      // RN'de <br> yok — satır sonu metnin kendisidir.
      parts.push({ text: '\n' });
      continue;
    }
    const st = RN_STYLE[rol];
    if (!st) throw new Error(`bilinmeyen belirteç rolü: ${JSON.stringify(rol)} — biçim tests/metin.mjs başlığında`);
    if (t.length !== 2 || typeof t[1] !== 'string') throw badToken(t);
    parts.push({ text: t[1], style: st });
  }
  return parts;
}

/** Belirteç dizisinden düz metin (bildirim gövdesi, erişilebilirlik, arama). */
export function tokensToText(toks) {
  if (typeof toks === 'string') return toks;
  return tokensToRN(toks).map((p) => p.text).join('');
}

// ---------------------------------------------------------------------
//  SADECE TEST — üretimde kullanılmaz.
// ---------------------------------------------------------------------
/**
 * HTML → belirteç dizisi.
 *
 * ★ Bu fonksiyon motorun kullanacağı yol DEĞİL. Motor doğrudan belirteç
 *   üretecek; HTML ayrıştırmak üretimde hiçbir zaman gerekmeyecek.
 *
 * Buradaki tek işi KANIT: mevcut 46 cümleyi belirtece çevirip geri
 * render ettiğimizde BAYT BAYT aynı HTML çıkıyor mu? Çıkıyorsa web PWA
 * bu geçişte görsel olarak hiç değişmez.
 *
 * `<b>` → 'v' olarak geri okunur. v/e/s ayrımı bir İNSAN kararı (hangi
 * `<b>` sayı, hangisi etiket) ve HTML'de görünmez — metin-test.mjs bunu
 * ayrıca doğruluyor. Yani bu basitleştirme kanıtı zayıflatmıyor.
 */
export function htmlToTokens(html) {
  const BACK = { b: 'v', em: 'd', i: 'i' };
  const RX = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\s*(\/?)>/g;
  const toks = [];
  let i = 0, m, open = null, buf = '';

  const pushText = (s) => {
    if (!s) return;
    if (open) { buf += s; return; }
    if (typeof toks[toks.length - 1] === 'string') toks[toks.length - 1] += s;
    else toks.push(s);
  };

  while ((m = RX.exec(html)) !== null) {
    pushText(html.slice(i, m.index));
    i = m.index + m[0].length;
    const kapanis = m[1] === '/';
    const ad = m[2].toLowerCase();

    if (ad === 'br') {
      if (kapanis) throw new Error('</br> geçersiz');
      if (open) throw new Error(`<br> bir <${open}> içinde — iç içe yapı desteklenmiyor`);
      toks.push(['br']);
      continue;
    }
    const rol = BACK[ad];
    if (!rol) throw new Error(`cümle içinde beklenmeyen etiket: <${ad}> — biçim yalnız b/em/i/br tanır`);

    if (!kapanis) {
      if (open) throw new Error(`iç içe etiket: <${ad}> bir <${open}> içinde — biçim iç içe yapıyı desteklemiyor`);
      open = ad; buf = '';
    } else {
      if (open !== ad) throw new Error(`eşleşmeyen kapanış: </${ad}> (açık: ${open ? '<' + open + '>' : 'yok'})`);
      toks.push([rol, buf]);
      open = null; buf = '';
    }
  }
  pushText(html.slice(i));
  if (open) throw new Error(`kapanmayan etiket: <${open}>`);
  return toks;
}
