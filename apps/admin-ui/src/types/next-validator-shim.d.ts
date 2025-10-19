// Shim to satisfy Next.js generated validator imports that reference a non-existent `apps/admin-ui/app` directory.
// Our source uses `src/app`, but Nx/Next may generate type validators that import from `apps/admin-ui/app/**`.
// This module declaration prevents TypeScript from failing on those imports during type checking.
// Important: use `any` (not `unknown`) so the imported type can satisfy `AppPageConfig<...>` constraints in Next's validator.
declare module '../../../../../apps/admin-ui/app/*' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any;
  export = mod;
}
