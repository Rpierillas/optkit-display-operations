/**
 * TechnicalDrawings Web Component
 * Composant pour afficher les dessins techniques
 * Compatible avec tous les frameworks (Vue, React, Angular, vanilla JS)
 */

class TechnicalDrawings extends HTMLElement {
  constructor() {
    super()
    console.log('🏗️ TechnicalDrawings constructor')

    this.attachShadow({ mode: 'open' })

    // Constantes
    this.HAYNES_DEFAULT_LANG = '2057'
    this.DEFAULT_LANG = 'en'

    // Propriétés internes
    this._isPrint = false
    this._technicalDrawings = {}
    this._technicalDrawingsIndex = 0
    this._description = ''
    this._isLastItem = false
    this._component = {}
    this._lang = 'en'
    this._haynesLang = '2057'
  }

  static get observedAttributes() {
    return [
      'is-print',
      'technical-drawings-index',
      'description',
      'is-last-item',
      'lang',
      'haynes-lang'
    ]
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    this._isPrint = boolValue
    if (this.isConnected) {
      this.render()
    }
  }

  get technicalDrawings() {
    return this._technicalDrawings
  }

  set technicalDrawings(value) {
    console.log('📝 TechnicalDrawings - technicalDrawings set:', value)
    this._technicalDrawings = value || {}
    if (this.isConnected) {
      this.render()
    }
  }

  get technicalDrawingsIndex() {
    return this._technicalDrawingsIndex
  }

  set technicalDrawingsIndex(value) {
    this._technicalDrawingsIndex = parseInt(value, 10) || 0
  }

  get description() {
    return this._description
  }

  set description(value) {
    this._description = value || ''
  }

  get isLastItem() {
    return this._isLastItem
  }

  set isLastItem(value) {
    const boolValue = value === true || value === 'true'
    this._isLastItem = boolValue
    if (this.isConnected) {
      this.render()
    }
  }

  get component() {
    return this._component
  }

  set component(value) {
    console.log('📝 TechnicalDrawings - component set:', value)
    this._component = value || {}
    if (this.isConnected) {
      this.render()
    }
  }

  get lang() {
    return this._lang
  }

  set lang(value) {
    this._lang = value || 'en'
    if (this.isConnected) {
      this.render()
    }
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    this._haynesLang = value || '2057'
    if (this.isConnected) {
      this.render()
    }
  }

  // ============================================
  // COMPUTED
  // ============================================

  get imageUrl() {
    if (!this._technicalDrawings.drawing?.url) return ''
    return this.getDrawingWithParameters(this._technicalDrawings.drawing.url)
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    console.log('🔌 TechnicalDrawings connected')
    console.log('  - technicalDrawings:', this._technicalDrawings)
    console.log('  - component:', this._component)

    if (this._technicalDrawings && Object.keys(this._technicalDrawings).length > 0) {
      this.render()
    } else {
      console.log('⏳ Attente des données avant le premier render')
    }
  }

  disconnectedCallback() {
    console.log('🔌 TechnicalDrawings disconnected')
    this.detachEventListeners()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'is-print':
          this.isPrint = newValue === 'true'
          break
        case 'technical-drawings-index':
          this.technicalDrawingsIndex = parseInt(newValue, 10)
          break
        case 'description':
          this.description = newValue
          break
        case 'is-last-item':
          this.isLastItem = newValue === 'true'
          break
        case 'lang':
          this.lang = newValue
          break
        case 'haynes-lang':
          this.haynesLang = newValue
          break
      }
    }
  }

  // ============================================
  // METHODS
  // ============================================

  formatHaynesLang(map) {
    if (!map) return ''
    return map[this._haynesLang] || map[this.HAYNES_DEFAULT_LANG] || ''
  }

  getDrawingWithParameters(drawing) {
    if (!drawing) return ''

    if (drawing.indexOf('gif') !== -1) {
      return `${drawing}?typeOfDrawing=tdrawing&language=${this._lang}`
    } else {
      return `${drawing}?typeOfDrawing=tdrawing&language=${this._lang}&dim=800x800`
    }
  }

  openSvgImageContainer(e, src) {
    console.log('🖼️ Opening image:', src)

    const data = {
      event: e,
      src: src
    }

    // Émettre un événement custom
    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: data,
      bubbles: true,
      composed: true
    }))
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  attachEventListeners() {
    const shadow = this.shadowRoot

    // Image cliquable pour zoom
    const imageWrapper = shadow.querySelector('.image-wrapper.zoomable')
    if (imageWrapper) {
      imageWrapper.addEventListener('click', (e) => {
        this.openSvgImageContainer(e, this.imageUrl)
      })
    }
  }

  detachEventListeners() {
    // Cleanup si nécessaire
  }

  // ============================================
  // RENDER
  // ============================================

  render() {
    console.log('🎨 TechnicalDrawings render')

    if (!this._technicalDrawings || Object.keys(this._technicalDrawings).length === 0) {
      console.log('⏳ No data to render yet')
      this.shadowRoot.innerHTML = `
        ${this.getStyles()}
        <div class="technical-drawings-container">
          <div class="loading-message">
            Chargement des dessins techniques...
          </div>
        </div>
      `
      return
    }

    try {
      const html = this.generateHTML()
      const css = this.getStyles()
      this.shadowRoot.innerHTML = css + html

      // Attacher les event listeners
      Promise.resolve().then(() => {
        this.attachEventListeners()
      })

      console.log('✅ Render successful')
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
    const componentTitle = this.formatHaynesLang(this._component.description?.map)
    const sectionTitle = this.formatHaynesLang(this._technicalDrawings.sentence?.description?.map)

    return `
      <div class="technical-drawings-container">
        <!-- Header avec titre du composant -->
        ${componentTitle ? `
          <div class="drawings-header">
            <h3 class="drawings-title">
              ${componentTitle}
            </h3>
          </div>
          <div class="divider"></div>
        ` : ''}

        <!-- Section titre -->
        ${sectionTitle ? `
          <div class="drawings-section-title">
            <h3 class="section-title-text">
              ${sectionTitle}
            </h3>
          </div>
        ` : ''}

        <!-- Image technique -->
        ${this.imageUrl ? this.renderImage() : ''}

        <!-- Divider final (sauf si dernier item) -->
        ${!this._isLastItem ? '<div class="divider divider--bottom"></div>' : ''}
      </div>
    `
  }

  renderImage() {
    if (this._isPrint) {
      // Mode print (image simple)
      return `
        <div class="drawings-image-container drawings-image-container--print">
          <img
            src="${this.imageUrl}"
            alt="Technical drawing"
            class="drawing-image drawing-image--print"
          />
        </div>
      `
    } else {
      // Mode normal avec zoom
      return `
        <div class="drawings-image-container">
          <div class="image-wrapper zoomable">
            <img
              src="${this.imageUrl}"
              alt="Technical drawing"
              class="drawing-image"
            />
            <!-- Overlay avec icône zoom -->
            <div class="zoom-overlay">
              <svg class="zoom-icon" viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
              </svg>
            </div>
          </div>
        </div>
      `
    }
  }

  getStyles() {
    return `
      <style>
        /* ============================================
           VARIABLES CSS - CHARTE IPD
           ============================================ */
        :host {
          --ipd-primary: #00378c;
          --ipd-turquoise: #00BCA1;
          --ipd-yellow: #FFC200;
          --ipd-white: #ffffff;
          --ipd-light-gray: #f5f5f5;
          --ipd-border: #e0e0e0;
          --ipd-dark-text: #1a1a1a;
          --ipd-medium-text: #555555;

          display: block;
          width: 100%;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        /* ============================================
           CONTAINER PRINCIPAL
           ============================================ */
        .technical-drawings-container {
          width: 100%;
          padding: 0;
          margin-bottom: 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--ipd-white);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .loading-message {
          padding: 40px 20px;
          text-align: center;
          color: var(--ipd-medium-text);
          background: var(--ipd-light-gray);
          border-radius: 8px;
        }

        /* ============================================
           HEADER
           ============================================ */
        .drawings-header {
          padding: 18px 24px;
          background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%);
        }

        .drawings-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: var(--ipd-white);
          letter-spacing: 0.3px;
        }

        /* ============================================
           DIVIDER
           ============================================ */
        .divider {
          height: 1px;
          background: var(--ipd-border);
          margin: 0;
        }

        .divider--bottom {
          margin-top: 20px;
        }

        /* ============================================
           SECTION TITRE
           ============================================ */
        .drawings-section-title {
          padding: 20px 24px 16px 24px;
        }

        .section-title-text {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--ipd-dark-text);
          line-height: 1.4;
          padding-left: 12px;
          border-left: 4px solid var(--ipd-turquoise);
        }

        /* ============================================
           IMAGE CONTAINER
           ============================================ */
        .drawings-image-container {
          padding: 0 24px 20px 24px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .drawings-image-container--print {
          text-align: left;
          justify-content: flex-start;
        }

        /* ============================================
           IMAGE WRAPPER (avec zoom)
           ============================================ */
        .image-wrapper {
          position: relative;
          display: inline-block;
          max-width: 100%;
          min-width: 600px;
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .image-wrapper:hover {
          transform: scale(1.02);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .image-wrapper:hover .zoom-overlay {
          opacity: 1;
        }

        /* ============================================
           IMAGE
           ============================================ */
        .drawing-image {
          display: block;
          width: 100%;
          min-width: 600px;
          height: auto;
          border-radius: 8px;
        }

        .drawing-image--print {
          max-width: 800px;
          min-width: 600px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          border: 1px solid var(--ipd-border);
        }

        /* ============================================
           ZOOM OVERLAY
           ============================================ */
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
          border-radius: 8px;
        }

        .zoom-icon {
          color: var(--ipd-white);
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        /* ============================================
           ZOOMABLE (état hover)
           ============================================ */
        .zoomable {
          cursor: zoom-in;
        }

        .zoomable:active {
          cursor: zoom-in;
        }

        /* ============================================
           RESPONSIVE - MOBILE
           ============================================ */
        @media (max-width: 768px) {
          .drawings-header {
            padding: 14px 16px;
          }

          .drawings-title {
            font-size: 18px;
          }

          .drawings-section-title {
            padding: 16px;
          }

          .section-title-text {
            font-size: 16px;
            padding-left: 10px;
            border-left-width: 3px;
          }

          .drawings-image-container {
            padding: 0 16px 16px 16px;
          }

          .image-wrapper {
            min-width: 100%;
          }

          .drawing-image {
            min-width: 100%;
          }

          .zoom-icon {
            width: 40px;
            height: 40px;
          }

          .drawing-image--print {
            max-width: 100%;
            min-width: 100%;
          }
        }

        /* ============================================
           RESPONSIVE - TABLET
           ============================================ */
        @media (min-width: 769px) and (max-width: 1024px) {
          .drawings-header {
            padding: 16px 20px;
          }

          .drawings-section-title {
            padding: 18px 20px;
          }

          .drawings-image-container {
            padding: 0 20px 18px 20px;
          }

          .image-wrapper {
            min-width: 500px;
          }

          .drawing-image {
            min-width: 500px;
          }

          .drawing-image--print {
            min-width: 500px;
          }
        }

        /* ============================================
           PRINT MODE
           ============================================ */
        @media print {
          .technical-drawings-container {
            box-shadow: none;
            page-break-inside: avoid;
          }

          .drawings-header {
            background: var(--ipd-primary) !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .image-wrapper {
            box-shadow: none;
            cursor: default;
          }

          .image-wrapper:hover {
            transform: none;
            box-shadow: none;
          }

          .zoom-overlay {
            display: none !important;
          }

          .divider {
            border-top: 1px solid var(--ipd-border);
          }

          .drawing-image--print {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    `
  }
}

// Enregistrer le Web Component
if (!customElements.get('technical-drawings')) {
  customElements.define('technical-drawings', TechnicalDrawings)
  console.log('✅ Web Component "technical-drawings" registered')
} else {
  console.log('ℹ️ Web Component "technical-drawings" already registered')
}

export default TechnicalDrawings
