## 1. Data model & seed

- [x] 1.1 Add `catalog: []` to the seed/doc shape
- [x] 1.2 Merge standalone definitions into `buildCatalog`, deduped by
      normalized name

## 2. Commands

- [x] 2.1 Add `ADD_CATALOG_EXERCISE` (insert/remove at index, undoable)
- [x] 2.2 Add `catalogTarget` sync to `CATALOG_RENAME`
- [x] 2.3 Add `catalogTarget` sync to `CATALOG_UPDATE_FIELD` (def fields only)
- [x] 2.4 Add `catalogTarget` removal/restore to `CATALOG_DELETE`

## 3. Manager UI

- [x] 3.1 Add the kebab-menu entry opening the catalog manager drawer
- [x] 3.2 Render the unified, filterable exercise list with usage metadata
- [x] 3.3 Add the delete affordance, gated to unused definitions
- [x] 3.4 Wire open/close/back-stack state and hashchange reset

## 4. Create form

- [x] 4.1 Add the create-exercise form drawer (name, kind, video, notes)
- [x] 4.2 Wire "save & keep adding" and "save & close" submit actions
- [x] 4.3 Re-focus the name field after each "save & keep adding"

## 5. Styles

- [x] 5.1 Manager rows, delete button, and create-form layout in `styles.css`

## 6. Verification

- [x] 6.1 Manually verify: create → appears in list → add to routine → can no
      longer be deleted from the catalog
- [x] 6.2 Manually verify: rename/edit syncs across def + routine instances;
      delete is undoable to the same position
