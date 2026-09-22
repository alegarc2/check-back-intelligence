/**
 * Business Insight slide PDF — layout mirrors the dashboard slide; real hyperlink annotations.
 */
class BiaSlidePdf {
  static COLORS = {
    bg: [10, 14, 26],
    panelBg: [15, 23, 42],
    accent: [0, 188, 235],
    text: [241, 245, 249],
    muted: [148, 163, 184],
    label: [148, 163, 184],
    cyan: [6, 182, 212],
    orange: [255, 107, 53],
    magenta: [236, 72, 153],
    notes: [59, 130, 246],
    health: {
      good: [0, 212, 160],
      risk: [239, 68, 68],
      upsell: [124, 58, 237],
      unknown: [30, 41, 59],
    },
  };

  static resolveDeck(row) {
    if (!row) return BiaWorkbookMapper.rowToSlide({});
    if (typeof BiaTemplate !== 'undefined' && BiaTemplate.mergeSlideWithRow) {
      const bia = BiaTemplate.findSlide ? BiaTemplate.findSlide(row) : null;
      const base = bia || BiaTemplate.rowToSlide(row);
      return BiaTemplate.mergeSlideWithRow(row, base);
    }
    return BiaWorkbookMapper.rowToSlide(row);
  }

  static safeFilename(name) {
    return (
      String(name || 'customer')
        .replace(/[^\w\s-]+/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80) || 'customer'
    );
  }

  static datedFilename(customerName) {
    const base = BiaSlidePdf.safeFilename(customerName);
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${base}_${months[d.getMonth()]}${d.getDate()}${d.getFullYear()}.pdf`;
  }

  static cleanText(val) {
    return String(val ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static formatMoneyValue(raw) {
    const formatted = BiaSanitizer.formatMoneyDisplay(raw);
    return formatted || BiaSlidePdf.cleanText(raw);
  }

  static setFill(doc, rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  static setText(doc, rgb) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  static drawHeader(doc, deck, pageW) {
    const h = BiaSanitizer.healthClass(deck.health);
    const gathered =
      deck.gatheredBy || deck.gatheredDate
        ? `Data gathered${deck.gatheredBy ? ' by ' + deck.gatheredBy : ''}${deck.gatheredDate ? ' on ' + deck.gatheredDate : ''}`
        : '';
    const accountName = BiaSlidePdf.cleanText(deck.accountName);
    const customerName = BiaSlidePdf.cleanText(deck.customerName || 'Customer');
    const headerH = accountName ? 40 : 34;

    BiaSlidePdf.setFill(doc, BiaSlidePdf.COLORS.bg);
    doc.rect(0, 0, pageW, headerH, 'F');
    BiaSlidePdf.setFill(doc, BiaSlidePdf.COLORS.accent);
    doc.rect(0, 0, pageW, 3, 'F');

    let yText = 12;
    if (accountName) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
      doc.text('ACCOUNT NAME', 12, yText);
      doc.setFontSize(12);
      BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.accent);
      doc.text(accountName.substring(0, 80), 42, yText);
      yText += 7;
    }

    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.text);
    doc.setFontSize(accountName ? 14 : 16);
    doc.setFont(undefined, 'bold');
    doc.text(customerName.substring(0, 72), 12, yText);
    yText += 6;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
    doc.text('Business Insight and Analysis', 12, yText);
    if (gathered) {
      doc.setFontSize(8);
      doc.text(BiaSlidePdf.cleanText(gathered).substring(0, 110), 12, yText + 5);
    }

    const badgeW = 30;
    const badgeH = 22;
    const badgeX = pageW - 12 - badgeW;
    const badgeY = 6;
    const healthRgb = BiaSlidePdf.COLORS.health[h.class] || BiaSlidePdf.COLORS.health.unknown;
    BiaSlidePdf.setFill(doc, healthRgb);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, h.class === 'good' ? [4, 47, 46] : [255, 255, 255]);
    doc.text(h.label.substring(0, 10), badgeX + badgeW / 2, badgeY + 13, { align: 'center' });
    doc.setFont(undefined, 'normal');

    return headerH + 4;
  }

  static drawTimeline(doc, deck, y, pageW) {
    const years = deck.timelineYears || 5;
    const nowYear =
      deck.timelineCurrentYear || BiaSanitizer.parseTimelineFromTerm(deck.subscription?.term).currentYear || 2;
    BiaSlidePdf.setFill(doc, [20, 28, 45]);
    doc.roundedRect(10, y, pageW - 20, 8, 2, 2, 'F');

    doc.setFontSize(7);
    const step = (pageW - 24) / years;
    for (let i = 0; i < years; i += 1) {
      const year = i + 1;
      const x = 12 + step * i + step / 2;
      if (year === nowYear) {
        BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.accent);
        doc.setFont(undefined, 'bold');
        doc.text(`Year ${year} · NOW`, x, y + 5.2, { align: 'center' });
        doc.setFont(undefined, 'normal');
      } else {
        BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
        doc.text(`Year ${year}`, x, y + 5.2, { align: 'center' });
      }
    }
    return y + 12;
  }

  static drawPanelBorder(doc, x, y, w, h, borderRgb) {
    doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
    doc.setLineWidth(0.6);
    BiaSlidePdf.setFill(doc, [
      Math.min(255, Math.round(borderRgb[0] * 0.07 + 12)),
      Math.min(255, Math.round(borderRgb[1] * 0.07 + 16)),
      Math.min(255, Math.round(borderRgb[2] * 0.07 + 24)),
    ]);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  }

  static drawLinkText(doc, text, url, valueLeft, y, valueW) {
    const label = BiaSlidePdf.cleanText(text) || '—';
    const rightX = valueLeft + valueW;
    const lines = doc.splitTextToSize(label.substring(0, 120), valueW);
    if (!url) {
      BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.text);
      lines.forEach((line, i) => {
        doc.text(line, rightX, y + i * 3.6, { align: 'right' });
      });
      return y + lines.length * 3.6;
    }
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.accent);
    const lineHeight = 3.6;
    lines.forEach((line, i) => {
      doc.textWithLink(line, rightX, y + i * lineHeight, { url, align: 'right' });
    });
    return y + lines.length * lineHeight;
  }

  static drawKv(doc, label, value, x, y, w, linkUrl) {
    const labelW = w * 0.46;
    const valueLeft = x + labelW + 1;
    const valueW = w - labelW - 1;
    doc.setFontSize(8);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.label);
    const labelLines = doc.splitTextToSize(BiaSlidePdf.cleanText(label), labelW);
    doc.text(labelLines, x, y);
    const nextY = BiaSlidePdf.drawLinkText(doc, value, linkUrl, valueLeft, y, valueW);
    const labelH = labelLines.length * 3.6;
    const valueH = Math.max(3.6, nextY - y);
    return y + Math.max(labelH, valueH) + 1.2;
  }

  static measureKv(doc, label, value, w) {
    const labelW = w * 0.46;
    const valueW = w - labelW - 1;
    doc.setFontSize(8);
    const labelLines = doc.splitTextToSize(BiaSlidePdf.cleanText(label), labelW);
    const valueLines = doc.splitTextToSize(BiaSlidePdf.cleanText(value || '—'), valueW);
    return Math.max(labelLines.length * 3.6, valueLines.length * 3.6) + 1.2;
  }

  static measureSubLinks(doc, subRaw, w) {
    const items = BiaSlidePdf.subUrls(subRaw);
    if (!items.length) return BiaSlidePdf.measureKv(doc, 'Subscription', '—', w);
    return 4 + items.length * 4 + 1;
  }

  static measureLinksBlock(doc, deck, w) {
    let h = 4.5;
    const sub = String(deck.subscription?.sub || '').trim();
    if (sub) h += BiaSlidePdf.measureSubLinks(doc, sub, w);
    h += BiaSlidePdf.measureKv(doc, 'S&C', deck.salesforceUrl ? 'Salesforce' : '—', w);
    h += BiaSlidePdf.measureKv(
      doc,
      'Success Portal',
      deck.successPortalUrl ? 'Success Portal' : '—',
      w
    );
    return h;
  }

  static measureSubscriptionPanel(doc, deck, w) {
    const s = deck.subscription || {};
    let h = 11;
    if (deck.accountName) h += BiaSlidePdf.measureKv(doc, 'Account Name', deck.accountName, w);
    if (deck.platforms) h += BiaSlidePdf.measureKv(doc, 'Platforms', deck.platforms, w);
    h += BiaSlidePdf.measureKv(doc, 'Term', s.term, w);
    h += BiaSlidePdf.measureKv(doc, 'Total Contract Value', BiaSlidePdf.formatMoneyValue(s.tcv), w);
    h += BiaSlidePdf.measureKv(doc, 'Total Recurring Revenue (AAR)', s.aar, w);
    h += BiaSlidePdf.measureKv(doc, 'Collab AE/SE', s.collabAe, w);
    h += BiaSlidePdf.measureKv(doc, 'Segment', s.segment, w);
    h += BiaSlidePdf.measureKv(doc, 'Partner', s.partner, w);
    h += BiaSlidePdf.measureKv(doc, 'CSM Coverage Model', s.csmModel, w);
    h += BiaSlidePdf.measureLinksBlock(doc, deck, w);
    return h + 4;
  }

  static measureProvisioningPanel(doc, deck, w) {
    const p = deck.provisioning || {};
    let h = 11;
    const orgId = p.orgId || deck.orgId;
    h += BiaSlidePdf.measureKv(doc, 'Customer Org ID', orgId, w);
    h += BiaSlidePdf.measureKv(doc, 'Licenses (prov/ent)', p.entitled, w);
    const provRows = BiaSlidePdf.callingLicenseRows(p, deck);
    if (provRows.length) {
      h += 3.5;
      provRows.forEach(([, val]) => {
        h += BiaSlidePdf.measureLicBar(doc, val, w);
      });
    }
    h += BiaSlidePdf.measureKv(doc, 'Active Users', p.activeUsers, w);
    h += BiaSlidePdf.measureKv(doc, 'External Calls vs Total', p.externalCalls, w);
    h += BiaSlidePdf.measureKv(doc, 'Meetings', p.meetings, w);
    h += BiaSlidePdf.measureKv(doc, 'Messaging', p.messaging, w);
    return h + 4;
  }

  static measureFeaturesPanel(doc, deck, w) {
    const f = deck.features || {};
    let h = 11 + 4;
    const features = [
      ['Auto Attendant', f.autoAttendant],
      ['Hunt Groups', f.huntGroups],
      ['Basic Call Queues', f.callQueues],
      ['Connected-UC', f.connectedUc],
      ['Virtual Lines', f.virtualLines],
    ];
    features.forEach(([label, val]) => {
      h += BiaSlidePdf.measureKv(doc, label, val, w);
    });
    return h + 2;
  }

  static measureAddonTable() {
    const rows = (CheckBack.Dashboard.Constants.ADDON_ROWS || []).length;
    return 6 + rows * 4.8 + 6;
  }

  static orgUrl(orgId) {
    const id = String(orgId || '').trim();
    if (!id || id === '—') return '';
    return CheckBack.Dashboard.Constants.WEBEX_ORG_ADMIN_PREFIX + encodeURIComponent(id);
  }

  static subUrls(subRaw) {
    const subs = String(subRaw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return subs
      .map((sub) => ({
        label: DashboardHtml.normalizeSubId(sub) || sub,
        url: DashboardHtml.subDetailUrl(sub),
      }))
      .filter((x) => x.label);
  }

  static drawSubLinks(doc, subRaw, x, y, w) {
    const items = BiaSlidePdf.subUrls(subRaw);
    if (!items.length) {
      return BiaSlidePdf.drawKv(doc, 'Subscription', '—', x, y, w, '');
    }
    let cy = y;
    doc.setFontSize(8);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.label);
    doc.text('Subscription', x, cy);
    cy += 4;
    items.forEach((item, idx) => {
      const prefix = idx > 0 ? ', ' : '';
      const linkLabel = prefix + item.label;
      const rightX = x + w;
      if (item.url) {
        BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.accent);
        doc.textWithLink(linkLabel, rightX, cy, { url: item.url, align: 'right' });
      } else {
        BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.text);
        doc.text(linkLabel, rightX, cy, { align: 'right' });
      }
      cy += 4;
    });
    return cy + 1;
  }

  static drawLinksBlock(doc, deck, x, y, w) {
    const s = deck.subscription || {};
    let cy = y;
    doc.setFontSize(8);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.label);
    doc.text('Links', x, cy);
    cy += 4.5;
    const sub = String(s.sub || '').trim();
    if (sub) {
      cy = BiaSlidePdf.drawSubLinks(doc, sub, x, cy, w);
    }
    cy = BiaSlidePdf.drawKv(
      doc,
      'S&C',
      deck.salesforceUrl ? 'Salesforce' : '—',
      x,
      cy,
      w,
      deck.salesforceUrl || ''
    );
    cy = BiaSlidePdf.drawKv(
      doc,
      'Success Portal',
      deck.successPortalUrl ? 'Success Portal' : '—',
      x,
      cy,
      w,
      deck.successPortalUrl || ''
    );
    return cy;
  }

  static callingLicenseRows(p, deck) {
    const lic = LicenseProductParser.mergeIntoProvisioning(p, [p.entitled, p.provisioned]);
    return [
      ['pl', lic.pl],
      ['std', lic.std],
      ['ws', lic.ws],
    ].filter(([, val]) => val);
  }

  static parseLicPair(raw) {
    const s = BiaSanitizer.sanitizeField(raw);
    let m = s.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*\((\d+)%\)/);
    if (!m) {
      const plain = s.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)$/);
      if (plain) {
        const u = parseFloat(plain[1].replace(/,/g, ''));
        const t = parseFloat(plain[2].replace(/,/g, ''));
        const pct = t ? Math.min(100, Math.round((u / t) * 100)) : 0;
        return {
          used: plain[1],
          total: plain[2],
          pct,
          display: `${plain[1]}/${plain[2]} (${pct}%)`,
        };
      }
      return null;
    }
    const u = parseFloat(m[1].replace(/,/g, ''));
    const t = parseFloat(m[2].replace(/,/g, ''));
    const pct = t ? Math.min(100, Math.round((u / t) * 100)) : parseInt(m[3], 10) || 0;
    return {
      used: m[1],
      total: m[2],
      pct,
      display: `${m[1]}/${m[2]} (${pct}%)`,
    };
  }

  static measureLicBar(doc, raw, w) {
    if (BiaSlidePdf.parseLicPair(raw)) return 9;
    return BiaSlidePdf.measureKv(doc, 'License', raw, w);
  }

  static drawLicBar(doc, label, raw, x, y, w) {
    const pair = BiaSlidePdf.parseLicPair(raw);
    if (!pair) {
      return BiaSlidePdf.drawKv(doc, label, raw, x, y, w);
    }
    const rightX = x + w;
    doc.setFontSize(8);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.label);
    doc.text(label, x, y);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.accent);
    doc.setFont(undefined, 'bold');
    doc.text(pair.display, rightX, y, { align: 'right' });
    doc.setFont(undefined, 'normal');
    const barY = y + 3.4;
    const barH = 1.6;
    BiaSlidePdf.setFill(doc, [12, 18, 28]);
    doc.roundedRect(x, barY, w, barH, 0.8, 0.8, 'F');
    const fillW = Math.max(0.4, (w * pair.pct) / 100);
    if (pair.pct > 0) {
      BiaSlidePdf.setFill(doc, BiaSlidePdf.COLORS.accent);
      doc.roundedRect(x, barY, fillW, barH, 0.8, 0.8, 'F');
    }
    return y + 9;
  }

  static provisionedRows(p, deck) {
    const lic = LicenseProductParser.mergeIntoProvisioning(p, [p.entitled, p.provisioned]);
    const rows = [
      ['pl', lic.pl],
      ['std', lic.std],
      ['ws', lic.ws],
      ['wxMeetingSuite', lic.wxMeetingSuite],
      ['wxMeetings', lic.wxMeetings],
      ['wxContactCenter', lic.wxContactCenter],
    ].filter(([, val]) => val);
    if (rows.length) return rows;
    const provRaw = BiaSanitizer.sanitizeField(p.provisioned || p.entitled || '');
    return provRaw ? [['raw', provRaw]] : [];
  }

  static drawSubscriptionPanel(doc, deck, x, y, w) {
    const s = deck.subscription || {};
    let cy = y + 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.cyan);
    doc.text('SUBSCRIPTION REVIEW', x + 3, cy);
    doc.setFont(undefined, 'normal');
    cy += 5;
    if (deck.accountName) {
      cy = BiaSlidePdf.drawKv(doc, 'Account Name', deck.accountName, x + 3, cy, w - 6);
    }
    if (deck.platforms) cy = BiaSlidePdf.drawKv(doc, 'Platforms', deck.platforms, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Term', s.term, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Total Contract Value', BiaSlidePdf.formatMoneyValue(s.tcv), x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Total Recurring Revenue (AAR)', s.aar, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Collab AE/SE', s.collabAe, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Segment', s.segment, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Partner', s.partner, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'CSM Coverage Model', s.csmModel, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawLinksBlock(doc, deck, x + 3, cy, w - 6);
    return cy - y + 4;
  }

  static drawProvisioningPanel(doc, deck, x, y, w) {
    const p = deck.provisioning || {};
    let cy = y + 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.orange);
    doc.text('PROVISIONING & USAGE', x + 3, cy);
    doc.setFont(undefined, 'normal');
    cy += 5;
    const orgId = p.orgId || deck.orgId;
    cy = BiaSlidePdf.drawKv(doc, 'Customer Org ID', orgId, x + 3, cy, w - 6, BiaSlidePdf.orgUrl(orgId));
    cy = BiaSlidePdf.drawKv(doc, 'Licenses (prov/ent)', p.entitled, x + 3, cy, w - 6);
    const provRows = BiaSlidePdf.callingLicenseRows(p, deck);
    if (provRows.length) {
      doc.setFontSize(7);
      BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
      doc.text('Provisioned licenses', x + 3, cy);
      cy += 3.5;
      provRows.forEach(([key, val]) => {
        const label = LicenseProductParser.DISPLAY_LABELS[key] || key;
        cy = BiaSlidePdf.drawLicBar(doc, label, val, x + 3, cy, w - 6);
      });
    }
    cy = BiaSlidePdf.drawKv(doc, 'Active Users', p.activeUsers, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'External Calls vs Total', p.externalCalls, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Meetings', p.meetings, x + 3, cy, w - 6);
    cy = BiaSlidePdf.drawKv(doc, 'Messaging', p.messaging, x + 3, cy, w - 6);
    return cy - y + 4;
  }

  static drawFeaturesPanel(doc, deck, x, y, w) {
    const f = deck.features || {};
    let cy = y + 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.magenta);
    doc.text('FEATURE USE & ADD-ONS', x + 3, cy);
    doc.setFont(undefined, 'normal');
    cy += 5;
    doc.setFontSize(7);
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
    doc.text('Included features (Using – how many)', x + 3, cy);
    cy += 4;
    const features = [
      ['Auto Attendant', f.autoAttendant],
      ['Hunt Groups', f.huntGroups],
      ['Basic Call Queues', f.callQueues],
      ['Connected-UC', f.connectedUc],
      ['Virtual Lines', f.virtualLines],
    ];
    features.forEach(([label, val]) => {
      cy = BiaSlidePdf.drawKv(doc, label, val, x + 3, cy, w - 6);
    });
    return cy - y + 2;
  }

  static drawAddonTable(doc, deck, x, y, w) {
    const addons = deck.addons || {};
    const names = CheckBack.Dashboard.Constants.ADDON_ROWS || [];
    const body = names.map((name) => {
      const a = BiaSlideEditor.addonCells(addons, name);
      const p = a.P ?? a.p ?? '—';
      const t = a.T ?? a.t ?? '—';
      const u = a.U ?? a.u ?? '—';
      return [name, String(p), String(t), String(u)];
    });
    if (typeof doc.autoTable !== 'function') return y;
    doc.autoTable({
      startY: y,
      margin: { left: x, right: 10 },
      tableWidth: w,
      head: [['Add-Ons', 'P', 'T', 'U']],
      body,
      theme: 'plain',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.2,
        textColor: BiaSlidePdf.COLORS.text,
        fillColor: BiaSlidePdf.COLORS.panelBg,
        lineColor: [30, 58, 95],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: BiaSlidePdf.COLORS.magenta,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: w * 0.55 },
        1: { halign: 'center', cellWidth: w * 0.15 },
        2: { halign: 'center', cellWidth: w * 0.15 },
        3: { halign: 'center', cellWidth: w * 0.15 },
      },
    });
    return doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 2 : y + 20;
  }

  static trendItems(deck) {
    const specs = CheckBack.Dashboard.Constants.TREND_DISPLAY || [];
    const legacy = deck.trends || [];
    return specs
      .map((spec) => {
        let value = BiaSanitizer.cleanVal(deck[spec.deckKey]);
        if (BiaSanitizer.isEmptyVal(value) && legacy.length) {
          const re = new RegExp(spec.legacyRe, 'i');
          const match = legacy.find((t) => re.test(String(t)));
          if (match) value = BiaSanitizer.sanitizeField(match);
        }
        if (BiaSanitizer.isEmptyVal(value)) return null;
        const sanitized = BiaSanitizer.sanitizeField(value);
        return {
          label: spec.label,
          value: BiaSanitizer.formatTrendDisplay(sanitized),
          sign: BiaSanitizer.trendSign(sanitized),
        };
      })
      .filter(Boolean);
  }

  static trendPillStyle(sign) {
    if (sign === 'positive') {
      return { fill: [8, 48, 42], text: [0, 212, 160] };
    }
    if (sign === 'negative') {
      return { fill: [48, 18, 18], text: [248, 113, 113] };
    }
    return { fill: [28, 34, 44], text: [148, 163, 184] };
  }

  static drawTrendPill(doc, value, sign, x, baselineY, maxW) {
    const display = value || '—';
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    const style = BiaSlidePdf.trendPillStyle(sign);
    const textW = Math.min(doc.getTextWidth(display) + 5, maxW);
    const pillW = Math.max(textW, 14);
    const pillH = 5.5;
    const pillTop = baselineY - 3.8;
    BiaSlidePdf.setFill(doc, style.fill);
    doc.roundedRect(x, pillTop, pillW, pillH, 1.5, 1.5, 'F');
    BiaSlidePdf.setText(doc, style.text);
    doc.text(display, x + 2.5, baselineY);
    doc.setFont(undefined, 'normal');
  }

  static drawTrends(doc, deck, y, pageW) {
    const items = BiaSlidePdf.trendItems(deck);
    if (!items.length) return y;
    const panelH = 18;
    BiaSlidePdf.drawPanelBorder(doc, 10, y, pageW - 20, panelH, BiaSlidePdf.COLORS.accent);
    let x = 12;
    const colW = (pageW - 24) / items.length;
    items.forEach((item) => {
      doc.setFontSize(7);
      BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.muted);
      doc.text(item.label.substring(0, 42), x, y + 5, { maxWidth: colW - 2 });
      BiaSlidePdf.drawTrendPill(doc, item.value, item.sign, x, y + 13, colW - 2);
      x += colW;
    });
    return y + panelH + 4;
  }

  static measureNoteBlock(doc, body, innerW) {
    const lines = doc.splitTextToSize(BiaSanitizer.cleanVal(body), innerW - 5);
    const lineH = 3.4;
    const boxPad = 4;
    const minBoxH = 14;
    const boxH = Math.max(minBoxH, boxPad * 2 + lines.length * lineH);
    const blockH = 4.5 + 2 + boxH + 5;
    return { lines, boxH, blockH };
  }

  static drawNoteBlock(doc, label, lines, boxH, x, y, w) {
    const boxX = x + 3;
    const boxW = w - 6;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.label);
    doc.text(String(label || '').toUpperCase(), boxX, y);
    const boxY = y + 5;
    BiaSlidePdf.setFill(doc, [8, 12, 22]);
    doc.setDrawColor(55, 65, 81);
    doc.setLineWidth(0.2);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.text);
    doc.text(lines, boxX + 2.5, boxY + 4.2, { maxWidth: boxW - 5 });
    return boxY + boxH + 5;
  }

  static drawNotes(doc, deck, y, pageW) {
    const notes = BiaSlideRenderer.resolveWorkbookNotes(deck);
    const blocks = [
      ['Calling analytics', notes.analytics],
      ['Provisioned features', notes.features],
      ['Recommended actions', notes.recommended],
    ].filter(([, body]) => BiaSanitizer.cleanVal(body));
    if (!blocks.length) return y;

    const panelX = 10;
    const panelW = pageW - 20;
    const innerW = panelW - 6;
    const pageH = doc.internal.pageSize.getHeight();
    const headerH = 12;
    const contentPadTop = 4;

    doc.setFontSize(7.5);
    const measured = blocks.map(([label, body]) => {
      const block = BiaSlidePdf.measureNoteBlock(doc, body, innerW);
      return { label, ...block };
    });
    const panelH =
      headerH + contentPadTop + measured.reduce((sum, b) => sum + b.blockH, 0) + 4;

    let startY = y;
    if (startY + panelH > pageH - 16) {
      doc.addPage();
      BiaSlidePdf.setFill(doc, BiaSlidePdf.COLORS.bg);
      doc.rect(0, 0, pageW, pageH, 'F');
      startY = 14;
    }

    BiaSlidePdf.drawPanelBorder(doc, panelX, startY, panelW, panelH, BiaSlidePdf.COLORS.notes);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    BiaSlidePdf.setText(doc, BiaSlidePdf.COLORS.notes);
    doc.text('NOTES & RECOMMENDED ACTIONS', panelX + 3, startY + 5.5);
    doc.setDrawColor(BiaSlidePdf.COLORS.notes[0], BiaSlidePdf.COLORS.notes[1], BiaSlidePdf.COLORS.notes[2]);
    doc.setLineWidth(0.2);
    doc.line(panelX + 3, startY + 7.5, panelX + panelW - 3, startY + 7.5);
    doc.setFont(undefined, 'normal');

    let cy = startY + headerH + contentPadTop;
    measured.forEach(({ label, lines, boxH }) => {
      cy = BiaSlidePdf.drawNoteBlock(doc, label, lines, boxH, panelX, cy, panelW);
    });

    return startY + panelH + 4;
  }

  static drawFooter(doc, pageW) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    BiaSlidePdf.setText(doc, [100, 116, 139]);
    doc.text(
      `Check Back Intelligence · Lookback Program · Cisco Confidential · ${new Date().toLocaleString()}`,
      12,
      pageH - 6
    );
  }

  static export(deck, options = {}) {
    if (!deck) return Promise.reject(new Error('No slide data for PDF export'));
    if (typeof window === 'undefined' || !window.jspdf) {
      return Promise.reject(new Error('jsPDF is not loaded'));
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const sanitized = BiaSlideMerger.sanitizeSlide(deck);

    BiaSlidePdf.setFill(doc, BiaSlidePdf.COLORS.bg);
    doc.rect(0, 0, pageW, pageH, 'F');

    let y = BiaSlidePdf.drawHeader(doc, sanitized, pageW);
    y = BiaSlidePdf.drawTimeline(doc, sanitized, y, pageW);

    const gap = 3;
    const colW = (pageW - 20 - gap * 2) / 3;
    const x1 = 10;
    const x2 = x1 + colW + gap;
    const x3 = x2 + colW + gap;
    const innerW = colW - 6;

    const h1 = BiaSlidePdf.measureSubscriptionPanel(doc, sanitized, innerW);
    const h2 = BiaSlidePdf.measureProvisioningPanel(doc, sanitized, innerW);
    const hFeat = BiaSlidePdf.measureFeaturesPanel(doc, sanitized, innerW);
    const hAddon = BiaSlidePdf.measureAddonTable();
    const h3 = hFeat + hAddon;

    BiaSlidePdf.drawPanelBorder(doc, x1, y, colW, h1, BiaSlidePdf.COLORS.cyan);
    BiaSlidePdf.drawPanelBorder(doc, x2, y, colW, h2, BiaSlidePdf.COLORS.orange);
    BiaSlidePdf.drawPanelBorder(doc, x3, y, colW, h3, BiaSlidePdf.COLORS.magenta);

    BiaSlidePdf.drawSubscriptionPanel(doc, sanitized, x1, y, colW);
    BiaSlidePdf.drawProvisioningPanel(doc, sanitized, x2, y, colW);
    BiaSlidePdf.drawFeaturesPanel(doc, sanitized, x3, y, colW);
    BiaSlidePdf.drawAddonTable(doc, sanitized, x3 + 3, y + hFeat + 1, innerW);

    let yAfter = y + Math.max(h1, h2, h3) + 4;
    yAfter = BiaSlidePdf.drawTrends(doc, sanitized, yAfter, pageW);
    BiaSlidePdf.drawNotes(doc, sanitized, yAfter, pageW);
    BiaSlidePdf.drawFooter(doc, pageW);

    const filename = options.filename || BiaSlidePdf.datedFilename(sanitized.accountName || sanitized.customerName);
    doc.save(filename);
    return Promise.resolve(filename);
  }

  static exportRow(row, options = {}) {
    return BiaSlidePdf.export(BiaSlidePdf.resolveDeck(row), options);
  }
}

CheckBack.Dashboard.BiaSlidePdf = BiaSlidePdf;
