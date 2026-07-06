/**
 * Repairs-Engine Web Component
 *
 * Custom Element JavaScript pur pour l'affichage des manuels Engine
 * Supporte deux modes automatiques :
 * - MODE IDENTIFICATION : Layout 2 colonnes pour groupId [319000215-219]
 * - MODE ENGINE : Layout standard pour tous les autres groupId
 *
 * Usage:
 * <repairs-engine id="repairs"></repairs-engine>
 *
 * const el = document.getElementById('repairs')
 * el.instruction = { ... }
 * el.groupId = 319000215
 * el.haynesLang = '1036'
 * el.isPrint = false
 *
 * el.addEventListener('show-schematics', (e) => {
 *   console.log(e.detail.src)
 * })
 */

class RepairsEngine extends HTMLElement {
  constructor() {
    super()

    // Attacher Shadow DOM
    this.attachShadow({ mode: 'open' })

    // État interne
    this._instruction = null
    this._groupId = null
    this._isPrint = false
    this._haynesLang = ''
    this._isMobile = false
    this._displayIdentificationMethods = false
    this._imageItem = []

    // IDs pour le mode identification
    this._identificationIds = [319000215, 319000216, 319000217, 319000218, 319000219]

    // Constantes
    this.HAYNES_DEFAULT_LANG = '2057'
    this.GROUP_TYPE = {
      STANDALONE: 'STANDALONE',
      PARAGRAPH: 'PARAGRAPH',
      BULLET_LIST: 'BULLET_LIST'
    }

    // Bind methods
    this._checkMobile = this._checkMobile.bind(this)
    this._handleImageClick = this._handleImageClick.bind(this)
  }

  // ========================================
  // Propriétés observées
  // ========================================
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

  // ========================================
  // Getters / Setters
  // ========================================
  get instruction() {
    return this._instruction
  }

  set instruction(value) {
    if (typeof value === 'string') {
      try {
        this._instruction = JSON.parse(value)
      } catch (e) {
        console.error('Invalid JSON for instruction:', e)
        this._instruction = null
      }
    } else {
      this._instruction = value
    }

    // Vérifier le mode identification après avoir défini instruction
    if (this._groupId !== null) {
      this._checkIfIdentificationMethods()
    }

    this._render()
  }

  get groupId() {
    return this._groupId
  }

  set groupId(value) {
    this._groupId = typeof value === 'string' ? parseInt(value, 10) : value

    // Ne vérifier que si instruction existe déjà
    if (this._instruction) {
      this._checkIfIdentificationMethods()
    }

    this._render()
  }

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    this._isPrint = typeof value === 'string' ? value === 'true' : !!value
    this._render()
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    this._haynesLang = value || ''
    this._render()
  }

  // ========================================
  // Lifecycle
  // ========================================
  connectedCallback() {
    this._checkMobile()
    window.addEventListener('resize', this._checkMobile)
    this._render()
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this._checkMobile)
  }

  // ========================================
  // Methods privées
  // ========================================
  _checkMobile() {
    this._isMobile = window.innerWidth <= 600
    this._render()
  }

  _checkIfIdentificationMethods() {
    this._displayIdentificationMethods = this._identificationIds.includes(this._groupId)

    if (this._displayIdentificationMethods && this._instruction?.items) {
      this._imageItem = this._instruction.items.filter(item => item.drawing)
    } else {
      this._imageItem = []
    }
  }

  _formatUrl(url) {
    if (!url) return ''
    return url.replace('http://', '//')
  }

  _trimRemark(remark) {
    if (!remark) return ''
    return remark.replace(/[[\]{}.]/g, '')
  }

  /**
   * Format text for note - Coloration rouge ET GRAS des mots-clés NOTE
   */
  /**
   * Format text for note - Version intelligente
   * Détecte "Note:" dans l'anchor (anglais) et met en rouge tout avant ":" dans le texte traduit
   * @param {string} text - Texte dans la langue utilisateur
   * @param {string} anchor - Texte dans la langue par défaut (anglais)
   * @returns {string} Texte formaté avec <span class="note-keyword">
   */
  _formatTextForNote(text, anchor) {
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

  /**
   * Format Haynes Lang - Coloration rouge ET GRAS des mots-clés NOTE
   * Version intelligente : détecte "Note:" dans l'anglais, colorie dans la langue traduite
   */
  _formatHaynesLang(map) {
    if (!map || typeof map !== 'object') return ''

    const isFilled = (v) => typeof v === 'string' && v.trim() !== ''
    let text = ''
    // 1. Override explicite, 2. langue non-anglaise du map (= langue du request header), 3. EN
    if (this._haynesLang && isFilled(map[this._haynesLang])) {
      text = map[this._haynesLang]
    } else {
      text = Object.keys(map).map(k => k !== '2057' && isFilled(map[k]) ? map[k] : '').find(Boolean)
        || (isFilled(map['2057']) ? map['2057'] : '')
    }
    const anchor = map[this.HAYNES_DEFAULT_LANG] || '' // Texte anglais

    if (!text || typeof text !== 'string') return ''

    // Vérifier si "Note:" existe dans l'anchor (langue par défaut = anglais)
    if (anchor.indexOf('Note:') !== -1) {
      const endOfNote = text.indexOf(':')

      if (endOfNote !== -1) {
        const textToReplace = text.substring(0, endOfNote + 1)
        text = text.replace(
          textToReplace,
          `<span class="note-keyword">${textToReplace}</span>`
        )
      }
    }

    return text
  }

  _isEmptyLine(item) {
    return (
      item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] === '' &&
      !item.drawing &&
      !item.table &&
      !item.remark
    )
  }

  _getLineNumber(block, itemIndex) {
    let counter = 0

    for (let i = 0; i <= itemIndex; i++) {
      const item = block.items[i]

      if (item.sentenceType === 'SENTENCE' && !this._isEmptyLine(item)) {
        counter++
      }
    }

    return counter
  }

  _getGroupedBlocks() {
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

  _getRowClass(item, index) {
    if (this._isEmptyLine(item)) return ''
    return index % 2 === 0 ? 'row-even' : 'row-odd'
  }

  _handleImageClick(event, imageUrl) {
    if (this._isPrint) return

    event.preventDefault()
    event.stopPropagation()

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

  // ========================================
  // Rendu MODE IDENTIFICATION
  // ========================================
  _renderIdentificationMode() {
    if (!this._instruction) return ''

    const title = this._formatHaynesLang(this._instruction.description.map)
    const titleClass = this._isMobile ? 'body16-bold' : 'body20-bold'

    return `
      <div class="identification-mode">
        <!-- Header principal -->
        <div class="instruction-header">
          <svg class="icon-wrench" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
          </svg>
          <span class="${titleClass}">${title}</span>
        </div>

        <!-- Layout deux colonnes -->
        <div class="identification-content">
          <!-- LÉGENDE : Table IPDA à gauche -->
          <div class="identification-legend">
            ${this._renderLegendTable()}
          </div>

          <!-- IMAGE à droite -->
          <div class="identification-image">
            ${this._renderIdentificationImages()}
          </div>
        </div>
      </div>
    `
  }

  _renderLegendTable() {
    if (!this._instruction?.items) return ''

    const rows = this._instruction.items.map((item, index) => {
      const rowClass = index % 2 === 0 ? 'legend-row-even' : 'legend-row-odd'
      const description = this._formatHaynesLang(item.sentence.description.map)
      const code = this._trimRemark(item.remark)

      return `
        <tr class="legend-data-row ${rowClass}">
          <td class="legend-cell legend-description">${description}</td>
          <td class="legend-cell legend-code">${code}</td>
        </tr>
      `
    }).join('')

    return `
      <table class="legend-table">
        <thead>
          <tr class="legend-header-row">
            <th class="legend-header-cell legend-header-description">Description</th>
            <th class="legend-header-cell legend-header-code">Code</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
  }

  _renderIdentificationImages() {
    if (!this._imageItem || this._imageItem.length === 0) return ''

    return this._imageItem.map(image => {
      const imageUrl = this._formatUrl(image.drawing.url)

      if (this._isPrint) {
        return `
          <div class="image-wrapper">
            <div class="image-label">
              <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
              </svg>
              <span>Schéma d'identification :</span>
            </div>
            <div class="image-container image-container--print">
              <img src="${imageUrl}" alt="Identification diagram" class="drawing-image" />
            </div>
          </div>
        `
      } else {
        return `
          <div class="image-wrapper">
            <div class="image-label">
              <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
              </svg>
              <span>Schéma d'identification :</span>
            </div>
            <div class="image-container image-container--identification" data-image-url="${imageUrl}">
              <img src="${imageUrl}" alt="Identification diagram" class="drawing-image" />
              <div class="zoom-overlay">
                <svg class="zoom-icon" viewBox="0 0 24 24" width="32" height="32">
                  <path fill="currentColor" d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
                </svg>
              </div>
            </div>
          </div>
        `
      }
    }).join('')
  }

  // ========================================
  // Rendu MODE ENGINE
  // ========================================
  _renderEngineMode() {
    if (!this._instruction) return ''

    const title = this._formatHaynesLang(this._instruction.description.map)
    const titleClass = this._isMobile ? 'body16-bold' : 'body20-bold'
    const blocks = this._getGroupedBlocks()

    return `
      <div>
        <!-- Header principal -->
        <div class="instruction-header">
          <svg class="icon-wrench" viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
          </svg>
          <span class="${titleClass}">${title}</span>
        </div>

        <!-- Blocs groupés (tables) -->
        <div class="operations-list">
          ${blocks.map((block, blockIndex) => this._renderBlock(block, blockIndex, blocks.length)).join('')}
        </div>
      </div>
    `
  }

  _renderBlock(block, blockIndex, totalBlocks) {
    const tableClasses = this._getTableClasses(blockIndex, totalBlocks)
    const headerText = this._formatHaynesLang(block.groupDescription)

    return `
      <table class="${tableClasses}">
        <thead>
          <tr class="header-row">
            <th class="header-cell">${headerText}</th>
          </tr>
        </thead>
        <tbody>
          ${block.items.map((item, itemIndex) => this._renderItem(item, itemIndex, block)).join('')}
        </tbody>
      </table>
    `
  }

  _renderItem(item, itemIndex, block) {
    const rowClass = this._getRowClass(item, itemIndex)

    return `
      <tr class="data-row ${rowClass}">
        <td class="content-cell">
          ${this._renderItemContent(item, itemIndex, block)}
        </td>
      </tr>
    `
  }

  _renderItemContent(item, itemIndex, block) {
    let html = ''

    // HEADER (h6)
    if (item.sentenceType === 'HEADER' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG]) {
      html += `<h6 class="header-title">${this._formatHaynesLang(item.sentence.description.map)}</h6>`
    }
    // REMARK
    else if (item.remark && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG]) {
      html += this._renderRemark(item)
    }
    // SENTENCE normale
    else if (item.sentenceType === 'SENTENCE' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] && !item.remark) {
      html += this._renderSentence(item, itemIndex, block)
    }
    // SUBSENTENCE
    else if (item.sentenceType === 'SUBSENTENCE' && item.sentence?.description?.map?.[this.HAYNES_DEFAULT_LANG] && !item.remark) {
      html += this._renderSubsentence(item)
    }

    // Drawing/Image
    if (item.drawing?.url) {
      html += this._renderDrawing(item)
    }

    return html
  }

  _renderRemark(item) {
    const currentLang = this._haynesLang || this.HAYNES_DEFAULT_LANG
    const textInLang = item.sentence.description.map[currentLang]
    const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

    let sentenceText = ''

    if (item.groupType === this.GROUP_TYPE.STANDALONE) {
      sentenceText = this._formatTextForNote(textInLang, textInDefault)
    } else if (item.groupType === this.GROUP_TYPE.PARAGRAPH) {
      sentenceText = this._formatHaynesLang(item.sentence.description.map)
    }

    return `
      <div class="remark-line">
        <svg class="icon-info" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
        </svg>
        <span class="remark-text">${item.remark}</span>
        <span class="sentence-text">${sentenceText}</span>
      </div>
    `
  }

  _renderSentence(item, itemIndex, block) {
    const lineNumber = this._getLineNumber(block, itemIndex)
    const currentLang = this._haynesLang || this.HAYNES_DEFAULT_LANG
    const textInLang = item.sentence.description.map[currentLang]
    const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

    let sentenceText = ''

    if (item.groupType === this.GROUP_TYPE.STANDALONE) {
      sentenceText = this._formatTextForNote(textInLang, textInDefault)
    } else if (item.groupType === this.GROUP_TYPE.PARAGRAPH) {
      sentenceText = this._formatHaynesLang(item.sentence.description.map)
    } else if (item.groupType === this.GROUP_TYPE.BULLET_LIST) {
      sentenceText = `<ul class="bullet-list"><li>${this._formatHaynesLang(item.sentence.description.map)}</li></ul>`
    }

    const specialTools = this._renderSpecialTools(item)

    return `
      <div class="sentence-content">
        <div class="line-number-square">${lineNumber}</div>
        <div class="sentence-wrapper">
          <span class="sentence-text">${sentenceText}</span>
          ${specialTools}
        </div>
      </div>
    `
  }

  _renderSubsentence(item) {
    const currentLang = this._haynesLang || this.HAYNES_DEFAULT_LANG
    const textInLang = item.sentence.description.map[currentLang]
    const textInDefault = item.sentence.description.map[this.HAYNES_DEFAULT_LANG]

    let sentenceText = ''

    if (item.groupType === this.GROUP_TYPE.STANDALONE) {
      sentenceText = this._formatTextForNote(textInLang, textInDefault)
    } else if (item.groupType === this.GROUP_TYPE.PARAGRAPH) {
      sentenceText = this._formatHaynesLang(item.sentence.description.map)
    }

    return `
      <div class="subsentence-content">
        <span class="sentence-text sentence-text--sub">${sentenceText}</span>
      </div>
    `
  }

  _renderSpecialTools(item) {
    if (!item.specialTools || item.specialTools.length === 0) return ''

    const tools = item.specialTools.map((tool, index) => {
      const separator = index < item.specialTools.length - 1 ? ' ' : ''

      if (tool.image) {
        return `<span class="tool-link" data-tool-url="${tool.image.url}">${tool.oeCode}</span>${separator}`
      } else {
        return `<span>${tool.oeCode}</span>${separator}`
      }
    }).join('')

    return `<span class="special-tools">(${tools})</span>`
  }

  _renderDrawing(item) {
    const imageUrl = this._formatUrl(item.drawing.url)

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
    } else {
      return `
        <div class="image-row">
          <div class="image-label">
            <svg class="icon-drawing" viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
            </svg>
            <span>Schéma :</span>
          </div>
          <div class="image-container" data-image-url="${imageUrl}">
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
  }

  // ========================================
  // Rendu principal
  // ========================================
  _render() {
    if (!this._instruction) {
      this.shadowRoot.innerHTML = `<style>${this._getStyles()}</style><div class="repairs-engine-container"></div>`
      return
    }

    const content = this._displayIdentificationMethods
      ? this._renderIdentificationMode()
      : this._renderEngineMode()

    this.shadowRoot.innerHTML = `
      <style>${this._getStyles()}</style>
      <div class="repairs-engine-container">
        ${content}
      </div>
    `

    // Attacher les event listeners pour les images
    this._attachImageListeners()
  }

  _attachImageListeners() {
    const imageContainers = this.shadowRoot.querySelectorAll('.image-container[data-image-url]')
    const toolLinks = this.shadowRoot.querySelectorAll('.tool-link[data-tool-url]')

    imageContainers.forEach(container => {
      container.addEventListener('click', (e) => {
        const imageUrl = container.getAttribute('data-image-url')
        this._handleImageClick(e, imageUrl)
      })
    })

    toolLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const toolUrl = link.getAttribute('data-tool-url')
        this._handleImageClick(e, toolUrl)
      })
    })
  }

  // ========================================
  // Styles CSS
  // ========================================
  _getStyles() {
    return `
      /* ============================================
         CONTAINER PRINCIPAL
         ============================================ */
      .repairs-engine-container {
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 0 16px;
      }

      /* ============================================
         MODE IDENTIFICATION
         ============================================ */
      .identification-mode {
        width: 100%;
      }

      .identification-content {
        display: flex;
        gap: 32px;
        align-items: flex-start;
        margin-top: 16px;
      }

      /* ============================================
         LÉGENDE : Table IPDA (gauche)
         ============================================ */
      .identification-legend {
        flex: 1;
        min-width: 0;
      }

      .legend-table {
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        border-radius: 0 !important;
      }

      .legend-header-row {
        background: linear-gradient(135deg, #00378c 0%, #0047b3 100%);
      }

      .legend-header-cell {
        padding: 16px 20px;
        text-align: left;
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: 0.3px;
        border-bottom: 3px solid #00BCA1;
        border-radius: 0 !important;
      }

      .legend-header-description {
        width: 70%;
      }

      .legend-header-code {
        width: 30%;
        text-align: center;
      }

      .legend-data-row {
        transition: background-color 0.2s ease;
        border-bottom: 1px solid #e0e0e0;
      }

      .legend-data-row:last-child {
        border-bottom: none;
      }

      .legend-data-row:hover {
        background-color: #f0f7ff !important;
      }

      .legend-row-even {
        background-color: #ffffff;
      }

      .legend-row-odd {
        background-color: #f5f5f5;
      }

      .legend-cell {
        padding: 14px 20px;
        vertical-align: middle;
      }

      .legend-description {
        font-size: 15px;
        font-weight: 600;
        color: #1a1a1a;
        line-height: 1.5;
      }

      .legend-code {
        font-size: 16px;
        font-weight: 700;
        color: #00378c;
        text-align: center;
        font-family: 'Courier New', monospace;
        background: linear-gradient(90deg, #e3f2fd 0%, transparent 100%);
      }

      /* ============================================
         IMAGE (droite)
         ============================================ */
      .identification-image {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .image-wrapper {
        width: 100%;
      }

      .image-container--identification {
        max-width: 100%;
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
         REMARK LINE
         ============================================ */
      .remark-line {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 20px;
        background: linear-gradient(90deg, #fff9e6 0%, transparent 100%);
        border-left: 4px solid #FFC200;
        font-style: italic;
        margin: -18px -24px;
        padding: 18px 24px;
      }

      .icon-info {
        color: #FFC200;
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
        background: #00378c;
        color: #ffffff;
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
        .repairs-engine-container {
          padding: 0 8px;
        }

        .identification-content {
          flex-direction: column;
          gap: 24px;
        }

        .legend-header-cell {
          padding: 12px 16px;
          font-size: 14px;
        }

        .legend-cell {
          padding: 12px 16px;
        }

        .legend-description {
          font-size: 14px;
        }

        .legend-code {
          font-size: 15px;
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
      }

      /* ============================================
         PRINT MODE
         ============================================ */
      @media print {
        .repairs-engine-container {
          break-inside: avoid;
        }

        .legend-table {
          box-shadow: none;
          break-inside: avoid;
        }

        .legend-header-row {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .legend-code {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
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

        .legend-data-row:hover {
          background-color: inherit !important;
        }

        .line-number-square {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .remark-line {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `
  }
}

// Enregistrer le Custom Element
customElements.define('repairs-engine', RepairsEngine)
export default RepairsEngine
