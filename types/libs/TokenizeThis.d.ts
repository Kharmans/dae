declare const DEMODE_NONE: "modeNone";
declare const DEMODE_DEFAULT: "modeDefault";
declare const DEMODE_MATCH: "modeMatch";
/**
 * Sorts the tokenizable substrings by their length DESC.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
declare function DEsortTokenizableSubstrings(a: string, b: string): number;
declare function DEendsWith(str: any, suffix: any): boolean;
/**
 * Create an instance of this class for each new string you wish to parse.
 */
declare class DETokenizer {
    /**
     *
     * @param {DETokenizeThis} factory
     * @param {string} str
     * @param {function} forEachToken
     */
    constructor(factory: DETokenizeThis, str: string, forEachToken: Function);
    /**
     * Holds the processed configuration.
     *
     * @type {DETokenizeThis}
     */
    factory: DETokenizeThis;
    /**
     * The string to tokenize.
     *
     * @type {string}
     */
    str: string;
    /**
     * The function to call for teach token.
     *
     * @type {Function}
     */
    forEachToken: Function;
    /**
     * The previous character consumed.
     *
     * @type {string}
     */
    previousChr: string;
    /**
     * The current quote to match.
     *
     * @type {string}
     */
    toMatch: string;
    /**
     * The current token being created.
     *
     * @type {string}
     */
    currentToken: string;
    /**
     * Keeps track of the current "mode" of tokenization.
     * The tokenization rules are different depending if you are tokenizing an explicit string (surrounded by quotes),
     * versus a non-explicit string (not surrounded by quotes).
     *
     * @type {*[]}
     */
    modeStack: any[];
    currentIndex: number;
    /**
     *
     * @returns {string}
     */
    getCurrentMode(): string;
    /**
     *
     * @param {string} mode
     * @returns {Number}
     */
    setCurrentMode(mode: string): number;
    /**
     *
     * @returns {string}
     */
    completeCurrentMode(): string;
    /**
     *
     * @param {*} token
     */
    push(token: any): void;
    tokenize(): void;
    /**
     *
     * @param {string} chr
     */
    consume(chr: string): void;
    /**
     * This crazy function parses out potential tokenizable substrings out of the current token.
     *
     * @returns {*}
     */
    pushDefaultModeTokenizables(): any;
    /**
     *
     * @param {string} chr
     * @returns {*}
     */
    modeNone(chr: string): any;
    /**
     *
     * @param {string} chr
     * @returns {string}
     */
    modeDefault(chr: string): string;
    /**
     *
     * @param {string} chr
     * @returns {string}
     */
    modeMatch(chr: string): string;
}
/**
 * This is the main class.  It takes in the config, processes it, and creates tokenizer instances based on that config.
 */
declare class DETokenizeThis {
    /**
     *
     * @returns {{shouldTokenize: string[], shouldMatch: string[], shouldDelimitBy: string[], convertLiterals: boolean, escapeCharacter: string}}
     */
    static get defaultConfig(): {
        shouldTokenize: string[];
        shouldMatch: string[];
        shouldDelimitBy: string[];
        convertLiterals: boolean;
        escapeCharacter: string;
    };
    /**
     *
     * @param {{shouldTokenize: string[], shouldMatch: string[], shouldDelimitBy: string[]}} [config]
     */
    constructor(config?: {
        shouldTokenize: string[];
        shouldMatch: string[];
        shouldDelimitBy: string[];
    });
    /**
     *
     * @type {boolean}
     */
    convertLiterals: boolean;
    /**
     *
     * @type {string}
     */
    escapeCharacter: string;
    /**
     * Holds the list of tokenizable substrings.
     *
     * @type {Array}
     */
    tokenizeList: any[];
    /**
     * Holds an easy lookup map of tokenizable substrings.
     *
     * @type {{}}
     */
    tokenizeMap: {};
    /**
     * Holds the list of quotes to match explicit strings with.
     *
     * @type {Array}
     */
    matchList: any[];
    /**
     * Holds an easy lookup map of quotes to match explicit strings with.
     *
     * @type {{}}
     */
    matchMap: {};
    /**
     * Holds the list of delimiters.
     *
     * @type {Array}
     */
    delimiterList: any[];
    /**
     * Holds an easy lookup map of delimiters.
     *
     * @type {{}}
     */
    delimiterMap: {};
    /**
     * Creates a Tokenizer, then immediately calls "tokenize".
     *
     * @param {string} str
     * @param {function} forEachToken
     * @returns {*}
     */
    tokenize(str: string, forEachToken: Function): any;
}
