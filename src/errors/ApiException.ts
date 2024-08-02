export default class ApiException<T> extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: T,
  ) {
    super(message);
  }
}
