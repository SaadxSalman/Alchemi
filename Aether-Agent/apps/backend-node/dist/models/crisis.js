"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrisisModel = exports.crisisSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
exports.crisisSchema = new mongoose_1.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'Flood',
            'Wildfire',
            'Earthquake',
            'Hurricane',
            'Tsunami',
            'Drought',
            'Landslide',
            'Tornado',
            'Volcanic Eruption',
            'Unknown',
        ],
        index: true,
    },
    severity: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0.5,
    },
    crisisLabel: { type: String, required: true, default: 'Unknown' },
    location: {
        country: String,
        region: String,
        coordinates: {
            lat: Number,
            lng: Number,
        },
    },
    description: { type: String, default: '' },
    source: { type: String, default: 'manual' },
    imageUrl: String,
    reportCount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['detected', 'monitoring', 'response-active', 'resolved'],
        default: 'detected',
        index: true,
    },
    active: { type: Boolean, default: true },
    solanaTx: String,
}, {
    timestamps: true,
});
exports.CrisisModel = mongoose_1.default.models.Crisis ?? mongoose_1.default.model('Crisis', exports.crisisSchema);
//# sourceMappingURL=crisis.js.map