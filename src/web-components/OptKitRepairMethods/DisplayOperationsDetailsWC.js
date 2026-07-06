/**
 * DisplayOperationsDetails Web Component
 * Composant principal d'affichage des détails d'opérations
 */

// ============================================
// CONFIGURATION
// ============================================

/**
 * Seuil de bascule entre affichage en grille de cards et en dropdown
 * pour le sélecteur d'opérations. ≤ N → cards, > N → dropdown.
 */
const OPERATIONS_CARDS_THRESHOLD = 6

/**
 * Whitelist des group.id de technicalCriteria autorisés dans le sélecteur de
 * configuration véhicule. Les autres axes sont masqués de l'UI.
 *
 * Pour identifier le groupId d'un axe : regarder le log de diagnostic au render,
 * la liste `axesLabels` affiche tous les axes détectés sous la forme "groupId:label".
 * Récupérer le groupId et l'ajouter ici.
 *
 * Si vide ([]) : tous les axes sont affichés (mode passthrough).
 */
const CONFIG_AXES_WHITELIST = [
  301000024, // Type de suspension
  301000007, // Type de carrosserie
  302000015, // Code d'équipement (485 / 677 / 482 / P84…)
]

/**
 * Si true, les axes masqués (hors whitelist) sont quand même utilisés pour
 * filtrer la data en background (en prenant la première valeur trouvée comme
 * sélection implicite). Si false, ils sont complètement ignorés.
 */
const HIDDEN_AXES_STILL_FILTER = false

class DisplayOperationsDetails extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // Propriétés internes
    this._operationsDetails = []
    this._isPrint = false
    this._loading = false

    // État
    this._itemsPanelOpen = []
    this._childrensPanelOpen = []
    this._formattedItemsLocationSystems = []
    this._formattedChildrenLocationSystems = []

    // Sélecteur de configuration véhicule
    this._availableAxes = []          // [{ groupId, label, options: [{ descriptionId, label }] }]
    this._selectedConfig = {}         // { [groupId]: descriptionId }
    this._configLabels = {}           // { [groupId]: { axisLabel, valueLabel } } — pour affichage dans les méthodes
    this._haynesLang = ''             // '' = auto : affiche la langue renvoyée par l'API (clé non-2057), sinon EN. ID explicite pour forcer.
    this._activeOperationIndex = 0    // index de l'opération active dans la liste unifiée
    this._activeItemKey = null        // clé composite "opIdx-itemIdx" de l'item actif

    // Refs des Web Components enfants
    this._itemRefs = new Map()
    this._childrenRefs = new Map()

    // Cache tri des enfants
    this._sortedChildrenCache = new Map()

    // Composants déjà chargés
    this._loadedComponents = new Set()

    // Flag DOM prêt
    this._domReady = false

    // Modale fusibles/relais (location-schematics-uc), montée sur document.body
    // pour survivre aux re-renders complets du shadowRoot
    this._locationUC = null

    // Infos véhicule optionnelles (en-tête d'impression de la modale fusibles/relais)
    this._vehicle = null

    // L'événement show-location-uc bubbles (composed) depuis <location-systems>
    // via <methods-details> → on l'intercepte une seule fois au niveau du shadowRoot
    this.shadowRoot.addEventListener('show-location-uc', (e) => {
      this._openLocationUC(e.detail)
    })
  }

  static get observedAttributes() {
    return ['is-print', 'loading', 'haynes-lang']
  }

  // ============================================
  // GETTERS / SETTERS
  // ============================================

  get vehicle() { return this._vehicle }
  set vehicle(value) {
    this._vehicle = value || null
    // Propage à la modale si déjà ouverte
    if (this._locationUC) this._locationUC.vehicle = this._vehicle
  }

  get haynesLang() { return this._haynesLang }
  set haynesLang(value) {
    const next = value || ''
    if (this._haynesLang === next) return
    this._haynesLang = next
    // Les labels des axes/options dépendent de la langue → recalcul sans perdre la sélection
    if (this.isConnected && this._operationsDetails?.length) {
      const od = this._operationsDetails[0]
      this._availableAxes = this._computeAvailableAxes(od)
      this._configLabels = {}
      this._availableAxes.forEach((axis) => {
        const selId = this._selectedConfig[axis.groupId]
        const opt = axis.options.find(o => String(o.descriptionId) === String(selId)) || axis.options[0]
        this._configLabels[axis.groupId] = {
          axisLabel: axis.label,
          valueLabel: opt.label,
          valueLabelEn: opt.labelEn || '',
        }
      })
      this._domReady = false
      this._render()
    }
  }

  get operationsDetails() { return this._operationsDetails }
  set operationsDetails(value) {
    const normalized = this._normalize(value)
    this._operationsDetails = normalized
    this._sortedChildrenCache.clear()
    if (this.isConnected) {
      const od = normalized[0]
      if (od) {
        this._sortItemLocationSystems(od)
        this._sortChildrenLocationSystems(od)
        this._initConfigState(od)
        this._openFirst(od)
      }
      this._domReady = false
      this._render()
    }
  }

  /**
   * Initialise le sélecteur de configuration : calcule les axes discriminants
   * disponibles dans la data, et pré-sélectionne la première valeur de chaque axe.
   * Choisit aussi l'opération active initiale (première non vide) et l'item actif.
   */
  _initConfigState(operationDetails) {
    this._availableAxes = this._computeAvailableAxes(operationDetails)
    this._selectedConfig = {}
    this._availableAxes.forEach((axis) => {
      this._selectedConfig[axis.groupId] = axis.options[0].descriptionId
    })

    // Calcul des labels lisibles pour l'affichage dans les méthodes
    this._configLabels = {}
    this._availableAxes.forEach((axis) => {
      this._configLabels[axis.groupId] = {
        axisLabel: axis.label,
        valueLabel: axis.options[0].label,
        valueLabelEn: axis.options[0].labelEn || '',
      }
    })

    // Trouve la première opération non vide
    const operations = this._collectOperations(operationDetails)
    let activeOpIdx = 0
    let activeKey = null
    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      if (operations[opIdx].items.length > 0) {
        activeOpIdx = opIdx
        activeKey = this._itemKey(opIdx, 0)
        break
      }
    }
    this._activeOperationIndex = activeOpIdx
    this._activeItemKey = activeKey
  }

  /**
   * Normalise l'entrée en Array<operationDetails> quelle que soit la shape reçue.
   *
   * Selon l'endpoint, la même donnée (ex : UC) peut arriver sous deux formes :
   *  • Enveloppe objet  → { items: [...], childrenOperations: [...] }
   *  • Array d'items    → [{ code, properties, components, ... }, ...]
   *
   * On accepte aussi un array d'operationDetails complets si jamais l'app
   * hôte en passe plusieurs :
   *  • [{ items: [...], childrenOperations: [...] }, ...]
   *
   * Heuristique : si le 1er élément du tableau possède déjà `items` ou
   * `childrenOperations`, on considère que c'est un operationDetails ;
   * sinon on wrappe tout le tableau dans un operationDetails synthétique.
   */
  _normalize(value) {
    if (value == null) return []

    // Objet seul (non-array) → on le wrap dans un array
    if (!Array.isArray(value)) {
      return typeof value === 'object' ? [value] : []
    }

    if (value.length === 0) return []

    const first = value[0]
    const looksLikeOperationDetails =
      first && typeof first === 'object' &&
      ('items' in first || 'childrenOperations' in first)

    return looksLikeOperationDetails
      ? value
      : [{ items: value, childrenOperations: [] }]
  }

  get isPrint() { return this._isPrint }
  set isPrint(value) {
    const boolValue = value === true || value === 'true'
    this._isPrint = boolValue
    if (this.isConnected) {
      // La structure change entre mode chips et mode panels → full re-render
      this._domReady = false
      this._render()
    }
  }

  get loading() { return this._loading }
  set loading(value) {
    this._loading = value === true || value === 'true'
    if (this.isConnected) {
      this._domReady = false
      this._render()
    }
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    if (this._operationsDetails.length > 0) {
      const od = this._operationsDetails[0]
      if (od && this._availableAxes.length === 0) {
        // La data a été settée avant connectedCallback → on n'a pas encore calculé les axes
        this._sortItemLocationSystems(od)
        this._sortChildrenLocationSystems(od)
        this._initConfigState(od)
        this._openFirst(od)
      }
      this._render()
    }
  }

  disconnectedCallback() {
    this._itemRefs.clear()
    this._childrenRefs.clear()
    this._domReady = false
    if (this._dropdownOutsideHandler) {
      document.removeEventListener('click', this._dropdownOutsideHandler)
      this._dropdownOutsideHandler = null
    }
    if (this._locationUC) {
      this._locationUC.remove()
      this._locationUC = null
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    switch (name) {
      case 'is-print': this.isPrint = newValue === 'true'; break
      case 'loading': this.loading = newValue === 'true'; break
      case 'haynes-lang': this.haynesLang = newValue; break
    }
  }

  // ============================================
  // LAZY LOADING
  // ============================================

  async _loadMethodsDetails() {
    if (this._loadedComponents.has('methods-details')) return
    await import('./operationDetails/MethodsDetailsWC.js')
    await customElements.whenDefined('methods-details')
    this._loadedComponents.add('methods-details')
  }

  async _loadLocationUC() {
    if (this._loadedComponents.has('location-schematics-uc')) return
    await import('./common/LocationSchematicsUCWC.js')
    await customElements.whenDefined('location-schematics-uc')
    this._loadedComponents.add('location-schematics-uc')
  }

  /**
   * Ouvre la modale fusibles/relais suite au clic sur un item de <location-systems>.
   * detail = { item, locationId } — item est l'entrée locationSystems complète
   * (description, components[], systemDrawing, locationDrawing, locationId).
   */
  async _openLocationUC(detail) {
    const item = detail?.item
    if (!item) return

    await this._loadLocationUC()

    if (!this._locationUC || !this._locationUC.isConnected) {
      this._locationUC = document.createElement('location-schematics-uc')
      this._locationUC.addEventListener('close', () => {
        if (this._locationUC) this._locationUC.open = false
      })
      document.body.appendChild(this._locationUC)
    }

    this._locationUC.haynesLang = this._haynesLang
    this._locationUC.vehicle = this._vehicle || null
    this._locationUC.component = item
    this._locationUC.open = true
  }

  // ============================================
  // LOCATION SYSTEMS
  // ============================================

  _buildLocationSystemsData(item, locationGroupItems = [], type = 'locationSystems') {
    const withDrawing = []
    const withoutDrawing = []

    for (const ls of item[type]) {
      if (!ls.locationDrawing) withoutDrawing.push(ls)
      else withDrawing.push(ls)
    }

    const sorted = withDrawing.sort((a, b) => a.locationDrawing.id - b.locationDrawing.id)

    if (withoutDrawing.length > 0) {
      locationGroupItems.push({ locationDrawingId: null, locationImg: null, items: [...withoutDrawing], subItems: [] })
    }

    sorted.forEach((item) => {
      if (!item.locationDrawing) {
        locationGroupItems.find(g => !g.locationDrawingId)?.items.push(item)
      } else {
        const existing = locationGroupItems.find(g => g.locationDrawingId === item.locationDrawing.id)
        if (existing) {
          existing.items.push(item)
        } else {
          locationGroupItems.push({
            locationDrawingId: item.locationDrawing.id,
            locationImg: item.locationDrawing.url,
            items: [item],
            subItems: []
          })
        }
      }
    })

    return locationGroupItems
  }

  _sortItemLocationSystems(operationDetails) {
    if (!operationDetails?.items?.length || !operationDetails.items[0]?.locationSystems) return

    const locationGroupItems = []
    const subLocationGroupItems = []

    operationDetails.items.forEach((operation) => {
      if (operation.locationSystems && !operation.locationSystems[0].subSystems) {
        this._buildLocationSystemsData(operation, locationGroupItems)
      } else if (operation.locationSystems && !operation.locationSystems[0].locationDrawing && operation.locationSystems[0].subSystems) {
        locationGroupItems.push({ locationDrawingId: null, locationImg: null, items: [], subItems: [] })
        operation.locationSystems.forEach((item) => {
          this._buildLocationSystemsData(item, subLocationGroupItems, 'subSystems')
        })
        locationGroupItems[0].subItems = subLocationGroupItems
      }
    })

    this._formattedItemsLocationSystems = locationGroupItems
  }

  _sortChildrenLocationSystems(operationDetails) {
    if (!operationDetails?.childrenOperations?.length) return
    if (!operationDetails.childrenOperations[0]?.items?.[0]?.locationSystems) return

    const locationGroupItems = []
    operationDetails.childrenOperations.forEach((operation) => {
      operation.items?.forEach((item) => this._buildLocationSystemsData(item, locationGroupItems))
    })
    this._formattedChildrenLocationSystems = locationGroupItems.reverse()
  }

  // ============================================
  // HELPERS
  // ============================================

  _openFirst(operationDetails) {
    if (!operationDetails) return
    if (operationDetails.childrenOperations?.length > 0) this._childrensPanelOpen = [0]
    if (operationDetails.items?.length > 0) this._itemsPanelOpen = [0]
  }

  /**
   * Unifie les deux sources possibles d'opérations (items racine et childrenOperations)
   * en une seule liste normalisée. Le composant travaille ensuite sur cette liste
   * sans se soucier de l'origine.
   *
   * Retour : [{ label, status, intervention, items, source, sourceIndex }]
   * - source = 'root' pour les items au niveau racine (synthétisés en une "opération")
   * - source = 'children' pour chaque childrenOperation
   * - sourceIndex = index dans la collection d'origine (utilisé pour configureChildrenRef)
   */
  _collectOperations(operationDetails) {
    if (!operationDetails) return []
    const ops = []

    // Source 1 : items au niveau racine → synthétisés en une opération
    if (Array.isArray(operationDetails.items) && operationDetails.items.length > 0) {
      ops.push({
        label: operationDetails.label || '',
        status: operationDetails.status || null,
        intervention: operationDetails.intervention || null,
        items: operationDetails.items,
        source: 'root',
        sourceIndex: 0,
      })
    }

    // Source 2 : childrenOperations triées par status
    if (Array.isArray(operationDetails.childrenOperations) && operationDetails.childrenOperations.length > 0) {
      const sortedChildren = this._getSortedChildren(operationDetails)
      sortedChildren.forEach((child, idx) => {
        ops.push({
          label: child.label || '',
          status: child.status || null,
          intervention: child.intervention || null,
          items: Array.isArray(child.items) ? child.items : [],
          source: 'children',
          sourceIndex: idx,
        })
      })
    }

    return ops
  }

  /**
   * Encode/décode une clé composite "opIdx-itemIdx" qui identifie un item
   * dans la liste unifiée. Permet de naviguer indépendamment de la source.
   */
  _itemKey(opIdx, itemIdx) {
    return `${opIdx}-${itemIdx}`
  }
  _parseItemKey(key) {
    const [opIdx, itemIdx] = String(key).split('-').map(Number)
    return { opIdx, itemIdx }
  }

  /**
   * Extrait un label localisé depuis une `description.map` ({ "1036": "FR", "2057": "EN" }).
   * Prend la locale du document si dispo, sinon FR (1036), sinon EN (2057), sinon n'importe.
   */
  _localize(map) {
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

  /**
   * Parcourt tous les technicalCriteria de tous les components/repairManuals de tous
   * les items pour construire dynamiquement la liste des axes discriminants.
   *
   * Un axe = un `group.id` rencontré dans les technicalCriteria, avec au moins 2 valeurs
   * distinctes. Les axes mono-valeur sont ignorés (pas discriminants pour l'utilisateur).
   *
   * Retourne : [{ groupId, label, options: [{ descriptionId, label }] }]
   */
  _computeAvailableAxes(operationDetails) {
    const operations = this._collectOperations(operationDetails)
    if (!operations.length) return []

    // Map<groupId, { label, options: Map<descriptionId, label> }>
    const axesMap = new Map()

    const collectCriteria = (techCriteriaArray) => {
      if (!Array.isArray(techCriteriaArray)) return
      techCriteriaArray.forEach((tc) => {
        const groupId = tc?.group?.id
        if (groupId == null || !Array.isArray(tc.values)) return

        if (!axesMap.has(groupId)) {
          axesMap.set(groupId, {
            label: this._localize(tc.group.description?.map),
            sortOrder: tc.group.sortOrder ?? 0,
            options: new Map(),
          })
        }
        const axis = axesMap.get(groupId)
        tc.values.forEach((val) => {
          const descId = val?.descriptionId
          if (descId == null) return
          if (!axis.options.has(descId)) {
            axis.options.set(descId, {
              label: this._localize(val.description?.map),
              labelEn: val.description?.map?.['2057'] || val.description?.map?.['1036'] || '',
            })
          }
        })
      })
    }

    const walkBlock = (block) => {
      if (!block) return
      collectCriteria(block.technicalCriteria)
    }

    operations.forEach((op) => {
      op.items.forEach((item) => {
        item.components?.forEach(walkBlock)
        item.repairManuals?.forEach(walkBlock)
      })
    })

    // Conversion en tableau, filtrage des axes mono-valeur, tri stable
    const axes = []
    axesMap.forEach((data, groupId) => {
      if (data.options.size < 2) return
      // Application de la whitelist si configurée
      if (CONFIG_AXES_WHITELIST.length > 0 && !CONFIG_AXES_WHITELIST.includes(groupId)) {
        return
      }
      const options = []
      data.options.forEach((opt, descriptionId) => {
        const label = typeof opt === 'object' ? opt.label : opt
        const labelEn = typeof opt === 'object' ? opt.labelEn : opt
        options.push({ descriptionId, label, labelEn })
      })
      axes.push({ groupId, label: data.label, sortOrder: data.sortOrder, options })
    })
    axes.sort((a, b) => a.sortOrder - b.sortOrder)
    return axes
  }

  /**
   * Détermine si un block (component ou repairManual) match la configuration sélectionnée.
   *
   * Règle : pour chaque axe de selectedConfig, si le block déclare le groupId
   * correspondant, au moins une de ses values doit correspondre. Si le block
   * ne déclare PAS l'axe, il est considéré générique sur cet axe (match).
   *
   * Note : seuls les axes whitelistés (visibles dans l'UI) servent au filtrage,
   * sauf si HIDDEN_AXES_STILL_FILTER est activé.
   */
  /**
   * Règle : chaque axe whitelisté que le bloc DÉCLARE doit matcher la sélection.
   * Les axes non déclarés sont ignorés (génériques sur cet axe).
   * Ex : les codes équipement étant souvent partagés entre variantes de
   * suspension, seul l'axe suspension discrimine — il doit donc matcher.
   */
  _blockMatchesConfig(block, selectedConfig) {
    if (!block) return false
    const criteria = block.technicalCriteria
    if (!Array.isArray(criteria) || criteria.length === 0) return true

    for (const groupId of Object.keys(selectedConfig)) {
      const selectedDescId = String(selectedConfig[groupId])
      const tc = criteria.find(c => String(c?.group?.id) === String(groupId))
      if (!tc) continue // axe non déclaré → générique sur cet axe

      const hasMatch = tc.values?.some(v => String(v.descriptionId) === String(selectedDescId))
      if (!hasMatch) return false // axe déclaré qui ne matche pas → masqué
    }
    return true
  }

  /**
   * Retourne une copie de l'item avec ses `components` et `repairManuals`
   * filtrés selon la configuration sélectionnée. Ne mute pas l'original.
   */
  _filterItem(item, selectedConfig) {
    if (!item) return item
    const filtered = { ...item }
    if (Array.isArray(item.components)) {
      filtered.components = item.components.filter(c => this._blockMatchesConfig(c, selectedConfig))
      if (filtered.components.length !== item.components.length) {
        console.debug(`[config-filter] _filterItem "${item.code || item.properties?.description || '?'}" : components ${item.components.length} → ${filtered.components.length} | config: ${JSON.stringify(selectedConfig)}`)
      }
    }
    if (Array.isArray(item.repairManuals)) {
      filtered.repairManuals = item.repairManuals.filter(r => this._blockMatchesConfig(r, selectedConfig))
      if (filtered.repairManuals.length !== item.repairManuals.length) {
        console.debug(`[config-filter] _filterItem "${item.code || '?'}" : repairManuals ${item.repairManuals.length} → ${filtered.repairManuals.length}`)
      }
    }
    return filtered
  }

  /**
   * Nombre de blocs visibles pour un item après filtrage (utilisé pour griser
   * les chips d'items vides dans la nav).
   */
  _countItemBlocks(item, selectedConfig) {
    if (!item) return 0
    const f = this._filterItem(item, selectedConfig)
    return (f.components?.length || 0) + (f.repairManuals?.length || 0)
  }

  /**
   * DIAGNOSTIC : retourne tous les axes détectés dans la data, indépendamment
   * de la whitelist et du filtre mono-valeur. Sert à identifier les groupIds
   * disponibles à ajouter à CONFIG_AXES_WHITELIST.
   *
   * Retour : ["groupId:label (N valeurs) [whitelisted?]", ...]
   */
  _debugAllAxes(operationDetails) {
    const operations = this._collectOperations(operationDetails)
    const axesMap = new Map()

    const collect = (techCriteriaArray) => {
      if (!Array.isArray(techCriteriaArray)) return
      techCriteriaArray.forEach((tc) => {
        const groupId = tc?.group?.id
        if (groupId == null || !Array.isArray(tc.values)) return
        if (!axesMap.has(groupId)) {
          axesMap.set(groupId, {
            label: this._localize(tc.group.description?.map),
            values: new Set(),
          })
        }
        tc.values.forEach((v) => {
          if (v?.descriptionId != null) {
            axesMap.get(groupId).values.add(this._localize(v.description?.map))
          }
        })
      })
    }

    operations.forEach((op) => {
      op.items.forEach((item) => {
        item.components?.forEach((c) => collect(c.technicalCriteria))
        item.repairManuals?.forEach((r) => collect(r.technicalCriteria))
      })
    })

    const result = []
    axesMap.forEach((data, groupId) => {
      const isWhitelisted = CONFIG_AXES_WHITELIST.length === 0 || CONFIG_AXES_WHITELIST.includes(groupId)
      const status = isWhitelisted
        ? (data.values.size >= 2 ? '✅ affiché' : '⚪ mono-valeur')
        : '🚫 hors whitelist'
      result.push(`${groupId} → "${data.label}" (${data.values.size} valeur${data.values.size > 1 ? 's' : ''}) ${status}`)
    })
    return result
  }

  _getSortedChildren(operationDetails) {
    if (this._sortedChildrenCache.has(operationDetails)) {
      return this._sortedChildrenCache.get(operationDetails)
    }
    const sorted = operationDetails.childrenOperations
      ?.slice()
      .sort((a, b) => (a.status?.id || 0) - (b.status?.id || 0)) || []
    this._sortedChildrenCache.set(operationDetails, sorted)
    return sorted
  }

  _serializeOnce(value) {
    try { return JSON.parse(JSON.stringify(value)) } catch { return value }
  }

  _checkCodeUCType(type) {
    return type?.includes('UC') || false
  }

  // ============================================
  // TOGGLE - mise à jour ciblée du DOM
  // ============================================

  /**
   * Active une opération dans le sélecteur. Bascule automatiquement sur le
   * premier item de cette opération.
   */
  async _setActiveOperation(opIdx, operationDetails) {
    if (this._isPrint) return
    if (opIdx === this._activeOperationIndex) return

    const operations = this._collectOperations(operationDetails)
    const op = operations[opIdx]
    if (!op || !op.items.length) return

    this._activeOperationIndex = opIdx
    this._activeItemKey = this._itemKey(opIdx, 0)

    // Re-render la nav des sections (a changé d'opération) + le contenu
    this._renderOperationSelectorState()
    this._renderItemsNavForActiveOp(operationDetails)
    this._renderItemContent(operationDetails)

    // Charge methods-details si nécessaire pour le nouvel item actif
    const firstItem = op.items[0]
    if (firstItem && !this._checkCodeUCType(firstItem.code)) {
      await this._loadMethodsDetails()
    }

    await new Promise(resolve => setTimeout(resolve, 0))
    this._configureActiveItemRef(operationDetails)
  }

  /**
   * Active un item dans la nav par chips (mode non-print). Charge le sous-WC
   * si nécessaire et reconfigure les refs. La clé identifie l'item dans la
   * liste unifiée (opération + index dans l'opération).
   */
  async _setActiveItem(itemKey, operationDetails) {
    if (this._isPrint) return
    if (itemKey === this._activeItemKey) return

    const { opIdx, itemIdx } = this._parseItemKey(itemKey)
    const operations = this._collectOperations(operationDetails)
    const op = operations[opIdx]
    const item = op?.items?.[itemIdx]
    if (!item) return

    if (!this._checkCodeUCType(item.code)) {
      await this._loadMethodsDetails()
    }

    this._activeItemKey = itemKey

    // Re-render uniquement le panneau de contenu + l'état des chips
    this._renderItemsNavState()
    this._renderItemContent(operationDetails)

    // Configurer la ref après upgrade
    await new Promise(resolve => setTimeout(resolve, 0))
    this._configureActiveItemRef(operationDetails)
  }

  /**
   * Met à jour la sélection sur un axe de configuration. Recalcule les compteurs
   * d'items vides, reconfigure le sous-WC actif avec les nouveaux filtres.
   */
  _setConfigAxis(groupId, descriptionId, operationDetails) {
    if (String(this._selectedConfig[groupId]) === String(descriptionId)) return
    this._selectedConfig[groupId] = descriptionId

    // Mise à jour du label lisible pour cet axe
    const axis = this._availableAxes.find(a => String(a.groupId) === String(groupId))
    if (axis) {
      const opt = axis.options.find(o => String(o.descriptionId) === String(descriptionId))
      if (opt) {
        this._configLabels[groupId] = {
          axisLabel: axis.label,
          valueLabel: opt.label,
          valueLabelEn: opt.labelEn || '',
        }
      }
    }

    // Met à jour les chips de config (état actif)
    this._renderConfigSelectorState()
    // Met à jour les chips d'items (état empty)
    this._renderItemsNavState()
    // Reconfigure le sous-WC de l'item actif pour qu'il reçoive les nouveaux filtres
    this._configureActiveItemRef(operationDetails)
  }

  /**
   * Configure la ref du sous-WC affichant l'item actif. Dispatche vers
   * _configureItemRef ou _configureChildrenRef selon la source de l'item.
   */
  _configureActiveItemRef(operationDetails) {
    if (!this._activeItemKey) return
    const { opIdx, itemIdx } = this._parseItemKey(this._activeItemKey)
    const operations = this._collectOperations(operationDetails)
    const op = operations[opIdx]
    if (!op) return

    const wc = this._itemRefs.get(this._activeItemKey)
    if (!wc) return

    if (op.source === 'root') {
      this._configureItemRef(wc, itemIdx, operationDetails)
    } else {
      this._configureChildrenRef(wc, op.sourceIndex, itemIdx, operationDetails)
    }
  }

  /**
   * Re-render uniquement le contenu de l'item actif. Évite un full re-render
   * lors d'un changement d'item.
   */
  _renderItemContent(operationDetails) {
    const shadow = this.shadowRoot
    const container = shadow.querySelector('.active-item-content')
    if (!container || !this._activeItemKey) return

    const { opIdx, itemIdx } = this._parseItemKey(this._activeItemKey)
    const operations = this._collectOperations(operationDetails)
    const op = operations[opIdx]
    const item = op?.items?.[itemIdx]
    if (!item) {
      container.innerHTML = ''
      return
    }

    const isUC = this._checkCodeUCType(item.code)
    container.innerHTML = isUC
      ? `<div class="vesa-placeholder" data-content-key="${this._activeItemKey}"></div>`
      : `<methods-details data-methods-key="${this._activeItemKey}"></methods-details>`

    // Re-référencer le WC (nouveau DOM)
    const newRef = container.querySelector('[data-methods-key]')
    if (newRef) this._itemRefs.set(this._activeItemKey, newRef)
  }

  /**
   * Met à jour l'état actif des cards d'opération (mode cards) ou du dropdown
   * (mode dropdown) sans full re-render.
   */
  _renderOperationSelectorState() {
    const shadow = this.shadowRoot
    // Cards mode
    shadow.querySelectorAll('[data-op-card]').forEach((card) => {
      const idx = parseInt(card.getAttribute('data-op-card'), 10)
      const isActive = idx === this._activeOperationIndex
      card.classList.toggle('is-active', isActive)
      card.setAttribute('aria-pressed', String(isActive))
    })
    // Dropdown mode : update du label affiché + état selected dans le menu
    const od = this._operationsDetails[0]
    if (!od) return
    const operations = this._collectOperations(od)
    const activeOp = operations[this._activeOperationIndex]
    if (!activeOp) return

    const current = shadow.querySelector('[data-op-select-current]')
    if (current) {
      current.innerHTML = this._renderOperationContent(activeOp)
    }
    shadow.querySelectorAll('[data-op-option]').forEach((opt) => {
      const idx = parseInt(opt.getAttribute('data-op-option'), 10)
      opt.classList.toggle('is-selected', idx === this._activeOperationIndex)
    })
  }

  /**
   * Remplace les chips de sections par celles de l'opération active.
   * Appelé quand on change d'opération.
   */
  _renderItemsNavForActiveOp(operationDetails) {
    const shadow = this.shadowRoot
    const container = shadow.querySelector('.items-nav-sections')
    if (!container) return

    const operations = this._collectOperations(operationDetails)
    const op = operations[this._activeOperationIndex]
    if (!op) {
      container.innerHTML = ''
      return
    }

    container.innerHTML = this._buildSectionsChipsHTML(op, this._activeOperationIndex)
    // Réattacher les listeners sur les nouvelles chips
    container.querySelectorAll('[data-item-chip]').forEach((chip) => {
      const key = chip.getAttribute('data-item-chip')
      chip.addEventListener('click', () => this._setActiveItem(key, operationDetails))
    })
  }

  /**
   * Met à jour l'état actif/empty des chips d'items sans re-render.
   */
  _renderItemsNavState() {
    const shadow = this.shadowRoot
    const od = this._operationsDetails[0]
    if (!od) return

    const operations = this._collectOperations(od)

    shadow.querySelectorAll('[data-item-chip]').forEach((chip) => {
      const key = chip.getAttribute('data-item-chip')
      const { opIdx, itemIdx } = this._parseItemKey(key)
      const item = operations[opIdx]?.items?.[itemIdx]
      const blocks = this._countItemBlocks(item, this._selectedConfig)
      chip.classList.toggle('is-active', key === this._activeItemKey)
      chip.classList.toggle('is-empty', blocks === 0)
      chip.setAttribute('aria-pressed', String(key === this._activeItemKey))
    })
  }

  /**
   * Met à jour l'état actif des chips de config sans re-render.
   */
  _renderConfigSelectorState() {
    const shadow = this.shadowRoot
    shadow.querySelectorAll('[data-config-chip]').forEach((chip) => {
      const groupId = chip.getAttribute('data-config-group')
      const descId = chip.getAttribute('data-config-chip')
      const isActive = String(this._selectedConfig[groupId]) === String(descId)
      chip.classList.toggle('is-active', isActive)
      chip.setAttribute('aria-pressed', String(isActive))
    })
  }

  async _toggleItemPanel(index, operationDetails) {
    if (this._isPrint) return

    const pos = this._itemsPanelOpen.indexOf(index)
    const isOpening = pos === -1

    if (isOpening) {
      const item = operationDetails?.items?.[index]
      if (item && !this._checkCodeUCType(item.code)) {
        await this._loadMethodsDetails()
      }
      this._itemsPanelOpen.push(index)
      this._applyPanelState('item', index, true)

      // Configurer la ref après rendu
      await new Promise(resolve => setTimeout(resolve, 0))
      const wc = this._itemRefs.get(index)
      if (wc) this._configureItemRef(wc, index, operationDetails)
    } else {
      this._itemsPanelOpen.splice(pos, 1)
      this._applyPanelState('item', index, false)
    }
  }

  async _toggleChildrenPanel(index, operationDetails) {
    if (this._isPrint) return

    const pos = this._childrensPanelOpen.indexOf(index)
    const isOpening = pos === -1

    if (isOpening) {
      await this._loadMethodsDetails()
      this._childrensPanelOpen.push(index)
      this._applyPanelState('children', index, true)

      await new Promise(resolve => setTimeout(resolve, 0))
      const sortedChildren = this._getSortedChildren(operationDetails)
      const childItem = sortedChildren?.[index]
      if (childItem?.items) {
        childItem.items.forEach((_, operationsIndex) => {
          const key = `${index}-${operationsIndex}`
          const wc = this._childrenRefs.get(key)
          if (wc) this._configureChildrenRef(wc, index, operationsIndex, operationDetails)
        })
      }
    } else {
      this._childrensPanelOpen.splice(pos, 1)
      this._applyPanelState('children', index, false)
    }
  }

  /**
   * Ouvre/ferme un panel sans re-render
   */
  _applyPanelState(type, index, isOpen) {
    const shadow = this.shadowRoot
    const selector = type === 'item' ? `[data-item-index="${index}"]` : `[data-children-index="${index}"]`
    const panelEl = shadow.querySelector(selector)
    if (!panelEl) return

    const content = panelEl.querySelector('.expansion-panel-content')
    if (isOpen) {
      panelEl.classList.add('is-open')
      if (content) content.style.display = ''
      panelEl.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', 'true')
    } else {
      panelEl.classList.remove('is-open')
      if (content) content.style.display = 'none'
      panelEl.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', 'false')
    }
  }

  /**
   * Met à jour tous les états de panels (ex: mode impression)
   */
  _updatePanelStates() {
    const shadow = this.shadowRoot
    shadow.querySelectorAll('[data-item-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-item-index'), 10)
      const isOpen = this._itemsPanelOpen.includes(index)
      const content = el.querySelector('.expansion-panel-content')
      el.classList.toggle('is-open', isOpen)
      if (content) content.style.display = isOpen ? '' : 'none'
      el.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', String(isOpen))
    })

    shadow.querySelectorAll('[data-children-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-children-index'), 10)
      const isOpen = this._childrensPanelOpen.includes(index)
      const content = el.querySelector('.expansion-panel-content')
      el.classList.toggle('is-open', isOpen)
      if (content) content.style.display = isOpen ? '' : 'none'
      el.querySelector('.expansion-panel-header')?.setAttribute('aria-expanded', String(isOpen))
    })
  }

  // ============================================
  // CONFIGURATION DES WEB COMPONENTS ENFANTS
  // ============================================

  _configureItemRef(el, itemIndex, operationDetails) {
    const item = operationDetails?.items?.[itemIndex]
    if (!item || !el) return

    const filteredItem = this._filterItem(item, this._selectedConfig)

    // Labels connus (toutes les options de tous les axes) — pour la détection
    // des titres discriminants dans les WC enfants
    const knownLabelsEn = {}
    ;(this._availableAxes || []).forEach(a => {
      knownLabelsEn[a.groupId] = (a.options || []).map(o => o.labelEn).filter(Boolean)
    })

    // IMPORTANT : configLabels et knownConfigLabelsEn AVANT selectedConfig,
    // car le setter selectedConfig déclenche le render qui les consomme
    el.haynesLang = this._haynesLang
    el.configLabels = this._serializeOnce(this._configLabels)
    el.knownConfigLabelsEn = this._serializeOnce(knownLabelsEn)
    el.operationDetails = this._serializeOnce(operationDetails)
    el.formattedLocationSystems = this._serializeOnce(this._formattedItemsLocationSystems)
    el.type = 'ITEM'
    el.isPrint = this._isPrint
    el.isSingleItem = operationDetails.items.length === 1
    el.item = this._serializeOnce(filteredItem)
    el.operations = el.item
    el.selectedConfig = this._serializeOnce(this._selectedConfig)
  }

  _configureChildrenRef(el, childrenIndex, operationsIndex, operationDetails) {
    const sortedChildren = this._getSortedChildren(operationDetails)
    const childItem = sortedChildren?.[childrenIndex]
    const operations = childItem?.items?.[operationsIndex]
    if (!operations || !el) return

    const knownLabelsEn = {}
    ;(this._availableAxes || []).forEach(a => {
      knownLabelsEn[a.groupId] = (a.options || []).map(o => o.labelEn).filter(Boolean)
    })

    // IMPORTANT : configLabels et knownConfigLabelsEn AVANT selectedConfig
    el.haynesLang = this._haynesLang
    el.configLabels = this._serializeOnce(this._configLabels)
    el.knownConfigLabelsEn = this._serializeOnce(knownLabelsEn)
    el.operationDetails = this._serializeOnce(operationDetails)
    el.formattedLocationSystems = this._serializeOnce(this._formattedChildrenLocationSystems)
    el.type = 'CHILDREN'
    el.isPrint = this._isPrint
    el.isSingleItem = childItem.items.length === 1
    el.item = this._serializeOnce(operations)
    el.operations = el.item
    el.selectedConfig = this._serializeOnce(this._selectedConfig)
  }

  _updateLightProps() {
    this._itemRefs.forEach((wc) => { if (wc) wc.isPrint = this._isPrint })
    this._childrenRefs.forEach((wc) => { if (wc) wc.isPrint = this._isPrint })
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  _attachEventListeners() {
    const shadow = this.shadowRoot
    const od = this._operationsDetails[0]

    // Chips de config véhicule
    shadow.querySelectorAll('[data-config-chip]').forEach((chip) => {
      const groupId = chip.getAttribute('data-config-group')
      const descId = chip.getAttribute('data-config-chip')
      chip.addEventListener('click', () => {
        // Le descriptionId est une string ici, on le reconvertit en number si possible
        const parsed = Number(descId)
        this._setConfigAxis(groupId, isNaN(parsed) ? descId : parsed, od)
      })
    })

    // Cards d'opérations (mode ≤ seuil)
    shadow.querySelectorAll('[data-op-card]').forEach((card) => {
      const idx = parseInt(card.getAttribute('data-op-card'), 10)
      card.addEventListener('click', () => this._setActiveOperation(idx, od))
    })

    // Dropdown d'opérations (mode > seuil)
    const dropdownToggle = shadow.querySelector('[data-op-select-toggle]')
    const dropdownMenu = shadow.querySelector('.op-select-menu')
    if (dropdownToggle && dropdownMenu) {
      dropdownToggle.addEventListener('click', () => {
        const isOpen = !dropdownMenu.hasAttribute('hidden')
        if (isOpen) {
          dropdownMenu.setAttribute('hidden', '')
          dropdownToggle.setAttribute('aria-expanded', 'false')
          dropdownToggle.classList.remove('is-open')
        } else {
          dropdownMenu.removeAttribute('hidden')
          dropdownToggle.setAttribute('aria-expanded', 'true')
          dropdownToggle.classList.add('is-open')
        }
      })
      // Click outside pour fermer
      this._dropdownOutsideHandler = (e) => {
        if (!shadow.contains(e.composedPath?.()?.[0] || e.target)) {
          dropdownMenu.setAttribute('hidden', '')
          dropdownToggle.setAttribute('aria-expanded', 'false')
          dropdownToggle.classList.remove('is-open')
        }
      }
      document.addEventListener('click', this._dropdownOutsideHandler)

      shadow.querySelectorAll('[data-op-option]').forEach((opt) => {
        const idx = parseInt(opt.getAttribute('data-op-option'), 10)
        opt.addEventListener('click', () => {
          this._setActiveOperation(idx, od)
          dropdownMenu.setAttribute('hidden', '')
          dropdownToggle.setAttribute('aria-expanded', 'false')
          dropdownToggle.classList.remove('is-open')
        })
      })
    }

    // Chips de navigation des sections (mode interactif)
    shadow.querySelectorAll('[data-item-chip]').forEach((chip) => {
      const key = chip.getAttribute('data-item-chip')
      chip.addEventListener('click', () => this._setActiveItem(key, od))
    })

    // Refs methods-details (clé composite)
    shadow.querySelectorAll('[data-methods-key]').forEach((el) => {
      const key = el.getAttribute('data-methods-key')
      this._itemRefs.set(key, el)
    })
  }

  // ============================================
  // RENDER
  // ============================================

  _render() {
    // === DIAGNOSTIC TEMPORAIRE ===
    const od = this._operationsDetails[0]
    const operations = od ? this._collectOperations(od) : []
    const useDropdown = operations.length > OPERATIONS_CARDS_THRESHOLD

    // Calcule tous les axes détectés (avant whitelist) pour aider à identifier
    // les groupIds disponibles à ajouter à CONFIG_AXES_WHITELIST.
    const allAxesDetected = od ? this._debugAllAxes(od) : []

    console.log('🔍 [DisplayOperationsDetails] _render appelé', {
      version: 'TWO_LEVEL_NAV_v3',
      isPrint: this._isPrint,
      loading: this._loading,
      hasData: this._operationsDetails.length > 0,
      operationsCount: operations.length,
      operationSelector: operations.length <= 1 ? 'none' : (useDropdown ? 'dropdown' : 'cards'),
      operationsBreakdown: operations.map((op, i) => ({
        idx: i,
        label: op.label || '(no label)',
        source: op.source,
        itemsCount: op.items.length,
        active: i === this._activeOperationIndex,
      })),
      // Axes affichés à l'utilisateur (après whitelist + filtre mono-valeur)
      axesShown: this._availableAxes.map(a => `${a.groupId}:${a.label} (${a.options.length} valeurs)`),
      // Tous les axes détectés (utile pour compléter CONFIG_AXES_WHITELIST)
      axesDetected: allAxesDetected,
      activeOperationIndex: this._activeOperationIndex,
      activeItemKey: this._activeItemKey,
    })
    // === FIN DIAGNOSTIC ===

    if (this._loading) {
      this.shadowRoot.innerHTML = `
        ${this._getStyles()}
        <div class="display-operation-details">
          <div class="loading-message">Chargement...</div>
        </div>
      `
      return
    }

    if (!this._operationsDetails.length) {
      this.shadowRoot.innerHTML = `
        ${this._getStyles()}
        <div class="display-operation-details"></div>
      `
      return
    }

    try {
      this.shadowRoot.innerHTML = this._getStyles() + this._generateHTML()
      this._domReady = true

      Promise.resolve().then(async () => {
        this._attachEventListeners()
        await this._hydrateOpenPanels()
      })
    } catch (error) {
      console.error('❌ DisplayOperationsDetails render error:', error)
    }
  }

  /**
   * Hydrate les panneaux ouverts par défaut après le render initial.
   * - Mode interactif : hydrate uniquement l'item actif
   * - Mode print : hydrate tous les items de toutes les opérations
   */
  async _hydrateOpenPanels() {
    const od = this._operationsDetails[0]
    if (!od) return

    const operations = this._collectOperations(od)
    if (!operations.length) return

    // Détermine les clés d'items à hydrater
    const keysToHydrate = []
    if (this._isPrint) {
      operations.forEach((op, opIdx) => {
        op.items.forEach((_, itemIdx) => {
          keysToHydrate.push(this._itemKey(opIdx, itemIdx))
        })
      })
    } else if (this._activeItemKey) {
      keysToHydrate.push(this._activeItemKey)
    }

    if (!keysToHydrate.length) return

    // Détermine si au moins un panneau nécessite methods-details
    const needsMD = keysToHydrate.some((key) => {
      const { opIdx, itemIdx } = this._parseItemKey(key)
      const item = operations[opIdx]?.items?.[itemIdx]
      return item && !this._checkCodeUCType(item.code)
    })

    if (needsMD) {
      await this._loadMethodsDetails()
    }

    // Laisse le navigateur upgrade les <methods-details> nouvellement registered
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Configure les refs des items hydratés
    keysToHydrate.forEach((key) => {
      const { opIdx, itemIdx } = this._parseItemKey(key)
      const op = operations[opIdx]
      const wc = this._itemRefs.get(key)
      if (!wc || !op) return

      if (op.source === 'root') {
        this._configureItemRef(wc, itemIdx, od)
      } else {
        this._configureChildrenRef(wc, op.sourceIndex, itemIdx, od)
      }
    })
  }

  _generateHTML() {
    return this._operationsDetails.map((operationDetails, index) => `
      <div class="display-operation-details ${this._isPrint ? 'display-operation-details--print' : ''}">
        ${this._renderHeader(operationDetails)}
        <div class="operation-content">
          ${this._renderItems(operationDetails)}
          ${this._renderChildren(operationDetails)}
        </div>
      </div>
    `).join('')
  }

  _renderHeader(operationDetails) {
    // Cherche un titre fiable dans cet ordre :
    //   1) properties du premier item racine
    //   2) label de l'operationDetails (cas childrenOperations seulement)
    //   3) properties du premier item de la première children
    let title = ''
    if (operationDetails?.items?.[0]?.properties?.description) {
      title = operationDetails.items[0].properties.description
    } else if (operationDetails?.label) {
      title = operationDetails.label
    } else if (operationDetails?.childrenOperations?.[0]?.label) {
      title = operationDetails.childrenOperations[0].label
    } else if (operationDetails?.childrenOperations?.[0]?.items?.[0]?.properties?.description) {
      title = operationDetails.childrenOperations[0].items[0].properties.description
    }

    if (!title) return ''

    return `
      <div class="operation-header">
        <h2 class="operation-title">${title}</h2>
      </div>
    `
  }

  _renderItems(operationDetails) {
    const operations = this._collectOperations(operationDetails)
    if (!operations.length) return ''

    // Mode print : panels classiques empilés (lecture complète)
    if (this._isPrint) return this._renderItemsPrint(operationDetails)

    // Mode interactif : config + sélecteur d'opérations + nav des sections + panneau actif
    return `
      <div class="items-section">
        ${this._renderConfigSelector()}
        ${this._renderOperationSelector(operations)}
        ${this._renderSectionsNav(operations)}
        <div class="active-item-content">
          ${this._renderActiveItemSlot(operationDetails)}
        </div>
      </div>
    `
  }

  /**
   * Affichage en panels expansibles classiques (mode impression).
   * Toutes les opérations et leurs items sont rendus en accordéon ouvert.
   */
  _renderItemsPrint(operationDetails) {
    const operations = this._collectOperations(operationDetails)

    return `
      <div class="items-section">
        ${this._renderConfigSelector()}
        ${operations.map((op, opIdx) => `
          <div class="print-operation-group">
            ${op.label ? `
              <h3 class="print-operation-title">
                ${op.label}
                ${op.intervention ? `<small>[${op.intervention.label || ''}]</small>` : ''}
                ${op.status ? `<span class="print-operation-status">${op.status.label || ''}</span>` : ''}
              </h3>
            ` : ''}
            <div class="expansion-panels">
              ${op.items.map((item, itemIdx) => {
                const key = this._itemKey(opIdx, itemIdx)
                const isUC = this._checkCodeUCType(item.code)
                const title = item.properties?.description || item.code

                return `
                  <div class="expansion-panel is-open" data-item-key="${key}">
                    <button class="expansion-panel-header" disabled aria-expanded="true">
                      <div class="header-content">
                        <div class="header-icon">${this._getWrenchIcon()}</div>
                        <h3 class="header-title">
                          <span class="header-title-text">${title}</span>
                        </h3>
                        <div class="header-chevron">
                          <svg class="chevron-icon" viewBox="0 0 24 24">
                            <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                          </svg>
                        </div>
                      </div>
                    </button>
                    <div class="expansion-panel-content">
                      <div class="panel-body">
                        ${isUC
                          ? `<div class="vesa-placeholder" data-content-key="${key}"></div>`
                          : `<methods-details data-methods-key="${key}"></methods-details>`
                        }
                      </div>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  /**
   * Le slot dans lequel le sous-WC de l'item actif sera rendu (mode interactif).
   */
  _renderActiveItemSlot(operationDetails) {
    if (!this._activeItemKey) return ''
    const { opIdx, itemIdx } = this._parseItemKey(this._activeItemKey)
    const operations = this._collectOperations(operationDetails)
    const item = operations[opIdx]?.items?.[itemIdx]
    if (!item) return ''

    const isUC = this._checkCodeUCType(item.code)
    return isUC
      ? `<div class="vesa-placeholder" data-content-key="${this._activeItemKey}"></div>`
      : `<methods-details data-methods-key="${this._activeItemKey}"></methods-details>`
  }

  /**
   * Sélecteur de configuration véhicule. Une ligne par axe discriminant
   * détecté dans la data (après whitelist). Si aucun axe, on ne rend rien.
   */
  _renderConfigSelector() {
    if (!this._availableAxes.length) return ''

    return `
      <div class="config-selector" role="group" aria-label="Configuration véhicule">
        <div class="config-selector-header">
          <svg class="config-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14,12H10V10H14M14,16H10V14H14M20,8H17.19C16.74,7.22 16.12,6.55 15.37,6.04L17,4.41L15.59,3L13.42,5.17C12.96,5.06 12.5,5 12,5S11.05,5.06 10.59,5.17L8.41,3L7,4.41L8.62,6.04C7.88,6.55 7.26,7.22 6.81,8H4V10H6.09C6.04,10.33 6,10.66 6,11V12H4V14H6V15C6,15.34 6.04,15.67 6.09,16H4V18H6.81C7.85,19.79 9.78,21 12,21S16.15,19.79 17.19,18H20V16H17.91C17.96,15.67 18,15.34 18,15V14H20V12H18V11C18,10.66 17.96,10.33 17.91,10H20V8Z"/>
          </svg>
          <span class="config-selector-label">Configuration véhicule</span>
        </div>
        <div class="config-axes">
          ${this._availableAxes.map(axis => `
            <div class="config-axis">
              <span class="config-axis-label">${axis.label}</span>
              <div class="config-axis-options" role="radiogroup" aria-label="${axis.label}">
                ${axis.options.map(opt => {
                  const isActive = String(this._selectedConfig[axis.groupId]) === String(opt.descriptionId)
                  return `
                    <button
                      type="button"
                      class="chip config-chip ${isActive ? 'is-active' : ''}"
                      role="radio"
                      aria-pressed="${isActive}"
                      data-config-group="${axis.groupId}"
                      data-config-chip="${opt.descriptionId}"
                    >${opt.label}</button>
                  `
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  /**
   * Sélecteur d'opérations. Hybride :
   * - ≤ OPERATIONS_CARDS_THRESHOLD opérations : grille de cards
   * - > OPERATIONS_CARDS_THRESHOLD : dropdown
   * Si une seule opération, on ne rend rien (la nav des sections suffit).
   */
  _renderOperationSelector(operations) {
    if (operations.length <= 1) return ''

    const useDropdown = operations.length > OPERATIONS_CARDS_THRESHOLD
    const activeOp = operations[this._activeOperationIndex]

    if (useDropdown) {
      return `
        <div class="operation-selector operation-selector--dropdown">
          <div class="operation-selector-header">
            <span class="operation-selector-label">Opération · ${operations.length} disponibles</span>
          </div>
          <button type="button" class="op-select" data-op-select-toggle aria-haspopup="listbox" aria-expanded="false">
            <span class="op-select-current" data-op-select-current>
              ${this._renderOperationContent(activeOp)}
            </span>
            <span class="op-select-arrow" aria-hidden="true">▾</span>
          </button>
          <div class="op-select-menu" role="listbox" hidden>
            ${operations.map((op, idx) => `
              <button
                type="button"
                role="option"
                class="op-select-option ${idx === this._activeOperationIndex ? 'is-selected' : ''}"
                data-op-option="${idx}"
                aria-selected="${idx === this._activeOperationIndex}"
              >${this._renderOperationContent(op)}</button>
            `).join('')}
          </div>
        </div>
      `
    }

    // Mode cards
    return `
      <div class="operation-selector operation-selector--cards">
        <div class="operation-selector-header">
          <span class="operation-selector-label">Opération · ${operations.length} disponibles</span>
        </div>
        <div class="op-cards" role="tablist" aria-label="Sélection de l'opération">
          ${operations.map((op, idx) => {
            const isActive = idx === this._activeOperationIndex
            return `
              <button
                type="button"
                role="tab"
                class="op-card ${isActive ? 'is-active' : ''}"
                data-op-card="${idx}"
                aria-pressed="${isActive}"
              >${this._renderOperationContent(op)}</button>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  /**
   * Contenu interne d'une card / option d'opération : titre + meta (statut + nb sections).
   * Partagé entre cards et dropdown pour cohérence visuelle.
   */
  _renderOperationContent(op) {
    if (!op) return ''
    const sectionsCount = op.items?.length || 0
    const statusLabel = op.status?.label || ''
    const statusKey = op.status?.id != null ? `status-${op.status.id}` : ''
    return `
      <span class="op-card-title">${op.label || 'Opération sans titre'}</span>
      <span class="op-card-meta">
        ${statusLabel ? `<span class="op-status ${statusKey}">${statusLabel}</span>` : ''}
        <span class="op-sections-count">${sectionsCount} section${sectionsCount > 1 ? 's' : ''}</span>
      </span>
    `
  }

  /**
   * Nav des sections de l'opération active. Le rendu initial place les chips
   * dans un conteneur que _renderItemsNavForActiveOp peut ensuite remplacer.
   */
  _renderSectionsNav(operations) {
    const op = operations[this._activeOperationIndex]
    if (!op || !op.items.length) return ''

    return `
      <nav class="items-nav" role="tablist" aria-label="Sections de l'opération">
        <div class="items-nav-header">
          <svg class="items-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4V14Z"/>
          </svg>
          <span class="items-nav-label">Sections · ${op.items.length}</span>
        </div>
        <div class="items-nav-sections">
          ${this._buildSectionsChipsHTML(op, this._activeOperationIndex)}
        </div>
      </nav>
    `
  }

  /**
   * Construit le HTML des chips de sections pour une opération donnée.
   * Extrait dans une méthode pour pouvoir le réutiliser lors du switch d'opération.
   */
  _buildSectionsChipsHTML(op, opIdx) {
    return op.items.map((item, itemIdx) => {
      const key = this._itemKey(opIdx, itemIdx)
      const blocks = this._countItemBlocks(item, this._selectedConfig)
      const isActive = key === this._activeItemKey
      const isEmpty = blocks === 0
      const label = item.properties?.description || item.code || `Item ${itemIdx + 1}`
      const ariaLabel = isEmpty
        ? `${label}, aucun bloc pour cette configuration`
        : `${label}, ${blocks} bloc${blocks > 1 ? 's' : ''}`
      return `
        <button
          type="button"
          class="chip item-chip ${isActive ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}"
          role="tab"
          aria-pressed="${isActive}"
          aria-label="${ariaLabel}"
          data-item-chip="${key}"
        >
          <span class="item-chip-num">${itemIdx + 1}</span>
          <span class="item-chip-label">${label}</span>
        </button>
      `
    }).join('')
  }

  _renderChildren(operationDetails) {
    if (!operationDetails.childrenOperations?.length) return ''

    // En mode interactif, les childrenOperations sont déjà incluses dans la
    // vue unifiée (_renderItems via _collectOperations). On ne rend rien ici
    // pour éviter le doublon.
    if (!this._isPrint) return ''

    // En mode print, les childrenOperations sont également rendues par
    // _renderItemsPrint (unifié). On ne rend rien ici non plus.
    return ''
  }

  _getWrenchIcon() {
    return `
      <svg class="icon" viewBox="0 0 24 24">
        <path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z" />
      </svg>
    `
  }

  _getStyles() {
    return `
      <style>
        :host {
          --ipd-primary: #003D7A;
          --ipd-secondary: #E30613;
          --ipd-text-primary: #333333;
          --ipd-text-secondary: #666666;
          --ipd-border: #CCCCCC;
          --ipd-white: #FFFFFF;
          --ipd-light-gray: #F9F9F9;
          display: block;
          width: 100%;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .display-operation-details { width: 100%; }

        .display-operation-details--print .expansion-panel-header {
          cursor: default;
        }
        .display-operation-details--print .expansion-panel-header:hover {
          background: var(--ipd-white);
        }

        .loading-message {
          padding: 40px 20px;
          text-align: center;
          color: var(--ipd-text-secondary);
          background: var(--ipd-light-gray);
          border-radius: 8px;
          margin: 20px;
        }

        .operation-header {
          background: var(--ipd-white);
          padding: 24px;
          border-bottom: 2px solid var(--ipd-primary);
          margin-bottom: 24px;
        }

        .operation-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--ipd-primary);
          line-height: 1.3;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }

        .operation-content { width: 100%; }

        .items-section,
        .children-section { margin-bottom: 32px; }
        .items-section:last-child,
        .children-section:last-child { margin-bottom: 0; }

        /* ============================================
           SÉLECTEUR DE CONFIGURATION VÉHICULE
           ============================================ */

        .config-selector {
          background: var(--ipd-light-gray);
          border: 1px solid var(--ipd-border);
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }

        .config-selector-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .config-icon {
          width: 16px;
          height: 16px;
          fill: var(--ipd-text-secondary);
          flex-shrink: 0;
        }

        .config-selector-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ipd-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .config-axes {
          display: grid;
          gap: 10px;
        }

        .config-axis {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .config-axis-label {
          font-size: 0.875rem;
          color: var(--ipd-text-secondary);
          min-width: 140px;
          flex-shrink: 0;
        }

        .config-axis-options {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
        }

        /* ============================================
           NAVIGATION PAR CHIPS DES ITEMS
           ============================================ */

        .items-nav {
          margin-bottom: 20px;
        }

        .items-nav-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .items-nav-icon {
          width: 16px;
          height: 16px;
          fill: var(--ipd-text-secondary);
          flex-shrink: 0;
        }

        .items-nav-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ipd-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .items-nav-chips,
        .items-nav-sections {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* ============================================
           SÉLECTEUR D'OPÉRATIONS (cards + dropdown)
           ============================================ */

        .operation-selector {
          margin-bottom: 20px;
        }

        .operation-selector-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .operation-selector-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ipd-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Mode cards : grille fluide */
        .op-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 10px;
        }

        .op-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          border-radius: 8px;
          color: var(--ipd-text-primary);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .op-card:hover:not(.is-active) {
          background: var(--ipd-light-gray);
          border-color: var(--ipd-text-secondary);
        }
        .op-card:focus-visible {
          outline: 2px solid var(--ipd-primary);
          outline-offset: 2px;
        }
        .op-card.is-active {
          background: var(--ipd-primary);
          border-color: var(--ipd-primary);
          color: var(--ipd-white);
          box-shadow: 0 2px 4px rgba(0,61,122,0.2);
        }

        .op-card-title {
          font-size: 0.875rem;
          font-weight: 600;
          line-height: 1.35;
          /* Pas de troncature : le texte wrappe naturellement */
        }
        .op-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .op-status {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--ipd-light-gray);
          color: var(--ipd-text-secondary);
        }
        .op-card.is-active .op-status {
          background: rgba(255,255,255,0.2);
          color: var(--ipd-white);
        }
        /* Variations par statut (id) - couleurs adaptables au design system */
        .op-status.status-1 { background: #FFEBE8; color: #C9302C; } /* Indispensable */
        .op-status.status-2 { background: #FFF4D6; color: #B36B00; } /* Recommandée */
        .op-status.status-3 { background: #E6F4EA; color: #267A3D; } /* Incluse / Optionnelle */
        .op-card.is-active .op-status.status-1,
        .op-card.is-active .op-status.status-2,
        .op-card.is-active .op-status.status-3 {
          background: rgba(255,255,255,0.2);
          color: var(--ipd-white);
        }

        .op-sections-count {
          font-size: 0.75rem;
          color: var(--ipd-text-secondary);
        }
        .op-card.is-active .op-sections-count {
          color: rgba(255,255,255,0.85);
        }

        /* Mode dropdown : compact */
        .operation-selector--dropdown {
          position: relative;
        }
        .op-select {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          border-radius: 8px;
          color: var(--ipd-text-primary);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }
        .op-select:hover, .op-select.is-open {
          border-color: var(--ipd-primary);
        }
        .op-select-current {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 1;
        }
        .op-select-arrow {
          color: var(--ipd-text-secondary);
          font-size: 0.75rem;
          flex-shrink: 0;
          transition: transform 0.15s ease;
        }
        .op-select.is-open .op-select-arrow {
          transform: rotate(180deg);
        }
        .op-select-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          border-radius: 8px;
          padding: 4px;
          max-height: 320px;
          overflow-y: auto;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .op-select-menu[hidden] { display: none; }
        .op-select-option {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--ipd-text-primary);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }
        .op-select-option:hover { background: var(--ipd-light-gray); }
        .op-select-option.is-selected {
          background: var(--ipd-primary);
          color: var(--ipd-white);
        }
        .op-select-option.is-selected .op-status,
        .op-select-option.is-selected .op-sections-count {
          color: var(--ipd-white);
        }

        /* Groupes d'opérations en mode print */
        .print-operation-group {
          margin-bottom: 32px;
        }
        .print-operation-group:last-child {
          margin-bottom: 0;
        }
        .print-operation-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--ipd-primary);
          margin: 0 0 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--ipd-primary);
        }
        .print-operation-title small {
          font-size: 0.9rem;
          font-weight: 400;
          color: var(--ipd-text-secondary);
          margin-left: 8px;
        }
        .print-operation-status {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--ipd-secondary);
          margin-left: 12px;
        }

        /* ============================================
           CHIPS - STYLES PARTAGÉS + VARIANTS
           ============================================ */

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: 1px solid var(--ipd-border);
          border-radius: 16px;
          background: var(--ipd-white);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8125rem;
          color: var(--ipd-text-primary);
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          line-height: 1.4;
        }
        .chip:hover:not(.is-active) {
          background: var(--ipd-light-gray);
          border-color: var(--ipd-text-secondary);
        }
        .chip:focus-visible {
          outline: 2px solid var(--ipd-primary);
          outline-offset: 2px;
        }
        .chip.is-active {
          background: var(--ipd-primary);
          border-color: var(--ipd-primary);
          color: var(--ipd-white);
          font-weight: 600;
        }

        /* Variant : item-chip (nav) - plus marquée + numérotée */
        .item-chip {
          padding: 8px 14px;
          border-radius: 8px;
          gap: 8px;
        }
        .item-chip.is-empty:not(.is-active) {
          opacity: 0.55;
        }
        .item-chip-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          font-size: 0.6875rem;
          font-weight: 600;
          background: var(--ipd-light-gray);
          color: var(--ipd-text-secondary);
          border-radius: 10px;
          flex-shrink: 0;
        }
        .item-chip.is-active .item-chip-num {
          background: var(--ipd-white);
          color: var(--ipd-primary);
        }
        .item-chip.is-empty:not(.is-active) .item-chip-num {
          background: transparent;
          border: 1px dashed var(--ipd-border);
          color: var(--ipd-text-secondary);
        }
        .item-chip-label {
          line-height: 1.3;
        }

        /* ============================================
           PANNEAU DE L'ITEM ACTIF (mode chips)
           ============================================ */

        .active-item-content {
          background: var(--ipd-white);
          border: 1px solid var(--ipd-border);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          animation: slideDown 0.3s ease;
        }

        /* ============================================
           PANELS EXPANSIBLES (mode print uniquement)
           ============================================ */

        .expansion-panels { display: flex; flex-direction: column; gap: 16px; }

        .expansion-panel {
          background: var(--ipd-white);
          border-radius: 12px;
          border: 1px solid var(--ipd-border);
          overflow: hidden;
          transition: box-shadow 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .expansion-panel:hover { box-shadow: 0 4px 8px rgba(0,0,0,0.12); }
        .expansion-panel:last-of-type { margin-bottom: 4px; }

        .expansion-panel-header {
          width: 100%;
          background: var(--ipd-white);
          border: none;
          padding: 20px 24px;
          cursor: pointer;
          transition: background-color 0.2s ease;
          display: block;
          text-align: left;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        }
        .expansion-panel-header:hover:not(:disabled) { background-color: var(--ipd-light-gray); }
        .expansion-panel-header:focus { outline: 2px solid var(--ipd-primary); outline-offset: -2px; }
        .expansion-panel-header:disabled { cursor: default; }
        .is-open .expansion-panel-header { border-bottom: 1px solid var(--ipd-border); }

        .header-content { display: flex; align-items: center; gap: 16px; }

        .header-icon { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
        .header-icon .icon { width: 100%; height: 100%; fill: var(--ipd-primary); }

        .header-title { flex: 1; margin: 0; font-size: 1.1rem; font-weight: 600; line-height: 1.4; }
        .header-title-text { color: var(--ipd-text-primary); }
        .header-subtitle { display: inline-block; margin-left: 8px; font-size: 0.9rem; font-weight: 400; color: var(--ipd-text-secondary); }

        .header-chevron { flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
        .is-open .header-chevron { transform: rotate(90deg); }
        .chevron-icon { width: 100%; height: 100%; fill: var(--ipd-text-secondary); }

        .expansion-panel-content { background: var(--ipd-white); animation: slideDown 0.3s ease; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .panel-body { padding: 24px; }

        .operations-item { margin-bottom: 16px; }
        .operations-item:last-child { margin-bottom: 0; }

        methods-details { display: block; width: 100%; }

        @media (max-width: 599px) {
          .operation-header { padding: 16px; }
          .operation-title { font-size: 1.5rem; }
          .expansion-panel-header { padding: 16px; }
          .panel-body { padding: 16px; }
          .header-title { font-size: 1rem; }
          .config-selector { padding: 12px 14px; }
          .config-axis { flex-direction: column; align-items: flex-start; gap: 6px; }
          .config-axis-label { min-width: 0; }
          .active-item-content { padding: 16px; }
        }

        @media print {
          .expansion-panel { box-shadow: none; border: 1px solid var(--ipd-border); page-break-inside: avoid; }
          .expansion-panel-header { background: var(--ipd-white) !important; }
          .header-chevron { display: none; }
          .expansion-panel-content { display: block !important; }
        }
      </style>
    `
  }
}

if (!customElements.get('display-operations-details')) {
  customElements.define('display-operations-details', DisplayOperationsDetails)
  console.log('✅ Web Component "display-operations-details" registered')
} else {
  console.log('ℹ️ Web Component "display-operations-details" already registered')
}

export default DisplayOperationsDetails