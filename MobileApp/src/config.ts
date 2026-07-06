/**
 * Backend GraphQL endpoint. Mirrors the WebApp's VITE_GRAPHQL_URL.
 * The production API is deployed on Vercel; swap to the localhost line
 * when running the Services backend locally.
 */
// export const GRAPHQL_URL = 'http://10.0.2.2:4000/graphql'; // Android emulator -> localhost
export const GRAPHQL_URL = 'https://menu-management-sand.vercel.app/graphql';

export const SESSION_STORAGE_KEY = 'menu-user-session';
