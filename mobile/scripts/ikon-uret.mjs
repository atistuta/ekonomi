// =====================================================================
//  UYGULAMA İKONU ÜRETİCİ — "Sabah Bülteni" markası   (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: ikon / splash / Android uyarlanabilir ikon katmanlarını ve
//  favicon'u ÜRETİR. Çalıştır: `node scripts/ikon-uret.mjs`
//
//  NEDEN KOD, HAZIR PNG DEĞİL: ikon tek bir ikili dosya olsaydı tasarım
//  bir daha ASLA düzeltilemezdi (hangi hex? hangi oran?). Burada mark
//  matematik: renk ya da oran değişince tek sayı değişir, altı dosya
//  birden yeniden üretilir. İkonlar depoda üretilebilir durumda.
//
//  NEDEN BAĞIMLILIK YOK (sharp / svg dönüştürücü): tek ihtiyaç "düz
//  renkli geometriyi PNG'ye yazmak". Node'un içindeki `zlib` buna
//  yetiyor; PNG kodlayıcı aşağıda ~40 satır. Yalnız varlık üretmek için
//  native derleme gerektiren bir kütüphane kurmak bağımlılık borcuydu.
//
//  MARKA: kendi çizimi — yükselen yarım güneş (sabah) + ufuk çizgisi +
//  yükselen üç çubuk (piyasa). Hiçbir markanın taklidi değil, telifli
//  hiçbir varlık kullanılmıyor. Renkler `src/theme/colors.ts` ile aynı:
//  mürekkep #0F1522, altın #D4A24E.
//
//  NEDEN KENAR YUMUŞATMA ELDE: ikon 1024px üretiliyor ama telefonda
//  60px çiziliyor; testere dişli kenar ucuz görünür. 4×4 üst-örnekleme
//  (16 örnek/piksel) ile kapsama oranı hesaplanıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = join(KOK, 'assets', 'images');

/** Tema ile AYNI renkler (src/theme/colors.ts). */
const MUREKKEP = [0x0f, 0x15, 0x22];
const ALTIN = [0xd4, 0xa2, 0x4e];
const BEYAZ = [0xff, 0xff, 0xff];

// ---------------------------------------------------------------------
//  Marka geometrisi — birim karede (0..1), yukarıdan aşağı y artar.
// ---------------------------------------------------------------------
const UFUK = 0.705; // ufuk çizgisinin y'si
const GUNES = { cx: 0.285, cy: UFUK, r: 0.23 };
const CIZGI = { x0: 0.045, x1: 0.955, kalinlik: 0.045 };
/** Üç çubuk: yükselen — sıralama anlamı yok, "artış" göstergesi. */
const CUBUKLAR = [
  { cx: 0.6, yuk: 0.26 },
  { cx: 0.75, yuk: 0.4 },
  { cx: 0.9, yuk: 0.54 },
];
const CUBUK_GEN = 0.09;
const YUVARLAK = 0.02; // çubuk ve çizgi uçlarının yarıçapı

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Yuvarlatılmış dikdörtgen içinde mi? (merkez cx/cy, yarı en/boy) */
function yuvarlakDikdortgenIci(x, y, cx, cy, yarimW, yarimH, r) {
  const rr = Math.min(r, yarimW, yarimH);
  const dx = Math.max(Math.abs(x - cx) - (yarimW - rr), 0);
  const dy = Math.max(Math.abs(y - cy) - (yarimH - rr), 0);
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Markanın bir noktada dolu olup olmadığı. TEK doğruluk kaynağı: altı
 * dosyanın hepsi bu fonksiyonu kullanıyor, yani ikonlar birbirinden
 * ayrı düşemez.
 */
/**
 * Mark'ın kendi sınırlayıcı kutusu. Geometri "ufuk y'si" gibi okunur
 * sayılarla yazıldı; o sayılar birim kareyi DOLDURMUYOR. Kutu burada
 * bir kez hesaplanıp çizim karesine EŞ ORANLI oturtuluyor — yoksa ikon
 * bir kenara yaslanır ya da şekiller ezilir.
 */
const KUTU = (() => {
  const ustler = CUBUKLAR.map((c) => UFUK - c.yuk);
  const y0 = Math.min(GUNES.cy - GUNES.r, ...ustler);
  const y1 = UFUK + CIZGI.kalinlik;
  const x0 = Math.min(CIZGI.x0, GUNES.cx - GUNES.r);
  const x1 = Math.max(CIZGI.x1, GUNES.cx + GUNES.r);
  const kenar = Math.max(x1 - x0, y1 - y0);
  return { mx: (x0 + x1) / 2, my: (y0 + y1) / 2, kenar };
})();

function markIci(u, v) {
  // Çizim karesinden (0..1) mark uzayına eş oranlı dönüşüm.
  const x = KUTU.mx + (u - 0.5) * KUTU.kenar;
  const y = KUTU.my + (v - 0.5) * KUTU.kenar;
  // Yükselen yarım güneş — ufkun ÜSTÜNDE kalan yarısı.
  if (y <= UFUK) {
    const dx = x - GUNES.cx;
    const dy = y - GUNES.cy;
    if (dx * dx + dy * dy <= GUNES.r * GUNES.r) return true;
  }
  // Ufuk çizgisi.
  if (
    yuvarlakDikdortgenIci(
      x,
      y,
      (CIZGI.x0 + CIZGI.x1) / 2,
      UFUK + CIZGI.kalinlik / 2,
      (CIZGI.x1 - CIZGI.x0) / 2,
      CIZGI.kalinlik / 2,
      CIZGI.kalinlik / 2,
    )
  ) {
    return true;
  }
  // Yükselen çubuklar — ufuktan yukarı.
  for (const c of CUBUKLAR) {
    const ust = UFUK - c.yuk;
    if (
      yuvarlakDikdortgenIci(
        x,
        y,
        c.cx,
        (ust + UFUK) / 2,
        CUBUK_GEN / 2,
        (UFUK - ust) / 2,
        YUVARLAK,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Piksel başına 4×4 örnekle kapsama oranı (kenar yumuşatma). */
function kapsama(px, py, boyut, olcek, kaydir) {
  let sayac = 0;
  const N = 4;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      // Birim kareye taşı, sonra `olcek` ile küçült + `kaydir` ile ortala.
      const u = (px + (i + 0.5) / N) / boyut;
      const v = (py + (j + 0.5) / N) / boyut;
      const x = (u - kaydir) / olcek;
      const y = (v - kaydir) / olcek;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && markIci(x, y)) sayac++;
    }
  }
  return sayac / (N * N);
}

/**
 * RGBA tampon üretir.
 * @param {object} a
 * @param {number} a.boyut kenar uzunluğu (px)
 * @param {number[]|null} a.zemin zemin rengi; `null` = şeffaf
 * @param {number[]} a.mark mark rengi
 * @param {number} a.olcek markın kare içinde kapladığı oran (güvenli alan)
 */
function rgbaUret({ boyut, zemin, mark, olcek }) {
  const kaydir = (1 - olcek) / 2;
  const buf = Buffer.alloc(boyut * boyut * 4);
  for (let py = 0; py < boyut; py++) {
    for (let px = 0; px < boyut; px++) {
      const k = clamp01(kapsama(px, py, boyut, olcek, kaydir));
      const o = (py * boyut + px) * 4;
      if (zemin) {
        // Mark zeminin üstüne karışır; sonuç tamamen opak.
        for (let c = 0; c < 3; c++) buf[o + c] = Math.round(zemin[c] * (1 - k) + mark[c] * k);
        buf[o + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) buf[o + c] = mark[c];
        buf[o + 3] = Math.round(k * 255);
      }
    }
  }
  return buf;
}

// ---------------------------------------------------------------------
//  PNG kodlayıcı — 8 bit RGBA, filtre 0. Bağımlılık yok.
// ---------------------------------------------------------------------
const CRC_TABLO = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLO[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function parca(tip, veri) {
  const uzunluk = Buffer.alloc(4);
  uzunluk.writeUInt32BE(veri.length, 0);
  const govde = Buffer.concat([Buffer.from(tip, 'ascii'), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(govde), 0);
  return Buffer.concat([uzunluk, govde, crc]);
}

function pngYaz(yol, rgba, boyut) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(boyut, 0);
  ihdr.writeUInt32BE(boyut, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // renk tipi: RGBA
  // 10-12: sıkıştırma / filtre / interlace = 0
  const satirlar = Buffer.alloc((boyut * 4 + 1) * boyut);
  for (let y = 0; y < boyut; y++) {
    satirlar[y * (boyut * 4 + 1)] = 0; // filtre: yok
    rgba.copy(satirlar, y * (boyut * 4 + 1) + 1, y * boyut * 4, (y + 1) * boyut * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', deflateSync(satirlar, { level: 9 })),
    parca('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(yol, png);
  return png.length;
}

// ---------------------------------------------------------------------
//  Üretilecek dosyalar.
// ---------------------------------------------------------------------
//  `olcek` NEDEN FARKLI: Android uyarlanabilir ikon ön katmanını sistem
//  KIRPIYOR (daire/squircle maskesi) — güvenli alan kenarın %66'sı, bu
//  yüzden 0.60. iOS ikonu kırpılmıyor ama köşelere yaklaşan mark sıkışık
//  görünür: 0.74. Splash tek başına duruyor, nefes payı geniş: 0.80.
const ISLER = [
  // iOS + genel ikon: TAM DOLU kare, şeffaflık YOK (App Store reddeder).
  { ad: 'icon.png', boyut: 1024, zemin: MUREKKEP, mark: ALTIN, olcek: 0.74 },
  // Açılış ekranı: şeffaf, zemini app.json'daki `backgroundColor` veriyor.
  { ad: 'splash-icon.png', boyut: 1024, zemin: null, mark: ALTIN, olcek: 0.8 },
  { ad: 'android-icon-foreground.png', boyut: 1024, zemin: null, mark: ALTIN, olcek: 0.6 },
  { ad: 'android-icon-background.png', boyut: 1024, zemin: MUREKKEP, mark: MUREKKEP, olcek: 0.6 },
  // Tek renk katman: sistem bunu KENDİ rengiyle boyar, altın olmamalı.
  { ad: 'android-icon-monochrome.png', boyut: 1024, zemin: null, mark: BEYAZ, olcek: 0.6 },
  // Tarayıcı sekmesi: 48px'te mark ince kalmasın, daha büyük ölçek.
  { ad: 'favicon.png', boyut: 48, zemin: MUREKKEP, mark: ALTIN, olcek: 0.82 },
];

mkdirSync(CIKTI, { recursive: true });
for (const is of ISLER) {
  const rgba = rgbaUret(is);
  const bayt = pngYaz(join(CIKTI, is.ad), rgba, is.boyut);
  console.log('✓ ' + is.ad + ' — ' + is.boyut + 'px, ' + bayt + ' bayt');
}
console.log('Bitti. Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
