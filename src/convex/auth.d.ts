import { BetterAuth } from '@convex-dev/better-auth';
export declare const betterAuthComponent: BetterAuth<string>;
export declare const createUser: import("convex/server").RegisteredMutation<"internal", {
    input: {
        model: "user";
        data: {
            image?: string | null | undefined;
            twoFactorEnabled?: boolean | null | undefined;
            isAnonymous?: boolean | null | undefined;
            username?: string | null | undefined;
            displayUsername?: string | null | undefined;
            phoneNumber?: string | null | undefined;
            phoneNumberVerified?: boolean | null | undefined;
            role?: string | null | undefined;
            banned?: boolean | null | undefined;
            banReason?: string | null | undefined;
            banExpires?: number | null | undefined;
            stripeCustomerId?: string | null | undefined;
            teamId?: string | null | undefined;
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
            image?: string | null | undefined;
            createdAt?: number | undefined;
            updatedAt?: number | undefined;
            twoFactorEnabled?: boolean | null | undefined;
            isAnonymous?: boolean | null | undefined;
            username?: string | null | undefined;
            displayUsername?: string | null | undefined;
            phoneNumber?: string | null | undefined;
            phoneNumberVerified?: boolean | null | undefined;
            role?: string | null | undefined;
            banned?: boolean | null | undefined;
            banReason?: string | null | undefined;
            banExpires?: number | null | undefined;
            stripeCustomerId?: string | null | undefined;
            teamId?: string | null | undefined;
        };
        model: "user";
    };
}, Promise<{
    _id: string;
    _creationTime: number;
    image?: string | null | undefined;
    twoFactorEnabled?: boolean | null | undefined;
    isAnonymous?: boolean | null | undefined;
    username?: string | null | undefined;
    displayUsername?: string | null | undefined;
    phoneNumber?: string | null | undefined;
    phoneNumberVerified?: boolean | null | undefined;
    role?: string | null | undefined;
    banned?: boolean | null | undefined;
    banReason?: string | null | undefined;
    banExpires?: number | null | undefined;
    stripeCustomerId?: string | null | undefined;
    userId?: string | null | undefined;
    teamId?: string | null | undefined;
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
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
            impersonatedBy?: string | null | undefined;
            activeOrganizationId?: string | null | undefined;
            activeTeamId?: string | null | undefined;
            createdAt: number;
            updatedAt: number;
            userId: string;
            expiresAt: number;
            token: string;
        };
    };
}, Promise<any>>, isAuthenticated: import("convex/server").RegisteredQuery<"public", {}, Promise<boolean>>;
export declare const getCurrentUser: import("convex/server").RegisteredQuery<"public", {}, Promise<any>>;
