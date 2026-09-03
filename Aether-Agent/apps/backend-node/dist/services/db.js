"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONGODB_URI = exports.db = void 0;
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aether-agent';
exports.MONGODB_URI = MONGODB_URI;
async function connectDB() {
    if (mongoose_1.default.connection.readyState === 1)
        return;
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ MongoDB connected');
    }
    catch (err) {
        console.error('❌ MongoDB connection error:', err);
        // Do not crash — app should still boot so REST/health endpoints work.
    }
}
exports.db = mongoose_1.default.connection;
//# sourceMappingURL=db.js.map