/**
 * Repairs-MaintenanceWC.js
 * Web Component pour l'affichage des instructions de maintenance
 * Avec numérotation intelligente (ignore les lignes vides)
 */

const HAYNES_DEFAULT_LANG = '2057'

class RepairsMaintenance extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // Propriétés internes
    this._instruction = null
    this._operations = null
    this._operationsDetails = null
    this._groupId = null
    this._isPrint = false
    this._haynesLang = '2057'
  }

  // ========================================
  // Propriétés avec setters
  // ========================================

  set instruction(value) {
    this._instruction = typeof value === 'string' ? JSON.parse(value) : value
    this._render()
  }

  get instruction() {
    return this._instruction
  }

  set operations(value) {
    this._operations = typeof value === 'string' ? JSON.parse(value) : value
    this._render()
  }

  get operations() {
    return this._operations
  }

  set operationsDetails(value) {
    this._operationsDetails = typeof value === 'string' ? JSON.parse(value) : value
    this._render()
  }

  get operationsDetails() {
    return this._operationsDetails
  }

  set groupId(value) {
    this._groupId = value
    this._render()
  }

  get groupId() {
    return this._groupId
  }

  set isPrint(value) {
    this._isPrint = value === 'true' || value === true
    this._render()
  }

  get isPrint() {
    return this._isPrint
  }

  set haynesLang(value) {
    this._haynesLang = value || '2057'
    this._render()
  }

  get haynesLang() {
    return this._haynesLang
  }

  // ========================================
  // Lifecycle
  // ========================================

  connectedCallback() {
    this._render()
  }

  // ========================================
  // Méthodes de rendu
  // ========================================

  /**
   * Grouper les items par group.description
   */
  _getGroupedBlocks() {
    if (!this._instruction?.items) return []

    const blocks = []
    let currentBlock = null

    this._instruction.items.forEach((item) => {
      const groupKey = item.group?.description?.map?.[HAYNES_DEFAULT_LANG] || 'default'

      if (!currentBlock || currentBlock.groupKey !== groupKey) {
        currentBlock = {
          groupKey: groupKey,
          groupDescription: item.group?.description?.map || {},
          items: []
        }
        blocks.push(currentBlock)
      }

      currentBlock.items.push(item)
    })

    return blocks
  }

  /**
   * Obtenir le numéro de ligne dans un bloc
   * Ignore les lignes sans sentence ou avec sentence vide
   */
  _getLineNumber(block, itemIndex) {
    let counter = 0

    for (let i = 0; i <= itemIndex; i++) {
      const item = block.items[i]

      // Ignorer les lignes sans sentence
      if (!item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
        continue
      }

      // Ignorer les lignes avec sentence vide
      const sentenceText = item.sentence.description.map[HAYNES_DEFAULT_LANG]
      if (!sentenceText || sentenceText.trim() === '') {
        continue
      }

      // Compter cette ligne
      counter++
    }

    return counter
  }

  /**
   * Classes CSS pour les tables
   */
  _getTableClasses(blockIndex, totalBlocks) {
    const isFirst = blockIndex === 0
    const isLast = blockIndex === totalBlocks - 1

    const classes = ['adjustment-table']

    if (isFirst) classes.push('first-of-group')
    if (isLast) classes.push('last-of-group')
    if (!isFirst && !isLast) classes.push('middle-of-group')
    if (isFirst && isLast) classes.push('first-last')

    return classes.join(' ')
  }

  /**
   * Classes CSS pour les lignes (alternance)
   */
  _getRowClass(index) {
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  /**
   * Formater le texte multilingue
   */
  _formatHaynesLang(map) {
    if (!map) return ''
    return map[this._haynesLang] || map[HAYNES_DEFAULT_LANG] || ''
  }

  /**
   * Formater le texte pour les notes (rouge + gras)
   */
  _formatTextForNote(translatedText, anchorText) {
    if (!translatedText || !anchorText) return translatedText || ''

    // Chercher "Note:" dans l'ancre anglaise
    const noteMatch = anchorText.match(/\b(Note):\s*/i)
    if (!noteMatch) return translatedText

    // Trouver le mot équivalent dans la traduction
    const words = translatedText.split(/\s+/)
    if (words.length === 0) return translatedText

    const firstWord = words[0]

    // Remplacer le premier mot par une version stylée
    return translatedText.replace(
      firstWord,
      `<span class="note-keyword">${firstWord}</span>`
    )
  }

  /**
   * Formater URL
   */
  _formatUrl(url) {
    if (!url) return ''
    return url.replace('http://', '//')
  }

  /**
   * Vérifier si mobile
   */
  _isMobile() {
    return window.innerWidth <= 600
  }

  /**
   * Rendu du contenu d'un item
   */
  _renderItemContent(item, block, itemIndex) {
    const SENTENCE_TYPE = {
      HEADER: 'HEADER',
      SENTENCE: 'SENTENCE',
      SUB_SENTENCE: 'SUB_SENTENCE'
    }

    const GROUP_TYPE = {
      STANDALONE: 'STANDALONE',
      PARAGRAPH: 'PARAGRAPH',
      BULLET_LIST: 'BULLET_LIST'
    }

    let html = ''

    // HEADER (h6)
    if (item.sentenceType === SENTENCE_TYPE.HEADER && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      html += `<h6 class="header-title">${this._formatHaynesLang(item.sentence.description.map)}</h6>`
    }

    // STANDALONE
    else if (item.groupType === GROUP_TYPE.STANDALONE && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      const isSubSentence = item.sentenceType === SENTENCE_TYPE.SUB_SENTENCE
      const lineNumber = this._getLineNumber(block, itemIndex)

      html += `
        <div class="sentence-content ${isSubSentence ? 'subsentence-content' : ''}">
          <div class="line-number-square">${lineNumber}</div>
          <span class="sentence-text ${isSubSentence ? 'sentence-text--sub' : ''}">
            ${this._formatTextForNote(
              item.sentence.description.map[this._haynesLang] || item.sentence.description.map[HAYNES_DEFAULT_LANG],
              item.sentence.description.map[HAYNES_DEFAULT_LANG]
            )}
          </span>
          ${this._renderSpecialTools(item)}
        </div>
      `
    }

    // PARAGRAPH
    else if (item.groupType === GROUP_TYPE.PARAGRAPH && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      html += `
        <div class="sentence-content">
          <span class="sentence-text">${this._formatHaynesLang(item.sentence.description.map)}</span>
        </div>
      `
    }

    // BULLET_LIST
    else if (item.groupType === GROUP_TYPE.BULLET_LIST && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      html += `
        <ul class="bullet-list">
          <li>
            <span class="sentence-text">${this._formatHaynesLang(item.sentence.description.map)}</span>
          </li>
        </ul>
      `
    }

    // Drawing/Image
    if (item.drawing?.url) {
      html += this._renderDrawing(item.drawing.url)
    }

    return html
  }

  /**
   * Rendu des Special Tools
   */
  _renderSpecialTools(item) {
    if (!item.specialTools || item.specialTools.length === 0) return ''

    let html = '<span class="special-tools">('

    item.specialTools.forEach((tool, index) => {
      if (tool.image) {
        html += `<span class="tool-link" data-image-url="${tool.image.url}">${tool.oeCode}</span>`
      } else {
        html += `<span>${tool.oeCode}</span>`
      }
      if (index < item.specialTools.length - 1) {
        html += ' '
      }
    })

    html += ')</span>'
    return html
  }

  /**
   * Rendu d'une image/drawing
   */
  _renderDrawing(url) {
    if (this._isPrint) {
      return `
        <div class="image-row">
          <div class="image-label">
            <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
            </svg>
            <span>Schéma :</span>
          </div>
          <div class="image-container image-container--print">
            <img src="${this._formatUrl(url)}" alt="Repair diagram" class="drawing-image" />
          </div>
        </div>
      `
    } else {
      return `
        <div class="image-row">
          <div class="image-label">
            <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
            </svg>
            <span>Schéma :</span>
          </div>
          <div class="image-container" data-image-url="${this._formatUrl(url)}">
            <img src="${this._formatUrl(url)}" alt="Repair diagram" class="drawing-image" />
            <div class="zoom-overlay">
              <svg class="zoom-icon" viewBox="0 0 24 24" width="32" height="32">
                <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
              </svg>
            </div>
          </div>
        </div>
      `
    }
  }

  /**
   * Rendu principal
   */
  _render() {
    if (!this._instruction) {
      this.shadowRoot.innerHTML = ''
      return
    }

    const groupedBlocks = this._getGroupedBlocks()
    const isMobile = this._isMobile()

    let html = `
      <style>${this._getStyles()}</style>
      <div class="repairs-maintenance-container">
        <!-- Header principal -->
        <div class="instruction-header">
          <svg class="icon-wrench" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
          </svg>
          <span class="${isMobile ? 'body16-bold' : 'body20-bold'}">
            ${this._formatHaynesLang(this._instruction.description.map)}
          </span>
        </div>

        <!-- Tables groupées -->
        <div class="operations-list">
    `

    groupedBlocks.forEach((block, blockIndex) => {
      html += `
        <table class="${this._getTableClasses(blockIndex, groupedBlocks.length)}">
          <thead>
            <tr class="header-row">
              <th class="header-cell">${this._formatHaynesLang(block.groupDescription)}</th>
            </tr>
          </thead>
          <tbody>
      `

      block.items.forEach((item, itemIndex) => {
        html += `
          <tr class="data-row ${this._getRowClass(itemIndex)}">
            <td class="content-cell">
              ${this._renderItemContent(item, block, itemIndex)}
            </td>
          </tr>
        `
      })

      html += `
          </tbody>
        </table>
      `
    })

    html += `
        </div>
      </div>
    `

    this.shadowRoot.innerHTML = html

    // Attacher les event listeners après le rendu
    this._attachEventListeners()
  }

  /**
   * Attacher les event listeners
   */
  _attachEventListeners() {
    // Click sur les images
    const imageContainers = this.shadowRoot.querySelectorAll('.image-container:not(.image-container--print)')
    imageContainers.forEach(container => {
      const url = container.getAttribute('data-image-url')
      container.addEventListener('click', (event) => {
        this.dispatchEvent(new CustomEvent('show-schematics', {
          detail: { event, src: url },
          bubbles: true,
          composed: true
        }))
      })
    })

    // Click sur les special tools
    const toolLinks = this.shadowRoot.querySelectorAll('.tool-link')
    toolLinks.forEach(link => {
      const url = link.getAttribute('data-image-url')
      link.addEventListener('click', (event) => {
        this.dispatchEvent(new CustomEvent('show-schematics', {
          detail: { event, src: url },
          bubbles: true,
          composed: true
        }))
      })
    })
  }

  /**
   * Styles CSS (exactement comme Repairs-Engine)
   */
  _getStyles() {
    return `
      /* ============================================
         CONTAINER PRINCIPAL
         ============================================ */
      .repairs-maintenance-container {
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 0 16px;
      }

      /* ============================================
         HEADER PRINCIPAL
         ============================================ */
      .instruction-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0 8px 16px;
        margin-bottom: 16px;
      }

      .icon-wrench {
        color: #464653;
        flex-shrink: 0;
      }

      .body16-bold {
        font-size: 16px;
        font-weight: 700;
        color: #464653;
      }

      .body20-bold {
        font-size: 20px;
        font-weight: 700;
        color: #464653;
      }

      /* ============================================
         OPERATIONS LIST & TABLES
         ============================================ */
      .operations-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .adjustment-table {
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        position: relative;
        margin-bottom: 24px;
        border-radius: 0 !important;
      }

      .header-row {
        background: linear-gradient(135deg, #00378c 0%, #0047b3 100%);
      }

      .header-cell {
        padding: 18px 24px;
        text-align: left;
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 0.3px;
        border-bottom: 3px solid #00BCA1;
        border-radius: 0 !important;
      }

      /* ============================================
         LIGNES DE DONNÉES
         ============================================ */
      .data-row {
        transition: background-color 0.2s ease;
      }

      .data-row:hover {
        background-color: #f0f7ff !important;
      }

      .row-even {
        background-color: #ffffff;
      }

      .row-odd {
        background-color: #f5f5f5;
      }

      .content-cell {
        padding: 18px 24px;
        vertical-align: middle;
      }

      /* ============================================
         HEADER TITLE (h6)
         ============================================ */
      .header-title {
        font-size: 18px;
        font-weight: 700;
        color: #00378c;
        margin: 0;
        padding: 0;
        text-align: left;
        line-height: 1.4;
      }

      /* ============================================
         SENTENCE CONTENT (avec numéro)
         ============================================ */
      .sentence-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }

      .line-number-square {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        padding: 6px 10px;
        background: #00378c;
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
        border-radius: 0;
        margin-top: 2px;
      }

      .sentence-text {
        font-size: 16px;
        font-weight: 600;
        line-height: 1.6;
        color: #1a1a1a;
      }

      .sentence-text--sub {
        font-size: 15px;
        font-weight: 550;
        color: #2a2a2a;
      }

      /* ============================================
         NOTE KEYWORD (rouge ET GRAS)
         ============================================ */
      .note-keyword {
        color: #d32f2f;
        font-weight: 700;
        font-size: inherit;
        line-height: inherit;
      }

      /* ============================================
         SUBSENTENCE CONTENT
         ============================================ */
      .subsentence-content {
        padding-left: 48px;
        border-left: 3px solid #00BCA1;
      }

      /* ============================================
         BULLET LIST & SPECIAL TOOLS
         ============================================ */
      .bullet-list {
        margin: 0;
        padding-left: 20px;
      }

      .bullet-list li {
        margin-bottom: 4px;
      }

      .special-tools {
        display: inline;
        margin-left: 4px;
        font-size: 15px;
      }

      .tool-link {
        color: #00378c;
        text-decoration: underline;
        cursor: pointer;
        font-weight: 700;
        transition: color 0.2s ease;
      }

      .tool-link:hover {
        color: #0056b3;
      }

      /* ============================================
         IMAGE ROW
         ============================================ */
      .image-row {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e0e0e0;
      }

      .image-label {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 14px;
        font-weight: 600;
        color: #464653;
      }

      .icon-drawing {
        color: #00BCA1;
      }

      /* ============================================
         AFFICHAGE DES IMAGES
         ============================================ */
      .image-container {
        position: relative;
        display: inline-block;
        border-radius: 0;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        max-width: 100%;
        cursor: pointer;
      }

      .image-container:hover {
        transform: scale(1.02);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
      }

      .image-container--print {
        cursor: default !important;
        box-shadow: none;
      }

      .image-container--print:hover {
        transform: none !important;
      }

      .drawing-image {
        display: block;
        max-width: 600px;
        width: 100%;
        height: auto;
        border-radius: 0;
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

      .image-container:hover .zoom-overlay {
        opacity: 1;
      }

      .zoom-icon {
        color: #ffffff;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }

      /* ============================================
         RESPONSIVE
         ============================================ */
      @media (max-width: 768px) {
        .repairs-maintenance-container {
          padding: 0 8px;
        }

        .instruction-header {
          padding-left: 8px;
        }

        .adjustment-table {
          font-size: 14px;
        }

        .header-cell {
          padding: 14px 16px;
          font-size: 17px;
        }

        .content-cell {
          padding: 14px 16px;
        }

        .sentence-content {
          gap: 12px;
          flex-direction: column;
        }

        .line-number-square {
          min-width: 28px;
          height: 28px;
          padding: 5px 8px;
          font-size: 14px;
        }

        .sentence-text {
          font-size: 15px;
        }

        .header-title {
          font-size: 16px;
        }

        .subsentence-content {
          padding-left: 32px;
        }

        .drawing-image {
          max-width: 100%;
        }
      }

      /* ============================================
         PRINT MODE
         ============================================ */
      @media print {
        .repairs-maintenance-container {
          break-inside: avoid;
        }

        .adjustment-table {
          box-shadow: none;
          break-inside: avoid;
        }

        .zoom-overlay {
          display: none;
        }

        .image-container {
          cursor: default !important;
          box-shadow: none;
        }

        .image-container:hover {
          transform: none !important;
        }

        .tool-link {
          color: #464653;
          text-decoration: none;
        }

        .data-row:hover {
          background-color: inherit !important;
        }

        .line-number-square {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `
  }
}

// Enregistrer le Custom Element
customElements.define('repairs-maintenance', RepairsMaintenance)
export default RepairsMaintenance
