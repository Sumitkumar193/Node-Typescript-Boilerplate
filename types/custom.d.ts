import { JwtToken, Pagination } from '../src/interfaces/Common';

declare namespace Express {
    export interface Request {
        token?: JwtToken;
        pagination?: Pagination;
    }
}