/** Almacén del token JWT en el navegador (localStorage). */
const KEY = 'coolway.token';

export const getToken = (): string | null => localStorage.getItem(KEY);
export const setToken = (token: string): void => localStorage.setItem(KEY, token);
export const clearToken = (): void => localStorage.removeItem(KEY);
