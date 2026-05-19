/**
 * Repairs-DataGroup Web Component
 * Orchestrateur pour afficher les différents types de manuels de réparation
 *
 * @element repairs-data-group
 *
 * @fires {CustomEvent} show-schematics - Émis quand un schéma doit être affiché
 *
 * @example
 * const repairsGroup = document.createElement('repairs-data-group');
 * repairsGroup.group = 'ENGINE';
 * repairsGroup.instruction = { ... };
 * repairsGroup.addEventListener('show-schematics', (e) => {
 *   console.log('Show schematic:', e.detail);
 * });
 * document.body.appendChild(repairsGroup);
 */

// Imports des Web Components enfants
import './repairManualDataGroup/RepairsElectronics.js'
import './repairManualDataGroup/RepairsEngine.js'
import './repairManualDataGroup/RepairsMaintenance.js'
import './repairManualDataGroup/RepairsDefault.js'

// Enum GROUP_TYPE
const GROUP_TYPE = {
  ELECTRONICS: 'ELECTRONICS',
  ENGINE: 'ENGINE',
  MAINTENANCE: 'MAINTENANCE',
  OTHERS: 'OTHERS'
};

class RepairsDataGroup extends HTMLElement {
  static get observedAttributes() {
    return ['group-id', 'group', 'is-print', 'type', 'index', 'haynes-lang'];
  }

  constructor() {
    super();

    this.attachShadow({ mode: 'open' });

    // Propriétés privées
    this._groupId = null;
    this._group = '';
    this._isPrint = false;
    this._type = null;
    this._operationsDetails = {};
    this._operations = {};
    this._instruction = {};
    this._item = {};
    this._index = 0;
    this._useWebComponent = true;
    this._haynesLang = '2057';
    this._isOpened = null;

    // Refs des composants enfants
    this._childRefs = {
      default: null,
      electronics: null,
      engine: null,
      maintenance: null
    };

    // Binding des méthodes
    this._handleShowSchematics = this._handleShowSchematics.bind(this);
    this._updateChildComponents = this._updateChildComponents.bind(this);
  }

  // ============ GETTERS / SETTERS ============

  get groupId() {
    return this._groupId;
  }

  set groupId(value) {
    if (this._groupId !== value) {
      this._groupId = value;
      this._updateChildComponents();
    }
  }

  get group() {
    return this._group;
  }

  set group(value) {
    if (this._group !== value) {
      const oldValue = this._group;
      this._group = value;

      if (oldValue && this.isConnected) {
        this._render();
      }
      this._updateChildComponents();
    }
  }

  get isPrint() {
    return this._isPrint;
  }

  set isPrint(value) {
    const boolValue = value === true || value === 'true';
    if (this._isPrint !== boolValue) {
      this._isPrint = boolValue;
      this._updateChildComponents();
    }
  }

  get type() {
    return this._type;
  }

  set type(value) {
    if (this._type !== value) {
      this._type = value;
      this._updateChildComponents();
    }
  }

  get operationsDetails() {
    return this._operationsDetails;
  }

  set operationsDetails(value) {
    this._operationsDetails = value || {};
    this._updateChildComponents();
  }

  get operations() {
    return this._operations;
  }

  set operations(value) {
    this._operations = value || {};

    if (this._operations.repairManuals?.length === 1) {
      this._isOpened = 0;
    }

    this._updateChildComponents();
  }

  get instruction() {
    return this._instruction;
  }

  set instruction(value) {
    this._instruction = value || {};
    this._updateChildComponents();
  }

  get item() {
    return this._item;
  }

  set item(value) {
    this._item = value || {};
    this._updateChildComponents();
  }

  get index() {
    return this._index;
  }

  set index(value) {
    const numValue = parseInt(value, 10);
    if (this._index !== numValue) {
      this._index = numValue;
      this._updateChildComponents();
    }
  }

  get useWebComponent() {
    return this._useWebComponent;
  }

  set useWebComponent(value) {
    const boolValue = value === true || value === 'true';
    if (this._useWebComponent !== boolValue) {
      this._useWebComponent = boolValue;
    }
  }

  get haynesLang() {
    return this._haynesLang;
  }

  set haynesLang(value) {
    if (this._haynesLang !== value) {
      this._haynesLang = value || '2057';
      this._updateChildComponents();
    }
  }

  // ============ LIFECYCLE METHODS ============

  connectedCallback() {
    this._render();

    requestAnimationFrame(() => {
      this._attachEventListeners();
      this._updateChildComponents();
    });
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'group-id':
        this.groupId = newValue;
        break;
      case 'group':
        this.group = newValue;
        break;
      case 'is-print':
        this.isPrint = newValue === 'true';
        break;
      case 'type':
        this.type = newValue;
        break;
      case 'index':
        this.index = parseInt(newValue, 10);
        break;
      case 'haynes-lang':
        this.haynesLang = newValue;
        break;
    }
  }

  // ============ PRIVATE METHODS ============

  /**
   * Render le template HTML dans le shadow DOM
   */
  _render() {
    const styles = this._getStyles();
    const template = this._getTemplate();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${template}
    `;
  }

  /**
   * Retourne les styles CSS
   */
  _getStyles() {
    return `
      :host {
        display: block;
        width: 100%;
      }

      .repairs-container {
        margin: 0;
        padding: 0;
        width: 100%;
      }

      .repairs-col {
        margin: 0;
        padding: 0;
        width: 100%;
      }

      /* Responsive padding */
      @media (min-width: 600px) {
        .repairs-container {
          padding-left: 16px;
          padding-right: 16px;
        }
      }

      @media (max-width: 599px) {
        .repairs-container {
          padding-left: 8px;
          padding-right: 8px;
        }
      }

      /* Styles pour les composants enfants */
      repairs-electronics,
      repairs-engine,
      repairs-maintenance,
      repairs-default {
        display: block;
        width: 100%;
      }
    `;
  }

  /**
   * Retourne le template HTML selon le groupe
   */
  _getTemplate() {
    const componentId = `picto-${this._index}`;
    const childComponentName = this._getChildComponentName();
    const childComponent = `<${childComponentName} id="${componentId}"></${childComponentName}>`;

    return `
      <div class="repairs-container">
        <div class="repairs-col">
          ${childComponent}
        </div>
      </div>
    `;
  }

  /**
   * Détermine le nom du composant enfant basé sur le groupe
   */
  _getChildComponentName() {
    switch (this._group) {
      case GROUP_TYPE.ELECTRONICS:
        return 'repairs-electronics';
      case GROUP_TYPE.ENGINE:
        return 'repairs-engine';
      case GROUP_TYPE.MAINTENANCE:
        return 'repairs-maintenance';
      default:
        return 'repairs-default';
    }
  }

  /**
   * Attache les event listeners sur les composants enfants
   */
  _attachEventListeners() {
    const childTypes = ['electronics', 'engine', 'maintenance', 'default'];

    childTypes.forEach(type => {
      const element = this.shadowRoot.querySelector(`repairs-${type}`);
      if (element) {
        this._childRefs[type] = element;
        element.addEventListener('show-schematics', this._handleShowSchematics);
      }
    });
  }

  /**
   * Détache les event listeners
   */
  _detachEventListeners() {
    Object.values(this._childRefs).forEach(ref => {
      if (ref) {
        ref.removeEventListener('show-schematics', this._handleShowSchematics);
      }
    });
  }

  /**
   * Gère l'événement show-schematics des composants enfants
   */
  _handleShowSchematics(event) {
    if (this._isPrint) return;

    const dataSource = event.detail;
    const data = {
      event: dataSource?.event || dataSource,
      src: dataSource?.src || null
    };

    this.dispatchEvent(new CustomEvent('show-schematics', {
      detail: data,
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Met à jour les propriétés des composants enfants
   */
  _updateChildComponents() {
    if (!Object.values(this._childRefs).some(ref => ref)) {
      return;
    }

    Object.entries(this._childRefs).forEach(([type, element]) => {
      if (element) {
        this._updateChildComponent(element, type);
      }
    });
  }

  /**
   * Met à jour un composant enfant spécifique
   */
  _updateChildComponent(element, type) {
    if (!element) return;

    element.instruction = this._instruction;
    element.groupId = this._groupId;
    element.isPrint = this._isPrint;
    element.haynesLang = this._haynesLang;

    if (type === 'default') {
      element.operations = this._operations;
      element.operationsDetails = this._operationsDetails;
    }
  }

  /**
   * Force une mise à jour complète
   */
  forceUpdate() {
    this._render()

    requestAnimationFrame(() => {
      this._attachEventListeners()
      this._updateChildComponents()
    });
  }
}

// Enregistrer le Web Component
if (!customElements.get('repairs-data-group')) {
  customElements.define('repairs-data-group', RepairsDataGroup);
}

export default RepairsDataGroup;
export { GROUP_TYPE };
