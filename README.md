# Display Operations Details Web Component

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Framework Agnostic](https://img.shields.io/badge/framework-agnostic-blue.svg)]()

A framework-agnostic Web Component suite for displaying automotive repair operations details. Built in pure vanilla JavaScript with native Custom Elements and Shadow DOM — no runtime dependencies, no framework lock-in.

Primary entry point: `<display-operations-details>`.

## Highlights

- **Zero runtime dependencies** — pure vanilla JS, ~11k lines, no Vue, no React, nothing to bundle
- **Shadow DOM isolated** — styles never leak in or out
- **Lazy-loaded sub-components** — child Web Components are imported on demand
- **Print-friendly** — dedicated print mode via the `is-print` attribute
- **Self-registering** — components auto-register via `customElements.define()` on import
- **Use anywhere** — vanilla JS, jQuery, React, Vue, Angular, legacy PHP pages

## Component hierarchy

```
display-operations-details
└── methods-details
    ├── adjustment-data-group
    │   ├── adjustment-steering
    │   └── adjustment-default
    ├── lubricant-data
    ├── repairs-data-group
    │   ├── repairs-electronics
    │   ├── repairs-engine
    │   ├── repairs-maintenance
    │   └── repairs-default
    │       └── table-wrapper
    ├── technical-drawings
    ├── location-systems
    └── vesa-and-breakdowns
```

All children are auto-registered when you import the package entry point.

## Installation

### Via npm

```bash
npm install @ipd4/display-operations-details-wc
```

### Via CDN (no install)

```html
<script type="module">
  import 'https://unpkg.com/@ipd4/display-operations-details-wc';
</script>
```

Or via jsDelivr:

```html
<script type="module">
  import 'https://cdn.jsdelivr.net/npm/@ipd4/display-operations-details-wc';
</script>
```

## Usage

### Basic example

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@ipd4/display-operations-details-wc';
  </script>
</head>
<body>
  <display-operations-details id="ops"></display-operations-details>

  <script type="module">
    const el = document.getElementById('ops');
    el.operationsDetails = [/* your operations data */];
  </script>
</body>
</html>
```

### Inside a Vue 3 application

```vue
<template>
  <display-operations-details
    ref="opsEl"
    :is-print="printMode ? 'true' : 'false'"
    :loading="isLoading ? 'true' : 'false'"
  />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import '@ipd4/display-operations-details-wc';

const opsEl = ref(null);
const operations = ref([/* ... */]);
const printMode = ref(false);
const isLoading = ref(false);

// Properties (objects/arrays) are set as JS properties, not attributes
onMounted(() => {
  opsEl.value.operationsDetails = operations.value;
});

watch(operations, (val) => {
  if (opsEl.value) opsEl.value.operationsDetails = val;
});
</script>
```

### Inside a legacy jQuery / PHP page

```html
<script type="module" src="/node_modules/@ipd4/display-operations-details-wc/src/web-components/OptKitRepairMethods/index.js"></script>

<display-operations-details id="ops"></display-operations-details>

<script>
  $(document).ready(function() {
    const el = document.getElementById('ops');
    el.operationsDetails = <?php echo json_encode($operationsData); ?>;
  });
</script>
```

## API

### Tag

```html
<display-operations-details></display-operations-details>
```

### Attributes (string-typed, used in HTML)

| Attribute   | Values          | Default   | Description                                  |
|-------------|-----------------|-----------|----------------------------------------------|
| `is-print`  | `"true"` / `"false"` | `"false"` | Switches to print-friendly layout (all panels open, no animations) |
| `loading`   | `"true"` / `"false"` | `"false"` | Shows a loading state                        |

### Properties (set via JavaScript)

| Property            | Type                 | Description                                                         |
|---------------------|----------------------|---------------------------------------------------------------------|
| `operationsDetails` | `Object[]` or `Object` | The operations data to render. Single object is wrapped into an array. |
| `isPrint`           | `boolean`            | Same as `is-print` attribute                                        |
| `loading`           | `boolean`            | Same as `loading` attribute                                         |

> ⚠️ **Important**: complex data (objects, arrays) must be passed as **properties**, not attributes. Attributes only accept strings.

### Data shape (`operationsDetails`)

The component expects an array of operation detail objects. Minimal shape:

```typescript
interface OperationDetails {
  items?: OperationItem[];
  childrenOperations?: OperationDetails[];
  // ... domain-specific fields
}

interface OperationItem {
  code?: string;
  locationSystems?: LocationSystem[];
  // ... domain-specific fields rendered by child components
}
```

The exact shape is determined by the data your backend produces. The component handles missing fields gracefully (it simply does not render the corresponding section).

## Demo

A standalone `demo.html` is included in this repository. Clone the repo and open it directly in your browser — no build, no server required:

```bash
git clone https://github.com/your-org/display-operations-details-wc.git
cd display-operations-details-wc
# Open demo.html in your browser, or:
npx serve .
```

## Styling

The component uses Shadow DOM, so external styles cannot reach inside it. A few CSS custom properties can be set on the host element to theme the component:

```css
display-operations-details {
  --ipd-primary: #00378c;
  --ipd-text-primary: #1a1a1a;
  --ipd-text-secondary: #6e6e73;
  --ipd-border: #d2d2d7;
  --ipd-light-gray: #f5f5f7;
  --ipd-white: #ffffff;
}
```

## Browser support

Modern evergreen browsers with Custom Elements v1 and Shadow DOM v1 support:

- Chrome / Edge (latest)
- Firefox (latest)
- Safari 14+

No polyfills are bundled. If you need to support older browsers, add the [Web Components polyfills](https://www.npmjs.com/package/@webcomponents/webcomponentsjs).

## Project structure

```
.
├── src/
│   └── web-components/
│       └── OptKitRepairMethods/
│           ├── index.js                       # Public entry point
│           ├── DisplayOperationsDetailsWC.js  # Main component
│           ├── common/                        # Shared utilities (table, modal)
│           └── operationDetails/              # Sub-components (lazy-loaded)
├── demo.html
├── package.json
├── LICENSE
└── README.md
```

## Contributing

Contributions are welcome. Please open an issue before submitting a PR for significant changes.

## License

[MIT](./LICENSE) © IPD Automotive
