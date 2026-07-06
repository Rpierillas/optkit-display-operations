/**
 * AdjustmentDisplay Steering Component
 * Composant autonome compatible avec tous les frameworks (Vue, React, Angular, Vanilla JS)
 */

class AdjustmentSteering extends HTMLElement {
  constructor() {
    super()

    // Attacher Shadow DOM pour encapsulation CSS
    this.attachShadow({ mode: 'open' })

    // Constante pour la langue par défaut (Anglais, si pas de langue trouvée dans les données)
    this.HAYNES_DEFAULT_LANG = '2057'

    // Propriétés internes
    this._adjustmentItem = {}
    this._component = {}
    this._adjustmentIndex = 0
    this._componentIndex = 0
    this._haynesLang = ''
    this._isPrint = false
    this._operations = {}

    // État interne
    this.state = {
      showManualDialog: false,
      showImageZoom: false,
      loadingExtraInfo: false,
      extraInfo: null,
      zoomedImage: '',
      loadedManuals: new Set()
    }

    // Traductions
    this.translations = {
      'common.seeMore': 'Voir plus',
      'common.additionalInfo': 'Informations supplémentaires',
      'common.loading': 'Chargement',
      'operationsDetails.unloadedLoaded': 'déchargé/chargé',
      'operationsDetails.unloaded': 'déchargé'
    }
  }

  // Attributs observés
  static get observedAttributes() {
    return [
      'adjustment-index',
      'component-index',
      'haynes-lang',
      'is-print'
    ]
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get adjustmentItem() {
    return this._adjustmentItem
  }

  set adjustmentItem(value) {
    console.log('📝 AdjustmentSteering - adjustmentItem set:', value)
    this._adjustmentItem = value || {}
    if (this.isConnected) {
      this.render()
      this.attachEventListeners()
    }
  }

  get component() {
    return this._component
  }

  set component(value) {
    console.log('📝 AdjustmentSteering - component set:', value)
    this._component = value || {}
    if (this.isConnected) {
      this.render()
      this.attachEventListeners()
    }
  }

  get operations() {
    return this._operations
  }

  set operations(value) {
    console.log('📝 AdjustmentSteering - operations set:', value)
    this._operations = value || {}
    if (this.isConnected) {
      this.render()
      this.attachEventListeners()
    }
  }

  get adjustmentIndex() {
    return this._adjustmentIndex
  }

  set adjustmentIndex(value) {
    const numValue = parseInt(value, 10)
    if (this._adjustmentIndex !== numValue) {
      this._adjustmentIndex = numValue
      if (this.isConnected) {
        this.render()
        this.attachEventListeners()
      }
    }
  }

  get componentIndex() {
    return this._componentIndex
  }

  set componentIndex(value) {
    const numValue = parseInt(value, 10)
    if (this._componentIndex !== numValue) {
      this._componentIndex = numValue
      if (this.isConnected) {
        this.render()
        this.attachEventListeners()
      }
    }
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    if (this._haynesLang !== value) {
      this._haynesLang = value || ''
      if (this.isConnected) {
        this.render()
        this.attachEventListeners()
      }
    }
  }

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    if (this._isPrint !== boolValue) {
      this._isPrint = boolValue
      if (this.isConnected) {
        this.render()
        this.attachEventListeners()
      }
    }
  }

  // Lifecycle
  connectedCallback() {
    console.log('🔌 AdjustmentSteering connected')
    console.log('  - adjustmentItem:', this._adjustmentItem)
    console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

    // ✅ NE RENDRE QUE SI ON A DES DONNÉES
    if (this._adjustmentItem && this._adjustmentItem.sentence) {
      this.render()
      this.attachEventListeners()
    } else {
      console.log('⏳ Attente des données avant le premier render')
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'adjustment-index':
          this.adjustmentIndex = parseInt(newValue, 10)
          break
        case 'component-index':
          this.componentIndex = parseInt(newValue, 10)
          break
        case 'haynes-lang':
          this.haynesLang = newValue
          break
        case 'is-print':
          this.isPrint = newValue === 'true'
          break
      }
    }
  }

  // Helpers
  t(key) {
    return this.translations[key] || key
  }

  formatHaynesLang(map) {
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

  formatUrl(url) {
    if (!url) return ''
    return url.replace('http://', '//')
  }

  displayLoad(value) {
    if (!value) return ''
    return value.indexOf('-') > -1
      ? this.t('operationsDetails.unloadedLoaded')
      : this.t('operationsDetails.unloaded')
  }

  getRowClass(index) {
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  // Computed properties
  get previousItem() {
    if (!this._component?.adjustmentSystem?.items || this._adjustmentIndex === 0) {
      return null
    }
    return this._component.adjustmentSystem.items[this._adjustmentIndex - 1]
  }

  get nextItem() {
    if (!this._component?.adjustmentSystem?.items) {
      return null
    }
    const items = this._component.adjustmentSystem.items
    if (this._adjustmentIndex >= items.length - 1) {
      return null
    }
    return items[this._adjustmentIndex + 1]
  }

  get shouldShowHeader() {
    if (!this._adjustmentItem.header) return false
    if (this._adjustmentIndex === 0) return true
    if (!this.previousItem || !this.previousItem.header) return true

    const currentHeaderText = this._adjustmentItem.header.description.map[this._haynesLang] || this._adjustmentItem.header.description.map[this.HAYNES_DEFAULT_LANG]
    const previousHeaderText = this.previousItem.header.description.map[this._haynesLang] || this.previousItem.header.description.map[this.HAYNES_DEFAULT_LANG]

    return currentHeaderText !== previousHeaderText
  }

  get isFirstOfGroup() {
    return this.shouldShowHeader
  }

  get isLastOfGroup() {
    if (!this.nextItem) return true
    if (!this.nextItem.header || !this._adjustmentItem.header) return true

    const currentHeaderText = this._adjustmentItem.header.description.map[this._haynesLang] || this._adjustmentItem.header.description.map[this.HAYNES_DEFAULT_LANG]
    const nextHeaderText = this.nextItem.header.description.map[this._haynesLang] || this.nextItem.header.description.map[this.HAYNES_DEFAULT_LANG]

    return currentHeaderText !== nextHeaderText
  }

  get tableClasses() {
    const classes = ['adjustment-table']
    if (this.isFirstOfGroup) classes.push('first-of-group')
    if (this.isLastOfGroup) classes.push('last-of-group')
    if (!this.isFirstOfGroup && !this.isLastOfGroup) classes.push('middle-of-group')
    return classes.join(' ')
  }

  // Event handlers
  openManualDialog(manual) {
    this.state.showManualDialog = true

    // Émettre un événement custom
    this.dispatchEvent(new CustomEvent('open-manual', {
      detail: { manual },
      bubbles: true,
      composed: true
    }))

    this.render()
    this.attachEventListeners()
  }

  closeManualDialog() {
    this.state.showManualDialog = false
    this.render()
    this.attachEventListeners()
  }

  openImageZoom(imageUrl) {
    if (this._isPrint) return

    this.state.zoomedImage = imageUrl
    this.state.showImageZoom = true

    // Émettre un événement custom
    this.dispatchEvent(new CustomEvent('open-image', {
      detail: { imageUrl },
      bubbles: true,
      composed: true
    }))

    this.render()
    this.attachEventListeners()
  }

  closeImageZoom() {
    this.state.showImageZoom = false
    this.state.zoomedImage = ''
    this.render()
    this.attachEventListeners()
  }

  // Render
  render() {
    const item = this._adjustmentItem

    this.shadowRoot.innerHTML = `
      ${this.getStyles()}
      <div class="adjustment-container">
        <table class="${this.tableClasses}">
          ${this.shouldShowHeader ? this.renderHeader() : ''}
          <tbody>
            ${item.sentence ? this.renderSentenceRow() : ''}
            ${item.remark ? this.renderRemarkRow(item.remark, 1) : ''}
            ${item.drawing ? this.renderImageRow(item.drawing, 2) : ''}
            ${item.subItems ? this.renderSubItems() : ''}
          </tbody>
        </table>
        ${this.state.showManualDialog ? this.renderManualDialog() : ''}
        ${this.state.showImageZoom ? this.renderImageZoom() : ''}
      </div>
    `
  }

  renderHeader() {
    return `
      <thead>
        <tr class="header-row">
          <th colspan="3" class="header-cell">
            ${this.formatHaynesLang(this._adjustmentItem.header?.description.map)}
          </th>
        </tr>
      </thead>
    `
  }

  renderSentenceRow() {
    const item = this._adjustmentItem
    return `
      <tr class="${this.getRowClass(0)} data-row">
        <td class="icon-cell">
          <svg class="row-icon" viewBox="0 0 24 24" width="22" height="22">
            <path fill="currentColor" d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
          </svg>
        </td>
        <td colspan="2" class="content-cell">
          <div class="content-layout">
            <div class="main-info">
              <span class="description-text-emphasis">
                ${this.formatHaynesLang(item.sentence?.description.map)}
              </span>
              ${item.value ? `
                <div class="value-chip">
                  <span class="value-number">${item.value}</span>
                  ${item.sentence?.measurementUnits ? `<span class="value-unit">${item.sentence.measurementUnits}</span>` : ''}
                </div>
              ` : ''}
            </div>
            ${item.manual ? `
              <button class="btn-see-more" data-manual='${JSON.stringify(item.manual)}'>
                <span>${this.t('common.seeMore')}</span>
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                </svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `
  }

  renderRemarkRow(remark, index, isSubitem = false) {
    return `
      <tr class="${this.getRowClass(index)} data-row remark-row ${isSubitem ? 'subitem-row' : ''}">
        <td class="icon-cell">
          <svg class="row-icon ${isSubitem ? 'subitem-icon' : ''}" viewBox="0 0 24 24" width="${isSubitem ? 18 : 20}" height="${isSubitem ? 18 : 20}">
            <path fill="currentColor" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z" />
          </svg>
        </td>
        <td colspan="2" class="remark-cell ${isSubitem ? 'subitem-remark' : ''}">
          <span class="remark-text">
            ${this.formatHaynesLang(remark.description.map)}
          </span>
        </td>
      </tr>
    `
  }

  renderImageRow(drawing, index, isSubitem = false) {
    return `
      <tr class="${this.getRowClass(index)} data-row image-row ${isSubitem ? 'subitem-row' : ''}">
        <td class="icon-cell">
          <svg class="row-icon ${isSubitem ? 'subitem-icon' : ''}" viewBox="0 0 24 24" width="${isSubitem ? 18 : 20}" height="${isSubitem ? 18 : 20}">
            <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
          </svg>
        </td>
        <td colspan="2" class="image-cell ${isSubitem ? 'subitem-image' : ''}">
          <div class="image-container ${this._isPrint ? 'image-container--print' : ''}" data-image-url="${drawing.url}">
            <img
              src="${this.formatUrl(drawing.url)}"
              alt="Adjustment diagram"
              class="drawing-image"
            />
            <div class="zoom-overlay">
              <svg class="zoom-icon" viewBox="0 0 24 24" width="${isSubitem ? 28 : 32}" height="${isSubitem ? 28 : 32}">
                <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
              </svg>
            </div>
          </div>
        </td>
      </tr>
    `
  }

  renderSubItems() {
    const subItems = this._adjustmentItem.subItems || []
    return subItems.map((subItem, index) => `
      ${subItem.sentence ? `
        <tr class="${this.getRowClass(index + 3)} data-row subitem-row">
          <td class="icon-cell">
            <svg class="row-icon subitem-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
            </svg>
          </td>
          <td colspan="2" class="content-cell subitem-content">
            <div class="content-layout">
              <div class="main-info">
                <span class="description-text-emphasis subitem-text">
                  ${this.formatHaynesLang(subItem.sentence?.description.map)}
                </span>
                ${subItem.value ? `
                  <div class="value-chip subitem-chip">
                    <span class="value-number">${subItem.value}</span>
                    ${subItem.sentence?.measurementUnits ? `<span class="value-unit">${subItem.sentence.measurementUnits}</span>` : ''}
                    ${subItem.sentence?.measurementUnits === '(bar)' ? `<span class="load-text">(${this.displayLoad(subItem.value)})</span>` : ''}
                  </div>
                ` : ''}
              </div>
              ${subItem.manual ? `
                <button class="btn-see-more btn-small" data-manual='${JSON.stringify(subItem.manual)}'>
                  <span>${this.t('common.seeMore')}</span>
                  <svg class="icon" viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                  </svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      ` : ''}
      ${subItem.remark ? this.renderRemarkRow(subItem.remark, index + 100, true) : ''}
      ${subItem.drawing ? this.renderImageRow(subItem.drawing, index + 200, true) : ''}
    `).join('')
  }

  renderManualDialog() {
    return `
      <div class="modal-overlay" data-close-manual>
        <div class="modal-container" data-modal-content>
          <div class="modal-header">
            <h3 class="modal-title">${this.t('common.additionalInfo')}</h3>
            <button class="btn-close" data-close-manual>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            ${this.state.loadingExtraInfo ? `
              <div class="loading-container">
                <div class="spinner"></div>
                <p>${this.t('common.loading')}...</p>
              </div>
            ` : `
              <div class="extra-info-content">
                <p>Contenu supplémentaire</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `
  }

  renderImageZoom() {
    return `
      <div class="modal-overlay modal-image-overlay" data-close-image>
        <div class="modal-image-card" data-modal-content>
          <button class="btn-close btn-close-image" data-close-image>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
            </svg>
          </button>
          <div class="modal-image-content">
            <img src="${this.formatUrl(this.state.zoomedImage)}" alt="Zoom" class="zoomed-image" />
          </div>
        </div>
      </div>
    `
  }

  // Event listeners
  attachEventListeners() {
    // Boutons "Voir plus"
    this.shadowRoot.querySelectorAll('[data-manual]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const manual = JSON.parse(e.currentTarget.getAttribute('data-manual'))
        this.openManualDialog(manual)
      })
    })

    // Images cliquables
    this.shadowRoot.querySelectorAll('[data-image-url]').forEach(container => {
      container.addEventListener('click', (e) => {
        if (!this._isPrint) {
          const imageUrl = e.currentTarget.getAttribute('data-image-url')
          this.openImageZoom(imageUrl)
        }
      })
    })

    // Fermer modales
    this.shadowRoot.querySelectorAll('[data-close-manual]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.currentTarget.hasAttribute('data-close-manual')) {
          this.closeManualDialog()
        }
      })
    })

    this.shadowRoot.querySelectorAll('[data-close-image]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.currentTarget.hasAttribute('data-close-image')) {
          this.closeImageZoom()
        }
      })
    })

    // Empêcher la propagation des clics sur le contenu des modales
    this.shadowRoot.querySelectorAll('[data-modal-content]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    })
  }

  getStyles() {
    return `
      <style>
        /* Variables CSS - Couleurs IPD */
        :host {
          --ipd-primary: #00378c;
          --ipd-white: #ffffff;
          --ipd-gray: #777574;
          --ipd-turquoise: #00BCA1;
          --ipd-yellow: #FFC200;
          --ipd-green: #1AB729;
          --ipd-orange: #F26101;
          --ipd-dark-green: #006B6A;
          --ipd-light-gray: #f5f5f5;
          --ipd-border: #e0e0e0;

          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        /* Container principal */
        .adjustment-container {
          width: 100%;
          margin-bottom: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* Table */
        .adjustment-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--ipd-white);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          position: relative;
        }

        /* Fusion des groupes */
        .adjustment-table.first-of-group {
          border-radius: 8px 8px 0 0;
        }

        .adjustment-table.middle-of-group {
          border-radius: 0;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
          margin-top: -1px;
        }

        .adjustment-table.last-of-group {
          border-radius: 0 0 8px 8px;
          margin-bottom: 24px;
        }

        .adjustment-table.first-of-group.last-of-group {
          border-radius: 8px;
          margin-bottom: 24px;
        }

        /* En-tête */
        .header-row {
          background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%);
        }

        .first-of-group .header-row th:first-child {
          border-radius: 8px 0 0 0;
        }

        .first-of-group .header-row th:last-child {
          border-radius: 0 8px 0 0;
        }

        .header-cell {
          padding: 18px 24px;
          text-align: left;
          font-size: 20px;
          font-weight: 700;
          color: var(--ipd-white);
          letter-spacing: 0.3px;
          border-bottom: 3px solid var(--ipd-turquoise);
        }

        /* Lignes */
        .data-row {
          transition: background-color 0.2s ease;
        }

        .data-row:hover {
          background-color: #f0f7ff !important;
        }

        .row-even {
          background-color: var(--ipd-white);
        }

        .row-odd {
          background-color: var(--ipd-light-gray);
        }

        /* Cellules */
        .icon-cell {
          width: 60px;
          padding: 18px 12px 18px 20px;
          vertical-align: middle;
          text-align: center;
        }

        .row-icon {
          color: var(--ipd-primary);
        }

        .subitem-icon {
          color: var(--ipd-turquoise);
          opacity: 0.8;
        }

        .content-cell {
          padding: 18px 24px;
          vertical-align: middle;
        }

        .subitem-content {
          padding-left: 30px;
          border-left: 4px solid var(--ipd-turquoise);
        }

        .content-layout {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .main-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* Description */
        .description-text-emphasis {
          font-size: 17px;
          font-weight: 600;
          color: #1a1a1a;
          line-height: 1.4;
        }

        .subitem-text {
          font-size: 16px;
          font-weight: 550;
          color: #2a2a2a;
        }

        /* Chips de valeur */
        .value-chip {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          background: var(--ipd-primary);
          color: var(--ipd-white);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 15px;
          font-weight: 600;
          line-height: 1.3;
          white-space: nowrap;
        }

        .subitem-chip {
          background: var(--ipd-turquoise);
          padding: 5px 12px;
          font-size: 14px;
        }

        .value-number {
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .value-unit {
          font-weight: 500;
          opacity: 0.95;
          font-size: 0.9em;
        }

        .load-text {
          font-weight: 500;
          opacity: 0.9;
          font-size: 0.85em;
          margin-left: 4px;
        }

        /* Boutons */
        .btn-see-more {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--ipd-white);
          border: 2px solid var(--ipd-orange);
          color: var(--ipd-orange);
          font-size: 14px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .btn-see-more:hover {
          background: var(--ipd-orange);
          color: var(--ipd-white);
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(242, 97, 1, 0.3);
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 12px;
        }

        /* Remarques */
        .remark-row {
          font-style: italic;
        }

        .remark-cell {
          padding: 14px 20px;
          background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
          border-left: 4px solid var(--ipd-yellow);
        }

        .subitem-remark {
          padding-left: 50px;
        }

        .remark-text {
          font-size: 15px;
          color: #555;
          display: block;
          line-height: 1.5;
        }

        /* Images */
        .image-cell {
          padding: 20px;
          text-align: center;
        }

        .subitem-image {
          padding-left: 50px;
        }

        .image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }

        .image-container:hover {
          transform: scale(1.02);
        }

        .image-container--print {
          cursor: default !important;
        }

        .image-container--print:hover {
          transform: none !important;
        }

        .image-container:hover .zoom-overlay {
          opacity: 1;
        }

        .drawing-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }

        .zoom-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 55, 140, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .zoom-icon {
          color: var(--ipd-white);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        /* Modales */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          backdrop-filter: blur(4px);
        }

        .modal-container {
          background: var(--ipd-white);
          border-radius: 12px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: linear-gradient(135deg, var(--ipd-orange) 0%, #ff7520 100%);
          border-radius: 12px 12px 0 0;
        }

        .modal-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--ipd-white);
        }

        .btn-close {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid var(--ipd-white);
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .btn-close:hover {
          background: var(--ipd-white);
        }

        .btn-close svg {
          color: var(--ipd-white);
        }

        .btn-close:hover svg {
          color: var(--ipd-orange);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: var(--ipd-light-gray);
        }

        /* Modal image */
        .modal-image-overlay {
          background: rgba(0, 0, 0, 0.75) !important;
          padding: 20px;
        }

        .modal-image-card {
          position: relative;
          max-width: 95vw;
          max-height: 95vh;
          background: var(--ipd-white);
          border-radius: 12px;
          padding: 0;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .btn-close-image {
          position: absolute;
          top: 12px;
          right: 12px;
          background: var(--ipd-primary);
          border: 2px solid var(--ipd-white);
          border-radius: 6px;
          padding: 8px;
          z-index: 10;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .btn-close-image:hover {
          background: var(--ipd-white);
          transform: scale(1.1);
        }

        .btn-close-image svg {
          color: var(--ipd-white);
        }

        .btn-close-image:hover svg {
          color: var(--ipd-primary);
        }

        .modal-image-content {
          background: var(--ipd-white);
          padding: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          width: 100%;
          height: 100%;
        }

        .zoomed-image {
          max-width: 100%;
          max-height: calc(95vh - 100px);
          width: auto;
          height: auto;
          display: block;
          margin: 0 auto;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          object-fit: contain;
        }

        /* Loading */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          gap: 16px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--ipd-light-gray);
          border-top-color: var(--ipd-orange);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header-cell { padding: 14px 16px; font-size: 17px; }
          .icon-cell { width: 50px; padding: 12px 8px 12px 12px; }
          .content-cell { padding: 14px 16px; }
          .content-layout { flex-direction: column; align-items: flex-start; gap: 12px; }
          .main-info { flex-direction: column; align-items: flex-start; gap: 10px; }
          .description-text-emphasis { font-size: 16px; }
          .value-chip { padding: 5px 12px; font-size: 14px; }
          .subitem-chip { padding: 4px 10px; font-size: 13px; }
          .btn-see-more { width: 100%; justify-content: center; }
          .modal-image-overlay { padding: 10px; }
          .modal-image-card { max-width: 98vw; max-height: 98vh; }
          .modal-image-content { padding: 15px; }
          .zoomed-image { max-height: calc(98vh - 80px); }
        }
      </style>
    `
  }
}

// Enregistrer le Web Component
if (!customElements.get('adjustment-steering')) {
  customElements.define('adjustment-steering', AdjustmentSteering)
}

// Export pour utilisation en module
export default AdjustmentSteering
