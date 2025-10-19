// Shim to satisfy Next.js generated validator imports that reference a non-existent `apps/admin-ui/app` directory.
// Our source uses `src/app`, but Nx/Next may generate type validators that import from `apps/admin-ui/app/**`.
// This module declaration prevents TypeScript from failing on those imports during type checking.
declare module '../../../../../apps/admin-ui/app/*' {
  const mod: any;
  export = mod;
}
