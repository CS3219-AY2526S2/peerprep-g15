export const Roles = ['user', 'admin'] as const;
export type Role = (typeof Roles)[number];
