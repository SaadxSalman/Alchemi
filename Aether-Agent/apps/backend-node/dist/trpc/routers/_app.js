"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_1 = require("../trpc");
const monitor_1 = require("./monitor");
const solana_1 = require("./solana");
const allocation_1 = require("./allocation");
exports.appRouter = (0, trpc_1.router)({
    monitor: monitor_1.monitorRouter,
    solana: solana_1.solanaRouter,
    allocation: allocation_1.allocationRouter,
});
//# sourceMappingURL=_app.js.map