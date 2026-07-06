/**
 * table-wrapper — Tableau de données rétractable
 * Converti depuis TableWrapper.vue (sans Vuetify)
 *
 * Props (propriétés JS) :
 *   cells      Array  — tableau de { x, y, value, sentence: { description: { map: {...} } } }
 *   haynesLang String — code langue HaynesPro (ex: 'fr', 2057...)
 *   label      String — libellé du bouton "Voir plus" (optionnel)
 */
class TableWrapper extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._cells = []
    this._haynesLang = ''
    this._label = 'Voir plus'
    this._opened = false
  }

  static get observedAttributes() {
    return ['haynes-lang', 'label']
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'haynes-lang') this._haynesLang = val
    if (name === 'label') this._label = val
    this._render()
  }

  set cells(v) { this._cells = Array.isArray(v) ? v : []; this._render() }
  get cells() { return this._cells }

  set haynesLang(v) { this._haynesLang = v; this._render() }
  get haynesLang() { return this._haynesLang }

  connectedCallback() { this._render() }

  // ── helpers ────────────────────────────────────────────────────────────────

  _formatHaynesLang(map) {
    if (!map) return ''
    if (!map || typeof map !== 'object') return ''
    const isFilled = (v) => typeof v === 'string' && v.trim() !== ''
    // 1. Override explicite éventuel (haynes-lang défini par l'hôte)
    if (this._haynesLang && isFilled(map[this._haynesLang])) return map[this._haynesLang]
    // 2. Langue demandée à l'API : la clé non-anglaise du map (contrat HaynesPro :
    //    le map contient 2057 (EN, toujours) + la langue du request header)
    for (const key of Object.keys(map)) {
      if (key !== '2057' && isFilled(map[key])) return map[key]
    }
    // 3. Anglais par défaut
    if (isFilled(map['2057'])) return map['2057']
    return Object.values(map).find(isFilled) || ''
  }

  _buildTable(cells) {
    if (!cells || !cells.length) return []
    const ys = [...new Set(cells.map(c => c.y))].sort((a, b) => a - b)
    const xs = [...new Set(cells.map(c => c.x))].sort((a, b) => a - b)
    return ys.map(y =>
      xs.map(x => {
        const cell = cells.find(c => c.x === x && c.y === y)
        if (!cell) return ''
        return cell.value ?? this._formatHaynesLang(cell.sentence?.description?.map) ?? ''
      })
    )
  }

  _toggleOpen() {
    this._opened = !this._opened
    this._render()
  }

  // ── render ─────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary: #00378c;
          --ipd-white: #ffffff;
          --ipd-turquoise: #00BCA1;
          --ipd-light-gray: #f5f5f5;
          --ipd-border: #e0e0e0;
          display: block;
          width: 100%;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: var(--ipd-white);
          border: 2px solid var(--ipd-primary);
          color: var(--ipd-primary);
          font-size: 14px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .toggle-btn:hover { background: var(--ipd-primary); color: var(--ipd-white); }

        .chevron {
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .chevron.open { transform: rotate(180deg); }

        .table-wrapper {
          margin-top: 12px;
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: var(--ipd-white);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-radius: 0 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        td {
          padding: 10px 16px;
          border: 1px solid var(--ipd-border);
          font-size: 14px;
          color: #1a1a1a;
          vertical-align: middle;
        }
        tr:nth-child(even) td { background: var(--ipd-light-gray); }
        tr:hover td { background: #f0f7ff; }

        .empty { color: #777574; font-style: italic; font-size: 14px; padding: 16px 0; }

        @media print {
          .toggle-btn { display: none; }
          .table-wrapper { display: block !important; }
        }
      </style>
    `
  }

  _render() {
    const rows = this._buildTable(this._cells)
    const hasData = rows.length > 0

    const tableHTML = hasData ? `
      <table>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell || '&nbsp;'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `<p class="empty">Aucune donnée disponible</p>`

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <button class="toggle-btn" id="toggle-btn">
        ${this._label}
        <svg class="chevron ${this._opened ? 'open' : ''}" viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
        </svg>
      </button>
      <div class="table-wrapper" style="display:${this._opened ? 'block' : 'none'}">
        ${tableHTML}
      </div>
    `

    this.shadowRoot.getElementById('toggle-btn')
      ?.addEventListener('click', () => this._toggleOpen())
  }
}

if (!customElements.get('table-wrapper')) {
  customElements.define('table-wrapper', TableWrapper)
}
export default TableWrapper
