/**
 * Export in-memory dashboard customer rows (portfolio / data table) to xlsx.
 */
const DashboardExport = (function () {
  /** Dashboard-only fields — never written back to the workbook file. */
  const EXPORT_SKIP = new Set([
    'Entitled Lic Calling',
    'Providioned Lic Calling',
    'Numbers assigned',
    'Locations main number',
    'Success Portal',
    'Control Hub Helpdesk',
    ' (G/Y/R)',
    'Final Determination',
    'Recommended Actions',
    'CSM / Account Team notes',
    'Trial',
    'Total calls',
    'Answered calls %',
    'Calls busiest hour',
  ]);

  function templateColumnOrder() {
    return (
      (typeof CheckBack !== 'undefined' &&
        CheckBack.Dashboard.Constants &&
        CheckBack.Dashboard.Constants.TEMPLATE_COLUMN_ORDER) ||
      []
    );
  }

  function isExportSkipped(col) {
    if (!col || col === '_biaSlideOnly') return true;
    if (String(col).startsWith('_')) return true;
    return EXPORT_SKIP.has(col);
  }

  function exportColumns(columns) {
    return (columns || []).filter((c) => c && !isExportSkipped(c));
  }

  function cellValue(val) {
    if (val == null) return '';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return val;
  }

  function exportCellValue(row, col) {
    if (col === '(G/Y/R)') {
      const current = row['(G/Y/R)'];
      if (current != null && String(current).trim() !== '') return cellValue(current);
      return cellValue(row[' (G/Y/R)']);
    }
    return cellValue(row[col]);
  }

  function rowForExport(row, columns) {
    const out = {};
    columns.forEach((col) => {
      out[col] = exportCellValue(row, col);
    });
    return out;
  }

  function filenameFromDisplay(displayName) {
    const base = String(displayName || 'check_back').replace(/\.xlsx?$/i, '');
    return base + '_from_dashboard.xlsx';
  }

  function mergeExportColumns(columns, rows) {
    const cols = exportColumns(columns || []);
    const seen = new Set(cols);
    (rows || []).forEach((row) => {
      Object.keys(row || {}).forEach((k) => {
        if (!k || seen.has(k) || isExportSkipped(k)) return;
        seen.add(k);
        cols.push(k);
      });
    });
    return cols;
  }

  function orderExportColumns(columns, rows, preferredOrder) {
    const template = templateColumnOrder();
    if (template.length) return template.slice();

    const available = new Set(mergeExportColumns(columns, rows));
    const ordered = [];
    const sequences = [];
    if (preferredOrder && preferredOrder.length) sequences.push(preferredOrder);
    sequences.forEach((seq) => {
      exportColumns(seq).forEach((col) => {
        if (available.has(col) && !ordered.includes(col)) {
          ordered.push(col);
          available.delete(col);
        }
      });
    });
    mergeExportColumns(columns, rows).forEach((col) => {
      if (available.has(col)) ordered.push(col);
    });
    return ordered;
  }

  function buildCustomerWorkbook(rows, columns, preferredOrder) {
    if (typeof XLSX === 'undefined') throw new Error('Spreadsheet library not loaded');
    if (!rows || !rows.length) throw new Error('No customer rows in the dashboard table');
    const workbookRows = rows.filter((r) => !r._biaSlideOnly);
    const exportRows = workbookRows.length ? workbookRows : rows;
    const cols = orderExportColumns(columns, exportRows, preferredOrder);
    if (!cols.length) throw new Error('No columns to export');
    const body = exportRows.map((row) => rowForExport(row, cols));
    const ws = XLSX.utils.json_to_sheet(body, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Data');
    return wb;
  }

  function exportCustomerData(rows, columns, displayName, preferredOrder) {
    const wb = buildCustomerWorkbook(rows, columns, preferredOrder);
    XLSX.writeFile(wb, filenameFromDisplay(displayName));
  }

  async function saveCustomerDataToServer(rows, columns, preferredOrder) {
    const wb = buildCustomerWorkbook(rows, columns, preferredOrder);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const resp = await fetch('/api/save-workbook', {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: buf,
    });
    let payload = {};
    try {
      payload = await resp.json();
    } catch (_err) {
      payload = {};
    }
    if (!resp.ok) {
      throw new Error(payload.error || resp.statusText || 'Save failed');
    }
    return payload;
  }

  async function fetchWorkbookInfo() {
    const resp = await fetch('/api/workbook-info');
    if (!resp.ok) return null;
    return resp.json();
  }

  return {
    exportColumns,
    mergeExportColumns,
    orderExportColumns,
    buildCustomerWorkbook,
    exportCustomerData,
    saveCustomerDataToServer,
    fetchWorkbookInfo,
    filenameFromDisplay,
  };
})();
