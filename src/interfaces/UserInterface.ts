export enum IUserRoleEnum {
  Admin = 'Admin',
  Staff = 'Staff',
}

export interface IUser {
  email: string;
  password: string;
  role: IUserRoleEnum;
}
