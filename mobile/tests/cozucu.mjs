// =====================================================================
//  ÇÖZÜCÜ KANCASI — `@/` takma adını saf Node'a öğretir
// ---------------------------------------------------------------------
//  NEDEN VAR — İKİ ÖLÇÜLMÜŞ ENGEL (2026-10-26):
//    ① `tsconfig.json` `@/*` → `src/*` takma adını tanımlıyor; Node bunu
//       BİLMEZ. Ölçüm: `import('src/api/liste.ts')` →
//       `ERR_MODULE_NOT_FOUND: Cannot find package '@/lib'`.
//    ② `@/lib/kalici` → `@react-native-async-storage/async-storage`
//       zinciri saf Node'da yüklenmez (yerel RN modülü bekler).
//
//  ÇÖZÜM: `node:module` çekirdek kancası. `@/...` istekleri `src/...`e,
//  YALNIZCA `@/lib/kalici` ise `tests/sahte-depo.mjs`ye yönlendirilir.
//  Bu bir KOPYA DEĞİL: ölçülen dosya gerçek `src/api/liste.ts`.
//
//  YENİ BAĞIMLILIK YOK: `module.register` Node 20.6+ çekirdeğinde,
//  TypeScript soyması Node 22.6+ çekirdeğinde. Ölçülen sürüm v24.14.1,
//  `--experimental-strip-types` bayrağı GEREKMİYOR (Node 23.6+ itibarıyla
//  tip soyması varsayılan açık) — ölçüldü, `.ts` dosyaları bayraksız
//  yüklendi.
//
//  KULLANIM (test dosyasının EN BAŞINDA, ölçülecek modülden ÖNCE):
//      import './cozucu.mjs';
//      const liste = await import('../src/api/liste.ts');
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./cozucu-kanca.mjs', import.meta.url), pathToFileURL('./'));
