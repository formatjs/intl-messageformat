import { Formats, Pattern } from "./compiler";
import { MessageFormatPattern } from "intl-messageformat-parser";
export default class MessageFormat<T> {
    static defaultLocale: string;
    private static __localeData__;
    static readonly formats: Formats;
    private _locale;
    private pattern;
    private message;
    constructor(message: string, locales?: string | string[], overrideFormats?: Formats);
    static __addLocaleData(data: {
        locale: string;
        [locale: string]: any;
    }): void;
    static __parse: (msg: string) => MessageFormatPattern;
    format: (values: Record<string, string | number>) => string;
    resolvedOptions(): {
        locale: string;
    };
    _resolveLocale(locales: string | string[]): string;
    _compilePattern(ast: MessageFormatPattern, locales: string | string[], formats: Formats): Pattern[];
    _format(pattern: Pattern[], values: Record<string, string | number>): string;
}
