export default class ApiException<T> extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: T,
    public success = false,
  ) {
    super(message);
  }
}
