// =====================================================================
//  ÇÖZÜCÜ KANCASI — ayrı iş parçacığında koşan `resolve` ucu
// ---------------------------------------------------------------------
//  Node modül kancaları KENDİ iş parçacığında yüklenir; bu yüzden
//  `cozucu.mjs`den ayrı bir dosya olmak ZORUNDA. Burada yalnız ad
//  çözümlemesi var — modül İÇERİĞİNE dokunulmuyor, dolayısıyla ölçülen
//  kaynak gerçek `src/` dosyası kalıyor.
//
//  İKİ İŞ YAPAR:
//    ① `@/lib/kalici` → bellek-içi sahte depo (RN deposu Node'da yüklenmez)
//    ② uzantısız içe aktarma → `.ts` / `.tsx` / `/index.*`
//       TypeScript `./types` yazmaya izin verir, Node ise kesin dosya adı
//       ister. ÖLÇÜLDÜ: `liste.ts` içindeki `from './types'` bu kanca
//       olmadan `ERR_MODULE_NOT_FOUND` veriyordu.
//
//  `nextResolve` ASENKRON: `await` olmadan sarılan try/catch reddi
//  yakalamaz (ilk denemede bu hataya düşüldü, ölçüldü ve düzeltildi).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

const YEDEKLER = new Map([
  ['@/lib/kalici', new URL('./sahte-depo.mjs', import.meta.url).href],
]);

/** Uzantısız ada eklenecek son ekler — sıra ÖNEMLİ, ilk tutan kazanır. */
const SONEKLER = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

async function dene(temelUrl, context, nextResolve) {
  for (const son of SONEKLER) {
    try {
      return await nextResolve(temelUrl + son, context);
    } catch {
      // sıradaki soneki dene
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const yedek = YEDEKLER.get(specifier);
  if (yedek) return { url: yedek, shortCircuit: true, format: 'module' };

  if (specifier.startsWith('@/')) {
    const temel = new URL('../src/' + specifier.slice(2), import.meta.url).href;
    const sonuc = await dene(temel, context, nextResolve);
    if (sonuc) return sonuc;
    throw new Error(`cozucu: "${specifier}" src/ altinda bulunamadi`);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (hata) {
    // Yalnız göreli + uzantısız adlar için sonek dene; başka hatayı yutma.
    const goreli = specifier.startsWith('./') || specifier.startsWith('../');
    const uzantisiz = !/\.[a-z]+$/i.test(specifier);
    if (hata?.code === 'ERR_MODULE_NOT_FOUND' && goreli && uzantisiz && context.parentURL) {
      const temel = new URL(specifier, context.parentURL).href;
      const sonuc = await dene(temel, context, nextResolve);
      if (sonuc) return sonuc;
    }
    throw hata;
  }
}
