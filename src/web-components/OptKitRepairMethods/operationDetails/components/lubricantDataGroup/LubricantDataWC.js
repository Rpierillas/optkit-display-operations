/**
 * lubricant-data — Données lubrifiants (toutes variantes)
 * Remplace : Lubricant-Engine, Lubricant-Brakes, Lubricant-IntExt,
 *            Lubricant-Transmission, Lubricant-Steering,
 *            Lubricant-Electronics, Lubricant-Default
 * + LubricantData.vue (wrapper)
 *
 * Props (propriétés JS) :
 *   component         Object  — { description: { map: {...} } }
 *   lubricantSystem   Object  — { group, viscosity, quality, temperature, remark }
 *   haynesLang        String  — code langue HaynesPro
 *   isPrint           Boolean
 */
class LubricantData extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._component = null
    this._lubricantSystem = null
    this._haynesLang = 'en'
    this._isPrint = false
  }

  static get observedAttributes() {
    return ['haynes-lang', 'is-print']
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'haynes-lang') this._haynesLang = val
    if (name === 'is-print') this._isPrint = val !== null && val !== 'false'
    this._render()
  }

  set component(v)       { this._component = v;       this._render() }
  set lubricantSystem(v) { this._lubricantSystem = v;  this._render() }
  set haynesLang(v)      { this._haynesLang = v;       this._render() }
  set isPrint(v)         { this._isPrint = !!v;        this._render() }

  connectedCallback() { this._render() }

  // ── helpers ────────────────────────────────────────────────────────────────

  _hl(map) {
    if (!map) return ''
    return map[this._haynesLang] || map[2057] || map['en'] || Object.values(map).find(v => v) || ''
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary:    #00378c;
          --ipd-white:      #ffffff;
          --ipd-turquoise:  #00BCA1;
          --ipd-yellow:     #FFC200;
          --ipd-light-gray: #f5f5f5;
          --ipd-border:     #e0e0e0;
          display: block;
          width: 100%;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lubricant-container {
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ── Table ──────────────────────────────── */
        .lubricant-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--ipd-white);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          margin-bottom: 16px;
          border-radius: 0 !important;
        }

        .header-row {
          background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%);
        }

        .header-cell {
          padding: 14px 20px;
          text-align: left;
          font-size: 16px;
          font-weight: 700;
          color: var(--ipd-white);
          letter-spacing: 0.3px;
          border-bottom: 3px solid var(--ipd-turquoise);
        }

        .data-row { transition: background-color 0.2s ease; }
        .data-row:hover { background-color: #f0f7ff !important; }
        .row-even { background-color: var(--ipd-white); }
        .row-odd  { background-color: var(--ipd-light-gray); }

        .label-cell {
          padding: 12px 20px;
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          vertical-align: middle;
        }

        .value-cell {
          padding: 12px 20px;
          vertical-align: middle;
        }

        /* ── Chips de valeur ──────────────────── */
        .value-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--ipd-primary);
          color: var(--ipd-white);
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
        }

        /* ── Remark ──────────────────────────── */
        .remark-cell {
          padding: 10px 20px;
          background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
          border-left: 4px solid var(--ipd-yellow);
          font-style: italic;
          font-size: 14px;
          color: #555;
        }

        .empty {
          padding: 20px;
          text-align: center;
          color: #777574;
          font-size: 14px;
          font-style: italic;
        }

        /* ── Responsive ─────────────────────── */
        @media (max-width: 768px) {
          .header-cell { padding: 10px 12px; font-size: 14px; }
          .label-cell, .value-cell { padding: 10px 12px; font-size: 13px; }
        }

        /* ── Print ───────────────────────────── */
        @media print {
          .lubricant-table { box-shadow: none; break-inside: avoid; }
          .data-row:hover { background-color: inherit !important; }
          .header-row { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    `
  }

  // ── render ─────────────────────────────────────────────────────────────────

  _render() {
    const ls = this._lubricantSystem
    const comp = this._component

    if (!ls) {
      this.shadowRoot.innerHTML = `${this._getStyles()}<p class="empty">Aucune donnée disponible</p>`
      return
    }

    const compTitle = comp ? this._hl(comp.description?.map) : ''
    const groupLabel = this._hl(ls.group?.description?.map)
    const viscosity = ls.viscosity?.description || ''
    const quality = ls.quality?.description || ''
    const temperature = ls.temperature ? this._hl(ls.temperature.description?.map) : ''
    const remark = ls.remark ? this._hl(ls.remark.description?.map) : ''

    const hasValues = viscosity || quality || temperature

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <div class="lubricant-container">
        <table class="lubricant-table">
          ${compTitle ? `
          <thead>
            <tr class="header-row">
              <th class="header-cell" colspan="4">
                <svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:middle;margin-right:8px;fill:#fff;opacity:0.9;">
                  <path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z"/>
                </svg>
                ${compTitle}
              </th>
            </tr>
          </thead>` : ''}
          <tbody>
            ${groupLabel ? `
            <tr class="data-row row-even">
              <td class="label-cell" colspan="${hasValues ? 1 : 4}" style="font-weight:700;color:var(--ipd-primary);">
                ${groupLabel}
              </td>
              ${hasValues ? `
              <td class="value-cell">
                ${viscosity ? `<span class="value-chip">${viscosity}</span>` : ''}
              </td>
              <td class="value-cell">
                ${quality ? `<span class="value-chip" style="background:#006B6A;">${quality}</span>` : ''}
              </td>
              <td class="value-cell">
                ${temperature ? `<span style="font-size:13px;color:#555;">${temperature}</span>` : ''}
              </td>` : ''}
            </tr>` : ''}
            ${remark ? `
            <tr>
              <td class="remark-cell" colspan="4">
                <svg viewBox="0 0 24 24" width="14" height="14" style="vertical-align:middle;margin-right:6px;fill:#FFC200;">
                  <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                ${remark}
              </td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>
    `
  }
}

if (!customElements.get('lubricant-data')) {
  customElements.define('lubricant-data', LubricantData)
}
export default LubricantData
