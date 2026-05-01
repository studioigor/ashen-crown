# Ashen Crown Art Overrides

Generated PNG assets go under this folder. The game only loads assets whose
manifest keys are listed in `manifest.generated.json`.

Default state:

```json
{
  "version": 1,
  "loadAll": false,
  "enabledKeys": []
}
```

After generating and placing a sheet, add its key from
`src/assets/artManifest.ts` to `enabledKeys`. Use `loadAll: true` only when
every listed PNG exists.
