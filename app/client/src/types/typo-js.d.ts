declare module 'typo-js' {
  export default class Typo {
    loaded: boolean;
    dictionary: string | null;
    constructor();
    constructor(dictionary: string, affData: string, wordsData: string);
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
    checkExact(word: string): boolean;
    hasFlag(word: string, flag: string, wordFlags?: any): boolean;
  }
}
