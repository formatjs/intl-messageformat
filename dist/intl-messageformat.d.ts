declare module "compiler" {
    import { MessageFormatPattern, Element } from "intl-messageformat-parser";
    export default class Compiler {
        private locales;
        private formats;
        constructor(locales: string | string[], formats: object);
        compile(ast: MessageFormatPattern): any;
        compileMessage(ast: MessageFormatPattern): any;
        compileMessageText(element: Element): any;
        compileArgument(element: any): StringFormat | PluralFormat | SelectFormat | {
            id: any;
            format: (value: number) => string;
        };
        compileOptions(element: any): {};
    }
    class StringFormat {
        private id;
        constructor(id: string);
        format(value: any): string;
    }
    class PluralFormat {
        constructor(id: any, useOrdinal: any, offset: any, options: any, locales: any);
        getOption(value: any): any;
    }
    class SelectFormat {
        constructor(id: any, options: any);
        getOption(value: any): any;
    }
}
