import { BetterAuth } from '@convex-dev/better-auth';
export declare const betterAuthComponent: BetterAuth<string>;
export declare const createUser: import("convex/server").RegisteredMutation<"internal", {
    input: {
        model: "user";
        data: {
            image?: string | undefined;
            twoFactorEnabled?: boolean | undefined;
            isAnonymous?: boolean | undefined;
            username?: string | undefined;
            displayUsername?: string | undefined;
            phoneNumber?: string | undefined;
            phoneNumberVerified?: boolean | undefined;
            role?: string | undefined;
            banned?: boolean | undefined;
            banReason?: string | undefined;
            banExpires?: number | undefined;
            stripeCustomerId?: string | undefined;
            name: string;
            email: string;
            emailVerified: boolean;
            createdAt: number;
            updatedAt: number;
        };
    };
}, Promise<any>>, updateUser: import("convex/server").RegisteredMutation<"internal", {
    input: {
        where?: {
            operator?: "lt" | "lte" | "gt" | "gte" | "eq" | "in" | "ne" | "contains" | "starts_with" | "ends_with" | undefined;
            connector?: "AND" | "OR" | undefined;
            value: string | number | boolean | string[] | number[] | null;
            field: string;
        }[] | undefined;
        update: {
            name?: string | undefined;
            email?: string | undefined;
            emailVerified?: boolean | undefined;
            image?: string | undefined;
            createdAt?: number | undefined;
            updatedAt?: number | undefined;
            twoFactorEnabled?: boolean | undefined;
            isAnonymous?: boolean | undefined;
            username?: string | undefined;
            displayUsername?: string | undefined;
            phoneNumber?: string | undefined;
            phoneNumberVerified?: boolean | undefined;
            role?: string | undefined;
            banned?: boolean | undefined;
            banReason?: string | undefined;
            banExpires?: number | undefined;
            stripeCustomerId?: string | undefined;
        };
        model: "user";
    };
}, Promise<{
    _id: string;
    _creationTime: number;
    image?: string | undefined;
    twoFactorEnabled?: boolean | undefined;
    isAnonymous?: boolean | undefined;
    username?: string | undefined;
    displayUsername?: string | undefined;
    phoneNumber?: string | undefined;
    phoneNumberVerified?: boolean | undefined;
    role?: string | undefined;
    banned?: boolean | undefined;
    banReason?: string | undefined;
    banExpires?: number | undefined;
    stripeCustomerId?: string | undefined;
    userId?: string | undefined;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: number;
    updatedAt: number;
}>>, deleteUser: import("convex/server").RegisteredMutation<"internal", {
    where?: {
        operator?: "lt" | "lte" | "gt" | "gte" | "eq" | "in" | "ne" | "contains" | "starts_with" | "ends_with" | undefined;
        connector?: "AND" | "OR" | undefined;
        value: string | number | boolean | string[] | number[] | null;
        field: string;
    }[] | undefined;
    sortBy?: {
        field: string;
        direction: "asc" | "desc";
    } | undefined;
    select?: string[] | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    unique?: boolean | undefined;
    model: string;
}, Promise<any>>, createSession: import("convex/server").RegisteredMutation<"internal", {
    input: {
        model: "session";
        data: {
            ipAddress?: string | undefined;
            userAgent?: string | undefined;
            impersonatedBy?: string | undefined;
            activeOrganizationId?: string | undefined;
            createdAt: number;
            updatedAt: number;
            userId: string;
            expiresAt: number;
            token: string;
        };
    };
}, Promise<any>>, isAuthenticated: import("convex/server").RegisteredQuery<"public", {}, Promise<boolean>>;
export declare const getCurrentUser: import("convex/server").RegisteredQuery<"public", {}, Promise<any>>;
