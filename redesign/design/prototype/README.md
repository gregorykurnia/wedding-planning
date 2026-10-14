# Veil prototype
Start at `index.html`. Every screen works on phone and desktop widths; light only (see decisions.md).
- `assets/veil.css`: tokens and components. `assets/data.js`: normal and stress data, with today fixed at 14 October 2026. `assets/app.js`: the shell, menu, sheets, toasts, states and money rules.
- `?state=<name>` shows a state; `?stress` swaps in the stress data. The dashed "Prototype" tab is not part of the design.
- Money rule used everywhere: still to pay = price − paid. A booking's totals, funders and due dates come from its parts.
