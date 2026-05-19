/**
 * AdjustmentDefault Web Component
 * Composant autonome pour afficher les données d'ajustement automobile
 * Compatible avec tous les frameworks (Vue, React, Angular, vanilla JS)
 * VERSION ANGLES DROITS (border-radius: 0)
 */

class AdjustmentDefault extends HTMLElement {
  constructor() {
    super()
    console.log('🏗️ AdjustmentDefault constructor')

    this.attachShadow({ mode: 'open' })

    // Constante pour la langue par défaut (français)
    this.HAYNES_DEFAULT_LANG = '2057'

    // Propriétés internes
    this._adjustmentItem = {}
    this._operations = {}
    this._component = {}
    this._adjustmentIndex = 0
    this._componentIndex = 0
    this._haynesLang = '2057'
    this._isPrint = false
    this._group = ''

    // State
    this.state = {
      manualDialog: false,
      imageDialog: false,
      selectedImage: '',
      loadingExtraInfo: false,
      extraInfo: null,
      loadedManuals: new Set()
    }

    // Traductions par défaut
    this.translations = {
      'common.seeMore': 'Voir plus',
      'common.additionalInfo': 'Informations supplémentaires',
      'common.loading': 'Chargement',
      'common.close': 'Fermer'
    }
  }

  static get observedAttributes() {
    return [
      'adjustment-index',
      'component-index',
      'haynes-lang',
      'is-print',
      'group',
      'translations'
    ]
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get adjustmentItem() {
    return this._adjustmentItem
  }

  set adjustmentItem(value) {
    console.log('📝 AdjustmentDefault - adjustmentItem set:', value)
    this._adjustmentItem = value || {}
    if (this.isConnected) {
      this.render()
    }
  }

  get operations() {
    return this._operations
  }

  set operations(value) {
    console.log('📝 AdjustmentDefault - operations set:', value)
    this._operations = value || {}
    if (this.isConnected) {
      this.render()
    }
  }

  get component() {
    return this._component
  }

  set component(value) {
    console.log('📝 AdjustmentDefault - component set:', value)
    this._component = value || {}
    if (this.isConnected) {
      this.render()
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
      }
    }
  }

  get haynesLang() {

    return this._haynesLang
  }

  set haynesLang(value) {
    if (this._haynesLang !== value) {
      this._haynesLang = value || '2057'
      if (this.isConnected) {
        this.render()
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
      }
    }
  }

  get group() {
    return this._group
  }

  set group(value) {
    if (this._group !== value) {
      this._group = value || ''
      if (this.isConnected) {
        this.render()
      }
    }
  }

  // Lifecycle
  connectedCallback() {
    console.log('🔌 AdjustmentDefault connected')
    console.log('  - adjustmentItem:', this._adjustmentItem)
    console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

    // Charger les traductions personnalisées si fournies
    const customTranslations = this.getAttribute('translations')
    if (customTranslations) {
      try {
        this.translations = { ...this.translations, ...JSON.parse(customTranslations) }
      } catch (e) {
        console.warn('Invalid translations JSON')
      }
    }

    // ✅ NE RENDRE QUE SI ON A DES DONNÉES
    if (this._adjustmentItem && this._adjustmentItem.sentence) {
      this.render()
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
        case 'group':
          this.group = newValue
          break
      }
    }
  }

  // Helpers
  t(key) {
    return this.translations[key] || key
  }

  formatHaynesLang(map) {
    console.log(map)
    if (!map) return ''

    // 1. Essayer la langue demandée par l'utilisateur
    const keys = Object.keys(map)
    for (const key of keys) {
      if (key !== this.HAYNES_DEFAULT_LANG && map[key].trim() !== '') {
        return map[key]
      } else {
        return map[this.HAYNES_DEFAULT_LANG]
      }
    }
  }

  formatUrl(url) {
    if (!url) return ''
    return url.replace('http://', '//')
  }

  formatTextForNote(text) {
    // Simplification - dans une vraie implémentation, gérer les notes
    return text || ''
  }

  getRowClass(index) {
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  // Computed properties
  get previousItem() {
    if (!this._operations?.adjustmentSystem?.items || this._adjustmentIndex === 0) {
      return null
    }
    return this._operations.adjustmentSystem.items[this._adjustmentIndex - 1]
  }

  get nextItem() {
    if (!this._operations?.adjustmentSystem?.items) {
      return null
    }
    const items = this._operations.adjustmentSystem.items
    if (this._adjustmentIndex >= items.length - 1) {
      return null
    }
    return items[this._adjustmentIndex + 1]
  }

  get shouldShowHeader() {
    if (!this._adjustmentItem.header) return false
    if (this._adjustmentIndex === 0) return true
    if (!this.previousItem || !this.previousItem.header) return true

    const currentHeaderText =  this.formatHaynesLang(this._adjustmentItem.header?.description?.map)
    const previousHeaderText = this.formatHaynesLang(this.previousItem.header?.description?.map)

    // Si pas de texte pour comparer, considérer qu'il faut afficher le header
    if (!currentHeaderText || !previousHeaderText) return true

    return currentHeaderText !== previousHeaderText
  }

  get isFirstOfGroup() {
    return this.shouldShowHeader
  }

  get isLastOfGroup() {
    if (!this.nextItem) return true
    if (!this.nextItem.header || !this._adjustmentItem.header) return true

    const currentHeaderText = this.formatHaynesLang(this._adjustmentItem.header?.description?.map)
    const nextHeaderText = this.formatHaynesLang(this.nextItem.header?.description?.map)

    // Si pas de texte pour comparer, considérer qu'on est le dernier du groupe
    if (!currentHeaderText || !nextHeaderText) return true

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
  openManualDialog(manualId) {
    this.state.manualDialog = true

    // Émettre un événement pour que le parent charge les données
    this.dispatchEvent(new CustomEvent('open-manual', {
      detail: {
        manualId,
        haynesLang: this._haynesLang
      },
      bubbles: true,
      composed: true
    }))

    this.render()
  }

  closeManualDialog() {
    this.state.manualDialog = false
    this.render()
  }

  openImageDialog(imageUrl) {
    if (this._isPrint) return

    this.state.selectedImage = imageUrl
    this.state.imageDialog = true

    // Émettre un événement
    this.dispatchEvent(new CustomEvent('open-image', {
      detail: { imageUrl },
      bubbles: true,
      composed: true
    }))

    this.render()
  }

  closeImageDialog() {
    this.state.imageDialog = false
    this.state.selectedImage = ''
    this.render()
  }

  // Icons SVG
  getIcon(name) {
    const icons = {
      'TEXT_BOX_OUTLINE': '<path fill="currentColor" d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />',
      'INFORMATION_OUTLINE': '<path fill="currentColor" d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z" />',
      'IMAGE_OUTLINE': '<path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />',
      'MAGNIFY_PLUS': '<path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />',
      'OPEN_IN_NEW': '<path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />',
      'CLOSE': '<path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />'
    }
    return icons[name] || ''
  }

  // Render methods
  renderHeader() {
    if (!this.shouldShowHeader || !this._adjustmentItem.header) return ''

    const headerText = this.formatHaynesLang(this._adjustmentItem.header?.description?.map)

    // Si pas de texte, ne pas afficher le header
    if (!headerText) return ''

    return `
      <thead>
        <tr class="header-row">
          <th colspan="3" class="header-cell">
            ${headerText}
          </th>
        </tr>
      </thead>
    `
  }

  renderMainRow() {
    const item = this._adjustmentItem
    if (!item.sentence) return ''

    const description = this.formatHaynesLang(item.sentence?.description?.map)
    const value = item.value || ''
    const unit = item.sentence?.measurementUnits || ''

    // Si pas de description, ne rien afficher
    if (!description) return ''

    return `
      <tr class="${this.getRowClass(0)} data-row">
        <td class="icon-cell">
          <svg class="row-icon" viewBox="0 0 24 24" width="22" height="22">
            ${this.getIcon('TEXT_BOX_OUTLINE')}
          </svg>
        </td>
        <td colspan="2" class="content-cell">
          <div class="content-layout">
            <div class="main-info">
              <span class="description-text-emphasis">${description}</span>
              ${value ? `
                <div class="value-chip">
                  <span class="value-number">${value}</span>
                  ${unit ? `<span class="value-unit">${unit}</span>` : ''}
                </div>
              ` : ''}
            </div>
            ${item.manual ? `
              <button class="btn-see-more" data-action="open-manual" data-manual-id="${item.manual.id}">
                <span>${this.t('common.seeMore')}</span>
                <svg class="icon" viewBox="0 0 24 24" width="14" height="14">
                  ${this.getIcon('OPEN_IN_NEW')}
                </svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `
  }

  renderRemarkRow(remark, index, isSubitem = false) {
    if (!remark) return ''

    // Gérer les différents types de remark
    let remarkText = ''
    if (typeof remark === 'string') {
      // Si remark est une string simple (ex: "(A)")
      remarkText = remark
    } else if (remark.description?.map) {
      // Si remark est un objet avec description.map
      remarkText = this.formatHaynesLang(remark.description.map)
    } else if (remark.map) {
      // Si remark est un objet avec map directement (ex: component.description)
      remarkText = this.formatHaynesLang(remark.map)
    } else {
      // Sinon, ne rien afficher
      return ''
    }

    return `
      <tr class="${this.getRowClass(index)} data-row remark-row ${isSubitem ? 'subitem-row' : ''}">
        <td class="icon-cell">
          <svg class="row-icon ${isSubitem ? 'subitem-icon' : ''}" viewBox="0 0 24 24" width="${isSubitem ? 18 : 20}" height="${isSubitem ? 18 : 20}">
            ${this.getIcon('INFORMATION_OUTLINE')}
          </svg>
        </td>
        <td colspan="2" class="remark-cell ${isSubitem ? 'subitem-remark' : ''}">
          <span class="remark-text">
            ${remarkText}
          </span>
        </td>
      </tr>
    `
  }

  renderImageRow(drawing, index, isSubitem = false) {
    if (!drawing) return ''

    const imageUrl = this.formatUrl(drawing.url)

    return `
      <tr class="${this.getRowClass(index)} data-row image-row ${isSubitem ? 'subitem-row' : ''}">
        <td class="icon-cell">
          <svg class="row-icon ${isSubitem ? 'subitem-icon' : ''}" viewBox="0 0 24 24" width="${isSubitem ? 18 : 20}" height="${isSubitem ? 18 : 20}">
            ${this.getIcon('IMAGE_OUTLINE')}
          </svg>
        </td>
        <td colspan="2" class="image-cell ${isSubitem ? 'subitem-image' : ''}">
          <div class="adj-image-wrapper ${this._isPrint ? 'adj-print-mode' : 'adj-zoomable'} ${isSubitem ? 'adj-size-small' : 'adj-size-default'}" data-action="open-image" data-image-url="${imageUrl}">
            <img src="${imageUrl}" alt="Adjustment diagram" class="adj-drawing-image" />
            ${!this._isPrint ? `
              <div class="adj-zoom-overlay">
                <svg class="adj-zoom-icon" viewBox="0 0 24 24" width="${isSubitem ? 28 : 32}" height="${isSubitem ? 28 : 32}">
                  ${this.getIcon('MAGNIFY_PLUS')}
                </svg>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `
  }

  renderComponentRemark() {
    if (!this._component.description?.map) return ''

    return this.renderRemarkRow(this._component.description, 3, false)
  }

  renderSubItems() {
    const subItems = this._adjustmentItem.subItems || []
    if (subItems.length === 0) return ''

    return subItems.map((subItem, index) => {
      let html = ''

      // Ligne principale du subitem
      if (subItem.sentence) {
        const description = this.formatHaynesLang(subItem.sentence?.description?.map)
        const value = subItem.value || ''
        const unit = subItem.sentence?.measurementUnits || ''

        // Si pas de description, ne pas afficher cette ligne
        if (description) {
          html += `
            <tr class="${this.getRowClass(index + 4)} data-row subitem-row">
              <td class="icon-cell">
                <svg class="row-icon subitem-icon" viewBox="0 0 24 24" width="18" height="18">
                  ${this.getIcon('TEXT_BOX_OUTLINE')}
                </svg>
              </td>
              <td colspan="2" class="content-cell subitem-content">
                <div class="content-layout">
                  <div class="main-info">
                    <span class="description-text-emphasis subitem-text">${description}</span>
                    ${value ? `
                      <div class="value-chip subitem-chip">
                        <span class="value-number">${value}</span>
                        ${unit ? `<span class="value-unit">${unit}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                  ${subItem.manual ? `
                    <button class="btn-see-more btn-small" data-action="open-manual" data-manual-id="${subItem.manual.id}">
                      <span>${this.t('common.seeMore')}</span>
                      <svg class="icon" viewBox="0 0 24 24" width="12" height="12">
                        ${this.getIcon('OPEN_IN_NEW')}
                      </svg>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `
        }
      }

      // Remarque du subitem
      if (subItem.remark) {
        html += this.renderRemarkRow(subItem.remark, index + 100, true)
      }

      // Image du subitem
      if (subItem.drawing) {
        html += this.renderImageRow(subItem.drawing, index + 200, true)
      }

      return html
    }).join('')
  }

  renderManualDialog() {
    if (!this.state.manualDialog) return ''

    return `
      <div class="modal-overlay" data-action="close-manual">
        <div class="modal-container" data-action="stop-propagation">
          <div class="modal-header">
            <h3 class="modal-title">${this.t('common.additionalInfo')}</h3>
            <button class="btn-close" data-action="close-manual">
              <svg viewBox="0 0 24 24" width="24" height="24">
                ${this.getIcon('CLOSE')}
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
                <p>Les informations du manuel doivent être chargées par le parent.</p>
                <p>Utilisez l'événement <code>open-manual</code> pour charger les données.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `
  }

  renderImageDialog() {
    if (!this.state.imageDialog) return ''

    return `
      <div class="modal-overlay modal-image-overlay" data-action="close-image">
        <div class="adj-modal-image-card" data-action="stop-propagation">
          <button class="btn-close btn-close-image" data-action="close-image">
            <svg viewBox="0 0 24 24" width="24" height="24">
              ${this.getIcon('CLOSE')}
            </svg>
          </button>
          <div class="adj-modal-image-content">
            <img src="${this.state.selectedImage}" alt="Zoom" class="adj-zoomed-image" />
          </div>
        </div>
      </div>
    `
  }

  generateHTML() {
    const item = this._adjustmentItem

    if (!item || !item.sentence) {
      return `
        <div class="debug-message">
          <strong>⚠️ Debug:</strong> Pas de données valides à afficher<br>
          <small>Vérifier que adjustmentItem.sentence existe</small>
        </div>
      `
    }

    return `
      <div class="adjustment-container">
        <table class="${this.tableClasses}">
          ${this.renderHeader()}
          <tbody>
            ${this.renderMainRow()}
            ${this.renderRemarkRow(item.remark, 1, false)}
            ${this.renderImageRow(item.drawing, 2, false)}
            ${this.renderComponentRemark()}
            ${this.renderSubItems()}
          </tbody>
        </table>
        ${this.renderManualDialog()}
        ${this.renderImageDialog()}
      </div>
    `
  }

  // Event listeners
  attachEventListeners() {
    const shadow = this.shadowRoot

    // Boutons "Voir plus"
    shadow.querySelectorAll('[data-action="open-manual"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const manualId = e.currentTarget.dataset.manualId
        this.openManualDialog(manualId)
      })
    })

    // Images cliquables
    shadow.querySelectorAll('[data-action="open-image"]').forEach(container => {
      container.addEventListener('click', (e) => {
        const imageUrl = e.currentTarget.dataset.imageUrl
        this.openImageDialog(imageUrl)
      })
    })

    // Fermer modales
    shadow.querySelectorAll('[data-action="close-manual"]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.currentTarget.dataset.action === 'close-manual') {
          this.closeManualDialog()
        }
      })
    })

    shadow.querySelectorAll('[data-action="close-image"]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === e.currentTarget || e.currentTarget.dataset.action === 'close-image') {
          this.closeImageDialog()
        }
      })
    })

    // Stop propagation
    shadow.querySelectorAll('[data-action="stop-propagation"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    })
  }

  // Render
  render() {
    console.log('🎨 AdjustmentDefault render')

    try {
      const html = this.generateHTML()
      const css = this.getStyles()
      this.shadowRoot.innerHTML = css + html
      this.attachEventListeners()
      console.log('✅ Render successful')
    } catch (error) {
      console.error('❌ Render error:', error)
      this.shadowRoot.innerHTML = `
        <style>
          .error-message {
            padding: 20px;
            background: #f8d7da;
            border: 2px solid #dc3545;
            border-radius: 0;
            color: #721c24;
          }
        </style>
        <div class="error-message">
          <strong>❌ Erreur:</strong> ${error.message}
        </div>
      `
    }
  }

  getStyles() {
    return `
      <style>
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

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .adjustment-container {
          width: 100%;
          margin-bottom: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ANGLES DROITS - Table */
        .adjustment-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--ipd-white);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          position: relative;
          margin-bottom: 24px;
          border-radius: 0 !important;
        }

        .adjustment-table.first-of-group { border-radius: 0 !important; }
        .adjustment-table.middle-of-group { border-radius: 0 !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); margin-top: 0; }
        .adjustment-table.last-of-group { border-radius: 0 !important; margin-bottom: 24px; }
        .adjustment-table.first-of-group.last-of-group { border-radius: 0 !important; margin-bottom: 24px; }

        .header-row {
          background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%);
        }

        /* ANGLES DROITS - Header */
        .first-of-group .header-row th:first-child { border-radius: 0 !important; }
        .first-of-group .header-row th:last-child { border-radius: 0 !important; }

        .header-cell {
          padding: 18px 24px;
          text-align: left;
          font-size: 20px;
          font-weight: 700;
          color: var(--ipd-white);
          letter-spacing: 0.3px;
          border-bottom: 3px solid var(--ipd-turquoise);
          border-radius: 0 !important;
        }

        /* ANGLES DROITS - Cellules */
        .last-of-group tbody tr:last-child td:first-child { border-radius: 0 !important; }
        .last-of-group tbody tr:last-child td:last-child { border-radius: 0 !important; }

        .data-row { transition: background-color 0.2s ease; }
        .data-row:hover { background-color: #f0f7ff !important; }

        .row-even { background-color: var(--ipd-white); }
        .row-odd { background-color: var(--ipd-light-gray); }

        .icon-cell {
          width: 60px;
          padding: 18px 12px 18px 20px;
          vertical-align: middle;
          text-align: center;
        }

        .row-icon { color: var(--ipd-primary); }
        .subitem-icon { color: var(--ipd-turquoise); opacity: 0.8; }

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

        /* Value chip garde son arrondi pour le style badge */
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

        /* Bouton garde son arrondi léger */
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

        .remark-row { font-style: italic; }

        .remark-cell {
          padding: 14px 20px;
          background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
          border-left: 4px solid var(--ipd-yellow);
        }

        .subitem-remark { padding-left: 50px; }

        .remark-text {
          font-size: 15px;
          color: #555;
          display: block;
          line-height: 1.5;
        }

        .image-cell {
          padding: 20px;
          text-align: center;
        }

        .subitem-image {
          padding-left: 50px;
        }

        /* ============================================
           AFFICHAGE DES IMAGES - CLASSES UNIQUES adj-
           ============================================ */

        /* Wrapper de l'image */
        .adj-image-wrapper {
          position: relative;
          display: inline-block;
          border-radius: 0;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          max-width: 100%;
        }

        /* Wrapper zoomable (cliquable) */
        .adj-zoomable {
          cursor: pointer;
        }

        .adj-zoomable:hover {
          transform: scale(1.02);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }

        /* Mode print */
        .adj-print-mode {
          cursor: default !important;
          box-shadow: none;
        }

        .adj-print-mode:hover {
          transform: none !important;
        }

        /* Tailles selon le contexte */
        .adj-size-default {
          max-width: 600px;
        }

        .adj-size-small {
          max-width: 400px;
        }

        /* Image elle-même */
        .adj-drawing-image {
          width: 500px;
          height: auto;
          border-radius: 0;
        }

        /* Overlay de zoom */
        .adj-zoom-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 55, 140, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .adj-zoomable:hover .adj-zoom-overlay {
          opacity: 1;
        }

        /* Icône de zoom */
        .adj-zoom-icon {
          color: var(--ipd-white);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        /* ============================================
           MODALE IMAGE - CLASSES UNIQUES adj-
           ============================================ */

        .adj-modal-image-card {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          background: var(--ipd-white);
          border-radius: 0;
          padding: 0;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .adj-modal-image-content {
          background: var(--ipd-white);
          padding: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          width: 100%;
          height: 100%;
        }

        .adj-zoomed-image {
          display: block;
          width: auto;
          width: 100%;
          height: calc(90vh - 100px);
          margin: 0 auto;
          border-radius: 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          object-fit: contain;
        }

        /* ANGLES DROITS - Modales */
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
          border-radius: 0;
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
          background: linear-gradient(135deg, var(--ipd-orange) 0%, #d45500 100%);
          border-radius: 0;
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

        .btn-close:hover { background: var(--ipd-white); }
        .btn-close svg { color: var(--ipd-white); }
        .btn-close:hover svg { color: var(--ipd-orange); }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: var(--ipd-light-gray);
        }

        .modal-image-overlay {
          background: rgba(0, 0, 0, 0.75) !important;
          padding: 20px;
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

        .btn-close-image svg { color: var(--ipd-white); }
        .btn-close-image:hover svg { color: var(--ipd-primary); }

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

        .extra-info-content {
          padding: 20px;
          text-align: center;
          color: #666;
        }

        .debug-message {
          padding: 20px;
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 0;
          color: #856404;
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

          /* Images responsive */
          .adj-size-default,
          .adj-size-small {
            max-width: 100%;
          }

          .adj-modal-image-card {
            max-width: 98vw;
            max-height: 98vh;
          }

          .adj-modal-image-content {
            padding: 15px;
          }

          .adj-zoomed-image {
            height: calc(98vh - 80px);
          }
        }

        @media print {
          .adjustment-container { box-shadow: none; break-inside: avoid; }
          .adjustment-table { box-shadow: none; }
          .adj-zoom-overlay, .btn-see-more { display: none; }
          .adj-image-wrapper { cursor: default !important; box-shadow: none; }
          .adj-image-wrapper:hover { transform: none !important; }
          .data-row:hover { background-color: inherit !important; }
        }
      </style>
    `
  }
}

// Enregistrer le Web Component
if (!customElements.get('adjustment-default')) {
  customElements.define('adjustment-default', AdjustmentDefault)
  console.log('✅ Web Component "adjustment-default" registered')
} else {
  console.log('ℹ️ Web Component "adjustment-default" already registered')
}

export default AdjustmentDefault
