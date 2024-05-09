import * as dotenv from 'dotenv';

dotenv.config();

export class Config {
  static readonly userName = process.env.USER_NAME;
  static readonly password = process.env.PASSWORD;

  public static getUserName() {
    return Config.userName ? Config.userName : '';
  }

  public static getPassword() {
    return Config.password ? Config.password : '';
  }
}
