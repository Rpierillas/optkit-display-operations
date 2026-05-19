/**
 * vesa-and-breakdowns — Contenu UC optionnel (schémas VESA ou diagnostics)
 * Converti depuis VesaAndBreakdowns.vue (sans Vuetify, sans routeur)
 *
 * Props (propriétés JS) :
 *   content  Object — l'objet item UC { code, vesaSystems, cwdSystems, tsbs, cases }
 *
 * Events émis (pour laisser l'app hôte gérer la navigation) :
 *   navigate-schema      — { detail: { systemApplicationLinkId, description } }
 *   navigate-diagnostic  — { detail: { breakdownId, description } }
 */
class VesaAndBreakdowns extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._content = null
    this._haynesLang = 'en'
  }

  set content(v) { this._content = v; this._render() }
  get content() { return this._content }

  set haynesLang(v) { this._haynesLang = v; this._render() }

  connectedCallback() { this._render() }

  // ── helpers ────────────────────────────────────────────────────────────────

  _hl(map) {
    if (!map) return ''
    return map[this._haynesLang] || map[2057] || map['en'] || Object.values(map).find(v => v) || ''
  }

  _isDiagram() {
    return this._content?.code?.includes('UC_SCH')
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary:   #00378c;
          --ipd-white:     #ffffff;
          --ipd-turquoise: #00BCA1;
          --ipd-border:    #e0e0e0;
          display: block;
          width: 100%;
          padding: 16px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .uc-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ── Liens ─────────────────────────────── */
        .link-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          margin-bottom: 8px;
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          color: var(--ipd-primary);
          font-size: 14px;
          font-weight: 600;
        }
        .link-item:hover {
          background: #f0f7ff;
          border-color: var(--ipd-primary);
          box-shadow: 0 2px 6px rgba(0,55,140,0.12);
        }

        .link-icon {
          flex-shrink: 0;
          color: var(--ipd-turquoise);
        }

        .link-label { flex: 1; }

        .link-arrow {
          flex-shrink: 0;
          color: var(--ipd-primary);
          opacity: 0.6;
        }

        /* ── Sections ─────────────────────────── */
        .section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #777574;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid var(--ipd-turquoise);
        }

        .section + .section { margin-top: 16px; }

        .empty {
          padding: 16px;
          color: #777574;
          font-size: 14px;
          font-style: italic;
          text-align: center;
        }

        @media print {
          .link-item { border: 1px solid var(--ipd-border); }
          .link-item:hover { background: transparent; }
        }
      </style>
    `
  }

  // ── render ─────────────────────────────────────────────────────────────────

  _render() {
    const content = this._content
    if (!content) {
      this.shadowRoot.innerHTML = `${this._getStyles()}<p class="empty">Aucun contenu disponible</p>`
      return
    }

    const isDiagram = this._isDiagram()
    let bodyHTML = ''

    if (isDiagram) {
      // VESA / CWD diagrams
      const systems = content.vesaSystems ?? content.cwdSystems ?? []
      bodyHTML = systems.length
        ? `<p class="section-title">Schémas électriques</p>
           ${systems.map(sys => `
             <div class="link-item" data-action="schema" data-id="${sys.systemApplicationLinkId}" data-desc="${this._hl(sys.description?.map)}">
               <svg class="link-icon" viewBox="0 0 24 24" width="18" height="18">
                 <path fill="currentColor" d="M3,5H9V11H3V5M5,7V9H7V7H5M11,7H21V9H11V7M11,15H21V17H11V15M5,20L1.5,16.5L2.91,15.09L5,17.17L9.09,13.09L10.5,14.5L5,20M3,13H9V19H3V13Z"/>
               </svg>
               <span class="link-label">${this._hl(sys.description?.map)}</span>
               <svg class="link-arrow" viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
               </svg>
             </div>
           `).join('')}`
        : `<p class="empty">Aucun schéma disponible</p>`
    } else {
      // Breakdowns (TSBs + Cases)
      const tsbs = content.tsbs || []
      const cases = content.cases || []

      const tsbHTML = tsbs.length
        ? `<p class="section-title">Bulletins techniques</p>
           ${tsbs.map(b => `
             <div class="link-item" data-action="tsb" data-id="${b.id}">
               <svg class="link-icon" viewBox="0 0 24 24" width="18" height="18">
                 <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
               </svg>
               <span class="link-label">${this._hl(b.description?.map)}</span>
               <svg class="link-arrow" viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
               </svg>
             </div>
           `).join('')}`
        : ''

      const casesHTML = cases.length
        ? `<p class="section-title">Cas de diagnostic</p>
           ${cases.map(b => `
             <div class="link-item" data-action="diagnostic" data-id="${b.id}">
               <svg class="link-icon" viewBox="0 0 24 24" width="18" height="18">
                 <path fill="currentColor" d="M11,2A2,2 0 0,1 13,4V20A2,2 0 0,1 11,22A2,2 0 0,1 9,20V4A2,2 0 0,1 11,2M18,9A2,2 0 0,1 20,11V20A2,2 0 0,1 18,22A2,2 0 0,1 16,20V11A2,2 0 0,1 18,9M4,14A2,2 0 0,1 6,16V20A2,2 0 0,1 4,22A2,2 0 0,1 2,20V16A2,2 0 0,1 4,14Z"/>
               </svg>
               <span class="link-label">${this._hl(b.description?.map)}</span>
               <svg class="link-arrow" viewBox="0 0 24 24" width="16" height="16">
                 <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
               </svg>
             </div>
           `).join('')}`
        : ''

      bodyHTML = (tsbHTML + casesHTML) || `<p class="empty">Aucun diagnostic disponible</p>`
    }

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <div class="uc-container">${bodyHTML}</div>
    `

    // Events
    this.shadowRoot.querySelectorAll('.link-item').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action
        if (action === 'schema') {
          this.dispatchEvent(new CustomEvent('navigate-schema', {
            detail: { systemApplicationLinkId: el.dataset.id, description: el.dataset.desc },
            bubbles: true, composed: true
          }))
        } else if (action === 'diagnostic' || action === 'tsb') {
          this.dispatchEvent(new CustomEvent('navigate-diagnostic', {
            detail: { breakdownId: el.dataset.id, type: action },
            bubbles: true, composed: true
          }))
        }
      })
    })
  }
}

if (!customElements.get('vesa-and-breakdowns')) {
  customElements.define('vesa-and-breakdowns', VesaAndBreakdowns)
}
export default VesaAndBreakdowns
