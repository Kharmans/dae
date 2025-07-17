declare const DETokenizeThis: {
    new (factory: any, str: any, forEachToken: any): {
        factory: any;
        str: any;
        forEachToken: any;
        previousChr: string;
        toMatch: string;
        currentToken: string;
        modeStack: string[];
        currentIndex: number;
        getCurrentMode(): string;
        setCurrentMode(mode: any): number;
        completeCurrentMode(): string | undefined;
        push(token: any): void;
        tokenize(): void;
        consume(chr: any): void;
        modeNone(chr: any): void;
        modeDefault(chr: any): string | void;
        pushDefaultModeTokenizables(): any;
        modeMatch(chr: any): string | undefined;
    };
};
