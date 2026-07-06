/**
 * AdjustmentDataGroup Web Component
 * Composant wrapper qui gère l'affichage conditionnel de adjustment-steering ou adjustment-default
 * Compatible avec tous les frameworks (Vue, React, Angular, vanilla JS)
 */

// Import des Web Components enfants
import './adjustmentDataGroup/Adjustement-DefaultWC.js'
import './adjustmentDataGroup/Adjustement-SteeringWC.js'

class AdjustmentDataGroup extends HTMLElement {
  constructor() {
    super()
    console.log('🏗️ AdjustmentDataGroup constructor')

    this.attachShadow({ mode: 'open' })

    // Constantes
    this.GROUP_TYPE = {
      STEERING: 'STEERING_SUSPENSION',
      DEFAULT: 'DEFAULT'
    }
    this.HAYNES_DEFAULT_LANG = '2057'

    // Propriétés internes
    this._title = ''
    this._group = ''
    this._operations = {}
    this._isPrint = false
    this._adjustmentItem = {}
    this._componentIndex = 0
    this._component = {}
    this._adjustmentIndex = 0
    this._haynesLang = ''

    // Refs vers les Web Components enfants
    this.steeringComponentRef = null
    this.defaultComponentRef = null

    // Flag pour savoir si on a déjà fait le premier render
    this._isInitialized = false
  }

  static get observedAttributes() {
    return [
      'title',
      'group',
      'adjustment-index',
      'component-index',
      'haynes-lang',
      'is-print'
    ]
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get title() {
    return this._title
  }

  set title(value) {
    this._title = value || ''
  }

  set group(value) {
    console.log('📝 AdjustmentDataGroup - group set:', value)
    console.log('  - type:', typeof value)
    console.log('  - stringified:', JSON.stringify(value))

    const oldValue = this._group
    this._group = value || ''

    // Si le groupe change, on doit re-render
    if (this.isConnected && oldValue !== this._group) {
      console.log('🔄 Group changed, re-rendering...')
      this.render()
    }
  }

   get group() {
    return this._group
  }

  get operations() {
    return this._operations
  }

  set operations(value) {
    console.log('📝 AdjustmentDataGroup - operations set:', value)
    this._operations = value || {}
    if (this.isConnected && this._isInitialized) {
      this.updateChildComponents()
    }
  }

  get isPrint() {
    return this._isPrint
  }

  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    this._isPrint = boolValue
    if (this.isConnected && this._isInitialized) {
      this.updateChildComponents()
    }
  }

  get adjustmentItem() {
    return this._adjustmentItem
  }

  set adjustmentItem(value) {
    console.log('📝 AdjustmentDataGroup - adjustmentItem set:', value)
    console.log('  - has sentence:', !!value?.sentence)
    this._adjustmentItem = value || {}

    // Si on a des données valides et qu'on est connecté, initialiser
    if (this.isConnected && this._adjustmentItem?.sentence) {
      if (!this._isInitialized) {
        console.log('🎬 First render with valid data')
        this.render()
      } else {
        this.updateChildComponents()
      }
    }
  }

  get componentIndex() {
    return this._componentIndex
  }

  set componentIndex(value) {
    const numValue = parseInt(value, 10)
    this._componentIndex = numValue
    if (this.isConnected && this._isInitialized) {
      this.updateChildComponents()
    }
  }

  get component() {
    return this._component
  }

  set component(value) {
    console.log('📝 AdjustmentDataGroup - component set:', value)
    console.log('  - component.group:', value?.group)
    console.log('  - component.group.mainGroups:', value?.group?.mainGroups)

    this._component = value || {}

    // Si on a des données valides et qu'on est connecté, initialiser
    if (this.isConnected && this._component && Object.keys(this._component).length > 0) {
      if (!this._isInitialized && this._adjustmentItem?.sentence) {
        console.log('🎬 First render with valid data (from component)')
        this.render()
      } else if (this._isInitialized) {
        this.updateChildComponents()
      }
    }
  }

  get adjustmentIndex() {
    return this._adjustmentIndex
  }

  set adjustmentIndex(value) {
    const numValue = parseInt(value, 10)
    this._adjustmentIndex = numValue
    if (this.isConnected && this._isInitialized) {
      this.updateChildComponents()
    }
  }

  get haynesLang() {
    return this._haynesLang
  }

  set haynesLang(value) {
    this._haynesLang = value || ''
    if (this.isConnected && this._isInitialized) {
      this.updateChildComponents()
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Détermine si le groupe est de type STEERING
   * Gère différents formats de données (string, objet, etc.)
   */
  isSteering() {
    console.log('🔍 isSteering check:')
    console.log('  - _group:', this._group)
    console.log('  - _component.group:', this._component?.group)

    // Cas 1 : group est directement la string 'STEERING'
    if (this._group === this.GROUP_TYPE.STEERING) {
      console.log('  ✅ Match: group === "STEERING"')
      return true
    }

    // Cas 2 : group est un tableau contenant 'STEERING'
    if (Array.isArray(this._group) && this._group.includes('STEERING')) {
      console.log('  ✅ Match: group array includes "STEERING"')
      return true
    }

    // Cas 3 : group est le premier élément d'un tableau
    if (Array.isArray(this._group) && this._group[0] === this.GROUP_TYPE.STEERING) {
      console.log('  ✅ Match: group[0] === "STEERING"')
      return true
    }

    // Cas 4 : vérifier dans component.group.mainGroups
    if (this._component?.group?.mainGroups) {
      const mainGroups = this._component.group.mainGroups
      console.log('  - component.group.mainGroups:', mainGroups)

      if (Array.isArray(mainGroups) && mainGroups.includes('STEERING')) {
        console.log('  ✅ Match: mainGroups includes "STEERING"')
        return true
      }

      if (Array.isArray(mainGroups) && mainGroups[0] === this.GROUP_TYPE.STEERING) {
        console.log('  ✅ Match: mainGroups[0] === "STEERING"')
        return true
      }
    }

    // Cas 5 : vérifier si _group est un objet avec une propriété qui contient 'STEERING'
    if (typeof this._group === 'object' && this._group !== null) {
      const groupStr = JSON.stringify(this._group).toUpperCase()
      if (groupStr.includes('STEERING')) {
        console.log('  ✅ Match: group object contains "STEERING"')
        return true
      }
    }

    console.log('  ❌ No match: defaulting to DEFAULT')
    return false
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    console.log('🔌 AdjustmentDataGroup connected')
    console.log('  - group:', this._group)
    console.log('  - adjustmentItem:', this._adjustmentItem)
    console.log('  - component:', this._component)
    console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

    // Rendre uniquement si on a des données valides
    if (this._adjustmentItem?.sentence && this._component && Object.keys(this._component).length > 0) {
      console.log('✅ Valid data found, rendering...')
      this.render()
    } else {
      console.log('⏳ Attente des données avant le premier render')
      console.log('  - adjustmentItem.sentence exists:', !!this._adjustmentItem?.sentence)
      console.log('  - component exists:', !!this._component && Object.keys(this._component).length > 0)
    }
  }

  disconnectedCallback() {
    console.log('🔌 AdjustmentDataGroup disconnected')
    this.detachEventListeners()
    this._isInitialized = false
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'title':
          this.title = newValue
          break
        case 'group':
          this.group = newValue
          break
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

  // ============================================
  // METHODS
  // ============================================

  /**
   * Met à jour les Web Components enfants avec les nouvelles propriétés
   */
  updateChildComponents() {
    console.log('🔄 Updating child components...')
    console.log('  - steeringComponentRef exists:', !!this.steeringComponentRef)
    console.log('  - defaultComponentRef exists:', !!this.defaultComponentRef)

    const isSteeringType = this.isSteering()

    // Mise à jour du composant Steering
    if (isSteeringType && this.steeringComponentRef) {
      console.log('📝 Updating Steering component...')
      console.log('  - adjustmentItem:', this._adjustmentItem)
      console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

      this.steeringComponentRef.adjustmentItem = this._adjustmentItem
      this.steeringComponentRef.component = this._component
      this.steeringComponentRef.operations = this._operations
      this.steeringComponentRef.adjustmentIndex = this._adjustmentIndex
      this.steeringComponentRef.componentIndex = this._componentIndex
      this.steeringComponentRef.haynesLang = this._haynesLang
      this.steeringComponentRef.isPrint = this._isPrint
      console.log('✅ Steering component updated')
    }

    // Mise à jour du composant Default
    if (!isSteeringType && this.defaultComponentRef) {
      console.log('📝 Updating Default component...')
      console.log('  - adjustmentItem:', this._adjustmentItem)
      console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

      this.defaultComponentRef.adjustmentItem = this._adjustmentItem
      this.defaultComponentRef.component = this._component
      this.defaultComponentRef.operations = this._operations
      this.defaultComponentRef.adjustmentIndex = this._adjustmentIndex
      this.defaultComponentRef.componentIndex = this._componentIndex
      this.defaultComponentRef.haynesLang = this._haynesLang
      this.defaultComponentRef.isPrint = this._isPrint
      this.defaultComponentRef.group = this._component?.group?.mainGroups?.[0] || ''
      console.log('✅ Default component updated')
    }
  }

  /**
   * Gestion des événements des Web Components enfants
   */
  handleOpenImage(event) {
    console.log('🖼️ Image opened from child component:', event.detail)

    // Propager l'événement au parent
    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: {
        e: event,
        src: event.detail?.imageUrl || ''
      },
      bubbles: true,
      composed: true
    }))
  }

  handleOpenManual(event) {
    console.log('📖 Manual opened from child component:', event.detail)

    // Propager l'événement au parent
    this.dispatchEvent(new CustomEvent('open-manual', {
      detail: event.detail,
      bubbles: true,
      composed: true
    }))
  }

  handleShowSchematics(event) {
    console.log('🗺️ Schematics requested from child component:', event.detail)

    // Propager l'événement au parent
    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: event.detail,
      bubbles: true,
      composed: true
    }))
  }

  /**
   * Attache les écouteurs d'événements aux Web Components enfants
   */
  attachEventListeners() {
    console.log('🎧 Attaching event listeners...')
    const shadow = this.shadowRoot

    // Détacher les anciens listeners si nécessaire
    this.detachEventListeners()

    // Écouteurs pour le composant Steering
    this.steeringComponentRef = shadow.querySelector('adjustment-steering')
    if (this.steeringComponentRef) {
      this.steeringComponentRef.addEventListener('open-image', this.handleOpenImage.bind(this))
      this.steeringComponentRef.addEventListener('open-manual', this.handleOpenManual.bind(this))
      console.log('✅ Event listeners attached to Steering component')
    }

    // Écouteurs pour le composant Default
    this.defaultComponentRef = shadow.querySelector('adjustment-default')
    if (this.defaultComponentRef) {
      this.defaultComponentRef.addEventListener('open-image', this.handleOpenImage.bind(this))
      this.defaultComponentRef.addEventListener('open-manual', this.handleOpenManual.bind(this))
      this.defaultComponentRef.addEventListener('show-schematics', this.handleShowSchematics.bind(this))
      console.log('✅ Event listeners attached to Default component')
    }

    // Mettre à jour les composants enfants avec les données actuelles
    console.log('📦 Sending initial data to child components...')
    this.updateChildComponents()
  }

  /**
   * Détache les écouteurs d'événements
   */
  detachEventListeners() {
    if (this.steeringComponentRef) {
      this.steeringComponentRef.removeEventListener('open-image', this.handleOpenImage)
      this.steeringComponentRef.removeEventListener('open-manual', this.handleOpenManual)
    }

    if (this.defaultComponentRef) {
      this.defaultComponentRef.removeEventListener('open-image', this.handleOpenImage)
      this.defaultComponentRef.removeEventListener('open-manual', this.handleOpenManual)
      this.defaultComponentRef.removeEventListener('show-schematics', this.handleShowSchematics)
    }
  }

  // ============================================
  // RENDER
  // ============================================

  render() {
    console.log('🎨 AdjustmentDataGroup render')
    console.log('  - group:', this._group)
    console.log('  - component.group:', this._component?.group)
    console.log('  - adjustmentItem:', this._adjustmentItem)
    console.log('  - has sentence:', !!this._adjustmentItem?.sentence)

    // Ne pas rendre si on n'a pas de données valides
    if (!this._adjustmentItem?.sentence) {
      console.log('⚠️ No valid data to render yet')
      this.shadowRoot.innerHTML = `
        ${this.getStyles()}
        <div class="adjustment-data-group">
          <div class="loading-message">
            ⏳ Chargement des données d'ajustement...
          </div>
        </div>
      `
      return
    }

    try {
      const html = this.generateHTML()
      const css = this.getStyles()
      this.shadowRoot.innerHTML = css + html

      console.log('✅ HTML rendered, waiting for DOM...')

      // Marquer comme initialisé
      this._isInitialized = true

      // Attacher les event listeners après le render
      // Utiliser un micro-task pour être sûr que le DOM est prêt
      Promise.resolve().then(() => {
        console.log('🔗 DOM ready, attaching listeners...')
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
          <strong>❌ Erreur de rendu:</strong><br>
          ${error.message}<br>
          <small>${error.stack}</small>
        </div>
      `
    }
  }

  generateHTML() {
    const isSteeringType = this.isSteering()

    console.log('📝 Generating HTML...')
    console.log('  - isSteeringType:', isSteeringType)

    return `
      <div class="adjustment-data-group">
        <div class="row-container">
          ${isSteeringType ? `
            <!-- STEERING COMPONENT -->
            <div class="col-container">
              <adjustment-steering></adjustment-steering>
            </div>
          ` : `
            <!-- DEFAULT COMPONENT -->
            <div class="col-container">
              <adjustment-default></adjustment-default>
            </div>
          `}
        </div>
      </div>
    `
  }

  getStyles() {
    return `
      <style>
        /* ============================================
           VARIABLES CSS - CHARTE IPD
           ============================================ */
        :host {
          /* Couleurs principales IPD */
          --ipd-primary: #00378c;
          --ipd-white: #ffffff;
          --ipd-grey: #777574;
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
          margin: 0;
          padding: 0;
        }

        /* ============================================
           CONTAINER PRINCIPAL
           ============================================ */
        .adjustment-data-group {
          width: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        /* ============================================
           MESSAGE DE CHARGEMENT
           ============================================ */
        .loading-message {
          padding: 40px 20px;
          text-align: center;
          color: var(--ipd-grey);
          font-size: 16px;
          background: var(--ipd-light-gray);
          border-radius: 8px;
          margin: 20px;
          border: 1px dashed var(--ipd-border);
        }

        /* ============================================
           ROW CONTAINER (équivalent v-row)
           ============================================ */
        .row-container {
          display: flex;
          flex-wrap: wrap;
          margin: 0;
          padding: 0;
        }

        /* ============================================
           COLUMN CONTAINER (équivalent v-col)
           ============================================ */
        .col-container {
          width: 100%;
          margin: 0;
          padding: 0;
        }

        /* ============================================
           WEB COMPONENTS ENFANTS
           ============================================ */
        adjustment-steering,
        adjustment-default {
          display: block;
          width: 100%;

          /* Transmettre les variables CSS IPD aux Web Components enfants */
          --ipd-primary: #00378c;
          --ipd-white: #ffffff;
          --ipd-grey: #777574;
          --ipd-turquoise: #00BCA1;
          --ipd-yellow: #FFC200;
          --ipd-green: #1AB729;
          --ipd-orange: #F26101;
          --ipd-dark-green: #006B6A;
          --ipd-light-gray: #f5f5f5;
          --ipd-border: #e0e0e0;
        }

        /* ============================================
           RESPONSIVE - PETITS ÉCRANS
           ============================================ */
        @media (max-width: 959px) {
          .row-container {
            padding: 0 8px;
          }
        }

        /* ============================================
           RESPONSIVE - GRANDS ÉCRANS
           ============================================ */
        @media (min-width: 960px) {
          .row-container {
            padding: 0 20px;
          }
        }

        /* ============================================
           MODE IMPRESSION
           ============================================ */
        @media print {
          .adjustment-data-group {
            page-break-inside: avoid;
          }

          .row-container {
            padding: 0;
          }

          .loading-message {
            display: none;
          }
        }
      </style>
    `
  }
}

// Enregistrer le Web Component
if (!customElements.get('adjustment-data-group')) {
  customElements.define('adjustment-data-group', AdjustmentDataGroup)
  console.log('✅ Web Component "adjustment-data-group" registered')
} else {
  console.log('ℹ️ Web Component "adjustment-data-group" already registered')
}

export default AdjustmentDataGroup
