"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_1 = require("../trpc");
const monitor_1 = require("./monitor");
exports.appRouter = (0, trpc_1.router)({
    monitor: monitor_1.monitorRouter,
});
//# sourceMappingURL=_app.js.map