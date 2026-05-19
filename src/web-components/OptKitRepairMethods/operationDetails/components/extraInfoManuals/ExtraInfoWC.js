/**
 * ExtraInfo.js
 * Web Component pour l'affichage des procédures de lubrification
 */

class ExtraInfo extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // Propriétés internes
    this._extraInfo = null
  }

  // ========================================
  // Propriétés avec setters
  // ========================================

  set extraInfo(value) {
    this._extraInfo = typeof value === 'string' ? JSON.parse(value) : value
    this._render()
  }

  get extraInfo() {
    return this._extraInfo
  }

  // ========================================
  // Lifecycle
  // ========================================

  connectedCallback() {
    this._render()
  }

  // ========================================
  // Méthodes utilitaires
  // ========================================

  /**
   * Filtrer les étapes pour exclure celles avec name vide et ajouter displayOrder
   */
  _getFilteredSteps(steps) {
    if (!steps) return []

    let displayOrder = 1
    return steps
      .filter(step => step.name && step.name.trim() !== '')
      .map(step => ({
        ...step,
        displayOrder: displayOrder++
      }))
  }

  /**
   * Fonction pour alterner les couleurs de fond des étapes
   */
  _getStepRowClass(index) {
    return index % 2 === 0 ? 'step-row-even' : 'step-row-odd'
  }

  /**
   * Formater URL (supprimer http://)
   */
  _formatUrl(url) {
    if (!url) return ''
    return url.replace('http://', '//')
  }

  /**
   * Vérifier si une étape a des images (elle-même ou dans ses nested steps)
   */
  _hasImages(subStory) {
    if (subStory.mimeDataName) return true
    if (subStory.subStoryLines && subStory.subStoryLines.some(n => n.mimeDataName)) return true
    return false
  }

  // ========================================
  // Méthodes de rendu
  // ========================================

  /**
   * Rendu d'une image
   */
  _renderImage(url, altText, className = 'image-preview') {
    return `
      <img
        src="${this._formatUrl(url)}"
        alt="${altText}"
        class="${className}"
        data-image-url="${url}"
      />
    `
  }

  /**
   * Rendu d'une alerte info
   */
  _renderAlert(remark) {
    return `
      <div class="alert-info">
        <svg class="alert-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
        </svg>
        <span>${remark}</span>
      </div>
    `
  }

  /**
   * Rendu des nested steps
   */
  _renderNestedSteps(subStoryLines) {
    if (!subStoryLines || !subStoryLines.length) return ''

    let html = '<div class="nested-steps">'

    subStoryLines.forEach((nestedStory) => {
      html += '<div class="nested-step">'

      // Texte nested
      html += `
        <div class="nested-step-text">
          <span>${nestedStory.name}</span>
        </div>
      `

      // Remarque nested
      if (nestedStory.remark) {
        html += `
          <div class="nested-step-remark">
            ${nestedStory.remark}
          </div>
        `
      }

      // Image nested
      if (nestedStory.mimeDataName) {
        html += this._renderImage(nestedStory.mimeDataName, 'Nested step diagram', 'image-preview nested-image')
      }

      html += '</div>'
    })

    html += '</div>'
    return html
  }

  /**
   * Rendu d'une étape
   */
  _renderStep(subStory, index) {
    const rowClass = this._getStepRowClass(index)

    let html = `<div class="step-row ${rowClass}">`

    // Numéro de l'étape
    html += `
      <div class="step-number">
        ${subStory.displayOrder}
      </div>
    `

    // Contenu de l'étape
    html += '<div class="step-content">'

    // Texte de l'étape
    if (subStory.name) {
      html += `
        <div class="step-text">
          ${subStory.name}
        </div>
      `
    }

    // Image de l'étape
    if (subStory.mimeDataName) {
      html += this._renderImage(subStory.mimeDataName, 'Step diagram', 'image-preview step-image')
    }

    // Nested steps
    if (subStory.subStoryLines && subStory.subStoryLines.length) {
      html += this._renderNestedSteps(subStory.subStoryLines)
    }

    html += '</div>' // Fin step-content

    // Remarque
    if (subStory.remark) {
      html += `
        <div class="step-remark">
          ${subStory.remark}
        </div>
      `
    }

    // Bouton image
    if (this._hasImages(subStory)) {
      html += '<div class="step-actions">'
      if (subStory.mimeDataName) {
        html += `
          <button class="btn-image" data-image-url="${subStory.mimeDataName}">
            <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
            </svg>
            Image
          </button>
        `
      }
      html += '</div>'
    }

    html += '</div>' // Fin step-row
    return html
  }

  /**
   * Rendu d'une section
   */
  _renderSection(section, sectionIndex) {
    let html = '<div class="section-card">'

    // Header de la section
    html += `
      <div class="section-header">
        <span class="section-number">${section.order + 1}</span>
        <span>${section.name}</span>
      </div>
    `

    // Image de la section
    if (section.mimeDataName) {
      html += `
        <div class="section-image-container">
          ${this._renderImage(section.mimeDataName, 'Section diagram')}
        </div>
      `
    }

    // Remarque de la section
    if (section.remark) {
      html += this._renderAlert(section.remark)
    }

    // Contenu de la section
    html += '<div class="section-content">'

    // Étapes filtrées
    if (section.subStoryLines && section.subStoryLines.length) {
      const filteredSteps = this._getFilteredSteps(section.subStoryLines)

      if (filteredSteps.length > 0) {
        filteredSteps.forEach((subStory, subIndex) => {
          html += this._renderStep(subStory, subIndex)
        })
      } else {
        html += `
          <div class="empty-section">
            Aucune procédure disponible
          </div>
        `
      }
    } else {
      html += `
        <div class="empty-section">
          Aucune procédure disponible
        </div>
      `
    }

    html += '</div>' // Fin section-content
    html += '</div>' // Fin section-card

    return html
  }

  /**
   * Rendu principal
   */
  _render() {
    if (!this._extraInfo || !this._extraInfo.data) {
      this.shadowRoot.innerHTML = `
        <style>${this._getStyles()}</style>
        <div class="lubricant-procedures-container">
          <div class="empty-section">Aucune donnée disponible</div>
        </div>
      `
      return
    }

    let html = `
      <style>${this._getStyles()}</style>
      <div class="lubricant-procedures-container">
    `

    // Rendu de toutes les sections
    this._extraInfo.data.forEach((section, sectionIndex) => {
      html += this._renderSection(section, sectionIndex)
    })

    html += '</div>'

    this.shadowRoot.innerHTML = html

    // Attacher les event listeners après le rendu
    this._attachEventListeners()
  }

  /**
   * Attacher les event listeners
   */
  _attachEventListeners() {
    // Click sur toutes les images
    const images = this.shadowRoot.querySelectorAll('.image-preview')
    images.forEach(img => {
      const url = img.getAttribute('data-image-url')
      img.addEventListener('click', () => {
        this._handleImageClick(url)
      })
    })

    // Click sur les boutons image
    const buttons = this.shadowRoot.querySelectorAll('.btn-image')
    buttons.forEach(btn => {
      const url = btn.getAttribute('data-image-url')
      btn.addEventListener('click', () => {
        this._handleImageClick(url)
      })
    })
  }

  /**
   * Gérer le click sur une image
   */
  _handleImageClick(imageUrl) {
    if (!imageUrl) return

    this.dispatchEvent(new CustomEvent('open-image', {
      detail: { imageUrl },
      bubbles: true,
      composed: true
    }))
  }

  /**
   * Styles CSS
   */
  _getStyles() {
    return `
      /* ============================================
         CONTAINER PRINCIPAL
         ============================================ */
      .lubricant-procedures-container {
        width: 100%;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* ============================================
         SECTION CARD
         ============================================ */
      .section-card {
        background: white;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        margin-bottom: 16px;
      }

      .section-header {
        background: linear-gradient(135deg, #B85C6F 0%, #A04D5F 100%);
        color: white;
        padding: 10px 16px;
        font-size: 15px;
        font-weight: 600;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: background 0.2s;
      }

      .section-header:hover {
        background: linear-gradient(135deg, #C86D80 0%, #B05D6F 100%);
      }

      .section-number {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        margin-right: 10px;
        min-width: 28px;
        text-align: center;
      }

      /* ============================================
         SECTION IMAGE
         ============================================ */
      .section-image-container {
        padding: 16px 16px 0 16px;
      }

      /* ============================================
         ALERT INFO
         ============================================ */
      .alert-info {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #E3F2FD;
        border-left: 4px solid #2196F3;
        color: #1565C0;
        padding: 12px 16px;
        margin: 16px;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.5;
      }

      .alert-icon {
        flex-shrink: 0;
        color: #2196F3;
      }

      /* ============================================
         SECTION CONTENT
         ============================================ */
      .section-content {
        padding: 0;
      }

      /* ============================================
         STEP ROW
         ============================================ */
      .step-row {
        display: grid;
        grid-template-columns: 40px minmax(250px, 1fr) auto auto;
        gap: 12px;
        padding: 10px 16px;
        border-bottom: 1px solid #E0E0E0;
        align-items: center;
        transition: background 0.2s;
      }

      .step-row:last-child {
        border-bottom: none;
      }

      .step-row:hover {
        background: #F5E6EA !important;
      }

      .step-row-odd {
        background: #FAFAFA;
      }

      .step-row-even {
        background: white;
      }

      /* ============================================
         STEP NUMBER
         ============================================ */
      .step-number {
        background: #B85C6F;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
      }

      /* ============================================
         STEP CONTENT
         ============================================ */
      .step-content {
        flex: 1;
        align-self: start;
      }

      .step-text {
        font-size: 14px;
        color: #424242;
        line-height: 1.5;
      }

      .step-image {
        max-width: 500px;
        margin-top: 12px;
      }

      /* ============================================
         STEP REMARK
         ============================================ */
      .step-remark {
        background: #F8E8EA;
        color: #4A4A4A;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 18px;
        font-weight: 600;
        min-width: 110px;
        text-align: center;
        border: 1px solid #F0D4D8;
        white-space: nowrap;
      }

      /* ============================================
         STEP ACTIONS
         ============================================ */
      .step-actions {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }

      .btn-image {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: white;
        color: #B85C6F;
        border: 1px solid #B85C6F;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-image:hover {
        background: #B85C6F;
        color: white;
      }

      .btn-image:active {
        transform: scale(0.98);
      }

      .btn-icon {
        flex-shrink: 0;
      }

      /* ============================================
         IMAGES
         ============================================ */
      .image-preview {
        max-width: 100%;
        height: auto;
        cursor: pointer;
        border: 1px solid #E0E0E0;
        border-radius: 4px;
        transition: transform 0.2s, box-shadow 0.2s;
        display: block;
      }

      .image-preview:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      /* ============================================
         NESTED STEPS
         ============================================ */
      .nested-steps {
        margin-top: 12px;
        padding-left: 24px;
        border-left: 3px solid #F0D4D8;
      }

      .nested-step {
        padding: 8px 0;
        border-bottom: 1px solid #F5F5F5;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
      }

      .nested-step:last-child {
        border-bottom: none;
      }

      .nested-step-text {
        font-size: 13px;
        color: #616161;
        display: flex;
        align-items: start;
        line-height: 1.5;
      }

      .nested-step-text::before {
        content: "▸";
        margin-right: 8px;
        color: #B85C6F;
        font-size: 14px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .nested-step-remark {
        background: #F8E8EA;
        color: #4A4A4A;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 15px;
        font-weight: 600;
        min-width: 90px;
        text-align: center;
        border: 1px solid #F0D4D8;
        white-space: nowrap;
      }

      .nested-image {
        grid-column: 1 / -1;
        max-width: 400px;
        margin-top: 8px;
      }

      /* ============================================
         EMPTY SECTION
         ============================================ */
      .empty-section {
        padding: 16px;
        text-align: center;
        color: #9E9E9E;
        font-style: italic;
      }

      /* ============================================
         RESPONSIVE
         ============================================ */
      @media (max-width: 768px) {
        .step-row {
          grid-template-columns: 32px 1fr;
          gap: 8px;
        }

        .step-number {
          width: 24px;
          height: 24px;
          font-size: 11px;
        }

        .step-remark {
          grid-column: 2;
          margin-top: 8px;
          font-size: 16px;
        }

        .step-actions {
          grid-column: 2;
          margin-top: 8px;
        }

        .nested-steps {
          padding-left: 12px;
        }

        .nested-step {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .nested-step-remark {
          margin-top: 4px;
        }

        .step-image {
          max-width: 100%;
        }

        .nested-image {
          max-width: 100%;
        }
      }

      /* ============================================
         PRINT MODE
         ============================================ */
      @media print {
        .section-card {
          box-shadow: none;
          page-break-inside: avoid;
        }

        .btn-image {
          display: none !important;
        }

        .step-row:hover {
          background: inherit !important;
        }

        .section-header:hover {
          background: linear-gradient(135deg, #B85C6F 0%, #A04D5F 100%) !important;
        }

        .image-preview:hover {
          transform: none;
          box-shadow: none;
        }
      }
    `
  }
}

// Enregistrer le Custom Element
customElements.define('extra-info-wc', ExtraInfo)
export default ExtraInfo
