export const Roles = ['user', 'admin'] as const;
export type Role = (typeof Roles)[number];

export type ResolvedUser = {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: Role;
};
