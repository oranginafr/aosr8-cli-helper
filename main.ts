import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, Modal, Plugin, SuggestModal, TFile } from 'obsidian';
import commandDataR04 from './commands_R04.json';
import { keywords } from './keywords';

interface CommandNode {
    _desc?: string; // Description stored at the node if it matches a full command
    [key: string]: CommandNode | string | undefined;
}

interface CommandDetail {
    command: string;
    description: string;
    syntax: string;
    parameters: { name: string; description: string }[];
    defaults: string;
    platforms_supported: { [key: string]: string };
    usage_guidelines: string[];
    examples: string[];
    release_history: string[];
    related_commands: { command: string; description: string }[];
    mib_objects: string[];
    output_definitions: { field: string; description: string }[];
}

export default class Aosr8Plugin extends Plugin {
    autocompleteTree: CommandNode = {};
    commandsR04: { [key: string]: CommandDetail } = commandDataR04 as any;

    async onload() {
        console.log('Loading AOSR8 CLI Helper (R04 Intelligent Mode)');
        
        // 1. Build Autocomplete Tree dynamically from R04 Data
        this.buildTreeFromR04();

        // 2. Register Intelligent Autocomplete
        this.registerEditorSuggest(new Aosr8Suggest(this.app, this.autocompleteTree));

        // 3. Register Search Command (Keep this as a helper)
        this.addCommand({
            id: 'search-aosr8-command',
            name: 'Search AOS R8 Command Library',
            callback: () => {
                new CommandSearchModal(this.app, this.commandsR04).open();
            }
        });

        // 4. Register Syntax Highlighting
        this.registerMarkdownCodeBlockProcessor("aosr8", (source, el, ctx) => {
            const pre = el.createEl("pre");
            const codeBlock = pre.createEl("code", { cls: "is-loaded language-aosr8" });
            const lines = source.split("\n");
            for (const line of lines) {
                const lineDiv = codeBlock.createDiv({ cls: "token-line" });
                if (line.trim().startsWith("!") || line.trim().startsWith("#")) {
                    lineDiv.createSpan({ text: line, cls: "aosr8-comment" });
                    continue;
                }
                const parts = line.split(/([ \t]+|[()[\\]{} M,])/); 
                for (const part of parts) {
                    if (part === "") continue;
                    const lower = part.toLowerCase();
                    if (/^\s+$/.test(part)) lineDiv.createSpan({ text: part });
                    else if (keywords.keywords1.has(lower)) lineDiv.createSpan({ text: part, cls: "aosr8-keyword" });
                    else lineDiv.createSpan({ text: part });
                }
            }
        });
    }

    buildTreeFromR04() {
        this.autocompleteTree = {};
        
        // Iterate over all 2700+ commands
        for (const [cmdName, details] of Object.entries(this.commandsR04)) {
            // "show ip isis status" -> ["show", "ip", "isis", "status"]
            const parts = cmdName.trim().split(/\s+/);
            
            let currentLevel = this.autocompleteTree;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].toLowerCase(); // Normalize to lowercase for tree traversal
                
                if (!currentLevel[part]) {
                    currentLevel[part] = {};
                }
                
                // Move down
                currentLevel = currentLevel[part] as CommandNode;
                
                // If this is the last part, store the description here
                if (i === parts.length - 1) {
                    currentLevel._desc = details.description;
                }
            }
        }
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
        
        // Simple heuristic: Only trigger if line isn't empty and we are typing a word
        if (!sub.trim()) return null;

        const match = sub.match(/(\S+)$/);
        const query = match ? match[1] : "";
        const startCh = match ? match.index! : cursor.ch;
        
        return { 
            start: { line: cursor.line, ch: startCh }, 
            end: cursor, 
            query: query 
        };
    }

    getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
        const line = context.editor.getLine(context.start.line);
        // Get everything BEFORE the current word being typed to traverse the tree
        // Ex: "show ip i" -> context.query is "i". Prefix is "show ip ".
        const prefix = line.substring(0, context.start.ch).trim();
        
        // Tokenize the path: "show", "ip"
        const pathTokens = prefix.length > 0 ? prefix.split(/\s+/) : [];
        
        let current = this.data;
        let validPath = true;

        // Traverse down the tree based on already typed words
        for (const token of pathTokens) {
            const lowerToken = token.toLowerCase();
            if (current[lowerToken] && typeof current[lowerToken] === 'object') {
                current = current[lowerToken] as CommandNode;
            } else {
                validPath = false;
                break;
            }
        }

        if (!validPath) return [];

        const query = context.query.toLowerCase();
        
        // Get keys that are not internal properties like _desc
        const suggestions = Object.keys(current).filter(k => k !== "_desc" && k.startsWith(query));
        
        return suggestions.sort();
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        const div = el.createDiv({ cls: "suggestion-content" });
        div.createSpan({ text: value, cls: "suggestion-text" });
        // Future enhancement: Pass the description here if available in the context
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        const editor = this.context.editor;
        editor.replaceRange(value + " ", this.context.start, this.context.end);
        // Don't auto-trigger next suggestion immediately, let user type
    }
}

class CommandSearchModal extends SuggestModal<CommandDetail> {
    commands: { [key: string]: CommandDetail };
    constructor(app: App, commands: { [key: string]: CommandDetail }) {
        super(app);
        this.commands = commands;
        this.setPlaceholder("Search for an AOS R8 command...");
    }
    getSuggestions(query: string): CommandDetail[] {
        const lowerQuery = query.toLowerCase();
        return Object.values(this.commands).filter(cmd => 
            cmd.command.toLowerCase().includes(lowerQuery) || 
            cmd.description.toLowerCase().includes(lowerQuery)
        ).slice(0, 50);
    }
    renderSuggestion(cmd: CommandDetail, el: HTMLElement) {
        el.createEl("div", { text: cmd.command, cls: "aosr8-search-title" });
        el.createEl("small", { text: cmd.description, cls: "aosr8-search-desc" });
    }
    onChooseSuggestion(cmd: CommandDetail, evt: MouseEvent | KeyboardEvent) {
        new CommandDetailModal(this.app, cmd).open();
    }
}

class CommandDetailModal extends Modal {
    cmd: CommandDetail;
    constructor(app: App, cmd: CommandDetail) {
        super(app);
        this.cmd = cmd;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("aosr8-detail-modal");
        contentEl.createEl("h2", { text: this.cmd.command });
        contentEl.createEl("p", { text: this.cmd.description, cls: "aosr8-description" });
        contentEl.createEl("h3", { text: "Syntax" });
        contentEl.createEl("pre", { cls: "language-aosr8" }).createEl("code", { text: this.cmd.syntax });
        if (this.cmd.parameters.length > 0 && this.cmd.parameters[0].name !== "N/A") {
            contentEl.createEl("h3", { text: "Parameters" });
            const table = contentEl.createEl("table");
            const header = table.createEl("tr");
            header.createEl("th", { text: "Parameter" });
            header.createEl("th", { text: "Description" });
            for (const param of this.cmd.parameters) {
                const row = table.createEl("tr");
                row.createEl("td", { text: param.name, cls: "aosr8-param-name" });
                row.createEl("td", { text: param.description });
            }
        }
        if (this.cmd.usage_guidelines.length > 0 && this.cmd.usage_guidelines[0] !== "N/A") {
            contentEl.createEl("h3", { text: "Usage Guidelines" });
            const list = contentEl.createEl("ul");
            for (const guide of this.cmd.usage_guidelines) {
                list.createEl("li", { text: guide });
            }
        }
        if (this.cmd.examples.length > 0) {
            contentEl.createEl("h3", { text: "Examples" });
            for (const example of this.cmd.examples) {
                contentEl.createEl("pre", { cls: "aosr8-example" }).createEl("code", { text: example });
            }
        }
        if (this.cmd.output_definitions.length > 0) {
            contentEl.createEl("h3", { text: "Output Definitions" });
            const table = contentEl.createEl("table");
            for (const def of this.cmd.output_definitions) {
                const row = table.createEl("tr");
                row.createEl("td", { text: def.field, cls: "aosr8-param-name" });
                row.createEl("td", { text: def.description });
            }
        }
        if (this.cmd.release_history.length > 0) {
            contentEl.createEl("h4", { text: "Release History" });
            contentEl.createEl("p", { text: this.cmd.release_history.join(", "), cls: "aosr8-history" });
        }
    }
    onClose() { this.contentEl.empty(); }
}