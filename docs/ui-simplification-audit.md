# Shelter Prep UI Simplification Audit

## Current issues found

- Primary navigation exposed daily workflow, admin operations, AI tools, memory tools, gallery, archive, invoices, history, and export actions at the same time.
- Several admin tools appeared twice: once in `More` and again as top-level buttons.
- Dashboard read like an admin tool board instead of a property-centered work queue.
- Visible statuses used internal operational terms such as `Needs Info`, `Estimate Ready`, and `Pending Approval`.
- Gallery management was available as a first-class navigation destination instead of an admin/contextual evidence tool.
- Mobile navigation could wrap or scroll through too many choices before the user reached the next action.

## Navigation simplification

Primary navigation is now:

- New Request
- Properties
- Dashboard
- Reports
- More

`Properties` is prepared as the property-centered work queue. It still uses the current request data model until a dedicated property route exists.

Admin tools moved under `More -> Admin Tools`:

- Project Gallery
- Messages
- Seller Prep
- Pricing Memory
- Material Costs
- Labor Rates
- AI Estimator
- Agent Learning
- Field Lesson Agent
- Archived Leads
- Invoices
- Historical Upload
- AI Intake
- Settings
- Export CSV

## Dashboard simplification

- Dashboard now opens with a single primary action: `Start New Request`.
- Dense admin status columns were replaced with guided property buckets:
  - Active Properties
  - Needs Review
  - Ready for Action
  - Recently Updated
- Property cards now lead with address, simplified status, workflow stage, and the next action.

## Mobile simplification

- Top navigation now has five mobile-friendly choices instead of many admin buttons.
- Tap targets remain 48px or larger.
- Property cards keep address and next action near the top.
- More/admin tools are contained in a scrollable menu instead of wrapping the header.

## What was changed

- Collapsed visible navigation in `src/App.tsx`.
- Added `Properties`, `Reports`, and `Settings` tabs while preserving existing backend/admin screens.
- Simplified status labels to `New`, `In Progress`, `Ready`, and `Done`.
- Reframed dashboard and property queue around guided cards and next actions.
- Moved CSV export into the More/Admin menu.
- Renamed gallery presentation copy to property evidence language and removed visible debug role text.

## TODO

- Add a true `properties` table/route when the data model is ready; current UI still maps properties from work requests.
- Move gallery evidence into each property detail view once property detail routing exists.
- Convert secondary flags such as `Needs Review`, `Contractor Assigned`, and `Seller Report Ready` into internal badges inside property detail instead of global columns.
- Add a dedicated property detail screen with tabs for requests, files/photos, repair items, notes, status, and report history.
- Audit copy in every admin tool so internal terms stay inside More/Admin.
