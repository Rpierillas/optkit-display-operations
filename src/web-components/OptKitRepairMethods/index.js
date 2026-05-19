// Point d'entrée public du module OptKitRepairMethods
// Les WC s'auto-enregistrent via customElements.define() à l'import

/**
 * OptKitRepairMethods — Web Components Suite
 * Portail d'entrée : <display-operations-details>
 *
 * Hiérarchie :
 * display-operations-details → methods-details
 *   ├── adjustment-data-group (adjustment-steering | adjustment-default)
 *   ├── lubricant-data
 *   ├── repairs-data-group (repairs-electronics | repairs-engine | repairs-maintenance | repairs-default)
 *   │     └── table-wrapper
 *   ├── technical-drawings
 *   ├── location-systems
 *   └── vesa-and-breakdowns
 */

// Utilitaires
export { default as TableWrapper }      from './common/TableWrapperWC.js'
export { default as SchematicsModal }   from './common/SchematicsModalWC.js'

// Ajustements
export { default as AdjustmentDefault } from './operationDetails/components/adjustmentDataGroup/Adjustement-DefaultWC.js'
export { default as AdjustmentSteering }from './operationDetails/components/adjustmentDataGroup/Adjustement-SteeringWC.js'
export { default as AdjustmentSystem }  from './operationDetails/components/AdjustementSystem.js'

// Lubrifiants
export { default as LubricantData }     from './operationDetails/components/lubricantDataGroup/LubricantDataWC.js'

// Manuels de réparation
export { default as RepairsDefault }    from './operationDetails/components/repairManualDataGroup/RepairsDefault.js'
export { default as RepairsElectronics }from './operationDetails/components/repairManualDataGroup/RepairsElectronics.js'
export { default as RepairsEngine }     from './operationDetails/components/repairManualDataGroup/RepairsEngine.js'
export { default as RepairsMaintenance }from './operationDetails/components/repairManualDataGroup/RepairsMaintenance.js'
export { default as RepairManuals }     from './operationDetails/components/RepairManualsWC.js'

// Dessins techniques & extra info
export { default as TechnicalDrawings } from './operationDetails/components/TechnicalDrawingsWC.js'
export { default as ExtraInfoWC }       from './operationDetails/components/extraInfoManuals/ExtraInfoWC.js'

// Localisation & UC optionnel
export { default as LocationSystems }   from './operationDetails/components/LocationSystemsWC.js'
export { default as VesaAndBreakdowns } from './operationDetails/components/optionalsGroup/VesaAndBreakdownsWC.js'

// Composants principaux
export { default as MethodsDetails }          from './operationDetails/MethodsDetailsWC.js'
export { default as DisplayOperationsDetails } from './DisplayOperationsDetailsWC.js'