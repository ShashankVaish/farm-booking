export const UserRoles = {
  CUSTOMER: 'CUSTOMER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
} as const;

export type AppUserRole = (typeof UserRoles)[keyof typeof UserRoles];
