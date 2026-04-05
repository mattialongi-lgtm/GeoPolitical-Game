declare module 'zod' {
  export type ZodSchema = any;
  export const z: any;
  export namespace z {
    type infer<T> = any;
  }
  export default z;
}

declare module 'zod/v4' {
  export const z: any;
  export namespace z {
    type infer<T> = any;
  }
  export default z;
}

declare module 'better-sqlite3' {
  const Database: any;
  export = Database;
}

declare module 'axios' {
  const axios: any;
  export default axios;
}
