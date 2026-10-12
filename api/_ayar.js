// ===========================================================================
//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN
// ===========================================================================
//
//  Kaynak : config.js (window.TA_WEIGHTS + window.TA_BENCHMARK)
//  Yenile : node tools/motor-uret.mjs
//  Doğrula: node tests/uretim-test.mjs
//
//  El ağırlıkları config.js'te DURUR — tek doğruluk kaynağı orası. Bu dosya
//  motorun sunucu tarafı için alınmış bir izdüşümü; ağırlık değişecekse
//  config.js değişir, sonra bu dosya yeniden üretilir.
//
//  Vadeler (4): gunici, kisa, orta, uzun
//  Alınmayan: NTFY_TOPIC, MY_PROXY, CORS_PROXY, besleme listeleri.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

export const IMZA_AYAR = 'sha256:75512c5271a89b33';

/** Vade adları — config.js'teki sırayla. */
export const VADELER = ["gunici","kisa","orta","uzun"];

/** Teknik skor el ağırlıkları — vade → { blend, interp, adxTf, weights }. */
export const TA_WEIGHTS = {
  "gunici": {
    "label": "Gün içi",
    "desc": "≈ 1–5 gün ufuk · 60dk + 15dk · order flow ağırlıklı",
    "intraday": true,
    "blend": [
      {
        "tf": "H1",
        "w": 0.55
      },
      {
        "tf": "M15",
        "w": 0.45
      }
    ],
    "interp": "reversal",
    "adxTf": "H1",
    "weights": {
      "trend": 0.06,
      "macd": 0.13,
      "rsi": 0.13,
      "stoch": 0.13,
      "boll": 0.11,
      "obv": 0.08,
      "vp": 0.12,
      "oflow": 0.16,
      "volconf": 0.08
    }
  },
  "kisa": {
    "label": "Kısa vade",
    "desc": "≈ 1–3 ay ufuk · günlük ağırlıklı",
    "blend": [
      {
        "tf": "D",
        "w": 0.7
      },
      {
        "tf": "W",
        "w": 0.3
      }
    ],
    "interp": "reversal",
    "adxTf": "D",
    "weights": {
      "trend": 0.1,
      "ichimoku": 0.05,
      "macd": 0.11,
      "rsi": 0.15,
      "stoch": 0.11,
      "boll": 0.11,
      "obv": 0.07,
      "vp": 0.12,
      "oflow": 0.06,
      "rs": 0.07,
      "volconf": 0.05
    }
  },
  "orta": {
    "label": "Orta-uzun vade",
    "desc": "≈ 6–12 ay ufuk · günlük + haftalık",
    "blend": [
      {
        "tf": "D",
        "w": 0.5
      },
      {
        "tf": "W",
        "w": 0.5
      }
    ],
    "interp": "momentum",
    "adxTf": "D",
    "weights": {
      "trend": 0.18,
      "ichimoku": 0.13,
      "macd": 0.17,
      "rsi": 0.1,
      "stoch": 0.04,
      "boll": 0.05,
      "obv": 0.1,
      "vp": 0.09,
      "rs": 0.09,
      "ttmpl": 0.05
    }
  },
  "uzun": {
    "label": "Uzun vade",
    "desc": "≈ 1–3 yıl ufuk · haftalık + aylık",
    "blend": [
      {
        "tf": "W",
        "w": 0.6
      },
      {
        "tf": "M",
        "w": 0.4
      }
    ],
    "interp": "trend",
    "adxTf": "W",
    "weights": {
      "trend": 0.25,
      "ichimoku": 0.2,
      "macd": 0.16,
      "rsi": 0.08,
      "obv": 0.1,
      "vp": 0.09,
      "rs": 0.07,
      "ttmpl": 0.05
    }
  }
};

/** Göreli Güç karşılaştırma endeksleri (Yahoo sembolü). */
export const TA_BENCHMARK = {
  "BIST": "XU100.IS",
  "US": "^GSPC"
};
