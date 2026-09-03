"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
const db_1 = require("../services/db");
/**
 * tRPC context factory — built for every request.
 * In the future we attach auth info here (user sessions etc).
 */
function createContext({ req, res }) {
    return {
        req,
        res,
        db: db_1.db,
    };
}
//# sourceMappingURL=context.js.map