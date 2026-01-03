import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Plugin, TFile } from 'obsidian';
import commandDataRaw from './obsidian_commands.json';
import { keywords } from './keywords';

interface CommandNode {
    [key: string]: CommandNode;
}

export default class Aosr8Plugin extends Plugin {
    normalizedData: CommandNode = {};

    async onload() {
        console.log('Loading AOSR8 CLI Helper');
        
        // 1. Initialize Autocomplete Data
        this.normalizedData = this.normalizeTree(commandDataRaw);
        this.registerEditorSuggest(new Aosr8Suggest(this.app, this.normalizedData));

        // 2. Register Syntax Highlighting for Reading Mode
        this.registerMarkdownCodeBlockProcessor("aosr8", (source, el, ctx) => {
            const pre = el.createEl("pre");
            // Add a class so Obsidian's default CSS doesn't override us too aggressively, 
            // but we might need to be specific.
            const codeBlock = pre.createEl("code", { cls: "is-loaded language-aosr8" });

            const lines = source.split("\n");
            for (const line of lines) {
                const lineDiv = codeBlock.createDiv({ cls: "token-line" });
                
                // 2.1 Check for comments (start with ! or #, possibly indented)
                if (line.trim().startsWith("!") || line.trim().startsWith("#")) {
                    lineDiv.createSpan({ text: line, cls: "aosr8-comment" });
                    continue; // Skip rest of line parsing
                }

                // 2.2 Tokenize line preserving delimiters
                // Split by spaces, tabs, common delimiters. Capturing group () includes the delimiter in the result array.
                const parts = line.split(/([ \t]+|[()[\]{} M,])/); 

                for (const part of parts) {
                    if (part === "") continue;

                    const lower = part.toLowerCase();

                    // Detect Type
                    if (/^\s+$/.test(part)) {
                        lineDiv.createSpan({ text: part });
                    }
                    // IP Address (simple check)
                    else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(part)) {
                        lineDiv.createSpan({ text: part, cls: "aosr8-number" });
                    }
                    // MAC Address (colon or dot)
                    else if (/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(part) || /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(part)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-mac" });
                    }
                    // Number
                    else if (/^\d+$/.test(part)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-number" });
                    }
                    // String (basic "...")
                    else if (part.startsWith('"') && part.endsWith('"')) {
                        lineDiv.createSpan({ text: part, cls: "aosr8-string" });
                    }
                    // Keywords Lookup
                    else if (keywords.keywords1.has(lower)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-keyword" });
                    } else if (keywords.keywords2.has(lower)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-type" });
                    } else if (keywords.keywords3.has(lower)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-invalid" });
                    } else if (keywords.keywords4.has(lower)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-atom" });
                    } else if (keywords.keywords5.has(lower)) {
                         lineDiv.createSpan({ text: part, cls: "aosr8-variable" });
                    }
                    // Fallback
                    else {
                        lineDiv.createSpan({ text: part });
                    }
                }
            }
        });
    }

    normalizeTree(raw: any): CommandNode {
        const root: CommandNode = {};
        const traverse = (currentRaw: any, currentRoot: CommandNode) => {
            for (const key in currentRaw) {
                if (key === "_options") continue;
                const parts = key.toLowerCase().split(/\s+/);
                let temp = currentRoot;
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!temp[part]) temp[part] = {};
                    if (i === parts.length - 1) {
                        const nextLevel = currentRaw[key];
                        if (typeof nextLevel === 'object' && !Array.isArray(nextLevel)) {
                            traverse(nextLevel, temp[part]);
                        }
                    } else {
                        temp = temp[part];
                    }
                }
            }
            if (raw._options && Array.isArray(raw._options)) {
                raw._options.forEach((opt: string) => {
                    const o = opt.toLowerCase();
                    if (!currentRoot[o]) currentRoot[o] = {};
                });
            }
        };
        traverse(raw, root);
        return root;
    }

    onunload() {
        console.log('Unloading AOSR8 CLI Helper');
    }
}

class Aosr8Suggest extends EditorSuggest<string> {
    data: CommandNode;

    constructor(app: App, data: CommandNode) {
        super(app);
        this.data = data;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const sub = line.substring(0, cursor.ch);
        if (!sub.trimStart()) return null;
        const match = sub.match(/(\S+)$/);
        const query = match ? match[1] : "";
        const startCh = match ? match.index! : cursor.ch;
        return { start: { line: cursor.line, ch: startCh }, end: cursor, query: query };
    }

    getSuggestions(context: EditorSuggestContext): string[] {
        const line = context.editor.getLine(context.start.line);
        const preStr = line.substring(0, context.start.ch).trim();
        const tokens = preStr.length > 0 ? preStr.toLowerCase().split(/\s+/) : [];
        const query = context.query.toLowerCase();
        let current = this.data;
        for (const token of tokens) {
            if (current[token]) current = current[token];
            else return [];
        }
        let suggestions = Object.keys(current);
        if (query) suggestions = suggestions.filter(s => s.startsWith(query));
        return suggestions.sort();
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        const editor = this.context.editor;
        editor.replaceRange(value + " ", this.context.start, this.context.end);
        const newPos = { line: this.context.start.line, ch: this.context.start.ch + value.length + 1 };
        editor.setCursor(newPos);
    }
}