/**
 * location-schematics-uc — Modale "Implantation/affectation fusibles et relais"
 * Converti depuis LocationSchematicsUC.vue (sans Vuetify)
 *
 * Affiche, pour une boîte à fusibles/relais cliquée dans <location-systems> :
 *   - Colonne gauche : champ de recherche + légende (F1, F2, R1… avec descriptions et ampérage)
 *   - Colonne droite : schéma de la boîte (systemDrawing), SVG injecté inline
 *     avec surbrillance du composant sélectionné dans la légende
 *   - Icône à côté de la recherche : aperçu de la position dans le véhicule (locationDrawing)
 *   - Footer : bouton IMPRIMER (impression via iframe dédiée)
 *
 * Props (propriétés JS) :
 *   component   Object — item locationSystems cliqué :
 *               { description: { map }, components: [], systemDrawing: { url },
 *                 locationDrawing: { url }, locationId: { location } }
 *   vehicle     Object (optionnel) — { make, model, type, vin, date, km } pour l'en-tête d'impression
 *   haynesLang  String — ID de langue HaynesPro ('' = auto)
 *   open        Boolean — affiche / masque la modale
 *
 * Events émis :
 *   close — quand la modale est fermée
 */

const HAYNES_DEFAULT_LANG = '2057'

class LocationSchematicsUC extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._component = null
    this._vehicle = null
    this._haynesLang = ''
    this._open = false
    this._search = ''
    this._selectedIndex = -1
    this._svgMarkup = null       // SVG du systemDrawing injecté inline (null = fallback <img>)
    this._svgLoadedFor = null    // URL pour laquelle _svgMarkup a été résolu
    this._showLocationPreview = false
    this._handleKeyDown = this._handleKeyDown.bind(this)
  }

  // ── props ──────────────────────────────────────────────────────────────────

  set component(v) {
    this._component = v || null
    this._search = ''
    this._selectedIndex = -1
    this._svgMarkup = null
    this._svgLoadedFor = null
    this._render()
    this._loadSystemDrawing()
  }
  get component() { return this._component }

  set vehicle(v) { this._vehicle = v || null; this._render() }
  get vehicle() { return this._vehicle }

  set haynesLang(v) { this._haynesLang = v || ''; this._render() }
  get haynesLang() { return this._haynesLang }

  set open(v) {
    const next = !!v
    if (this._open === next) return
    this._open = next
    if (next) document.addEventListener('keydown', this._handleKeyDown)
    else document.removeEventListener('keydown', this._handleKeyDown)
    this._render()
    if (next) this._loadSystemDrawing()
  }
  get open() { return this._open }

  connectedCallback() { this._render() }
  disconnectedCallback() { document.removeEventListener('keydown', this._handleKeyDown) }

  // ── helpers langue (contrat HaynesPro : map = 2057 (EN) + langue du header) ─

  _hl(map) {
    if (!map || typeof map !== 'object') return ''
    const isFilled = (v) => typeof v === 'string' && v.trim() !== ''
    if (this._haynesLang && isFilled(map[this._haynesLang])) return map[this._haynesLang]
    for (const key of Object.keys(map)) {
      if (key !== HAYNES_DEFAULT_LANG && isFilled(map[key])) return map[key]
    }
    if (isFilled(map[HAYNES_DEFAULT_LANG])) return map[HAYNES_DEFAULT_LANG]
    return Object.values(map).find(isFilled) || ''
  }

  _escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  // ── logique métier (portée de LocationSchematicsUC.vue) ────────────────────

  get _title() { return this._hl(this._component?.description?.map) }

  /** Notes de légende : type loc/cm avec sortOrder 0 → pas de code en préfixe */
  _isNote(item) {
    return ['loc', 'cm'].includes(item.type) && item.sortOrder === 0
  }

  /** Phrases d'un item + ampérage "(40A)" sur la dernière phrase */
  _getDetailsFromItem(item) {
    const ret = []
    ;(item.sentences || []).forEach((sentence, index) => {
      ret.push(this._hl(sentence.description?.map))
      if (item.value && index === item.sentences.length - 1) {
        ret[ret.length - 1] += ' (' + item.value + 'A)'
      }
    })
    return ret
  }

  /** Filtre de la légende : location, oemCode, 1re phrase (langue courante + EN) */
  get _filteredItems() {
    const components = this._component?.components
    if (!components) return false
    if (!this._search) return components.map((item, idx) => ({ item, idx }))

    const needle = this._search.toLowerCase()
    const match = (s) => typeof s === 'string' && s.toLowerCase().indexOf(needle) > -1

    return components
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => {
        const map = item.sentences?.[0]?.description?.map || {}
        return match(item.location)
          || match(item.oemCode)
          || match(this._hl(map))
          || match(map[HAYNES_DEFAULT_LANG])
      })
  }

  // ── chargement du schéma (SVG inline pour surbrillance) ────────────────────

  get _systemDrawingUrl() {
    const url = this._component?.systemDrawing?.url
    return url ? url.replace('http://', '//') : null
  }

  get _locationDrawingUrl() {
    const url = this._component?.locationDrawing?.url
    return url ? url.replace('http://', '//') : null
  }

  async _loadSystemDrawing() {
    const url = this._systemDrawingUrl
    if (!url || !this._open || this._svgLoadedFor === url) return

    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      // On ne garde que si c'est bien du SVG (sinon fallback <img>)
      if (/<svg[\s>]/i.test(text)) {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const svg = doc.documentElement
        if (svg && svg.nodeName.toLowerCase() === 'svg' && !doc.querySelector('parsererror')) {
          svg.removeAttribute('width')
          svg.removeAttribute('height')
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
          this._svgMarkup = svg.outerHTML
        }
      }
    } catch (e) {
      // CORS / réseau / non-SVG → fallback <img>, pas de surbrillance
      this._svgMarkup = null
    }
    this._svgLoadedFor = url
    this._render()
    this._applyHighlight()
  }

  // ── surbrillance dans le schéma ─────────────────────────────────────────────

  /**
   * Localise le nœud SVG correspondant au composant (F1, R2…).
   * Stratégies, dans l'ordre :
   *   1. id exact / id "sys-<location>" / id se terminant par le code
   *   2. nœud <text> dont le contenu == code → on surligne son groupe parent
   */
  _findSvgTarget(svg, location) {
    if (!location) return null
    const loc = String(location).trim()

    const byId = svg.querySelector(`[id="${CSS.escape(loc)}"]`)
      || svg.querySelector(`[id="sys-${CSS.escape(loc)}"]`)
      || [...svg.querySelectorAll('[id]')].find(n => n.id.toLowerCase().endsWith(loc.toLowerCase()))
    if (byId) return byId

    const textNode = [...svg.querySelectorAll('text')]
      .find(t => t.textContent.trim().toLowerCase() === loc.toLowerCase())
    if (textNode) return textNode.closest('g') || textNode
    return null
  }

  _applyHighlight() {
    const svg = this.shadowRoot.querySelector('.schema-inline svg')
    if (!svg) return

    // Reset
    svg.querySelectorAll('.uc-highlight').forEach(n => n.classList.remove('uc-highlight'))
    if (!svg.querySelector('style[data-uc-highlight]')) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.setAttribute('data-uc-highlight', '')
      style.textContent = `
        .uc-highlight, .uc-highlight * {
          stroke: #E30613 !important;
          stroke-width: 2px !important;
        }
      `
      svg.prepend(style)
    }

    const components = this._component?.components || []
    const item = components[this._selectedIndex]
    if (!item) return

    const target = this._findSvgTarget(svg, item.location)
    if (target) {
      target.classList.add('uc-highlight')
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
  }

  // ── interactions ────────────────────────────────────────────────────────────

  _handleKeyDown(e) { if (e.key === 'Escape') this._close() }

  _close() {
    this._open = false
    this._showLocationPreview = false
    document.removeEventListener('keydown', this._handleKeyDown)
    this._render()
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
  }

  _selectItem(idx) {
    this._selectedIndex = this._selectedIndex === idx ? -1 : idx
    this._updateSelectionUI()
    this._applyHighlight()
  }

  /** Met à jour la sélection sans re-render complet (préserve focus + saisie) */
  _updateSelectionUI() {
    this.shadowRoot.querySelectorAll('.legend-item').forEach(el => {
      const idx = parseInt(el.dataset.index, 10)
      el.classList.toggle('is-selected', idx === this._selectedIndex)
    })
  }

  _handleSearchInput(value) {
    this._search = value
    const list = this.shadowRoot.getElementById('legend-list')
    if (list) list.innerHTML = this._renderLegendItems()
    this._bindLegendEvents()
  }

  // ── impression (iframe dédiée, contenu autonome) ────────────────────────────

  _handlePrint() {
    const vehicle = this._vehicle
    const vehicleLine = vehicle ? `
      <div class="print-vehicle">
        ${this._escape([vehicle.make, vehicle.model, vehicle.type, vehicle.vin].filter(Boolean).join(' — '))}
        ${vehicle.date || vehicle.km ? `<br/>${this._escape([vehicle.date, vehicle.km ? vehicle.km + ' KM' : ''].filter(Boolean).join(' — '))}` : ''}
      </div>` : ''

    const components = this._component?.components || []
    const rows = components.map(item => {
      const note = this._isNote(item)
      const details = this._getDetailsFromItem(item).map(s => `<span>${s}</span>`).join(' ')
      return `
        <tr>
          <td class="code-cell">${note ? '' : `<strong>${this._escape(item.location || '')}</strong>${item.oemCode ? ` <strong>[${this._escape(item.oemCode)}]</strong>` : ''}`}</td>
          <td>${details}</td>
        </tr>`
    }).join('')

    const schemaUrl = this._systemDrawingUrl
    const locationUrl = this._locationDrawingUrl

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>${this._escape(this._title)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1a1a1a; }
          .print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00BCA1; padding-bottom: 12px; margin-bottom: 16px; }
          .print-logo { font-size: 1.25rem; font-weight: 700; color: #00378c; }
          .print-logo span { color: #E30613; }
          .print-vehicle { font-size: 13px; text-align: right; color: #555555; }
          h1 { font-size: 1.25rem; color: #00378c; margin-bottom: 16px; }
          .print-images { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
          .print-images img { max-width: 48%; height: auto; border: 1px solid #e0e0e0; }
          table { width: 100%; border-collapse: collapse; border-radius: 0 !important; }
          th { text-align: left; padding: 8px; background: #f5f5f5; color: #00378c; font-weight: 600; border-bottom: 3px solid #00BCA1; }
          td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 14px; vertical-align: top; }
          .code-cell { white-space: nowrap; width: 90px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-logo">Atelio <span>DATA</span></div>
          ${vehicleLine}
        </div>
        <h1>${this._escape(this._title)}</h1>
        <div class="print-images">
          ${locationUrl ? `<img src="${this._escape(locationUrl)}" alt=""/>` : ''}
          ${schemaUrl ? `<img src="${this._escape(schemaUrl)}" alt=""/>` : ''}
        </div>
        <table>
          <thead><tr><th colspan="2">Légende</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()

    const doPrint = () => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } finally {
        setTimeout(() => iframe.remove(), 1000)
      }
    }
    // Laisse le temps aux images de charger
    const imgs = [...iframe.contentDocument.images]
    if (!imgs.length) { doPrint(); return }
    let loaded = 0
    const onDone = () => { if (++loaded >= imgs.length) doPrint() }
    imgs.forEach(img => {
      if (img.complete) onDone()
      else { img.onload = onDone; img.onerror = onDone }
    })
    // Garde-fou si une image ne répond jamais
    setTimeout(doPrint, 4000)
  }

  // ── styles ──────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary:     #00378c;
          --ipd-secondary:   #E30613;
          --ipd-turquoise:   #00BCA1;
          --ipd-white:       #ffffff;
          --ipd-gray:        #777574;
          --ipd-light-gray:  #f5f5f5;
          --ipd-border:      #e0e0e0;
          --ipd-dark-text:   #1a1a1a;
          --ipd-medium-text: #555555;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Overlay + dialog ─────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          background: var(--ipd-white);
          border-radius: 0;
          border-top: 4px solid var(--ipd-secondary);
          width: 70vw;
          max-width: 1400px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--ipd-border);
          flex-shrink: 0;
        }
        .modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--ipd-dark-text);
        }
        .btn-close {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          display: flex;
          color: var(--ipd-dark-text);
          transition: color 0.2s ease;
        }
        .btn-close:hover { color: var(--ipd-secondary); }

        /* ── Body 2 colonnes ──────────────── */
        .modal-body {
          flex: 1;
          overflow: auto;
          padding: 20px;
          display: grid;
          grid-template-columns: minmax(320px, 1fr) minmax(0, 1.2fr);
          gap: 24px;
          align-items: start;
        }

        /* ── Colonne gauche : recherche + légende ── */
        .search-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          position: relative;
        }
        .search-field {
          flex: 1;
          display: flex;
          align-items: center;
          border: 1px solid var(--ipd-gray);
          border-radius: 28px;
          padding: 0 14px;
          background: var(--ipd-white);
          transition: border-color 0.2s ease;
        }
        .search-field:focus-within { border-color: var(--ipd-primary); }
        .search-input {
          flex: 1;
          border: none;
          outline: none;
          padding: 11px 8px 11px 0;
          font-size: 14px;
          background: transparent;
          color: var(--ipd-dark-text);
        }
        .search-input::placeholder { color: var(--ipd-gray); }
        .search-icon { color: var(--ipd-gray); flex-shrink: 0; }

        .btn-location-preview {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          display: flex;
          color: var(--ipd-gray);
          flex-shrink: 0;
          transition: color 0.2s ease;
        }
        .btn-location-preview:hover { color: var(--ipd-primary); }

        .location-preview-pop {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 10;
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          padding: 8px;
          min-width: 300px;
          max-width: 420px;
        }
        .location-preview-pop img { display: block; width: 100%; height: auto; }

        .legend-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--ipd-dark-text);
          margin-bottom: 8px;
        }

        .legend-scroll {
          max-height: calc(92vh - 300px);
          overflow: auto;
          border-top: 1px solid var(--ipd-border);
        }

        .legend-item {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 12px 12px;
          border: 1px solid var(--ipd-border);
          border-top: none;
          cursor: pointer;
          transition: background 0.15s ease;
          font-size: 14px;
          color: var(--ipd-dark-text);
        }
        .legend-item:hover { background: #f0f7ff; }
        .legend-item.is-selected { background: #d9e4f5; }

        .legend-code {
          font-weight: 700;
          white-space: nowrap;
          flex-shrink: 0;
          min-width: 34px;
        }
        .legend-text { flex: 1; line-height: 1.4; }
        .legend-empty {
          padding: 16px 12px;
          font-style: italic;
          color: var(--ipd-medium-text);
          border: 1px solid var(--ipd-border);
          border-top: none;
          font-size: 14px;
        }

        /* ── Colonne droite : schéma ──────── */
        .schema-panel {
          background: #F1F4F6;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          min-height: 300px;
          position: sticky;
          top: 0;
        }
        .schema-inline { width: 100%; }
        .schema-inline svg { width: 100%; height: auto; display: block; max-height: calc(92vh - 220px); }
        .schema-img { max-width: 100%; height: auto; display: block; }

        .no-data-message {
          grid-column: 1 / -1;
          padding: 48px 0;
          text-align: center;
          font-style: italic;
          font-size: 1.125rem;
          color: var(--ipd-medium-text);
        }

        /* ── Footer ───────────────────────── */
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          padding: 12px 20px;
          border-top: 1px solid var(--ipd-border);
          flex-shrink: 0;
        }
        .btn-print {
          background: #4a4f57;
          color: var(--ipd-white);
          border: none;
          border-radius: 0;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s ease;
        }
        .btn-print:hover { background: var(--ipd-primary); }

        /* ── Responsive ───────────────────── */
        @media (max-width: 960px) {
          .modal-container { width: 96vw; }
          .modal-body { grid-template-columns: 1fr; }
          .schema-panel { position: static; order: -1; }
          .legend-scroll { max-height: 40vh; }
        }
        @media (max-width: 768px) {
          .modal-overlay { padding: 8px; }
          .modal-title { font-size: 1rem; }
          .modal-body { padding: 12px; gap: 16px; }
        }

        /* ── Print (la modale elle-même n'est pas imprimée : iframe dédiée) ── */
        @media print {
          .modal-overlay { display: none; }
        }
      </style>
    `
  }

  // ── render ──────────────────────────────────────────────────────────────────

  _renderLegendItems() {
    const filtered = this._filteredItems

    if (filtered === false) {
      return `<div class="legend-empty">Aucune légende disponible</div>`
    }
    if (!filtered.length) {
      return `<div class="legend-empty">Aucun résultat</div>`
    }

    return filtered.map(({ item, idx }) => {
      const note = this._isNote(item)
      const details = this._getDetailsFromItem(item)
        .map((s, i) => `<span data-sentence="${i}">${s}</span>`)
        .join(' ')
      return `
        <div class="legend-item ${idx === this._selectedIndex ? 'is-selected' : ''}" data-index="${idx}">
          ${note ? '' : `
            <span class="legend-code">
              ${this._escape(item.location || '')}${item.oemCode ? ` [${this._escape(item.oemCode)}]` : ''}
            </span>`}
          <span class="legend-text">${details}</span>
        </div>
      `
    }).join('')
  }

  _bindLegendEvents() {
    this.shadowRoot.querySelectorAll('.legend-item').forEach(el => {
      el.addEventListener('click', () => this._selectItem(parseInt(el.dataset.index, 10)))
    })
  }

  _render() {
    if (!this._open || !this._component) {
      this.shadowRoot.innerHTML = this._getStyles()
      return
    }

    const hasComponents = !!this._component.components
    const schemaUrl = this._systemDrawingUrl
    const locationUrl = this._locationDrawingUrl

    const schemaHTML = this._svgMarkup
      ? `<div class="schema-inline">${this._svgMarkup}</div>`
      : (schemaUrl ? `<img class="schema-img" src="${this._escape(schemaUrl)}" alt="${this._escape(this._title)}"/>` : '')

    const bodyHTML = hasComponents ? `
      <div class="legend-col">
        <div class="search-row">
          <div class="search-field">
            <input
              id="search-input"
              class="search-input"
              type="text"
              placeholder="Tapez pour filtrer les composants"
              value="${this._escape(this._search)}"
            />
            <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
            </svg>
          </div>
          ${locationUrl ? `
            <button class="btn-location-preview" id="btn-location-preview" title="Position dans le véhicule">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M12,2C15.31,2 18,4.66 18,7.95C18,12.41 12,19 12,19C12,19 6,12.41 6,7.95C6,4.66 8.69,2 12,2M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6Z"/>
              </svg>
            </button>
            <div class="location-preview-pop" id="location-preview-pop" ${this._showLocationPreview ? '' : 'hidden'}>
              <img src="${this._escape(locationUrl)}" alt="Position dans le véhicule"/>
            </div>
          ` : ''}
        </div>

        <div class="legend-title">Légende</div>
        <div class="legend-scroll" id="legend-list">
          ${this._renderLegendItems()}
        </div>
      </div>

      <div class="schema-panel" id="schema-panel">
        ${schemaHTML}
      </div>
    ` : `
      <div class="no-data-message">Aucune donnée de localisation disponible</div>
    `

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <div class="modal-overlay" id="overlay">
        <div class="modal-container">
          <div class="modal-header">
            <span class="modal-title">${this._escape(this._title)}</span>
            <button class="btn-close" id="btn-close" title="Fermer">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            ${bodyHTML}
          </div>
          <div class="modal-footer">
            <button class="btn-print" id="btn-print">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M18,3H6V7H18M19,12A1,1 0 0,1 18,11A1,1 0 0,1 19,10A1,1 0 0,1 20,11A1,1 0 0,1 19,12M16,19H8V14H16M19,8H5A3,3 0 0,0 2,11V17H6V21H18V17H22V11A3,3 0 0,0 19,8Z"/>
              </svg>
              Imprimer
            </button>
          </div>
        </div>
      </div>
    `

    // ── events ──
    this.shadowRoot.getElementById('btn-close')?.addEventListener('click', () => this._close())
    this.shadowRoot.getElementById('overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this._close()
    })
    this.shadowRoot.getElementById('btn-print')?.addEventListener('click', () => this._handlePrint())

    const searchInput = this.shadowRoot.getElementById('search-input')
    searchInput?.addEventListener('input', (e) => this._handleSearchInput(e.target.value))

    const previewBtn = this.shadowRoot.getElementById('btn-location-preview')
    const previewPop = this.shadowRoot.getElementById('location-preview-pop')
    if (previewBtn && previewPop) {
      const show = () => { this._showLocationPreview = true; previewPop.removeAttribute('hidden') }
      const hide = () => { this._showLocationPreview = false; previewPop.setAttribute('hidden', '') }
      previewBtn.addEventListener('mouseenter', show)
      previewBtn.addEventListener('mouseleave', hide)
      previewBtn.addEventListener('click', () => {
        this._showLocationPreview ? hide() : show()
      })
    }

    this._bindLegendEvents()
    this._applyHighlight()
  }
}

if (!customElements.get('location-schematics-uc')) {
  customElements.define('location-schematics-uc', LocationSchematicsUC)
}
export default LocationSchematicsUC
