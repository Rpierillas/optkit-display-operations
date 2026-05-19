/**
 * schematics-modal — Modale d'affichage d'image (schéma / dessin technique)
 * Converti depuis SchematicsModal.vue (sans Vuetify)
 *
 * Props (propriétés JS) :
 *   schema     Object  — { imgUrl: string }
 *   showSchema Boolean — affiche ou masque la modale
 *
 * Events émis :
 *   close — quand la modale est fermée
 */
class SchematicsModal extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this._schema = { imgUrl: null }
    this._showSchema = false
    this._handleKeyDown = this._handleKeyDown.bind(this)
  }

  set schema(v) { this._schema = v || { imgUrl: null }; this._render() }
  get schema() { return this._schema }

  set showSchema(v) {
    this._showSchema = !!v
    if (v) document.addEventListener('keydown', this._handleKeyDown)
    else document.removeEventListener('keydown', this._handleKeyDown)
    this._render()
  }
  get showSchema() { return this._showSchema }

  connectedCallback() { this._render() }
  disconnectedCallback() { document.removeEventListener('keydown', this._handleKeyDown) }

  _handleKeyDown(e) {
    if (e.key === 'Escape') this._close()
  }

  _close() {
    this._showSchema = false
    document.removeEventListener('keydown', this._handleKeyDown)
    this._render()
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
  }

  _getStyles() {
    return `
      <style>
        :host { --ipd-primary: #00378c; --ipd-white: #ffffff; }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-container {
          background: var(--ipd-white);
          border-radius: 12px;
          max-width: 80vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 12px 16px;
          background: var(--ipd-primary);
        }

        .btn-close {
          background: rgba(255,255,255,0.2);
          border: 2px solid var(--ipd-white);
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          color: var(--ipd-white);
        }
        .btn-close:hover { background: var(--ipd-white); color: var(--ipd-primary); }

        .modal-body {
          flex: 1;
          overflow: auto;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f5f5;
        }

        .modal-image {
          max-width: 100%;
          max-height: calc(90vh - 80px);
          width: auto;
          height: auto;
          display: block;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        @media (max-width: 768px) {
          .modal-container { max-width: 95vw; }
          .modal-body { padding: 12px; }
        }

        @media print {
          .modal-overlay { display: none; }
        }
      </style>
    `
  }

  _render() {
    if (!this._showSchema || !this._schema?.imgUrl) {
      this.shadowRoot.innerHTML = this._getStyles()
      return
    }

    this.shadowRoot.innerHTML = `
      ${this._getStyles()}
      <div class="modal-overlay" id="overlay">
        <div class="modal-container">
          <div class="modal-header">
            <button class="btn-close" id="btn-close" title="Fermer">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <img class="modal-image" src="${this._schema.imgUrl}" alt="Schéma technique" />
          </div>
        </div>
      </div>
    `

    this.shadowRoot.getElementById('btn-close')?.addEventListener('click', () => this._close())
    this.shadowRoot.getElementById('overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this._close()
    })
  }
}

if (!customElements.get('schematics-modal')) {
  customElements.define('schematics-modal', SchematicsModal)
}
export default SchematicsModal
