import { StreamLanguage, StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { keywords } from "./keywords";

// Regex definitions
const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
const macRegex = /^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}/; // Colon format
const macRegexDot = /^[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}/; // Dot format (common in switch configs)
const stringRegex = /^".*?"/;
const numberRegex = /^\d+/;

export const aosr8Language = StreamLanguage.define({
    token(stream: StringStream) {
        // Eat whitespace
        if (stream.eatSpace()) return null;

        // Comments: "!" at start of line or generally, or "remark"
        if (stream.match(/^!.*/) || stream.match(/^#.*/)) {
            return t.lineComment;
        }

        // Strings
        if (stream.match(stringRegex)) {
            return t.string;
        }

        // IP Address
        if (stream.match(ipRegex)) {
            return t.number; // Using number color for IPs is common, or create custom logic
        }

        // MAC Address
        if (stream.match(macRegex) || stream.match(macRegexDot)) {
            return t.special(t.string); // Distinctive color for MACs
        }

        // Numbers
        if (stream.match(numberRegex)) {
            return t.number;
        }

        // Words / Keywords
        // Consume the word
        const wordMatch = stream.match(/^[\w\d\.-]+/);
        if (wordMatch) {
            const word = wordMatch[0].toLowerCase(); // XML was case insensitive? check. Assuming case insensitive for CLI.

            if (keywords.keywords1.has(word)) return t.keyword;   // Major commands -> keyword (Purple/Gold)
            if (keywords.keywords2.has(word)) return t.typeName;  // Parameters -> Type (Blue/Cyan)
            if (keywords.keywords3.has(word)) return t.invalid;   // Critical/No -> Invalid/Red
            if (keywords.keywords4.has(word)) return t.atom;      // Protocols -> Atom (Green/Teal)
            if (keywords.keywords5.has(word)) return t.variableName; // Actions -> Variable (Blue)
            
            return null; // Normal text
        }

        // Skip one char if nothing matched (safety)
        stream.next();
        return null;
    }
});
