/**
 * location-systems — Systèmes de localisation (liste + image)
 * Converti depuis LocationSystems.vue (sans Vuetify)
 *
 * Props (propriétés JS) :
 *   systems       Object  — { items: [], subItems: [], locationImg: string, locationId: [] }
 *   isPrint       Boolean
 *   operationsDetails Object (non utilisé directement ici)
 *
 * Events émis :
 *   show-schematics  — { detail: { event, src } }  zoom image
 *   show-location-uc — { detail: { item, locationId } }  ouvre le dialog UC
 */
class LocationSystems extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._systems = null
    this._isPrint = false
  }

  static get observedAttributes() {
    return ['is-print']
  }

  attributeChangedCallback(name, _, val) {
    if (name === 'is-print') this._isPrint = val !== null && val !== 'false'
    this._render()
  }

  set systems(v) { this._systems = v; this._render() }
  set isPrint(v) { this._isPrint = !!v; this._render() }

  connectedCallback() { this._render() }

  // ── helpers ────────────────────────────────────────────────────────────────

  _haynesLang = 'en'
  set haynesLang(v) { this._haynesLang = v; this._render() }

  _hl(map) {
    if (!map) return ''
    return map[this._haynesLang] || map[2057] || map['en'] || Object.values(map).find(v => v) || ''
  }

  get hasItems() {
    return (this._systems?.items?.length > 0) || (this._systems?.subItems?.length > 0)
  }

  _handleItemClick(item, locationId) {
    if (this._isPrint) return
    this.dispatchEvent(new CustomEvent('show-location-uc', {
      detail: { item, locationId },
      bubbles: true, composed: true
    }))
  }

  _handleImageClick(e, src) {
    if (this._isPrint) return
    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: { event: e, src },
      bubbles: true, composed: true
    }))
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary:    #00378c;
          --ipd-white:      #ffffff;
          --ipd-turquoise:  #00BCA1;
          --ipd-light-gray: #f5f5f5;
          --ipd-border:     #e0e0e0;
          display: block;
          width: 100%;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .location-container {
          width: 100%;
          background: var(--ipd-white);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          overflow: hidden;
          margin-bottom: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ── Liste d'items ─────────────────── */
        .items-section {
          padding: 16px;
        }

        .location-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid var(--ipd-border);
          cursor: ${this._isPrint ? 'default' : 'pointer'};
          transition: background 0.2s;
          border-radius: 4px;
        }
        .location-item:last-child { border-bottom: none; }
        .location-item:hover { background: ${this._isPrint ? 'transparent' : '#f0f7ff'}; }

        .item-label {
          font-size: 15px;
          font-weight: 600;
          color: #464653;
          flex: 1;
        }

        .item-arrow {
          color: var(--ipd-turquoise);
          opacity: ${this._isPrint ? '0' : '0.7'};
          flex-shrink: 0;
        }

        /* ── Sous-items ────────────────────── */
        .sub-section {
          padding: 0 16px 8px 32px;
          border-left: 3px solid var(--ipd-turquoise);
          margin: 0 16px 16px 16px;
        }

        /* ── Image ─────────────────────────── */
        .image-section {
          padding: 16px;
          border-top: 1px solid var(--ipd-border);
          display: flex;
          ${this._isPrint ? 'justify-content: flex-start;' : 'justify-content: center;'}
        }

        .image-wrapper {
          position: relative;
          display: inline-block;
          border-radius: 0;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transition: transform 0.3s ease;
          cursor: ${this._isPrint ? 'default' : 'pointer'};
          max-width: 100%;
        }
        .image-wrapper:hover { transform: ${this._isPrint ? 'none' : 'scale(1.02)'}; }

        .location-img {
          display: block;
          max-width: 500px;
          width: 100%;
          height: auto;
        }

        .zoom-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,55,140,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .image-wrapper:hover .zoom-overlay { opacity: ${this._isPrint ? '0' : '1'}; }
        .zoom-icon { color: #fff; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }

        @media (max-width: 768px) {
          .item-label { font-size: 13px; }
          .location-img { max-width: 100%; }
        }
        @media print {
          .location-container { box-shadow: none; break-inside: avoid; }
          .zoom-overlay { display: none; }
          .image-wrapper { box-shadow: none; cursor: default; }
        }
      </style>
    `
  }

  // ── render ─────────────────────────────────────────────────────────────────

  _renderItems(items, locationId) {
    if (!items?.length) return ''
    return items.map(item => `
      <div class="location-item" data-item-id="${item.id || ''}" data-location-id='${JSON.stringify(locationId || [])}'>
        <span class="item-label">${this._hl(item.description?.map)}</span>
        <svg class="item-arrow" viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
        </svg>
      </div>
    `).join('')
  }

  _render() {
    const sys = this._systems
    if (!sys || (!sys.items?.length && !sys.subItems?.length)) {
      this.shadowRoot.innerHTML = this._getStyles()
      return
    }

    const itemsHTML = this._renderItems(sys.items, sys.locationId)
    const subItemsHTML = (sys.subItems || []).map(sub =>
      `<div class="sub-section">${this._renderItems(sub.items, sub.locationId)}</div>`
    ).join('')

    const imageHTML = sys.locationImg ? `
      <div class="image-section">
        <div class="image-wrapper" id="img-wrapper">
          <img class="location-img" src="${sys.locationImg}" alt="Localisation" />
          <div class="zoom-overlay">
            <svg class="zoom-icon" viewBox="0 0 24 24" width="40" height="40">
              <path fill="currentColor" d="M15.5,14H14.71L14.43,13.73C15.41,12.59 16,11.11 16,9.5A6.5,6.5 0 0,0 9.5,3A6.5,6.5 0 0,0 3,9.5A6.5,6.5 0 0,0 9.5,16C11.11,16 12.59,15.41 13.73,14.43L14,14.71V15.5L19,20.5L20.5,19L15.5,14M9.5,14C7,14 5,12 5,9.5C5,7 7,5 9.5,5C12,5 14,7 14,9.5C14,12 12,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z"/>
            </svg>
          </div>
        </div>
      </div>` : ''

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <div class="location-container">
        <div class="items-section">
          ${itemsHTML}
        </div>
        ${subItemsHTML}
        ${imageHTML}
      </div>
    `

    // Events — items
    this.shadowRoot.querySelectorAll('.location-item').forEach(el => {
      el.addEventListener('click', () => {
        if (this._isPrint) return
        try {
          const locationId = JSON.parse(el.dataset.locationId || '[]')
          const itemId = el.dataset.itemId
          const item = [...(this._systems?.items || []), ...(this._systems?.subItems?.flatMap(s => s.items) || [])]
            .find(i => String(i.id) === itemId)
          if (item) this._handleItemClick(item, locationId)
        } catch (e) { /* noop */ }
      })
    })

    // Events — image
    this.shadowRoot.getElementById('img-wrapper')?.addEventListener('click', (e) => {
      this._handleImageClick(e, this._systems.locationImg)
    })
  }
}

if (!customElements.get('location-systems')) {
  customElements.define('location-systems', LocationSystems)
}
export default LocationSystems
