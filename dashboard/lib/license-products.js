/**
 * Parse PL/WS and Webex product license pairs (used/entitled) from spreadsheet text.
 */
class LicenseProductParser {
  static LICENSE_COL = 'Provisioned/Entitled Lic Calling';
  static LEGACY_ENT_COL = 'Entitled Lic Calling';
  static LEGACY_PROV_COL = 'Providioned Lic Calling';

  /** Order matters: WxMS before WxM so "WxMS" is not read as "WxM". */
  static PRODUCT_PAIR_RE =
    /\b(WxMS|WxM|WxCC|PL|WS|STD|Standard)\s*:?\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi;
  static STANDARD_PAIR_RE =
    /\bStandard\s+(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi;
  /** Professional, Standard, Workspace pairs in merged / legacy license cells (not WxMS/WxM/WxCC). */
  static CALLING_PAIR_RE =
    /\b(?:PL|WS|STD|Professional|Standard|Workspace)\s*:?\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi;
  static CALLING_PAIR_LABEL_RE =
    /\b(Professional|Standard|Workspace|PL|WS|STD)\s*:?\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi;
  static CALLING_PAIR_PROV_RE =
    /\b(Professional|Standard|Workspace|PL|WS|STD)\s*:?\s*(\d[\d,]*)\s*\/\s*\d[\d,]*/gi;

  static callingProductLabel(token) {
    const t = String(token || '').toUpperCase();
    if (t === 'WS' || t === 'WORKSPACE') return 'Workspace';
    if (t === 'STD' || t === 'STANDARD') return 'Standard';
    return 'Professional';
  }

  static LIC_BREAKDOWN_COLS = [
    'Lic Professional (used/entitled)',
    'Lic Standard (used/entitled)',
    'Lic Workspace (used/entitled)',
  ];

  /** e.g. "1,265 workspace 335" → Professional 1265, Workspace 335 */
  static PROF_WS_SHORT_RE = /(\d[\d,]*)\s+workspace\s+(\d[\d,]*)/i;

  static DISPLAY_LABELS = {
    wxMeetingSuite: 'Webex Meeting Suite',
    wxMeetings: 'Webex Meetings',
    wxContactCenter: 'Webex Contact Center',
    pl: 'Professional',
    std: 'Standard',
    ws: 'Workspace',
  };

  static parseFromText(...sources) {
    const combined = sources.filter((s) => s != null && String(s).trim()).join(' ');
    const out = {
      pl: '',
      std: '',
      ws: '',
      wxMeetingSuite: '',
      wxMeetings: '',
      wxContactCenter: '',
    };
    if (!combined.trim()) return out;

    const re = new RegExp(LicenseProductParser.PRODUCT_PAIR_RE.source, 'gi');
    let m;
    while ((m = re.exec(combined)) !== null) {
      const token = m[1].toUpperCase();
      const pair = `${m[2]}/${m[3]}`;
      if (token === 'WXMS') out.wxMeetingSuite = pair;
      else if (token === 'WXM') out.wxMeetings = pair;
      else if (token === 'WXCC') out.wxContactCenter = pair;
      else if (token === 'PL') out.pl = pair;
      else if (token === 'STD' || token === 'STANDARD') out.std = pair;
      else if (token === 'WS') out.ws = pair;
    }
    const stdRe = new RegExp(LicenseProductParser.STANDARD_PAIR_RE.source, 'gi');
    while ((m = stdRe.exec(combined)) !== null) {
      if (!out.std) out.std = `${m[1]}/${m[2]}`;
    }
    return out;
  }

  static parseProfWsShorthand(text) {
    const m = String(text || '').match(LicenseProductParser.PROF_WS_SHORT_RE);
    if (!m) return null;
    return { pl: m[1], ws: m[2] };
  }

  static fmtCount(n) {
    return Math.round(Number(n) || 0).toLocaleString();
  }

  static parsePlWsSingleCell(val) {
    const out = { pl: null, std: null, ws: null };
    const s = String(val ?? '').trim();
    if (!s) return out;
    let m;
    const plRe = /\bPL\s*:\s*(\d[\d,]*)/gi;
    const stdRe = /\bSTD\s*:\s*(\d[\d,]*)/gi;
    const wsRe = /\bWS\s*:\s*(\d[\d,]*)/gi;
    while ((m = plRe.exec(s)) !== null) out.pl = LicenseProductParser.parseNum(m[1]);
    while ((m = stdRe.exec(s)) !== null) out.std = LicenseProductParser.parseNum(m[1]);
    while ((m = wsRe.exec(s)) !== null) out.ws = LicenseProductParser.parseNum(m[1]);
    return out;
  }

  static hasProfWsPairFormat(val) {
    return /\b(?:PL|WS|STD|Professional|Standard|Workspace)\s*:?\s*\d[\d,]*\s*\/\s*\d[\d,]*/i.test(
      String(val ?? '')
    );
  }

  static normalizeProfWsDisplay(text) {
    let s = String(text ?? '').trim();
    if (!s) return '';
    s = s.replace(
      /\b(PL|STD|WS)\s*:?\s*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi,
      (_, token, p, e) => {
        const name = LicenseProductParser.callingProductLabel(token);
        return `${name} ${LicenseProductParser.fmtCount(p)}/${LicenseProductParser.fmtCount(e)}`;
      }
    );
    s = s.replace(
      /\b(Professional|Standard|Workspace)\s+(\d[\d,]*)\s*\/\s*(\d[\d,]*)/gi,
      (_, name, p, e) =>
        `${name} ${LicenseProductParser.fmtCount(p)}/${LicenseProductParser.fmtCount(e)}`
    );
    return s.replace(/\s*;\s*/g, '; ').replace(/,\s*(?=(?:Workspace|Standard)\b)/gi, '; ');
  }

  static parseBreakdownPair(val) {
    const m = String(val ?? '').trim().match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    if (!m) return null;
    return {
      provisioned: LicenseProductParser.parseNum(m[1]),
      entitled: LicenseProductParser.parseNum(m[2]),
    };
  }

  static mergedHasCallingProduct(merged, product) {
    const s = String(merged ?? '');
    if (product === 'standard') {
      return /\b(?:STD|Standard)\s*:?\s*\d[\d,]*\s*\/\s*\d[\d,]*/i.test(s);
    }
    if (product === 'workspace') {
      return /\b(?:WS|Workspace)\s*:?\s*\d[\d,]*\s*\/\s*\d[\d,]*/i.test(s);
    }
    return /\b(?:PL|Professional)\s*:?\s*\d[\d,]*\s*\/\s*\d[\d,]*/i.test(s);
  }

  static augmentTotalsFromBreakdownColumns(row, mergedText) {
    let entitled = 0;
    let provisioned = 0;
    const specs = [
      ['Lic Professional (used/entitled)', 'professional'],
      ['Lic Standard (used/entitled)', 'standard'],
      ['Lic Workspace (used/entitled)', 'workspace'],
    ];
    specs.forEach(([col, product]) => {
      if (mergedText && LicenseProductParser.mergedHasCallingProduct(mergedText, product)) return;
      const pair = LicenseProductParser.parseBreakdownPair(row[col]);
      if (!pair) return;
      entitled += pair.entitled;
      provisioned += pair.provisioned;
    });
    return { entitled, provisioned };
  }

  static getLicenseCell(row) {
    const merged = String(row?.[LicenseProductParser.LICENSE_COL] ?? '').trim();
    if (merged) return merged;
    return '';
  }

  static hasLegacySplitColumns(row) {
    return Boolean(
      String(row?.[LicenseProductParser.LEGACY_ENT_COL] ?? '').trim() ||
        String(row?.[LicenseProductParser.LEGACY_PROV_COL] ?? '').trim()
    );
  }

  /** Entitled counts only — from merged prov/ent cell or legacy entitled column. */
  static formatEntitledOnlyColumn(row) {
    const merged = LicenseProductParser.getLicenseCell(row);
    if (merged && LicenseProductParser.hasProfWsPairFormat(merged)) {
      const parts = [];
      const pairRe = new RegExp(LicenseProductParser.CALLING_PAIR_LABEL_RE.source, 'gi');
      let m;
      while ((m = pairRe.exec(merged)) !== null) {
        const name = LicenseProductParser.callingProductLabel(m[1]);
        parts.push(`${name} ${LicenseProductParser.fmtCount(m[3])}`);
      }
      if (parts.length) return parts.join('; ');
      const total = LicenseProductParser.sumPlWsCell(merged, 'entitled');
      return total ? LicenseProductParser.fmtCount(total) : merged;
    }
    return LicenseProductParser.formatEntitledColumn(row);
  }

  /** Provisioned counts only — from merged prov/ent cell or legacy provisioned column. */
  static formatProvisionedOnlyColumn(row) {
    const merged = LicenseProductParser.getLicenseCell(row);
    if (merged && LicenseProductParser.hasProfWsPairFormat(merged)) {
      const parts = [];
      const pairRe = new RegExp(LicenseProductParser.CALLING_PAIR_PROV_RE.source, 'gi');
      let m;
      while ((m = pairRe.exec(merged)) !== null) {
        const name = LicenseProductParser.callingProductLabel(m[1]);
        parts.push(`${name} ${LicenseProductParser.fmtCount(m[2])}`);
      }
      if (parts.length) return parts.join('; ');
      const total = LicenseProductParser.sumPlWsCell(merged, 'provisioned');
      return total ? LicenseProductParser.fmtCount(total) : merged;
    }
    return LicenseProductParser.formatProvisionedColumn(row);
  }

  /** Display merged prov/ent column (normalize commas / labels). */
  static formatLicenseColumn(row) {
    const merged = LicenseProductParser.getLicenseCell(row);
    if (merged && LicenseProductParser.hasProfWsPairFormat(merged)) {
      return LicenseProductParser.normalizeProfWsDisplay(merged);
    }
    if (merged) return merged;
    return LicenseProductParser.formatEntitledColumn(row);
  }

  /** @deprecated use formatLicenseColumn — legacy entitled-only display */
  static formatEntitledColumn(row) {
    const entitledRaw = String(row[LicenseProductParser.LEGACY_ENT_COL] ?? '').trim();
    const provRaw = String(row[LicenseProductParser.LEGACY_PROV_COL] ?? '').trim();

    if (LicenseProductParser.hasProfWsPairFormat(entitledRaw)) {
      return LicenseProductParser.normalizeProfWsDisplay(entitledRaw);
    }

    if (LicenseProductParser.hasProfWsPairFormat(provRaw) && !entitledRaw) {
      return LicenseProductParser.normalizeProfWsDisplay(provRaw);
    }

    const ent = LicenseProductParser.parsePlWsSingleCell(entitledRaw);
    const prov = LicenseProductParser.parsePlWsSingleCell(provRaw);
    const parts = [];
    if (ent.pl != null || prov.pl != null) {
      parts.push(
        `Professional ${LicenseProductParser.fmtCount(prov.pl ?? 0)}/${LicenseProductParser.fmtCount(ent.pl ?? 0)}`
      );
    }
    if (ent.std != null || prov.std != null) {
      parts.push(
        `Standard ${LicenseProductParser.fmtCount(prov.std ?? 0)}/${LicenseProductParser.fmtCount(ent.std ?? 0)}`
      );
    }
    if (ent.ws != null || prov.ws != null) {
      parts.push(
        `Workspace ${LicenseProductParser.fmtCount(prov.ws ?? 0)}/${LicenseProductParser.fmtCount(ent.ws ?? 0)}`
      );
    }
    if (parts.length) return parts.join('; ');
    return entitledRaw;
  }

  /** @deprecated split-column layout — use formatLicenseColumn */
  static formatProvisionedColumn(row) {
    const provRaw = String(row[LicenseProductParser.LEGACY_PROV_COL] ?? '').trim();
    if (LicenseProductParser.hasProfWsPairFormat(provRaw)) {
      return LicenseProductParser.normalizeProfWsDisplay(provRaw);
    }
    const prov = LicenseProductParser.parsePlWsSingleCell(provRaw);
    const parts = [];
    if (prov.pl != null) parts.push(`Professional ${LicenseProductParser.fmtCount(prov.pl)}`);
    if (prov.std != null) parts.push(`Standard ${LicenseProductParser.fmtCount(prov.std)}`);
    if (prov.ws != null) parts.push(`Workspace ${LicenseProductParser.fmtCount(prov.ws)}`);
    if (parts.length) return parts.join('; ');
    return provRaw;
  }

  static formatActiveColumn(val) {
    const n = LicenseProductParser.sumPlWsCell(val, 'active');
    if (n) return LicenseProductParser.fmtCount(n);
    return String(val ?? '').trim();
  }

  static parseNum(s) {
    return parseFloat(String(s ?? '').replace(/,/g, '')) || 0;
  }

  /**
   * Sum Professional + Standard + Workspace counts from a license cell (not WxMS/WxM/WxCC).
   * @param {string} val - cell text
   * @param {'entitled'|'provisioned'|'active'} columnKind - which column the value came from
   */
  static sumPlWsCell(val, columnKind) {
    const s = String(val ?? '').trim();
    if (!s) return 0;

    let total = 0;
    let found = false;

    const pairRe = new RegExp(LicenseProductParser.CALLING_PAIR_RE.source, 'gi');
    let m;
    while ((m = pairRe.exec(s)) !== null) {
      found = true;
      const prov = LicenseProductParser.parseNum(m[1]);
      const ent = LicenseProductParser.parseNum(m[2]);
      if (columnKind === 'entitled') total += ent;
      else total += prov;
    }
    if (found) return total;

    const singleRe = /\b(?:PL|STD|WS)\s*:\s*(\d[\d,]*)/gi;
    while ((m = singleRe.exec(s)) !== null) {
      found = true;
      total += LicenseProductParser.parseNum(m[1]);
    }
    if (found) return total;

    const shorthand = LicenseProductParser.parseProfWsShorthand(s);
    if (shorthand) {
      return (
        LicenseProductParser.parseNum(shorthand.pl) + LicenseProductParser.parseNum(shorthand.ws)
      );
    }

    const nums = s.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!nums) return 0;
    if (nums.length === 1) return LicenseProductParser.parseNum(nums[0]);
    if (columnKind === 'active') {
      return nums.reduce((acc, n) => acc + LicenseProductParser.parseNum(n), 0);
    }
    return 0;
  }

  static rowLicenseTotals(row) {
    const merged = LicenseProductParser.getLicenseCell(row);
    if (merged && LicenseProductParser.hasProfWsPairFormat(merged)) {
      const augment = LicenseProductParser.augmentTotalsFromBreakdownColumns(row, merged);
      return {
        entitled:
          LicenseProductParser.sumPlWsCell(merged, 'entitled') + augment.entitled,
        provisioned:
          LicenseProductParser.sumPlWsCell(merged, 'provisioned') + augment.provisioned,
        active: LicenseProductParser.sumPlWsCell(row['Active Lic Calling'], 'active'),
      };
    }
    const entitledRaw = row[LicenseProductParser.LEGACY_ENT_COL];
    const provisionedRaw = row[LicenseProductParser.LEGACY_PROV_COL];
    const legacyText = [entitledRaw, provisionedRaw]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const entitled = LicenseProductParser.sumPlWsCell(entitledRaw, 'entitled');
    const provisioned = LicenseProductParser.sumPlWsCell(provisionedRaw, 'provisioned');
    const augment = LicenseProductParser.augmentTotalsFromBreakdownColumns(
      row,
      LicenseProductParser.hasProfWsPairFormat(legacyText) ? legacyText : ''
    );
    const active = LicenseProductParser.sumPlWsCell(row['Active Lic Calling'], 'active');
    return {
      entitled: entitled + augment.entitled,
      provisioned: provisioned + augment.provisioned,
      active,
    };
  }

  /** Last source in the list wins for shorthand counts (provisioned over entitled). */
  static mergeShorthandFromSources(sources) {
    let pl = '';
    let ws = '';
    sources.forEach((src) => {
      const parsed = LicenseProductParser.parseProfWsShorthand(src);
      if (!parsed) return;
      pl = parsed.pl;
      ws = parsed.ws;
    });
    return { pl, ws };
  }

  static mergeIntoProvisioning(p, sources) {
    const parsed = LicenseProductParser.parseFromText(...sources);
    const shorthand = LicenseProductParser.mergeShorthandFromSources(sources);
    const pl =
      BiaSanitizer.sanitizeField(p.licProfessional || p.professional || '') ||
      parsed.pl ||
      shorthand.pl;
    const std =
      BiaSanitizer.sanitizeField(p.licStandard || p.standard || '') || parsed.std;
    const ws =
      BiaSanitizer.sanitizeField(p.licWorkspace || p.workspace || '') ||
      parsed.ws ||
      shorthand.ws;
    return {
      pl,
      std,
      ws,
      wxMeetingSuite: BiaSanitizer.sanitizeField(p.wxMeetingSuite || '') || parsed.wxMeetingSuite,
      wxMeetings: BiaSanitizer.sanitizeField(p.wxMeetings || '') || parsed.wxMeetings,
      wxContactCenter:
        BiaSanitizer.sanitizeField(p.wxContactCenter || '') || parsed.wxContactCenter,
    };
  }

  static hasPlWsBreakdown(lic) {
    return Boolean(lic.pl || lic.std || lic.ws);
  }

  static hasAnyProduct(lic) {
    return Boolean(
      lic.pl || lic.std || lic.ws || lic.wxMeetingSuite || lic.wxMeetings || lic.wxContactCenter
    );
  }
}

CheckBack.Dashboard.LicenseProductParser = LicenseProductParser;
