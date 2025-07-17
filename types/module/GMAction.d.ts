import { AnyMutableObject } from "fvtt-types/utils";
export declare class GMActionMessage {
    action: string;
    sender: string;
    targetGM: string;
    data: {};
    constructor(action: string, sender: string, targetGM: string, data: {});
}
export declare let socketlibSocket: any;
export declare let setupSocket: () => void;
export declare function applyActiveEffects({ activate, activityUuid, targetList, activeEffects, effectDuration, itemCardUuid, removeMatchLabel, toggleEffect, metaData, origin }: ApplyActiveEffectsInput): Promise<void>;
export declare function convertDuration(durationData: {
    units: string;
    value: number;
}, inCombat: boolean, maxSecondsToConvert?: number): {
    type: string;
    seconds: number;
    rounds: number;
    turns: number;
} | {
    type: string;
    seconds: undefined;
    rounds: undefined;
    turns: undefined;
};
interface ApplyActiveEffectsInput {
    activate: boolean;
    activityUuid?: string;
    targetList: string[];
    activeEffects: ActiveEffect.Source[];
    effectDuration: {
        units: string;
        value: number;
    };
    itemCardUuid?: string | null;
    removeMatchLabel: boolean;
    toggleEffect: boolean;
    metaData: AnyMutableObject;
    origin?: string;
}
export {};
