import mongoose, { type InferSchemaType } from 'mongoose';
export declare const crisisSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
    severity: number;
    crisisLabel: string;
    description: string;
    source: string;
    reportCount: number;
    status: "detected" | "monitoring" | "response-active" | "resolved";
    active: boolean;
    imageUrl?: string | null | undefined;
    solanaTx?: string | null | undefined;
    location?: {
        country?: string | null | undefined;
        region?: string | null | undefined;
        coordinates?: {
            lat?: number | null | undefined;
            lng?: number | null | undefined;
        } | null | undefined;
    } | null | undefined;
} & mongoose.DefaultTimestampProps, mongoose.Document<unknown, {}, {
    type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
    severity: number;
    crisisLabel: string;
    description: string;
    source: string;
    reportCount: number;
    status: "detected" | "monitoring" | "response-active" | "resolved";
    active: boolean;
    imageUrl?: string | null | undefined;
    solanaTx?: string | null | undefined;
    location?: {
        country?: string | null | undefined;
        region?: string | null | undefined;
        coordinates?: {
            lat?: number | null | undefined;
            lng?: number | null | undefined;
        } | null | undefined;
    } | null | undefined;
} & mongoose.DefaultTimestampProps, {
    id: string;
}, mongoose.ResolveSchemaOptions<{
    timestamps: true;
}>> & Omit<{
    type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
    severity: number;
    crisisLabel: string;
    description: string;
    source: string;
    reportCount: number;
    status: "detected" | "monitoring" | "response-active" | "resolved";
    active: boolean;
    imageUrl?: string | null | undefined;
    solanaTx?: string | null | undefined;
    location?: {
        country?: string | null | undefined;
        region?: string | null | undefined;
        coordinates?: {
            lat?: number | null | undefined;
            lng?: number | null | undefined;
        } | null | undefined;
    } | null | undefined;
} & mongoose.DefaultTimestampProps & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    [path: string]: mongoose.SchemaDefinitionProperty<undefined, any, any>;
} | {
    [x: string]: mongoose.SchemaDefinitionProperty<any, any, mongoose.Document<unknown, {}, {
        type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
        severity: number;
        crisisLabel: string;
        description: string;
        source: string;
        reportCount: number;
        status: "detected" | "monitoring" | "response-active" | "resolved";
        active: boolean;
        imageUrl?: string | null | undefined;
        solanaTx?: string | null | undefined;
        location?: {
            country?: string | null | undefined;
            region?: string | null | undefined;
            coordinates?: {
                lat?: number | null | undefined;
                lng?: number | null | undefined;
            } | null | undefined;
        } | null | undefined;
    } & mongoose.DefaultTimestampProps, {
        id: string;
    }, mongoose.ResolveSchemaOptions<{
        timestamps: true;
    }>> & Omit<{
        type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
        severity: number;
        crisisLabel: string;
        description: string;
        source: string;
        reportCount: number;
        status: "detected" | "monitoring" | "response-active" | "resolved";
        active: boolean;
        imageUrl?: string | null | undefined;
        solanaTx?: string | null | undefined;
        location?: {
            country?: string | null | undefined;
            region?: string | null | undefined;
            coordinates?: {
                lat?: number | null | undefined;
                lng?: number | null | undefined;
            } | null | undefined;
        } | null | undefined;
    } & mongoose.DefaultTimestampProps & {
        _id: mongoose.Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, {
    type: "Flood" | "Wildfire" | "Earthquake" | "Hurricane" | "Tsunami" | "Drought" | "Landslide" | "Tornado" | "Volcanic Eruption" | "Unknown";
    severity: number;
    crisisLabel: string;
    description: string;
    source: string;
    reportCount: number;
    status: "detected" | "monitoring" | "response-active" | "resolved";
    active: boolean;
    imageUrl?: string | null | undefined;
    solanaTx?: string | null | undefined;
    location?: {
        country?: string | null | undefined;
        region?: string | null | undefined;
        coordinates?: {
            lat?: number | null | undefined;
            lng?: number | null | undefined;
        } | null | undefined;
    } | null | undefined;
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
export type Crisis = InferSchemaType<typeof crisisSchema>;
export declare const CrisisModel: mongoose.Model<any, {}, {}, {}, any, any, any>;
//# sourceMappingURL=crisis.d.ts.map