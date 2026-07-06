/**
 * RepairsDefault Web Component - VERSION CORRIGÉE
 * Composant autonome pour afficher les manuels de réparation automobile
 * ✅ CORRECTION: Ajout des setters pour instruction, operations, operationsDetails, etc.
 */

class RepairsDefault extends HTMLElement {
  constructor() {
    super()
    console.log('🏗️ RepairsDefault constructor')

    this.attachShadow({ mode: 'open' })

    // ✅ État interne (propriétés privées)
    this._instruction = null
    this._operations = null
    this._operationsDetails = null
    this._groupId = null
    this._isPrint = false
    this._haynesLang = ''

    // Constants
    this.GROUP_TYPE = {
      STANDALONE: 'STANDALONE',
      PARAGRAPH: 'PARAGRAPH',
      BULLET_LIST: 'BULLET_LIST'
    }

    this.HAYNES_DEFAULT_LANG = '2057'
  }

  static get observedAttributes() {
    return ['group-id', 'is-print', 'haynes-lang']
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return

    switch (name) {
      case 'group-id':
        this.groupId = newValue
        break
      case 'is-print':
        this.isPrint = newValue === 'true' || newValue === ''
        break
      case 'haynes-lang':
        this.haynesLang = newValue
        break
    }
  }

  // ✅ Getters et Setters avec propriétés privées
  get instruction() {
    return this._instruction
  }

  set instruction(value) {
    console.log('📝 SET instruction', typeof value)
    if (typeof value === 'string') {
      try {
        this._instruction = JSON.parse(value)
      } catch (e) {
        console.error('Error parsing instruction:', e)
        this._instruction = null
      }
    } else {
      this._instruction = value
    }
    this.render()
  }

  get groupId() {
    return this._groupId
  }

  set groupId(value) {
    this._groupId = typeof value === 'string' ? parseInt(value, 10) : value
    this.render()
  }

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    this._isPrint = typeof value === 'string' ? value === 'true' : !!value
    this.render()
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    this._haynesLang = value || ''
    this.render()
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

  get defaultLang() {
    return this.HAYNES_DEFAULT_LANG
  }

  get isMobile() {
    return window.innerWidth <= 600
  }

  // Lifecycle
  connectedCallback() {
    console.log('🔌 RepairsDefault connected', {
      instruction: this._instruction,
      items: this._instruction?.items?.length
    })
    this.render()
  }

  // Helper methods
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

  formatTextForNote(text, anchor) {
    let result = text || ''

    if (!text || !anchor) return result

    // Vérifier si "Note:" existe dans l'anchor (langue par défaut = anglais)
    if (anchor.indexOf('Note:') !== -1) {
      const endOfNote = result.indexOf(':')

      if (endOfNote !== -1) {
        const textToReplace = result.substring(0, endOfNote + 1)
        result = result.replace(
          textToReplace,
          `<span class="note-keyword">${textToReplace}</span>`
        )
      }
    }

    return result
  }

  isEmptyLine(item) {
    return (
      item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] === '' &&
      !item.drawing &&
      !item.table &&
      !item.remark
    )
  }

  // Grouper les items par group.description.map
  get groupedBlocks() {
    if (!this._instruction?.items) return []

    const blocks = []
    let currentBlock = null

    this._instruction.items.forEach((item) => {
      const groupKey = item.group?.description?.map?.[this.HAYNES_DEFAULT_LANG] || 'default'

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

  getLineNumber(block, itemIndex) {
    let counter = 0

    for (let i = 0; i <= itemIndex; i++) {
      const item = block.items[i]

      if (item.sentenceType === 'SENTENCE' && !this.isEmptyLine(item)) {
        counter++
      }
    }

    return counter
  }

  getTableClasses(blockIndex) {
    const totalBlocks = this.groupedBlocks.length
    const isFirst = blockIndex === 0
    const isLast = blockIndex === totalBlocks - 1

    const classes = ['adjustment-table']
    if (isFirst) classes.push('first-of-group')
    if (isLast) classes.push('last-of-group')
    if (!isFirst && !isLast) classes.push('middle-of-group')
    if (isFirst && isLast) classes.push('first-last')

    return classes.join(' ')
  }

  getRowClass(item, index) {
    if (this.isEmptyLine(item)) {
      return ''
    }
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  // Event handlers
  handleImageClick(imageUrl) {
    if (this._isPrint) return

    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: { src: imageUrl },
      bubbles: true,
      composed: true
    }))
  }

  // Icons SVG
  getIcon(name) {
    const icons = {
      'WRENCH': '<path fill="currentColor" d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />',
      'INFO': '<path fill="currentColor" d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />',
      'IMAGE': '<path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />',
      'MAGNIFY_PLUS': '<path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />'
    }
    return icons[name] || ''
  }

  // Render methods
  renderHeader() {
    if (!this._instruction?.description?.map) return ''

    return `
      <div class="instruction-header">
        <svg class="icon-wrench" viewBox="0 0 24 24" width="24" height="24">
          ${this.getIcon('WRENCH')}
        </svg>
        <span class="${this.isMobile ? 'body16-bold' : 'body20-bold'}">
          ${this.formatHaynesLang(this._instruction.description.map)}
        </span>
      </div>
    `
  }

  renderBlocks() {
    return this.groupedBlocks.map((block, blockIndex) => {
      return `
        <table class="${this.getTableClasses(blockIndex)}">
          <thead>
            <tr class="header-row">
              <th class="header-cell">
                ${this.formatHaynesLang(block.groupDescription)}
              </th>
            </tr>
          </thead>
          <tbody>
            ${block.items.map((item, itemIndex) => this.renderItem(block, item, itemIndex)).join('')}
          </tbody>
        </table>
      `
    }).join('')
  }

  renderItem(block, item, itemIndex) {
    if (this.isEmptyLine(item)) {
      return ''
    }

    const rowClass = this.getRowClass(item, itemIndex)

    return `
      <tr class="data-row ${rowClass}">
        <td class="content-cell">
          ${this.renderItemContent(block, item, itemIndex)}
        </td>
      </tr>
    `
  }

  renderItemContent(block, item, itemIndex) {
    let html = ''

    // HEADER (h6)
    if (item.sentenceType === 'HEADER' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG]) {
      html += `
        <h6 class="header-title">
          ${this.formatHaynesLang(item.sentence.description.map)}
        </h6>
      `
    }
    // REMARK (ligne spéciale)
    else if (item.remark && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG]) {
      const textInLang = item.sentence.description.map[this._haynesLang]
      const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

      const sentenceText = item.groupType === this.GROUP_TYPE.STANDALONE
        ? this.formatTextForNote(textInLang, textInDefault)
        : this.formatHaynesLang(item.sentence.description.map)

      html += `
        <div class="remark-line">
          <svg class="icon-info" viewBox="0 0 24 24" width="18" height="18">
            ${this.getIcon('INFO')}
          </svg>
          <span class="remark-text">${sentenceText}</span>
          <span class="sentence-text">${item.remark}</span>
        </div>
      `
    }
    // SENTENCE normale (avec numéro)
    else if (item.sentenceType === 'SENTENCE' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] && !item.remark) {
      const lineNumber = this.getLineNumber(block, itemIndex)

      let sentenceContent = ''
      const textInLang = item.sentence.description.map[this._haynesLang]
      const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

      if (item.groupType === this.GROUP_TYPE.STANDALONE) {
        sentenceContent = this.formatTextForNote(textInLang, textInDefault)
      } else if (item.groupType === this.GROUP_TYPE.PARAGRAPH) {
        sentenceContent = this.formatHaynesLang(item.sentence.description.map)
      } else if (item.groupType === this.GROUP_TYPE.BULLET_LIST) {
        sentenceContent = `<ul class="bullet-list"><li>${this.formatHaynesLang(item.sentence.description.map)}</li></ul>`
      } else {
        sentenceContent = this.formatHaynesLang(item.sentence.description.map)
      }

      html += `
        <div class="sentence-content">
          <div class="line-number-square">${lineNumber}</div>
          <span class="sentence-text">${sentenceContent}</span>
        </div>
      `

      // Special Tools
      if (item.specialTools && item.specialTools.length > 0) {
        html += '<span class="special-tools">('
        html += item.specialTools.map((tool, toolIndex) => {
          let toolHtml = ''
          if (tool.image) {
            toolHtml = `<span class="tool-link" data-action="open-tool-image" data-image-url="${this.formatUrl(tool.image.url)}">${tool.oeCode}</span>`
          } else {
            toolHtml = `<span>${tool.oeCode}</span>`
          }
          if (toolIndex < item.specialTools.length - 1) {
            toolHtml += ' '
          }
          return toolHtml
        }).join('')
        html += ')</span>'
      }
    }
    // SUBSENTENCE (pas de numéro)
    else if (item.sentenceType === 'SUBSENTENCE' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] && !item.remark) {
      const textInLang = item.sentence.description.map[this._haynesLang]
      const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

      const sentenceText = item.groupType === this.GROUP_TYPE.STANDALONE
        ? this.formatTextForNote(textInLang, textInDefault)
        : this.formatHaynesLang(item.sentence.description.map)

      html += `
        <div class="subsentence-content">
          <span class="sentence-text sentence-text--sub">${sentenceText}</span>
        </div>
      `
    }

    // Drawing/Image
    if (item.drawing?.url) {
      const imageUrl = this.formatUrl(item.drawing.url)
      html += `
        <div class="image-row">
          <div class="image-label">
            <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
              ${this.getIcon('IMAGE')}
            </svg>
            <span>Schéma :</span>
          </div>
          <div class="image-container ${this._isPrint ? 'image-container--print' : ''}" data-action="open-image" data-image-url="${imageUrl}">
            <img src="${imageUrl}" alt="Repair diagram" class="drawing-image" />
            ${!this._isPrint ? `
              <div class="zoom-overlay">
                <svg class="zoom-icon" viewBox="0 0 24 24" width="32" height="32">
                  ${this.getIcon('MAGNIFY_PLUS')}
                </svg>
              </div>
            ` : ''}
          </div>
        </div>
      `
    }

    // Table (placeholder)
    if (item.table?.cells?.length) {
      html += `
        <div class="table-container">
          <p><em>Table with ${item.table.cells.length} cells (composant TableWrapper non implémenté)</em></p>
        </div>
      `
    }

    return html
  }

  generateHTML() {
    if (!this._instruction || !this._instruction.items || this._instruction.items.length === 0) {
      return `
        <div class="debug-message">
          <strong>⚠️ Debug:</strong> Pas de données d'instruction à afficher<br>
          <small>Vérifier que la propriété 'instruction' contient des items</small>
        </div>
      `
    }

    return `
      <div class="repairs-default-container">
        ${this.renderHeader()}
        <div class="operations-list">
          ${this.renderBlocks()}
        </div>
      </div>
    `
  }

  // Event listeners
  attachEventListeners() {
    const shadow = this.shadowRoot

    // Images cliquables
    shadow.querySelectorAll('[data-action="open-image"]').forEach(container => {
      container.addEventListener('click', (e) => {
        const imageUrl = e.currentTarget.dataset.imageUrl
        this.handleImageClick(imageUrl)
      })
    })

    // Tool images
    shadow.querySelectorAll('[data-action="open-tool-image"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const imageUrl = e.currentTarget.dataset.imageUrl
        this.handleImageClick(imageUrl)
      })
    })
  }

  // Render
  render() {
    console.log('🎨 RepairsDefault render', {
      instruction: this._instruction !== null,
      groupedBlocks: this.groupedBlocks.length
    })

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
            font-family: monospace;
          }
        </style>
        <div class="error-message">
          <strong>❌ Erreur:</strong> ${error.message}<br>
          <pre>${error.stack}</pre>
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

        .repairs-default-container {
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 0 16px;
        }

        .instruction-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0 8px 16px;
          margin-bottom: 16px;
        }

        .icon-wrench { color: #464653; flex-shrink: 0; }

        .body16-bold { font-size: 16px; font-weight: 700; color: #464653; }
        .body20-bold { font-size: 20px; font-weight: 700; color: #464653; }

        .operations-list { display: flex; flex-direction: column; gap: 0; }

        /* Table - ANGLES DROITS */
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
        .adjustment-table.first-last { border-radius: 0 !important; margin-bottom: 24px; }

        .header-row { background: linear-gradient(135deg, var(--ipd-primary) 0%, #0047b3 100%); }

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

        .last-of-group tbody tr:last-child td { border-radius: 0 !important; }

        .data-row { transition: background-color 0.2s ease; }
        .data-row:hover { background-color: #f0f7ff !important; }

        .row-even { background-color: var(--ipd-white); }
        .row-odd { background-color: var(--ipd-light-gray); }

        .content-cell { padding: 18px 24px; vertical-align: middle; }

        /* HEADER (h6) */
        .header-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--ipd-primary);
          margin: 0;
          padding: 0;
          text-align: left;
          line-height: 1.4;
        }

        /* REMARK LINE */
        .remark-line {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 14px 20px;
          background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
          border-left: 4px solid var(--ipd-yellow);
          font-style: italic;
          margin: -18px -24px;
          padding: 18px 24px;
        }

        .icon-info { color: var(--ipd-yellow); flex-shrink: 0; margin-top: 2px; }

        .remark-text {
          font-size: 15px;
          font-weight: 600;
          color: #555;
          line-height: 1.5;
          margin-right: 8px;
        }

        /* Sentence content */
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

        .sentence-text {
          flex: 1;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.6;
          color: #1a1a1a;
        }

        .note-keyword {
          color: #d32f2f;
          font-weight: 700;
          font-size: inherit;
          line-height: inherit;
        }

        .subsentence-content {
          padding-left: 48px;
          border-left: 3px solid var(--ipd-turquoise);
        }

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

        .tool-link:hover { color: #0056b3; }

        /* Image row */
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

        .icon-drawing { color: var(--ipd-turquoise); }

        .image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
          cursor: pointer;
          border-radius: 0;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }

        .image-container:hover { transform: scale(1.02); }
        .image-container--print { cursor: default !important; }
        .image-container--print:hover { transform: none !important; }
        .image-container:hover .zoom-overlay { opacity: 1; }

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

        .zoom-icon {
          color: var(--ipd-white);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        .table-container {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--ipd-border);
          font-style: italic;
          color: #666;
        }

        .debug-message {
          padding: 20px;
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 0;
          color: #856404;
          font-family: monospace;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .repairs-default-container { padding: 0 8px; }
          .instruction-header { padding-left: 8px; }
          .adjustment-table { font-size: 14px; }
          .header-cell { padding: 14px 16px; font-size: 17px; }
          .content-cell { padding: 14px 16px; }
          .sentence-content { gap: 12px; flex-direction: column; }
          .line-number-square { min-width: 28px; height: 28px; padding: 5px 8px; font-size: 14px; }
          .sentence-text { font-size: 15px; }
          .header-title { font-size: 16px; }
          .subsentence-content { padding-left: 32px; }
          .remark-line { flex-direction: column; gap: 8px; margin: -14px -16px; padding: 14px 16px; }
          .drawing-image { max-width: 100%; }
        }

        /* Print */
        @media print {
          .repairs-default-container { break-inside: avoid; }
          .adjustment-table { box-shadow: none; break-inside: avoid; }
          .zoom-overlay { display: none; }
          .image-container { cursor: default !important; box-shadow: none; }
          .image-container:hover { transform: none !important; }
          .tool-link { color: #464653; text-decoration: none; }
          .data-row:hover { background-color: inherit !important; }
          .line-number-square {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .remark-line {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    `
  }
}

// Enregistrer le Web Component
if (!customElements.get('repairs-default')) {
  customElements.define('repairs-default', RepairsDefault)
  console.log('✅ Web Component "repairs-default" registered')
} else {
  console.log('ℹ️ Web Component "repairs-default" already registered')
}

export default RepairsDefault
