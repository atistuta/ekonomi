// Native push gondericisi (isci tarafi) — tek gorev: /api/bildirim ucunu cagirmak.
// Jetonlari UC tutar; bu dosya jeton GORMEZ, Expo'ya dogrudan istek ATMAZ.
// Sozlesme:
//   POST {BASE}/api/bildirim?code=<SYNC_CODE>&mod=gonder
//   Basliklar: Content-Type: application/json, x-push-secret: <PUSH_SECRET>
//   Govde:     { baslik, mesaj, url: string|null, oncelik: 'normal'|'high' }
//   200 -> { ok:true, gonderildi:<number>, elendi:<number> }
//   401 yetki_yok | 400 kod_yok/bos_govde | 404 jeton_yok | 502 kv_yok/expo_hata
// GUVENLIK: PUSH_SECRET asla loglanmaz — ne tam, ne kismi, ne uzunlugu. Sir yalniz
// BASLIKTA gider, URL/query'ye GIRMEZ (query'de yalnizca `code` var).

const PUSH_SECRET = process.env.PUSH_SECRET;
// watchlist.mjs ile AYNI varsayilan kalip (kod/taban ayni kaynaktan gelmeli).
const CODE = process.env.SYNC_CODE || 'atahan-bulten-9f3c';
const BASE = process.env.SYNC_BASE || 'https://day-starter.vercel.app';

const UC = `${BASE}/api/bildirim?code=${encodeURIComponent(CODE)}&mod=gonder`;

const ZAMAN_ASIMI_MS = 10000; // tek denemenin ust siniri
const BEKLE_MS       = 1500;  // tek yeniden denemeden once aralik

let sirUyarisiVerildi = false; // her bildirimde log fistirtmamak icin: BIR KEZ uyar

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Loglanacak metinden sir izini kazi. Normalde uc sirri yanitta yansitmaz; yine de
// savunma amacli filtreleriz ve metni kisa tutariz (uzunluk bilgisi de sizmasin).
function gizle(metin) {
  let s = (metin == null ? '' : String(metin));
  if (PUSH_SECRET && PUSH_SECRET.length >= 4) s = s.split(PUSH_SECRET).join('[gizli]');
  s = s.replace(/x-push-secret.*/gi, 'x-push-secret: [gizli]');
  return s.slice(0, 200);
}

async function birDeneme(govde) {
  const kes = AbortSignal.timeout ? AbortSignal.timeout(ZAMAN_ASIMI_MS) : undefined;
  const r = await fetch(UC, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-push-secret': PUSH_SECRET,
      'User-Agent': 'sabah-bulteni-worker',
    },
    body: govde,
    signal: kes,
  });
  let j = null;
  const ham = await r.text().catch(() => '');
  try { j = ham ? JSON.parse(ham) : null; } catch { /* JSON degil */ }
  return { durum: r.status, ok: r.ok, j, ham };
}

/**
 * Tek bildirimi uca gonderir.
 * @returns {Promise<{ok:true,gonderildi:number,elendi:number}|{ok:false,sebep:string}>}
 * Firlatmaz: ag hatasinda { ok:false, sebep:'ag' }, sir yoksa { ok:false, sebep:'sir_yok' }.
 */
export async function pushGonder({ baslik, mesaj, url = null, oncelik = 'normal' }) {
  if (!PUSH_SECRET) {
    if (!sirUyarisiVerildi) {
      sirUyarisiVerildi = true;
      console.log('push: PUSH_SECRET tanimsiz → native push atlaniyor (bir kez uyarilir).');
    }
    return { ok: false, sebep: 'sir_yok' };
  }

  const govde = JSON.stringify({
    baslik: baslik == null ? '' : String(baslik),
    mesaj:  mesaj  == null ? '' : String(mesaj),
    url:    url ? String(url) : null,
    oncelik: oncelik === 'high' ? 'high' : 'normal',
  });

  // TEKRAR FIRTINASI YOK: en fazla 2 deneme (1 yeniden deneme), aralikli. Dongu yok.
  let sonSebep = 'ag';
  for (let deneme = 1; deneme <= 2; deneme++) {
    let c;
    try {
      c = await birDeneme(govde);
    } catch (e) {
      sonSebep = 'ag';
      if (deneme === 1) { await bekle(BEKLE_MS); continue; }
      console.error('push: ag hatasi →', gizle(e && e.message));
      return { ok: false, sebep: 'ag' };
    }

    if (c.ok && c.j && c.j.ok) {
      return {
        ok: true,
        gonderildi: Number(c.j.gonderildi) || 0,
        elendi: Number(c.j.elendi) || 0,
      };
    }

    sonSebep = (c.j && (c.j.sebep || c.j.hata || c.j.error)) ? String(c.j.sebep || c.j.hata || c.j.error) : `http_${c.durum}`;

    // Kalici hatalar (401 yetki_yok, 400 kod_yok/bos_govde, 404 jeton_yok) → tekrar BOSA gider.
    const gecici = c.durum === 429 || c.durum >= 500;
    if (!gecici || deneme === 2) {
      console.error(`push: basarisiz (${c.durum}) →`, gizle(sonSebep));
      return { ok: false, sebep: sonSebep };
    }
    await bekle(BEKLE_MS);
  }
  return { ok: false, sebep: sonSebep };
}

/** ntfy sayisal priority → uc oncelik eslemesi (>=5 = "one cikar" → high). */
export const oncelikCevir = (priority) => (Number(priority) >= 5 ? 'high' : 'normal');

export default pushGonder;
