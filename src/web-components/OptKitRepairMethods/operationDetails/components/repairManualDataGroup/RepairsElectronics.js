
/**
 * Repairs-Electronics Web Component
 *
 * Web Component pour afficher les manuels de réparation Electronics
 * Basé sur Manual-Electronics.vue, transformé en Custom Element
 *
 * Usage:
 * <repairs-electronics instruction='{}' group-id="102000010" is-print="false"></repairs-electronics>
 *
 * Ou via JavaScript:
 * const el = document.createElement('repairs-electronics')
 * el.instruction = { ... }
 * el.groupId = 102000010
 * el.isPrint = false
 * document.body.appendChild(el)
 */

class RepairsElectronics extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // État interne
    this._instruction = null
    this._operations = null
    this._operationsDetails = null
    this._groupId = null
    this._isPrint = false
    this._haynesLang = ''
    this._isMobile = false
    this._tableStates = new Map() // État d'ouverture des tables

    // Bind des méthodes
    this.handleResize = this.handleResize.bind(this)
    this.handleImageClick = this.handleImageClick.bind(this)
    this.handleTableToggle = this.handleTableToggle.bind(this)
  }

  // Propriétés observées
  static get observedAttributes() {
    return ['instruction', 'group-id', 'is-print', 'haynes-lang']
  }

  // Getters/Setters
  get instruction() {
    return this._instruction
  }

  get operations() {
    return this._operations
  }

  set operations(value) {
    if (typeof value === 'string') {
      try {
        this._operations = JSON.parse(value)
      } catch (e) {
        this._operations = null
      }
    } else {
      this._operations = value
    }
    this.render()
  }

  get operationsDetails() {
    return this._operationsDetails
  }

  set operationsDetails(value) {
    if (typeof value === 'string') {
      try {
        this._operationsDetails = JSON.parse(value)
      } catch (e) {
        this._operationsDetails = null
      }
    } else {
      this._operationsDetails = value
    }
    this.render()
  }


  set instruction(value) {
    if (typeof value === 'string') {
      try {
        this._instruction = JSON.parse(value)
      } catch (e) {
        console.error('Invalid instruction JSON:', e)
        this._instruction = null
      }
    } else if (typeof value === 'object') {
      this._instruction = value
    }
    this.render()
  }

  get groupId() {
    return this._groupId
  }

  set groupId(value) {
    this._groupId = value
    this.render()
  }

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    this._isPrint = value === true || value === 'true'
    this.render()
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    this._haynesLang = value || ''
    this.render()
  }

  // Lifecycle
  connectedCallback() {
    this.checkMobile()
    window.addEventListener('resize', this.handleResize)
    this.render()
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    switch (name) {
      case 'instruction':
        this.instruction = newValue
        break
      case 'group-id':
        this.groupId = newValue
        break
      case 'is-print':
        this.isPrint = newValue
        break
      case 'haynes-lang':
        this.haynesLang = newValue
        break
    }
  }

  // Méthodes utilitaires
  checkMobile() {
    this._isMobile = window.innerWidth <= 600
  }

  handleResize() {
    this.checkMobile()
    this.render()
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

  formatTextForNote(text, fallback) {
    // Simplification : retourner le texte ou le fallback
    return text || fallback || ''
  }

  /**
   * Grouper les items par group.description.map
   */
  getGroupedBlocks() {
    if (!this._instruction?.items) return []

    const blocks = []
    let currentBlock = null
    const HAYNES_DEFAULT_LANG = '2057'

    this._instruction.items.forEach((item) => {
      const groupKey = item.group?.description?.map?.[HAYNES_DEFAULT_LANG] || 'default'

      // Nouveau groupe détecté
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
   * Vérifie si une ligne est vide
   */
  isEmptyLine(item) {
    const HAYNES_DEFAULT_LANG = '2057'
    return (
      item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG] === '' &&
      !item.drawing &&
      !item.table &&
      !item.remark
    )
  }

  /**
   * Obtenir le numéro de ligne dans un bloc
   */
  getLineNumber(block, itemIndex) {
    let counter = 0

    for (let i = 0; i <= itemIndex; i++) {
      const item = block.items[i]

      if (item.sentenceType === 'SENTENCE' && !this.isEmptyLine(item) && !item.remark) {
        counter++
      }
    }

    return counter
  }

  /**
   * Classes CSS pour la table
   */
  getTableClasses(blockIndex, totalBlocks) {
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
   * Classes CSS pour les lignes
   */
  getRowClass(item, index) {
    if (this.isEmptyLine(item)) return ''
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  /**
   * Toggle ouverture/fermeture d'une table
   */
  handleTableToggle(event) {
    const itemId = event.currentTarget.dataset.itemId
    const isOpen = this._tableStates.get(itemId) || false
    this._tableStates.set(itemId, !isOpen)
    this.render()
  }

  /**
   * Construire les données du tableau à partir des cellules
   */
  buildTableData(cells) {
    if (!cells || cells.length === 0) return []

    // Liste triée de toutes les lignes (y)
    const ys = [...new Set(cells.map(c => c.y))].sort((a, b) => a - b)

    // Liste triée de toutes les colonnes (x)
    const xs = [...new Set(cells.map(c => c.x))].sort((a, b) => a - b)

    // Pour chaque ligne y → construire un tableau des colonnes
    return ys.map(y => {
      return xs.map(x => {
        const cell = cells.find(c => c.x === x && c.y === y)
        return cell?.value ?? this.formatHaynesLang(cell?.sentence?.description?.map) ?? ''
      })
    })
  }

  /**
   * Gérer le clic sur une image
   */
  handleImageClick(event) {
    if (this._isPrint) return

    const imageUrl = event.currentTarget.dataset.imageUrl

    // Émettre un événement personnalisé
    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: {
        event: event,
        src: imageUrl
      },
      bubbles: true,
      composed: true
    }))
  }

  /**
   * Rendu d'une ligne SENTENCE avec numéro
   */
  renderSentence(item, block, itemIndex) {
    const lineNumber = this.getLineNumber(block, itemIndex)
    const HAYNES_DEFAULT_LANG = '2057'

    let sentenceText = ''
    if (item.groupType === 'STANDALONE') {
      sentenceText = this.formatTextForNote(
        item.sentence.description.map[this._haynesLang],
        item.sentence.description.map[HAYNES_DEFAULT_LANG]
      )
    } else if (item.groupType === 'PARAGRAPH') {
      sentenceText = this.formatHaynesLang(item.sentence.description.map)
    } else if (item.groupType === 'BULLET_LIST') {
      return `
        <div class="sentence-content">
          <div class="line-number-square">${lineNumber}</div>
          <ul class="bullet-list">
            <li>${this.formatHaynesLang(item.sentence.description.map)}</li>
          </ul>
        </div>
      `
    }

    let specialToolsHtml = ''
    if (item.specialTools && item.specialTools.length > 0) {
      const toolsContent = item.specialTools.map(tool => {
        if (tool.image) {
          return `<span class="tool-link" data-image-url="${tool.image.url}">${tool.oeCode || ''}</span>`
        }
        return `<span>${tool.oeCode || ''}</span>`
      }).join(' ')

      specialToolsHtml = `<span class="special-tools">( ${toolsContent} )</span>`
    }

    return `
      <div class="sentence-content">
        <div class="line-number-square">${lineNumber}</div>
        <div class="sentence-wrapper">
          <span class="sentence-text">${sentenceText}</span>
          ${specialToolsHtml}
        </div>
      </div>
    `
  }

  /**
   * Rendu d'une ligne HEADER
   */
  renderHeader(item) {
    return `<h6 class="header-title">${this.formatHaynesLang(item.sentence.description.map)}</h6>`
  }

  /**
   * Rendu d'une ligne REMARK
   */
  renderRemark(item) {
    const HAYNES_DEFAULT_LANG = '2057'

    let sentenceText = ''
    if (item.groupType === 'STANDALONE') {
      sentenceText = this.formatTextForNote(
        item.sentence.description.map[this._haynesLang],
        item.sentence.description.map[HAYNES_DEFAULT_LANG]
      )
    } else if (item.groupType === 'PARAGRAPH') {
      sentenceText = this.formatHaynesLang(item.sentence.description.map)
    }

    return `
      <div class="remark-line">
        <svg class="icon-info" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
        </svg>
        <span class="remark-text">${item.remark}</span>
        ${sentenceText ? `<span class="sentence-text">${sentenceText}</span>` : ''}
      </div>
    `
  }

  /**
   * Rendu d'une ligne SUBSENTENCE
   */
  renderSubsentence(item) {
    const HAYNES_DEFAULT_LANG = '2057'

    let sentenceText = ''
    if (item.groupType === 'STANDALONE') {
      sentenceText = this.formatTextForNote(
        item.sentence.description.map[this._haynesLang],
        item.sentence.description.map[HAYNES_DEFAULT_LANG]
      )
    } else if (item.groupType === 'PARAGRAPH') {
      sentenceText = this.formatHaynesLang(item.sentence.description.map)
    }

    return `
      <div class="subsentence-content">
        <span class="sentence-text sentence-text--sub">${sentenceText}</span>
      </div>
    `
  }

  /**
   * Rendu d'une image
   */
  renderDrawing(item) {
    if (!item.drawing?.url) return ''

    const imageUrl = this.formatUrl(item.drawing.url)

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
            <img src="${imageUrl}" alt="Repair diagram" class="drawing-image" />
          </div>
        </div>
      `
    }

    return `
      <div class="image-row">
        <div class="image-label">
          <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
          </svg>
          <span>Schéma :</span>
        </div>
        <div class="image-container" data-image-url="${item.drawing.url}">
          <img src="${imageUrl}" alt="Repair diagram" class="drawing-image" />
          <div class="zoom-overlay">
            <svg class="zoom-icon" viewBox="0 0 24 24" width="32" height="32">
              <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
            </svg>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Rendu d'une table (TableWrapper inline)
   */
  renderTable(item, itemId) {
    if (!item.table?.cells?.length) return ''

    const isOpen = this._tableStates.get(itemId) || false
    const tableData = this.buildTableData(item.table.cells)

    const tableRowsHtml = tableData.map((row, rowIndex) => {
      const rowClass = rowIndex % 2 === 0 ? 'table-row-even' : 'table-row-odd'
      const cellsHtml = row.map((cell, cellIndex) => {
        const cellClass = cellIndex === 0 ? 'table-cell-header' : 'table-cell-data'
        return `<td class="${cellClass}">${cell}</td>`
      }).join('')

      return `<tr class="${rowClass}">${cellsHtml}</tr>`
    }).join('')

    const tableContentHtml = isOpen ? `
      <div class="table-content">
        <div class="table-scroll">
          <table class="data-table">
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>
      </div>
    ` : ''

    return `
      <div class="table-wrapper">
        <button class="table-toggle-btn" data-item-id="${itemId}">
          <svg class="btn-icon" viewBox="0 0 24 24" width="20" height="20">
            ${isOpen
              ? '<path fill="currentColor" d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" />'
              : '<path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />'
            }
          </svg>
          <span class="btn-text">Voir plus</span>
        </button>
        ${tableContentHtml}
      </div>
    `
  }

  /**
   * Rendu d'un item
   */
  renderItem(item, block, itemIndex, itemId) {
    const HAYNES_DEFAULT_LANG = '2057'

    let contentHtml = ''

    // HEADER
    if (item.sentenceType === 'HEADER' && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      contentHtml += this.renderHeader(item)
    }
    // REMARK
    else if (item.remark && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG]) {
      contentHtml += this.renderRemark(item)
    }
    // SENTENCE
    else if (item.sentenceType === 'SENTENCE' && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG] && !item.remark) {
      contentHtml += this.renderSentence(item, block, itemIndex)
    }
    // SUBSENTENCE
    else if (item.sentenceType === 'SUBSENTENCE' && item.sentence?.description?.map?.[HAYNES_DEFAULT_LANG] && !item.remark) {
      contentHtml += this.renderSubsentence(item)
    }

    // Drawing
    contentHtml += this.renderDrawing(item)

    // Table
    contentHtml += this.renderTable(item, itemId)

    return contentHtml
  }

  /**
   * Rendu principal
   */
  render() {
    if (!this._instruction) {
      this.shadowRoot.innerHTML = '<div class="repairs-default-container"><p>Aucune donnée à afficher</p></div>'
      return
    }

    const groupedBlocks = this.getGroupedBlocks()

    // Header principal
    const headerHtml = `
      <div class="instruction-header">
        <svg class="icon-wrench" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
        </svg>
        <span class="${this._isMobile ? 'body16-bold' : 'body20-bold'}">
          ${this.formatHaynesLang(this._instruction.description.map)}
        </span>
      </div>
    `

    // Blocs groupés
    const blocksHtml = groupedBlocks.map((block, blockIndex) => {
      const tableClasses = this.getTableClasses(blockIndex, groupedBlocks.length)

      const rowsHtml = block.items.map((item, itemIndex) => {
        const rowClass = this.getRowClass(item, itemIndex)
        const itemId = `item-${blockIndex}-${itemIndex}`
        const contentHtml = this.renderItem(item, block, itemIndex, itemId)

        return `
          <tr class="data-row ${rowClass}">
            <td class="content-cell">${contentHtml}</td>
          </tr>
        `
      }).join('')

      return `
        <table class="${tableClasses}">
          <thead>
            <tr class="header-row">
              <th class="header-cell">
                ${this.formatHaynesLang(block.groupDescription)}
              </th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `
    }).join('')

    // HTML complet
    this.shadowRoot.innerHTML = `
      ${this.getStyles()}
      <div class="repairs-default-container">
        ${headerHtml}
        <div class="operations-list">
          ${blocksHtml}
        </div>
      </div>
    `

    // Attacher les événements après le rendu
    this.attachEventListeners()
  }

  /**
   * Attacher les event listeners
   */
  attachEventListeners() {
    // Images cliquables
    const imageContainers = this.shadowRoot.querySelectorAll('.image-container:not(.image-container--print)')
    imageContainers.forEach(container => {
      container.addEventListener('click', this.handleImageClick)
    })

    // Liens d'outils cliquables
    const toolLinks = this.shadowRoot.querySelectorAll('.tool-link')
    toolLinks.forEach(link => {
      link.addEventListener('click', this.handleImageClick)
    })

    // Boutons toggle des tables
    const tableButtons = this.shadowRoot.querySelectorAll('.table-toggle-btn')
    tableButtons.forEach(button => {
      button.addEventListener('click', this.handleTableToggle)
    })
  }

  /**
   * Styles CSS
   */
  getStyles() {
    return `
      <style>
        /* ============================================
           VARIABLES CSS - Couleurs IPD
           ============================================ */
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

        /* ============================================
           CONTAINER PRINCIPAL
           ============================================ */
        .repairs-default-container {
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
          background: var(--ipd-white);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          position: relative;
          margin-bottom: 24px;
          border-radius: 0 !important;
        }

        .adjustment-table.first-of-group {
          border-radius: 0 !important;
        }

        .adjustment-table.middle-of-group {
          border-radius: 0 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          margin-top: 0;
        }

        .adjustment-table.last-of-group {
          border-radius: 0 !important;
          margin-bottom: 24px;
        }

        .adjustment-table.first-last {
          border-radius: 0 !important;
          margin-bottom: 24px;
        }

        /* En-tête de table */
        .header-row {
          background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%);
        }

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
          background-color: var(--ipd-white);
        }

        .row-odd {
          background-color: var(--ipd-light-gray);
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
          color: var(--ipd-primary);
          margin: 0;
          padding: 0;
          text-align: left;
          line-height: 1.4;
        }

        /* ============================================
           REMARK LINE
           ============================================ */
        .remark-line {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 20px;
          background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
          border-left: 4px solid var(--ipd-yellow);
          font-style: italic;
          margin: -18px -24px;
          padding: 18px 24px;
        }

        .icon-info {
          color: var(--ipd-yellow);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .remark-text {
          font-size: 15px;
          font-weight: 700;
          color: #555;
          line-height: 1.5;
          margin-right: 8px;
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
          background: var(--ipd-primary);
          color: var(--ipd-white);
          font-size: 15px;
          font-weight: 700;
          border-radius: 0;
          margin-top: 2px;
        }

        .sentence-wrapper {
          flex: 1;
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
           SUBSENTENCE CONTENT
           ============================================ */
        .subsentence-content {
          padding-left: 48px;
          border-left: 3px solid var(--ipd-turquoise);
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
          color: var(--ipd-primary);
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
          border-top: 1px solid var(--ipd-border);
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
          color: var(--ipd-turquoise);
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
          color: var(--ipd-white);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        /* ============================================
           TABLE WRAPPER (TableWrapper inline)
           ============================================ */
        .table-wrapper {
          width: 100%;
          margin-top: 16px;
          border: 1px solid var(--ipd-border);
          border-radius: 0;
          background: var(--ipd-white);
          overflow: hidden;
        }

        .table-toggle-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          padding: 14px 20px;
          background: linear-gradient(135deg, var(--ipd-orange) 0%, #d45500 100%);
          border: none;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .table-toggle-btn:hover {
          background: linear-gradient(135deg, #d45500 0%, var(--ipd-orange) 100%);
        }

        .btn-icon {
          color: var(--ipd-white);
          flex-shrink: 0;
        }

        .btn-text {
          text-align: left;
          font-size: 16px;
          font-weight: 700;
          color: var(--ipd-white);
        }

        .table-content {
          padding: 0;
          background: var(--ipd-white);
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 2000px;
          }
        }

        .table-scroll {
          overflow-x: auto;
          padding: 16px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
        }

        .data-table tbody tr {
          transition: background-color 0.2s ease;
        }

        .data-table tbody tr:hover {
          background-color: #f0f7ff !important;
        }

        .table-row-even {
          background-color: var(--ipd-white);
        }

        .table-row-odd {
          background-color: var(--ipd-light-gray);
        }

        .data-table td {
          padding: 12px 16px;
          border: 1px solid var(--ipd-border);
          font-size: 14px;
          line-height: 1.5;
          vertical-align: middle;
        }

        .table-cell-header {
          font-weight: 700;
          color: var(--ipd-primary);
          background: linear-gradient(90deg, #e3f2fd 0%, transparent 100%);
          min-width: 150px;
        }

        .table-cell-data {
          color: #1a1a1a;
        }

        /* ============================================
           RESPONSIVE
           ============================================ */
        @media (max-width: 768px) {
          .repairs-default-container {
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

          .remark-line {
            flex-direction: column;
            gap: 8px;
            margin: -14px -16px;
            padding: 14px 16px;
          }

          .drawing-image {
            max-width: 100%;
          }

          .table-toggle-btn {
            padding: 12px 16px;
          }

          .btn-text {
            font-size: 14px;
          }

          .table-scroll {
            padding: 12px;
          }

          .data-table td {
            padding: 10px 12px;
            font-size: 13px;
          }

          .table-cell-header {
            min-width: 120px;
          }
        }

        /* ============================================
           PRINT MODE
           ============================================ */
        @media print {
          .repairs-default-container {
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

          .table-wrapper {
            border: none;
            box-shadow: none;
            break-inside: avoid;
          }

          .table-toggle-btn {
            display: none;
          }

          .table-content {
            display: block !important;
            animation: none;
          }

          .data-table tbody tr:hover {
            background-color: inherit !important;
          }

          .table-cell-header {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    `
  }
}

// Enregistrer le Custom Element
customElements.define('repairs-electronics', RepairsElectronics)

// Export pour utilisation en module
export default RepairsElectronics
