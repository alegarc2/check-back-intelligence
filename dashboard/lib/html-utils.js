/**
 * HTML escaping and insight-slide UI fragments.
 */
class DashboardHtml {
  static esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  static orgLink(id) {
    const prefix = CheckBack.Dashboard.Constants.WEBEX_ORG_ADMIN_PREFIX;
    const v = String(id || '').trim();
    if (!v) return '—';
    const href = prefix + encodeURIComponent(v);
    return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="customer-link">${DashboardHtml.esc(v)}</a>`;
  }

  static normalizeSubId(sub) {
    const s = String(sub ?? '').trim();
    if (!s) return '';
    const m = s.match(/^Sub\s*(\d+)$/i);
    if (m) return `Sub${m[1]}`;
    if (/^\d+$/.test(s)) return `Sub${s}`;
    return s;
  }

  static subDetailUrl(sub) {
    const id = DashboardHtml.normalizeSubId(sub);
    if (!id || !/^Sub\d+$/i.test(id)) return '';
    const prefix = CheckBack.Dashboard.Constants.CCRC_SUB_DETAIL_PREFIX;
    return `${prefix}${id}`;
  }

  /** Workbook-safe Sub # value — never persist CCRC URLs in the Sub # column. */
  static normalizeSubColumnValue(val) {
    let s = String(val ?? '').trim();
    if (!s) return '';
    const ccrc = s.match(/subscriptions\/detail\/(Sub\d+)/i);
    if (ccrc) return ccrc[1];
    if (/^https?:\/\//i.test(s)) {
      try {
        const seg = new URL(s).pathname.split('/').filter(Boolean).pop() || '';
        if (/^Sub\d+$/i.test(seg)) return DashboardHtml.normalizeSubId(seg);
      } catch {
        /* ignore invalid URL */
      }
    }
    if (s.includes(',')) {
      return s
        .split(',')
        .map((part) => DashboardHtml.normalizeSubColumnValue(part.trim()))
        .filter(Boolean)
        .join(', ');
    }
    return DashboardHtml.normalizeSubId(s) || s;
  }

  static subLinksHtml(val) {
    if (val == null || val === '') return '';
    const subs = String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!subs.length) return '';
    return subs
      .map((sub) => {
        const url = DashboardHtml.subDetailUrl(sub);
        const label = DashboardHtml.normalizeSubId(sub) || sub;
        if (!url) return DashboardHtml.esc(label);
        return `<a href="${DashboardHtml.escAttr(url)}" target="_blank" rel="noopener noreferrer" class="customer-link">${DashboardHtml.esc(label)}</a>`;
      })
      .join(', ');
  }

  static linkLabelForUrl(url) {
    const u = String(url || '').trim();
    if (!u) return 'Link';
    if (/force\.com/i.test(u)) return 'S&C';
    if (/success/i.test(u) && /portal|webex/i.test(u)) return 'Success Portal';
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return 'Link';
    }
  }

  static escAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  static editableAttrs(col, rawValue) {
    if (!col) return '';
    let extra = '';
    if (col === 'TCV $' && rawValue != null && String(rawValue).trim() !== '') {
      extra = ` data-raw-value="${DashboardHtml.escAttr(String(rawValue))}"`;
    }
    return ` class="bia-editable-value" data-col="${DashboardHtml.escAttr(col)}"${extra} contenteditable="false"`;
  }

  static kv(label, value, col, opts) {
    const options = opts || {};
    const raw = BiaSanitizer.cleanVal(value);
    if (!raw) return '';
    const isLong =
      label === 'Links' ||
      label === 'Term' ||
      raw.length > 72 ||
      /^https?:\/\//i.test(raw);
    let inner = DashboardHtml.esc(raw);
    if (options.moneyDisplay || col === 'TCV $') {
      inner = DashboardHtml.esc(BiaSanitizer.formatMoneyDisplay(raw));
    }
    if (label === 'Customer Org ID' && !col) {
      inner = DashboardHtml.orgLink(raw);
    }
    if (col === 'Sub #' || label === 'Subscription') {
      const links = DashboardHtml.subLinksHtml(raw);
      if (links) inner = links;
    }
    if (label === 'Links' && /^https?:\/\//i.test(raw)) {
      const href = raw.replace(/"/g, '&quot;');
      inner = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="customer-link">${DashboardHtml.esc(DashboardHtml.linkLabelForUrl(raw))}</a>`;
    }
    const stackClass =
      isLong ||
      label === 'Links' ||
      label === 'Customer Org ID' ||
      label === 'Subscription' ||
      col === 'Sub #'
        ? ' insight-kv-stack'
        : '';
    const attrs = col ? DashboardHtml.editableAttrs(col, raw) : '';
    return `<div class="insight-kv${stackClass}"><span>${DashboardHtml.esc(label)}</span><strong${attrs}>${inner}</strong></div>`;
  }

  static licBar(label, raw, col) {
    const mappedCol = col || CheckBack.Dashboard.BiaSlideEditor?.LIC_LABEL_COL?.[label] || '';
    const s = BiaSanitizer.sanitizeField(raw);
    let m = s.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*\((\d+)%\)/);
    if (!m) {
      const plain = s.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/);
      if (plain) {
        const u = parseFloat(plain[1].replace(/,/g, ''));
        const t = parseFloat(plain[2].replace(/,/g, ''));
        const pct = t ? Math.min(100, Math.round((u / t) * 100)) : 0;
        m = [null, plain[1], plain[2], String(pct)];
      }
    }
    if (!m) return DashboardHtml.kv(label, s || '—', mappedCol);
    const u = parseFloat(m[1].replace(/,/g, ''));
    const t = parseFloat(m[2].replace(/,/g, ''));
    const pct = t ? Math.min(100, Math.round((u / t) * 100)) : parseInt(m[3], 10) || 0;
    const attrs = mappedCol ? DashboardHtml.editableAttrs(mappedCol) : '';
    return `<div class="insight-lic-row">
      <span class="insight-lic-label">${DashboardHtml.esc(label)}</span>
      <span class="insight-lic-nums"${attrs}>${DashboardHtml.esc(m[1])}/${DashboardHtml.esc(m[2])} (${pct}%)</span>
      <div class="insight-lic-bar"><div class="insight-lic-fill" style="width:${pct}%"></div></div>
    </div>`;
  }
}

CheckBack.Dashboard.Html = DashboardHtml;
