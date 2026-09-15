/**
 * Sanitization and value normalization for BIA slides and workbook rows.
 */
class BiaSanitizer {
  static isEmptyVal(v) {
    const s = String(v ?? '').trim();
    return !s || s === '—' || s === '-' || /^n\/?a$/i.test(s);
  }

  /** Strip PDF parser bleed (org ids, add-on tables, wrong field merges). */
  static sanitizeField(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return '';
    s = s.replace(/Customer Org ID:\s*[a-f0-9-]{36}/gi, '');
    s = s.replace(/Add-Ons \(Purchased, Trial, Using\)[\s\S]*/i, '');
    s = s.replace(/\|\s*Calling:.*$/i, '');
    s = s.replace(/Meetings:\s*NU[^|]*/i, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (/^(NU|AU)\s*_/i.test(s) && s.length < 40) return '';
    if (/^PSTN Cisco Calling Plans/i.test(s)) return '';
    return s;
  }

  static sanitizeMoney(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    if (!s || s === '$-' || s === '-') return '';
    if (/Licenses Active|External Calls vs|numbers \(/i.test(s)) return '';
    const m = s.match(/^\$[\d,.]+[KMB]?/i);
    return m ? m[0] : s.split(/\s{2,}/)[0].trim();
  }

  /** Parse currency-like text to a number (supports $, commas, K/M/B). */
  static parseMoneyNumber(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return null;
    s = s.replace(/^\$/, '').replace(/,/g, '').trim();
    const suffix = s.match(/^([\d.]+)\s*([KMB])$/i);
    if (suffix) {
      let n = parseFloat(suffix[1]);
      if (Number.isNaN(n)) return null;
      const mult = { K: 1e3, M: 1e6, B: 1e9 };
      n *= mult[suffix[2].toUpperCase()] || 1;
      return n;
    }
    const n = parseFloat(s.replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  /** Dashboard display only — full USD currency formatting. */
  static formatMoneyDisplay(raw) {
    const n = BiaSanitizer.parseMoneyNumber(raw);
    if (n == null) {
      const s = BiaSanitizer.sanitizeMoney(raw) || BiaSanitizer.sanitizeField(raw);
      return s || '';
    }
    const rawStr = String(raw ?? '');
    const hasCents =
      Math.abs(n - Math.round(n)) > 0.001 || /\.\d{1,2}(?:\D|$)/.test(rawStr);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(n);
  }

  /** Parse user-edited currency back to a workbook-safe value (used only after slide edits). */
  static normalizeMoneyColumnValue(raw) {
    const n = BiaSanitizer.parseMoneyNumber(raw);
    if (n == null) return String(raw ?? '').trim();
    if (Math.abs(n - Math.round(n)) < 0.001) return Math.round(n);
    return Math.round(n * 100) / 100;
  }

  static sanitizeSegment(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    if (/External Calls|Licenses Active|@cisco\.com/i.test(s)) return '';
    return s;
  }

  static cleanVal(v) {
    const s = BiaSanitizer.sanitizeField(v);
    if (!s || s === '—') return '';
    return s;
  }

  static licPair(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    const m = s.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    return m ? `${m[1]}/${m[2]}` : s;
  }

  static healthClass(h) {
    const x = String(h || '').toLowerCase();
    if (x === 'good') return { class: 'good', label: 'Good' };
    if (x === 'risk') return { class: 'risk', label: 'Risk' };
    if (x === 'upsell') return { class: 'upsell', label: 'Upsell' };
    return { class: 'unknown', label: h || '—' };
  }

  static healthToGyr(health) {
    const h = String(health || '').toLowerCase();
    if (h === 'good') return 'G';
    if (h === 'risk') return 'R';
    if (h === 'upsell' || h === 'yellow') return 'Y';
    return '';
  }

  /** Normalized G/Y/R from a workbook row (canonical + legacy column). */
  static rowGyrValue(row) {
    if (!row) return '';
    const gyrCol =
      (typeof CheckBack !== 'undefined' &&
        CheckBack.Dashboard &&
        CheckBack.Dashboard.Constants &&
        CheckBack.Dashboard.Constants.GYR_COL) ||
      '(G/Y/R)';
    const legacyCol =
      (typeof CheckBack !== 'undefined' &&
        CheckBack.Dashboard &&
        CheckBack.Dashboard.Constants &&
        CheckBack.Dashboard.Constants.LEGACY_GYR_COL) ||
      ' (G/Y/R)';
    const raw = row[gyrCol] ?? row[legacyCol] ?? row['Final Determination'] ?? '';
    return BiaSanitizer.normalizeGyrColumnValue(raw);
  }

  /** Workbook (G/Y/R) column — single letter only, not slide display labels. */
  static normalizeGyrColumnValue(raw) {
    const s = String(raw ?? '').trim();
    if (!s || s === '—') return '';
    const fromLabel = BiaSanitizer.healthToGyr(s);
    if (fromLabel) return fromLabel;
    const c = s.toUpperCase().charAt(0);
    if (c === 'G' || c === 'Y' || c === 'R') return c;
    return s;
  }

  static gyrToHealth(gyr) {
    const v = String(gyr || '').trim().toUpperCase();
    const c = v.charAt(0);
    if (c === 'G') return 'Good';
    if (c === 'R') return 'Risk';
    if (c === 'Y') return 'Upsell';
    return '';
  }

  static parseTimelineFromTerm(term) {
    const t = String(term || '');
    let years = 5;
    let currentYear = 2;
    const yrMatch = t.match(/(\d+)\s*yr/i);
    if (yrMatch) years = Math.min(10, Math.max(1, parseInt(yrMatch[1], 10)));
    const yearOf = t.match(/Year\s+(\d+)\s+of\s+(\d+)/i);
    if (yearOf) {
      currentYear = parseInt(yearOf[1], 10) || currentYear;
      years = parseInt(yearOf[2], 10) || years;
    }
    return { years, currentYear };
  }

  static normalizeOrgId(val) {
    return String(val ?? '').trim().toLowerCase();
  }

  /** positive | negative | neutral — for trend pill coloring. */
  static trendSign(raw) {
    const s = String(raw ?? '').trim().replace(/%\s*$/, '');
    if (!s) return 'neutral';
    if (/\bDOWN\b/i.test(s) || /\bdecreas/i.test(s)) return 'negative';
    if (/\bUP\b/i.test(s) || /\bincreas/i.test(s)) return 'positive';
    const signed = s.match(/[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
    if (signed) {
      const n = parseFloat(signed[0]);
      if (Number.isNaN(n) || n === 0) return 'neutral';
      return n > 0 ? 'positive' : 'negative';
    }
    return 'neutral';
  }

  /** Display trend metrics with a trailing % for numeric workbook values. */
  static formatTrendDisplay(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    if (!s) return '';
    if (/%/.test(s)) return s;
    const compact = s.match(/^([-+]?\d+(?:\.\d+)?)$/);
    if (compact) return `${compact[1]}%`;
    return s;
  }

  /** Workbook storage — strip trailing % from trend columns. */
  static normalizeTrendColumnValue(raw) {
    return String(raw ?? '')
      .trim()
      .replace(/%\s*$/, '');
  }
}

CheckBack.Dashboard.BiaSanitizer = BiaSanitizer;
