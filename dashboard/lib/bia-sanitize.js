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

  static isMoneyColumn(col) {
    return col === 'TCV $' || col === 'AAR $';
  }

  static skipGroupedNumberColumn(col) {
    return (
      !col ||
      BiaSanitizer.isMoneyColumn(col) ||
      col === 'Sub #' ||
      col === 'Customer org id' ||
      col === 'Salesforce URL' ||
      col === 'Success Portal' ||
      col === 'Account Name' ||
      col === 'Opportunity Name' ||
      col === 'Opportunity (linked)' ||
      col === 'CSM Engagement Model (linked)' ||
      col === 'Subscription dates' ||
      col === 'Sub Term' ||
      col === 'Sub start date (MM/DD/YYYY)' ||
      col === 'Closed on (MM/YY)' ||
      col === 'Data gathered date' ||
      col === 'Data gathered by' ||
      col === 'Connected-UC (Y/N)' ||
      BiaSanitizer.isGyrColumn(col)
    );
  }

  /** Insert thousands separators for display (1200 → 1,200). Skips IDs, URLs, years. */
  static formatNumbersInText(raw) {
    const s = String(raw ?? '');
    if (!s || s === '—' || s === '-') return s;
    const trimmed = s.trim();
    if (/^https?:\/\//i.test(trimmed)) return s;
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) {
      return s;
    }
    return s.replace(/[A-Za-z]\d[\d,]*|\d[\d,]*(?:\.\d+)?/g, (chunk) => {
      if (/^[A-Za-z]/.test(chunk)) return chunk;
      const n = parseFloat(chunk.replace(/,/g, ''));
      if (Number.isNaN(n)) return chunk;
      if (/^\d{4}$/.test(chunk) && n >= 1900 && n <= 2100) return chunk;
      const frac = chunk.includes('.') ? chunk.split('.')[1].replace(/,/g, '').length : 0;
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: frac,
        maximumFractionDigits: frac,
      }).format(n);
    });
  }

  static formatCountDisplay(raw) {
    return BiaSanitizer.formatNumbersInText(raw);
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
    if (x === 'risk' || x === 'watch' || x === 'yellow') return { class: 'risk', label: 'Risk' };
    if (x === 'critical') return { class: 'critical', label: 'Critical' };
    if (x === 'upsell') return { class: 'upsell', label: 'Upsell' };
    return { class: 'unknown', label: h || '—' };
  }

  static healthToGyr(health) {
    const h = String(health || '').trim().toLowerCase();
    if (h === 'good' || h === 'g') return 'G';
    if (h === 'risk' || h === 'yellow' || h === 'watch' || h === 'y') return 'Y';
    if (h === 'critical' || h === 'r') return 'R';
    if (h === 'upsell' || h === 'u') return 'U';
    return '';
  }

  /** Canonical + legacy health column names: (G/Y/R/U), (G/Y/R), leading-space (G/Y/R). */
  static gyrColumnNames() {
    const C =
      typeof CheckBack !== 'undefined' &&
      CheckBack.Dashboard &&
      CheckBack.Dashboard.Constants
        ? CheckBack.Dashboard.Constants
        : {};
    return [
      C.GYR_COL || '(G/Y/R/U)',
      C.LEGACY_GYR_COL || '(G/Y/R)',
      C.LEGACY_GYR_COL_SPACED || ' (G/Y/R)',
    ];
  }

  static isGyrColumn(col) {
    return BiaSanitizer.gyrColumnNames().includes(col);
  }

  static rowGyrRaw(row) {
    if (!row) return '';
    for (const name of BiaSanitizer.gyrColumnNames()) {
      const v = row[name];
      if (v != null && String(v).trim() !== '' && String(v).trim() !== '—') return v;
    }
    const fd = row['Final Determination'];
    if (fd != null && String(fd).trim() !== '' && String(fd).trim() !== '—') return fd;
    return '';
  }

  /** Copy a legacy health value onto the canonical (G/Y/R/U) key. */
  static aliasGyrOnRow(row) {
    if (!row) return row;
    const canonical = BiaSanitizer.gyrColumnNames()[0];
    const raw = BiaSanitizer.rowGyrRaw(row);
    if (raw !== '' && (row[canonical] == null || String(row[canonical]).trim() === '')) {
      row[canonical] = BiaSanitizer.normalizeGyrColumnValue(raw);
    }
    return row;
  }

  /** Normalized G/Y/R/U from a workbook row (canonical + legacy columns). */
  static rowGyrValue(row) {
    return BiaSanitizer.normalizeGyrColumnValue(BiaSanitizer.rowGyrRaw(row));
  }

  /** Workbook health column — single letter only, not slide display labels. */
  static normalizeGyrColumnValue(raw) {
    const s = String(raw ?? '').trim();
    if (!s || s === '—') return '';
    const fromLabel = BiaSanitizer.healthToGyr(s);
    if (fromLabel) return fromLabel;
    const upper = s.toUpperCase();
    if (upper === 'G' || upper === 'Y' || upper === 'R' || upper === 'U') return upper;
    const c = upper.charAt(0);
    if (c === 'G' || c === 'Y' || c === 'R') return c;
    return s;
  }

  static gyrToHealth(gyr) {
    const letter = BiaSanitizer.normalizeGyrColumnValue(gyr);
    if (letter === 'G') return 'Good';
    if (letter === 'Y') return 'Risk';
    if (letter === 'R') return 'Critical';
    if (letter === 'U') return 'Upsell';
    return '';
  }

  static parseTimelineFromTerm(term) {
    const t = String(term || '');
    let years = 5;
    let currentYear = 2;
    const yrMatch = t.match(/(\d+)\s*y/i);
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

  /** Display trend metrics as signed percents (Excel stores 2.6% as 0.026). */
  static formatTrendDisplay(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    if (!s) return '';
    const m = s.match(/([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)/);
    if (!m) return s;
    let n = parseFloat(m[1]);
    if (Number.isNaN(n)) return s;
    const hadPercent = /%/.test(s);
    if (!hadPercent && Math.abs(n) > 0 && Math.abs(n) <= 1) n *= 100;
    const rounded =
      Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Math.round(n * 10) / 10;
    const num = `${rounded > 0 ? '+' : ''}${rounded}%`;
    const dir = /\bDOWN\b/i.test(s) ? 'DOWN ' : /\bUP\b/i.test(s) ? 'UP ' : '';
    return `${dir}${num}`.trim();
  }

  /** Workbook storage — strip trailing % from trend columns. */
  static normalizeTrendColumnValue(raw) {
    return String(raw ?? '')
      .trim()
      .replace(/%\s*$/, '');
  }
}

CheckBack.Dashboard.BiaSanitizer = BiaSanitizer;
