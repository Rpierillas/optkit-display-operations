/**
 * MethodsDetails Web Component
 * Optimisé : imports dynamiques des enfants au moment du rendu
 */

// ✅ PLUS D'IMPORTS STATIQUES ICI

class MethodsDetails extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    this._item = {}
    this._type = null
    this._isPrint = false
    this._operationDetails = {}
    this._operations = {}
    this._formattedLocationSystems = []
    this._index = 0
    this._isSingleItem = false
    this._lang = 'en'
    this._haynesLang = '2057'

    this.state = {
      showSchematics: false,
      isOpened: false,
      svgDataContainer: { imgUrl: null }
    }

    this.repairManualRefs = new Map()
    this.adjustmentRefs = new Map()
    this.technicalDrawingsRefs = new Map()

    this._domReady = false

    // ✅ Suivi des composants déjà chargés
    this._loadedComponents = new Set()

    this.translations = {
      'common.loading': 'Chargement...'
    }
  }

  static get observedAttributes() {
    return ['type', 'is-print', 'index', 'is-single-item', 'lang', 'haynes-lang']
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get item() { return this._item }
  set item(value) {
    this._item = value || {}
    if (this.isConnected) {
      this.sortLubricantByGroupType()
      this._domReady = false
      this.render()
    }
  }

  get type() { return this._type }
  set type(value) { this._type = value }

  get isPrint() { return this._isPrint }
  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    this._isPrint = boolValue
    if (boolValue) this.state.isOpened = true
    if (this.isConnected) {
      if (this._domReady) {
        this._applyPanelState()
        this.updateChildComponents()
      } else {
        this.render()
      }
    }
  }

  get operationDetails() { return this._operationDetails }
  set operationDetails(value) {
    this._operationDetails = value || {}
    if (this.isConnected && this._domReady) this.updateChildComponents()
  }

  get operations() { return this._operations }
  set operations(value) {
    this._operations = value || {}
    if (this.isConnected && this._domReady) this.updateChildComponents()
  }

  get formattedLocationSystems() { return this._formattedLocationSystems }
  set formattedLocationSystems(value) { this._formattedLocationSystems = value || [] }

  get index() { return this._index }
  set index(value) { this._index = parseInt(value, 10) }

  get isSingleItem() { return this._isSingleItem }
  set isSingleItem(value) {
    const boolValue = value === true || value === 'true'
    this._isSingleItem = boolValue
    if (boolValue) this.state.isOpened = true
    if (this.isConnected) {
      if (this._domReady) this._applyPanelState()
      else this.render()
    }
  }

  get lang() { return this._lang }
  set lang(value) {
    this._lang = value || 'en'
    if (this.isConnected && this._domReady) this.updateChildComponents()
  }

  get haynesLang() { return this._haynesLang }
  set haynesLang(value) {
    this._haynesLang = value || '2057'
    if (this.isConnected && this._domReady) this.updateChildComponents()
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    if (this._isPrint || this._isSingleItem) this.state.isOpened = true
    if (this._item && Object.keys(this._item).length > 0) {
      this.sortLubricantByGroupType()
      this.render()
    }
  }

  disconnectedCallback() {
    this.detachEventListeners()
    this._domReady = false
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    switch (name) {
      case 'type': this.type = newValue; break
      case 'is-print': this.isPrint = newValue === 'true'; break
      case 'index': this.index = parseInt(newValue, 10); break
      case 'is-single-item': this.isSingleItem = newValue === 'true'; break
      case 'lang': this.lang = newValue; break
      case 'haynes-lang': this.haynesLang = newValue; break
    }
  }

  // ============================================
  // ✅ LAZY LOADING DES COMPOSANTS ENFANTS
  // Chaque composant n'est importé qu'une seule fois
  // ============================================

  async _loadAdjustmentSystem() {
    if (this._loadedComponents.has('adjustment-data-group')) return
    await import('./components/AdjustementSystem.js')
    await customElements.whenDefined('adjustment-data-group')
    this._loadedComponents.add('adjustment-data-group')
  }

  async _loadRepairManuals() {
    if (this._loadedComponents.has('repairs-data-group')) return
    await import('./components/RepairManualsWC.js')
    await customElements.whenDefined('repairs-data-group')
    this._loadedComponents.add('repairs-data-group')
  }

  async _loadTechnicalDrawings() {
    if (this._loadedComponents.has('technical-drawings')) return
    await import('./components/TechnicalDrawingsWC.js')
    await customElements.whenDefined('technical-drawings')
    this._loadedComponents.add('technical-drawings')
  }

  /**
   * ✅ Charge uniquement les composants nécessaires selon le contenu de _item
   */
  async _loadRequiredComponents() {
    const promises = []

    const hasAdjustments = this._item.components?.some(
      c => c.adjustmentData && c.adjustmentSystem?.items?.length
    )
    const hasRepairManuals = this._item.repairManuals?.length > 0
    const hasTechnicalDrawings = this._item.components?.some(
      c => c.drawingSystem?.items?.length
    )

    if (hasAdjustments) promises.push(this._loadAdjustmentSystem())
    if (hasRepairManuals) promises.push(this._loadRepairManuals())
    if (hasTechnicalDrawings) promises.push(this._loadTechnicalDrawings())

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  formatSentenceCase(text) {
    if (!text) return ''
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  }

  formatHaynesLang(map) {
    if (!map) return ''
    const keys = Object.keys(map)
    return keys.length > 0 ? map[keys[0]] : ''
  }

  isLastItem(itemsLength, currentItem) {
    return currentItem === itemsLength - 1
  }

  sortLubricantByGroupType() {
    if (this._item.components) {
      this._item.components.sort((a, b) => (a.group?.sortOrder || 0) - (b.group?.sortOrder || 0))
    }
  }

  filterDuplicateTitle(currentIndex, currentComponent) {
    if (currentIndex === 0) return currentComponent.description?.map || null
    return null
  }

  // ============================================
  // TOGGLE OPTIMISÉ
  // ============================================

  togglePanel() {
    this.state.isOpened = !this.state.isOpened
    this._applyPanelState()
  }

  _applyPanelState() {
    const shadow = this.shadowRoot
    if (!shadow) return

    const panel = shadow.querySelector('.expansion-panel')
    const content = shadow.querySelector('.expansion-panel-content')
    const header = shadow.querySelector('.expansion-panel-header')

    if (!panel || !content) return

    if (this.state.isOpened) {
      panel.classList.add('is-open')
      content.style.display = ''
      header?.setAttribute('aria-expanded', 'true')
    } else {
      panel.classList.remove('is-open')
      content.style.display = 'none'
      header?.setAttribute('aria-expanded', 'false')
    }
  }

  // ============================================
  // SCHEMATICS
  // ============================================

  openSvgImageContainer(data) {
    this.state.showSchematics = true
    this.state.svgDataContainer = { imgUrl: data.src || data.detail?.src || '' }

    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: data,
      bubbles: true,
      composed: true
    }))

    this._updateSchematicsModal()
  }

  closeSvgImageContainer() {
    this.state.showSchematics = false
    this.state.svgDataContainer = { imgUrl: null }
    this._updateSchematicsModal()
  }

  _updateSchematicsModal() {
    const shadow = this.shadowRoot
    if (!shadow) return

    shadow.querySelector('.modal-overlay')?.remove()

    if (this.state.showSchematics && this.state.svgDataContainer.imgUrl) {
      const panelBody = shadow.querySelector('.panel-body')
      if (panelBody) {
        const modalEl = document.createElement('div')
        modalEl.innerHTML = this.renderSchematicsModal()
        const modal = modalEl.firstElementChild
        panelBody.appendChild(modal)

        modal.querySelectorAll('[data-action="close-schematics"]').forEach(btn => {
          btn.addEventListener('click', () => this.closeSvgImageContainer())
        })
      }
    }
  }

  // ============================================
  // MISE À JOUR DES ENFANTS
  // ============================================

  updateChildComponents() {
    this.repairManualRefs.forEach((webComponent, index) => {
      if (webComponent && this._item.repairManuals?.[index]) {
        webComponent.instruction = this._item.repairManuals[index]
        webComponent.operations = this._operations
        webComponent.operationsDetails = this._operationDetails
      }
    })

    this.adjustmentRefs.forEach((webComponent, key) => {
      const [componentIndex, adjustmentIndex] = key.split('-').map(Number)
      const component = this._item.components?.[componentIndex]
      const adjustmentItem = component?.adjustmentSystem?.items?.[adjustmentIndex]

      if (webComponent && component && adjustmentItem) {
        webComponent.adjustmentItem = adjustmentItem
        webComponent.component = component
        webComponent.operations = this._operations
        webComponent.group = component.group?.mainGroups?.[0] || ''
        webComponent.isPrint = this._isPrint
        webComponent.haynesLang = this._haynesLang
      }
    })

    this.technicalDrawingsRefs.forEach((webComponent, key) => {
      const [componentIndex, drawingsIndex] = key.split('-').map(Number)
      const component = this._item.components?.[componentIndex]
      const technicalDrawing = component?.drawingSystem?.items?.[drawingsIndex]

      if (webComponent && component && technicalDrawing) {
        webComponent.technicalDrawings = technicalDrawing
        webComponent.component = component
        webComponent.technicalDrawingsIndex = drawingsIndex
        webComponent.isPrint = this._isPrint
        webComponent.lang = this._lang
        webComponent.haynesLang = this._haynesLang
        webComponent.isLastItem = this.isLastItem(component.drawingSystem.items.length, drawingsIndex)
      }
    })

    // ── lubricant-data ───────────────────────────────────────────────────────
    this.shadowRoot.querySelectorAll('lubricant-data').forEach(el => {
      const componentIndex = parseInt(el.getAttribute('data-component-index'), 10)
      const lubIdx = parseInt(el.getAttribute('data-lubricant-index'), 10)
      const component = this._item.components?.[componentIndex]
      const lubricantSystem = component?.lubricantSystem?.items?.[lubIdx]
      if (component && lubricantSystem) {
        el.component = component
        el.lubricantSystem = lubricantSystem
        el.haynesLang = this._haynesLang
        el.isPrint = this._isPrint
      }
    })

    // ── location-systems ─────────────────────────────────────────────────────
    this.shadowRoot.querySelectorAll('location-systems').forEach(el => {
      const sysIdx = parseInt(el.getAttribute('data-systems-index'), 10)
      const systems = this._formattedLocationSystems?.[sysIdx]
      if (systems) {
        el.systems = systems
        el.isPrint = this._isPrint
        el.haynesLang = this._haynesLang
      }
    })
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  attachEventListeners() {
    const shadow = this.shadowRoot

    shadow.querySelector('.expansion-panel-header')
      ?.addEventListener('click', this.togglePanel.bind(this))

    shadow.querySelectorAll('repairs-data-group').forEach((el, index) => {
      this.repairManualRefs.set(index, el)
      el.addEventListener('show-schematics', (e) => this.openSvgImageContainer(e.detail))
    })

    shadow.querySelectorAll('adjustment-data-group').forEach((el) => {
      const componentIndex = parseInt(el.getAttribute('data-component-index'), 10)
      const adjustmentIndex = parseInt(el.getAttribute('data-adjustment-index'), 10)
      const key = `${componentIndex}-${adjustmentIndex}`
      this.adjustmentRefs.set(key, el)
      el.addEventListener('show-schematics', (e) => this.openSvgImageContainer(e.detail))
    })

    shadow.querySelectorAll('technical-drawings').forEach((el) => {
      const componentIndex = parseInt(el.getAttribute('data-component-index'), 10)
      const drawingsIndex = parseInt(el.getAttribute('data-drawings-index'), 10)
      const key = `${componentIndex}-${drawingsIndex}`
      this.technicalDrawingsRefs.set(key, el)
      el.addEventListener('show-schematics', (e) => this.openSvgImageContainer(e.detail))
    })

    shadow.querySelectorAll('location-systems').forEach(el => {
      el.addEventListener('show-schematics', (e) => this.openSvgImageContainer(e.detail))
      el.addEventListener('show-location-uc', (e) => {
        this.dispatchEvent(new CustomEvent('show-location-uc', {
          detail: e.detail, bubbles: true, composed: true
        }))
      })
    })

    Promise.resolve().then(() => this.updateChildComponents())
  }

  detachEventListeners() {
    this.repairManualRefs.clear()
    this.adjustmentRefs.clear()
    this.technicalDrawingsRefs.clear()
  }

  // ============================================
  // ✅ RENDER - avec chargement lazy des enfants
  // ============================================

  async render() {
    if (!this._item || Object.keys(this._item).length === 0) {
      this.shadowRoot.innerHTML = `
        ${this.getStyles()}
        <div class="methods-details">
          <div class="loading-message">${this.translations['common.loading']}</div>
        </div>
      `
      return
    }

    try {
      // ✅ Charger uniquement les composants nécessaires AVANT de rendre le HTML
      await this._loadRequiredComponents()

      this.shadowRoot.innerHTML = this.getStyles() + this.generateHTML()
      this._domReady = true

      Promise.resolve().then(() => this.attachEventListeners())

    } catch (error) {
      console.error('❌ Render error:', error)
      this.shadowRoot.innerHTML = `
        <style>
          .error-message {
            padding: 20px;
            background: #f8d7da;
            border: 2px solid #dc3545;
            color: #721c24;
            font-family: sans-serif;
            border-radius: 8px;
            margin: 20px;
          }
        </style>
        <div class="error-message">
          <strong>❌ Erreur:</strong> ${error.message}
        </div>
      `
    }
  }

  generateHTML() {
    const hasLocationSystems = this._formattedLocationSystems?.length > 0 && this._item.locationSystems

    return `
      <div class="methods-details">
        <div class="expansion-panel ${this.state.isOpened ? 'is-open' : ''}">
          <button class="expansion-panel-header" aria-expanded="${this.state.isOpened}">
            <div class="header-content">
              <div class="header-icon">
                ${hasLocationSystems ? this.getCarIcon() : this.getDocumentIcon()}
              </div>
              <h2 class="header-title">
                ${this.formatSentenceCase(this._item.properties?.description || '')}
              </h2>
              <div class="header-chevron">
                <svg class="chevron-icon" viewBox="0 0 24 24">
                  <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                </svg>
              </div>
            </div>
          </button>

          <div class="expansion-panel-content" ${this.state.isOpened ? '' : 'style="display: none;"'}>
            <div class="panel-body">
              ${this.renderComponents()}
              ${this.renderRepairManuals()}
              ${this.renderLocationSystems()}
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderComponents() {
    if (!this._item.components?.length) return ''
    return this._item.components.map((component, componentIndex) => `
      <div class="component-section">
        ${this.renderAdjustmentData(component, componentIndex)}
        ${this.renderLubricantData(component, componentIndex)}
        ${this.renderRepairTimeData(component, componentIndex)}
        ${this.renderTechnicalDrawings(component, componentIndex)}
      </div>
    `).join('')
  }

  renderAdjustmentData(component, componentIndex) {
    if (!component.adjustmentData || !component.adjustmentSystem?.items) return ''
    const title = this.formatHaynesLang(component.description?.map)
    return `
      <div class="data-section">
        ${title ? `<h3 class="component-title">${title}</h3>` : ''}
        ${component.adjustmentSystem.items.map((_, adjustmentIndex) => `
          <div class="data-item">
            <adjustment-data-group
              data-component-index="${componentIndex}"
              data-adjustment-index="${adjustmentIndex}"
            ></adjustment-data-group>
          </div>
        `).join('')}
      </div>
    `
  }

  renderLubricantData(component, componentIndex) {
    if (!component.lubricantData || !component.lubricantSystem?.items) return ''
    return `
      <div class="data-section">
        ${component.lubricantSystem.items.map((_, lubIdx) => `
          <lubricant-data
            data-component-index="${componentIndex}"
            data-lubricant-index="${lubIdx}"
            haynes-lang="${this._haynesLang}"
            ${this._isPrint ? 'is-print' : ''}
          ></lubricant-data>
        `).join('')}
      </div>
    `
  }

  renderRepairTimeData(component, componentIndex) {
    if (!component.repairTimesData?.items) return ''
    return `
      <div class="data-section">
        <div class="vue-component-placeholder" data-type="repair-time" data-component-index="${componentIndex}"></div>
      </div>
    `
  }

  renderTechnicalDrawings(component, componentIndex) {
    if (!component.drawingSystem?.items) return ''
    return `
      <div class="data-section">
        ${component.drawingSystem.items.map((_, drawingsIndex) => `
          <div class="data-item">
            <technical-drawings
              data-component-index="${componentIndex}"
              data-drawings-index="${drawingsIndex}"
            ></technical-drawings>
          </div>
        `).join('')}
      </div>
    `
  }

  renderRepairManuals() {
    if (!this._item.repairManuals?.length) return ''
    return this._item.repairManuals.map((_, index) => `
      <div class="repair-manual-section">
        <repairs-data-group id="picto-${index}" data-index="${index}"></repairs-data-group>
      </div>
    `).join('')
  }

  renderLocationSystems() {
    const hasLocationSystems = this._formattedLocationSystems?.length > 0 && this._item.locationSystems
    if (!hasLocationSystems) return ''
    return `
      <div class="location-systems-section">
        ${this._formattedLocationSystems.map((_, sysIdx) => `
          <location-systems
            data-systems-index="${sysIdx}"
            ${this._isPrint ? 'is-print' : ''}
          ></location-systems>
        `).join('')}
      </div>
    `
  }

  renderSchematicsModal() {
    if (!this.state.showSchematics) return ''
    return `
      <div class="modal-overlay" data-action="close-schematics">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Schéma</h3>
            <button class="btn-close" data-action="close-schematics">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            ${this.state.svgDataContainer.imgUrl
              ? `<img src="${this.state.svgDataContainer.imgUrl}" alt="Schéma" class="modal-image" />`
              : ''
            }
          </div>
        </div>
      </div>
    `
  }

  getCarIcon() {
    return `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z" />
      </svg>
    `
  }

  getDocumentIcon() {
    return `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M21,4H3A2,2 0 0,0 1,6V19A2,2 0 0,0 3,21H21A2,2 0 0,0 23,19V6A2,2 0 0,0 21,4M3,19V6H11V19H3M21,19H13V6H21V19M14,9.5H20V11H14V9.5M14,12H20V13.5H14V12M14,14.5H20V16H14V14.5Z" />
      </svg>
    `
  }

  getStyles() {
    return `
      <style>
        :host {
          --ipd-primary: #003D7A;
          --ipd-secondary: #E30613;
          --ipd-background: #F5F5F5;
          --ipd-text-primary: #333333;
          --ipd-text-secondary: #666666;
          --ipd-border: #CCCCCC;
          --ipd-white: #FFFFFF;
          --ipd-hover: #002855;
          --ipd-light-gray: #F9F9F9;
          display: block;
          width: 100%;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .methods-details { width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        .loading-message { padding: 40px 20px; text-align: center; color: var(--ipd-text-secondary); background: var(--ipd-light-gray); border-radius: 8px; margin: 20px; }
        .expansion-panel { background: var(--ipd-white); border-radius: 12px; border: 1px solid var(--ipd-border); margin-bottom: 32px; overflow: hidden; transition: box-shadow 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
        .expansion-panel:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.12); }
        .expansion-panel:last-of-type { margin-bottom: 4px; }
        .expansion-panel-header { width: 100%; background: var(--ipd-white); border: none; padding: 20px 24px; cursor: pointer; transition: background-color 0.2s ease; display: block; text-align: left; font-family: inherit; }
        .expansion-panel-header:hover { background-color: var(--ipd-light-gray); }
        .expansion-panel-header:focus { outline: 2px solid var(--ipd-primary); outline-offset: -2px; }
        .is-open .expansion-panel-header { border-bottom: 1px solid var(--ipd-border); }
        .header-content { display: flex; align-items: center; gap: 16px; }
        .header-icon { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
        .header-icon .icon { width: 100%; height: 100%; fill: var(--ipd-primary); }
        .header-title { flex: 1; margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--ipd-text-primary); line-height: 1.4; }
        .header-chevron { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
        .is-open .header-chevron { transform: rotate(90deg); }
        .chevron-icon { width: 100%; height: 100%; fill: var(--ipd-text-secondary); }
        .expansion-panel-content { background: var(--ipd-white); animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .panel-body { padding: 24px; }
        .component-section { margin-bottom: 24px; }
        .component-section:last-child { margin-bottom: 0; }
        .data-section { margin-bottom: 16px; }
        .data-section:last-child { margin-bottom: 0; }
        .component-title { font-size: 1.1rem; font-weight: 600; color: var(--ipd-primary); margin: 8px 0 16px 24px; }
        .data-item { margin-bottom: 12px; }
        .data-item:last-child { margin-bottom: 0; }
        .repair-manual-section { margin-bottom: 16px; }
        .repair-manual-section:last-child { margin-bottom: 0; }
        repairs-data-group, adjustment-data-group, technical-drawings { display: block; width: 100%; }
        .vue-component-placeholder { min-height: 50px; }
        .location-systems-section { margin-top: 24px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .modal-container { background: var(--ipd-white); border-radius: 12px; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: var(--ipd-primary); border-radius: 12px 12px 0 0; }
        .modal-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--ipd-white); }
        .btn-close { background: rgba(255,255,255,0.2); border: 2px solid var(--ipd-white); border-radius: 6px; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
        .btn-close:hover { background: var(--ipd-white); }
        .btn-close svg { color: var(--ipd-white); }
        .btn-close:hover svg { color: var(--ipd-primary); }
        .modal-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; align-items: center; justify-content: center; }
        .modal-image { max-width: 100%; max-height: calc(90vh - 150px); width: auto; height: auto; display: block; margin: 0 auto; }
        @media (max-width: 599px) { .expansion-panel-header { padding: 16px; } .panel-body { padding: 16px; } .header-title { font-size: 1.1rem; } .component-title { margin-left: 12px; font-size: 1rem; } }
        @media print { .expansion-panel { box-shadow: none; border: 1px solid var(--ipd-border); page-break-inside: avoid; } .expansion-panel-header { background: var(--ipd-white) !important; } .header-chevron { display: none; } .expansion-panel-content { display: block !important; } .modal-overlay { display: none; } }
      </style>
    `
  }
}

if (!customElements.get('methods-details')) {
  customElements.define('methods-details', MethodsDetails)
} else {
  console.log('ℹ️ Web Component "methods-details" already registered')
}

export default MethodsDetails
