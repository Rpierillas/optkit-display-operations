/**
 * DisplayOperationsDetails Web Component
 * Composant principal d'affichage des détails d'opérations
 */

class DisplayOperationsDetails extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // Propriétés internes
    this._operationsDetails = []
    this._isPrint = false
    this._loading = false

    // État
    this._itemsPanelOpen = []
    this._childrensPanelOpen = []
    this._formattedItemsLocationSystems = []
    this._formattedChildrenLocationSystems = []

    // Refs des Web Components enfants
    this._itemRefs = new Map()
    this._childrenRefs = new Map()

    // Cache tri des enfants
    this._sortedChildrenCache = new Map()

    // Composants déjà chargés
    this._loadedComponents = new Set()

    // Flag DOM prêt
    this._domReady = false
  }

  static get observedAttributes() {
    return ['is-print', 'loading']
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get operationsDetails() { return this._operationsDetails }
  set operationsDetails(value) {
    const normalized = Array.isArray(value) ? value : (value ? [value] : [])
    this._operationsDetails = normalized
    this._sortedChildrenCache.clear()
    if (this.isConnected) {
      const od = normalized[0]
      if (od) {
        this._sortItemLocationSystems(od)
        this._sortChildrenLocationSystems(od)
        this._openFirst(od)
      }
      this._domReady = false
      this._render()
    }
  }

  get isPrint() { return this._isPrint }
  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    this._isPrint = boolValue
    if (boolValue) {
      const od = this._operationsDetails[0]
      if (od) {
        if (od.items?.length) this._itemsPanelOpen = od.items.map((_, i) => i)
        if (od.childrenOperations?.length) {
          this._childrensPanelOpen = this._getSortedChildren(od).map((_, i) => i)
        }
      }
    }
    if (this.isConnected) {
      if (this._domReady) {
        this._updatePanelStates()
        this._updateLightProps()
      } else {
        this._render()
      }
    }
  }

  get loading() { return this._loading }
  set loading(value) {
    this._loading = value === true || value === 'true'
    if (this.isConnected) {
      this._domReady = false
      this._render()
    }
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    if (this._operationsDetails.length > 0) {
      this._render()
    }
  }

  disconnectedCallback() {
    this._itemRefs.clear()
    this._childrenRefs.clear()
    this._domReady = false
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    switch (name) {
      case 'is-print': this.isPrint = newValue === 'true'; break
      case 'loading': this.loading = newValue === 'true'; break
    }
  }

  // ============================================
  // LAZY LOADING
  // ============================================

  async _loadMethodsDetails() {
    if (this._loadedComponents.has('methods-details')) return
    await import('./operationDetails/MethodsDetailsWC.js')
    await customElements.whenDefined('methods-details')
    this._loadedComponents.add('methods-details')
  }

  // ============================================
  // LOCATION SYSTEMS
  // ============================================

  _buildLocationSystemsData(item, locationGroupItems = [], type = 'locationSystems') {
    const withDrawing = []
    const withoutDrawing = []

    for (const ls of item[type]) {
      if (!ls.locationDrawing) withoutDrawing.push(ls)
      else withDrawing.push(ls)
    }

    const sorted = withDrawing.sort((a, b) => a.locationDrawing.id - b.locationDrawing.id)

    if (withoutDrawing.length > 0) {
      locationGroupItems.push({ locationDrawingId: null, locationImg: null, items: [...withoutDrawing], subItems: [] })
    }

    sorted.forEach((item) => {
      if (!item.locationDrawing) {
        locationGroupItems.find(g => !g.locationDrawingId)?.items.push(item)
      } else {
        const existing = locationGroupItems.find(g => g.locationDrawingId === item.locationDrawing.id)
        if (existing) {
          existing.items.push(item)
        } else {
          locationGroupItems.push({
            locationDrawingId: item.locationDrawing.id,
            locationImg: item.locationDrawing.url,
            items: [item],
            subItems: []
          })
        }
      }
    })

    return locationGroupItems
  }

  _sortItemLocationSystems(operationDetails) {
    if (!operationDetails?.items?.length || !operationDetails.items[0]?.locationSystems) return

    const locationGroupItems = []
    const subLocationGroupItems = []

    operationDetails.items.forEach((operation) => {
      if (operation.locationSystems && !operation.locationSystems[0].subSystems) {
        this._buildLocationSystemsData(operation, locationGroupItems)
      } else if (operation.locationSystems && !operation.locationSystems[0].locationDrawing && operation.locationSystems[0].subSystems) {
        locationGroupItems.push({ locationDrawingId: null, locationImg: null, items: [], subItems: [] })
        operation.locationSystems.forEach((item) => {
          this._buildLocationSystemsData(item, subLocationGroupItems, 'subSystems')
        })
        locationGroupItems[0].subItems = subLocationGroupItems
      }
    })

    this._formattedItemsLocationSystems = locationGroupItems
  }

  _sortChildrenLocationSystems(operationDetails) {
    if (!operationDetails?.childrenOperations?.length) return
    if (!operationDetails.childrenOperations[0]?.items?.[0]?.locationSystems) return

    const locationGroupItems = []
    operationDetails.childrenOperations.forEach((operation) => {
      operation.items?.forEach((item) => this._buildLocationSystemsData(item, locationGroupItems))
    })
    this._formattedChildrenLocationSystems = locationGroupItems.reverse()
  }

  // ============================================
  // HELPERS
  // ============================================

  _openFirst(operationDetails) {
    if (!operationDetails) return
    if (operationDetails.childrenOperations?.length > 0) this._childrensPanelOpen = [0]
    if (operationDetails.items?.length > 0) this._itemsPanelOpen = [0]
  }

  _getSortedChildren(operationDetails) {
    if (this._sortedChildrenCache.has(operationDetails)) {
      return this._sortedChildrenCache.get(operationDetails)
    }
    const sorted = operationDetails.childrenOperations
      ?.slice()
      .sort((a, b) => (a.status?.id || 0) - (b.status?.id || 0)) || []
    this._sortedChildrenCache.set(operationDetails, sorted)
    return sorted
  }

  _serializeOnce(value) {
    try { return JSON.parse(JSON.stringify(value)) } catch { return value }
  }

  _checkCodeUCType(type) {
    return type?.includes('UC') || false
  }

  // ============================================
  // TOGGLE - mise à jour ciblée du DOM
  // ============================================

  async _toggleItemPanel(index, operationDetails) {
    if (this._isPrint) return

    const pos = this._itemsPanelOpen.indexOf(index)
    const isOpening = pos === -1

    if (isOpening) {
      const item = operationDetails?.items?.[index]
      if (item && !this._checkCodeUCType(item.code)) {
        await this._loadMethodsDetails()
      }
      this._itemsPanelOpen.push(index)
      this._applyPanelState('item', index, true)

      // Configurer la ref après rendu
      await new Promise(resolve => setTimeout(resolve, 0))
      const wc = this._itemRefs.get(index)
      if (wc) this._configureItemRef(wc, index, operationDetails)
    } else {
      this._itemsPanelOpen.splice(pos, 1)
      this._applyPanelState('item', index, false)
    }
  }

  async _toggleChildrenPanel(index, operationDetails) {
    if (this._isPrint) return

    const pos = this._childrensPanelOpen.indexOf(index)
    const isOpening = pos === -1

    if (isOpening) {
      await this._loadMethodsDetails()
      this._childrensPanelOpen.push(index)
      this._applyPanelState('children', index, true)

      await new Promise(resolve => setTimeout(resolve, 0))
      const sortedChildren = this._getSortedChildren(operationDetails)
      const childItem = sortedChildren?.[index]
      if (childItem?.items) {
        childItem.items.forEach((_, operationsIndex) => {
          const key = `${index}-${operationsIndex}`
          const wc = this._childrenRefs.get(key)
          if (wc) this._configureChildrenRef(wc, index, operationsIndex, operationDetails)
        })
      }
    } else {
      this._childrensPanelOpen.splice(pos, 1)
      this._applyPanelState('children', index, false)
    }
  }

  /**
   * Ouvre/ferme un panel sans re-render
   */
  _applyPanelState(type, index, isOpen) {
    const shadow = this.shadowRoot
    const selector = type === 'item' ? `[data-item-index="${index}"]` : `[data-children-index="${index}"]`
    const panelEl = shadow.querySelector(selector)
    if (!panelEl) return

    const content = panelEl.querySelector('.expansion-panel-content')
    if (isOpen) {
      panelEl.classList.add('is-open')
      if (content) content.style.display = ''
      panelEl.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', 'true')
    } else {
      panelEl.classList.remove('is-open')
      if (content) content.style.display = 'none'
      panelEl.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', 'false')
    }
  }

  /**
   * Met à jour tous les états de panels (ex: mode impression)
   */
  _updatePanelStates() {
    const shadow = this.shadowRoot
    shadow.querySelectorAll('[data-item-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-item-index'), 10)
      const isOpen = this._itemsPanelOpen.includes(index)
      const content = el.querySelector('.expansion-panel-content')
      el.classList.toggle('is-open', isOpen)
      if (content) content.style.display = isOpen ? '' : 'none'
      el.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', String(isOpen))
    })

    shadow.querySelectorAll('[data-children-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-children-index'), 10)
      const isOpen = this._childrensPanelOpen.includes(index)
      const content = el.querySelector('.expansion-panel-content')
      el.classList.toggle('is-open', isOpen)
      if (content) content.style.display = isOpen ? '' : 'none'
      el.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', String(isOpen))
    })
  }

  // ============================================
  // CONFIGURATION DES WEB COMPONENTS ENFANTS
  // ============================================

  _configureItemRef(el, itemIndex, operationDetails) {
    const item = operationDetails?.items?.[itemIndex]
    if (!item || !el) return

    el.item = this._serializeOnce(item)
    el.operationDetails = this._serializeOnce(operationDetails)
    el.operations = el.item
    el.formattedLocationSystems = this._serializeOnce(this._formattedItemsLocationSystems)
    el.type = 'ITEM'
    el.isPrint = this._isPrint
    el.isSingleItem = operationDetails.items.length === 1
  }

  _configureChildrenRef(el, childrenIndex, operationsIndex, operationDetails) {
    const sortedChildren = this._getSortedChildren(operationDetails)
    const childItem = sortedChildren?.[childrenIndex]
    const operations = childItem?.items?.[operationsIndex]
    if (!operations || !el) return

    el.item = this._serializeOnce(operations)
    el.operationDetails = this._serializeOnce(operationDetails)
    el.operations = el.item
    el.formattedLocationSystems = this._serializeOnce(this._formattedChildrenLocationSystems)
    el.type = 'CHILDREN'
    el.isPrint = this._isPrint
    el.isSingleItem = childItem.items.length === 1
  }

  _updateLightProps() {
    this._itemRefs.forEach((wc) => { if (wc) wc.isPrint = this._isPrint })
    this._childrenRefs.forEach((wc) => { if (wc) wc.isPrint = this._isPrint })
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  _attachEventListeners() {
    const shadow = this.shadowRoot

    // Headers items
    shadow.querySelectorAll('[data-item-index] .expansion-panel-header').forEach((btn) => {
      const panel = btn.closest('[data-item-index]')
      const index = parseInt(panel.getAttribute('data-item-index'), 10)
      const od = this._operationsDetails[0]
      btn.addEventListener('click', () => this._toggleItemPanel(index, od))
    })

    // Headers children
    shadow.querySelectorAll('[data-children-index] .expansion-panel-header').forEach((btn) => {
      const panel = btn.closest('[data-children-index]')
      const index = parseInt(panel.getAttribute('data-children-index'), 10)
      const od = this._operationsDetails[0]
      btn.addEventListener('click', () => this._toggleChildrenPanel(index, od))
    })

    // Refs methods-details items
    shadow.querySelectorAll('[data-methods-item]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-methods-item'), 10)
      this._itemRefs.set(index, el)
    })

    // Refs methods-details children
    shadow.querySelectorAll('[data-methods-children]').forEach((el) => {
      const key = el.getAttribute('data-methods-children')
      this._childrenRefs.set(key, el)
    })
  }

  // ============================================
  // RENDER
  // ============================================

  _render() {
    if (this._loading) {
      this.shadowRoot.innerHTML = `
        ${this._getStyles()}
        <div class="display-operation-details">
          <div class="loading-message">Chargement...</div>
        </div>
      `
      return
    }

    if (!this._operationsDetails.length) {
      this.shadowRoot.innerHTML = `
        ${this._getStyles()}
        <div class="display-operation-details"></div>
      `
      return
    }

    try {
      this.shadowRoot.innerHTML = this._getStyles() + this._generateHTML()
      this._domReady = true

      Promise.resolve().then(() => this._attachEventListeners())
    } catch (error) {
      console.error('❌ DisplayOperationsDetails render error:', error)
    }
  }

  _generateHTML() {
    return this._operationsDetails.map((operationDetails, index) => `
      <div class="display-operation-details ${this._isPrint ? 'display-operation-details--print' : ''}">
        ${this._renderHeader(operationDetails)}
        <div class="operation-content">
          ${this._renderItems(operationDetails)}
          ${this._renderChildren(operationDetails)}
        </div>
      </div>
    `).join('')
  }

  _renderHeader(operationDetails) {
    if (!operationDetails?.items?.[0]?.properties) return ''

    return `
      <div class="operation-header">
        <h2 class="operation-title">
          ${operationDetails.items[0].properties.description || ''}
        </h2>
      </div>
    `
  }

  _renderItems(operationDetails) {
    if (!operationDetails.items?.length) return ''

    return `
      <div class="items-section">
        <div class="expansion-panels">
          ${operationDetails.items.map((item, itemIndex) => {
            const isOpen = this._itemsPanelOpen.includes(itemIndex)
            const isUC = this._checkCodeUCType(item.code)
            const title = item.properties?.description || operationDetails.label || item.code

            return `
              <div
                class="expansion-panel ${isOpen ? 'is-open' : ''}"
                data-item-index="${itemIndex}"
              >
                <button
                  class="expansion-panel-header"
                  ${this._isPrint ? 'disabled' : ''}
                  aria-expanded="${isOpen}"
                >
                  <div class="header-content">
                    <div class="header-icon">${this._getWrenchIcon()}</div>
                    <h3 class="header-title">
                      <span class="header-title-text">${title}</span>
                    </h3>
                    <div class="header-chevron">
                      <svg class="chevron-icon" viewBox="0 0 24 24">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div class="expansion-panel-content" ${isOpen ? '' : 'style="display:none;"'}>
                  <div class="panel-body">
                    ${isUC
                      ? `<div class="vesa-placeholder" data-content-index="${itemIndex}"></div>`
                      : `<methods-details data-methods-item="${itemIndex}"></methods-details>`
                    }
                  </div>
                </div>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  _renderChildren(operationDetails) {
    if (!operationDetails.childrenOperations?.length) return ''

    const sorted = this._getSortedChildren(operationDetails)

    return `
      <div class="children-section">
        <div class="expansion-panels">
          ${sorted.map((item, sortedItemIndex) => {
            const isOpen = this._childrensPanelOpen.includes(sortedItemIndex)

            return `
              <div
                class="expansion-panel ${isOpen ? 'is-open' : ''}"
                data-children-index="${sortedItemIndex}"
              >
                <button
                  class="expansion-panel-header"
                  ${this._isPrint ? 'disabled' : ''}
                  aria-expanded="${isOpen}"
                >
                  <div class="header-content">
                    <div class="header-icon">${this._getWrenchIcon()}</div>
                    <h3 class="header-title">
                      <span class="header-title-text">${item.label || ''}</span>
                      ${item.intervention ? `<small class="header-subtitle">[${item.intervention.label}]</small>` : ''}
                    </h3>
                    <div class="header-chevron">
                      <svg class="chevron-icon" viewBox="0 0 24 24">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                      </svg>
                    </div>
                  </div>
                </button>

                <div class="expansion-panel-content" ${isOpen ? '' : 'style="display:none;"'}>
                  <div class="panel-body">
                    ${item.items?.map((_, operationsIndex) => `
                      <div class="operations-item">
                        <methods-details
                          data-methods-children="${sortedItemIndex}-${operationsIndex}"
                        ></methods-details>
                      </div>
                    `).join('') || ''}
                  </div>
                </div>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  _getWrenchIcon() {
    return `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
      </svg>
    `
  }

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary: #003D7A;
          --ipd-secondary: #E30613;
          --ipd-text-primary: #333333;
          --ipd-text-secondary: #666666;
          --ipd-border: #CCCCCC;
          --ipd-white: #FFFFFF;
          --ipd-light-gray: #F9F9F9;
          display: block;
          width: 100%;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .display-operation-details { width: 100%; }

        .display-operation-details--print .expansion-panel-header {
          cursor: default;
        }
        .display-operation-details--print .expansion-panel-header:hover {
          background: var(--ipd-white);
        }

        .loading-message {
          padding: 40px 20px;
          text-align: center;
          color: var(--ipd-text-secondary);
          background: var(--ipd-light-gray);
          border-radius: 8px;
          margin: 20px;
        }

        .operation-header {
          background: var(--ipd-white);
          padding: 24px;
          border-bottom: 2px solid var(--ipd-primary);
          margin-bottom: 24px;
        }

        .operation-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--ipd-primary);
          line-height: 1.3;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }

        .operation-content { width: 100%; }

        .items-section,
        .children-section { margin-bottom: 32px; }
        .items-section:last-child,
        .children-section:last-child { margin-bottom: 0; }

        .expansion-panels { display: flex; flex-direction: column; gap: 16px; }

        .expansion-panel {
          background: var(--ipd-white);
          border-radius: 12px;
          border: 1px solid var(--ipd-border);
          overflow: hidden;
          transition: box-shadow 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .expansion-panel:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.12); }
        .expansion-panel:last-of-type { margin-bottom: 4px; }

        .expansion-panel-header {
          width: 100%;
          background: var(--ipd-white);
          border: none;
          padding: 20px 24px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          display: block;
          text-align: left;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .expansion-panel-header:hover:not(:disabled) { background-color: var(--ipd-light-gray); }
        .expansion-panel-header:focus { outline: 2px solid var(--ipd-primary); outline-offset: -2px; }
        .expansion-panel-header:disabled { cursor: default; }
        .is-open .expansion-panel-header { border-bottom: 1px solid var(--ipd-border); }

        .header-content { display: flex; align-items: center; gap: 16px; }

        .header-icon { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
        .header-icon .icon { width: 100%; height: 100%; fill: var(--ipd-primary); }

        .header-title { flex: 1; margin: 0; font-size: 1.1rem; font-weight: 600; line-height: 1.4; }
        .header-title-text { color: var(--ipd-text-primary); }
        .header-subtitle { display: inline-block; margin-left: 8px; font-size: 0.9rem; font-weight: 400; color: var(--ipd-text-secondary); }

        .header-chevron { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
        .is-open .header-chevron { transform: rotate(90deg); }
        .chevron-icon { width: 100%; height: 100%; fill: var(--ipd-text-secondary); }

        .expansion-panel-content { background: var(--ipd-white); animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .panel-body { padding: 24px; }

        .operations-item { margin-bottom: 16px; }
        .operations-item:last-child { margin-bottom: 0; }

        methods-details { display: block; width: 100%; }

        @media (max-width: 599px) {
          .operation-header { padding: 16px; }
          .operation-title { font-size: 1.5rem; }
          .expansion-panel-header { padding: 16px; }
          .panel-body { padding: 16px; }
          .header-title { font-size: 1rem; }
        }

        @media print {
          .expansion-panel { box-shadow: none; border: 1px solid var(--ipd-border); page-break-inside: avoid; }
          .expansion-panel-header { background: var(--ipd-white) !important; }
          .header-chevron { display: none; }
          .expansion-panel-content { display: block !important; }
        }
      </style>
    `
  }
}

if (!customElements.get('display-operations-details')) {
  customElements.define('display-operations-details', DisplayOperationsDetails)
  console.log('✅ Web Component "display-operations-details" registered')
} else {
  console.log('ℹ️ Web Component "display-operations-details" already registered')
}

export default DisplayOperationsDetails
