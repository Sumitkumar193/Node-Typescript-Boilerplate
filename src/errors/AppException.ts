export default class AppException extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
