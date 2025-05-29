// e:\work\novel-extention\src\decorationProvider.ts
import * as vscode from 'vscode';
import { findPlaceholders, COMMENT_REGEX } from './textProcessor'; // Import COMMENT_REGEX
import { WordStorage } from './storage';

let activeEditor = vscode.window.activeTextEditor;
let timeout: NodeJS.Timeout | undefined = undefined;

// Decoration type for resolved placeholders (original text hidden, value shown)
const resolvedDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        margin: '0 0.2em 0 0.2em', // 右側に0.2emのマージンを追加して後続テキストとの間に空間を作る
        color: new vscode.ThemeColor('editor.foreground'),
    },
    textDecoration: 'none; display: none;' // 元のテキストを非表示にする (Hide original text)
});

// Decoration type for focused placeholders (original text visible)
const focusedDecorationType = vscode.window.createTextEditorDecorationType({
    // Original text is visible by default (no textDecoration to hide it).
    // No 'after' content needed here. Hover message will be provided in DecorationOptions.
});

// Decoration type for comments
const commentDecorationType = vscode.window.createTextEditorDecorationType({
    color: 'green', // Specific green color as requested
    // For theme-aware green, consider: new vscode.ThemeColor('editorComment.foreground')
});

export async function updateDecorations(wordStorage: WordStorage) {
    if (!activeEditor) {
        return;
    }

    const document = activeEditor.document;
    const text = document.getText(); // Get full document text for comment matching

    // Optional: Add language checks if you only want this for specific file types
    // if (document.languageId !== 'plaintext' && document.languageId !== 'your-custom-language') {
    //     activeEditor.setDecorations(resolvedDecorationType, []);
    //     activeEditor.setDecorations(focusedDecorationType, []);
    //     activeEditor.setDecorations(commentDecorationType, []); // Clear comment decorations too
    //     return;
    // }

    const placeholders = findPlaceholders(document);
    const wordMap = await wordStorage.getWordMap();

    const resolvedDecorations: vscode.DecorationOptions[] = [];
    const focusedDecorations: vscode.DecorationOptions[] = [];
    const selections = activeEditor.selections;

    for (const p of placeholders) {
        const resolvedValue = wordMap.get(p.key);
        if (resolvedValue !== undefined) {
            const hoverMessage = new vscode.MarkdownString();
            hoverMessage.isTrusted = true; // Allow commands in hover if needed later
            hoverMessage.appendMarkdown(`**Variable:** \`{${p.key}}\`\n`);
            hoverMessage.appendMarkdown(`**Value:** \`${resolvedValue}\``);

            let isFocused = false;
            for (const selection of selections) {
                // Check if the placeholder's range intersects with the selection.
                // This covers both cursor position within the range and selection overlapping the range.
                if (p.range.intersection(selection)) {
                    isFocused = true;
                    break;
                }
            }

            if (isFocused) {
                focusedDecorations.push({
                    range: p.range,
                    hoverMessage: hoverMessage,
                    // No specific renderOptions needed here if focusedDecorationType
                    // is defined to show original text and has no 'after' by default.
                });
            } else {
                resolvedDecorations.push({
                    range: p.range,
                    hoverMessage: hoverMessage,
                    renderOptions: {
                        after: { // This displays the resolved value next to the placeholder
                            contentText: `${resolvedValue}`, // Display only the resolved value
                        }
                    }
                });
            }
        }
    }

    // Comments
    const commentDecorations: vscode.DecorationOptions[] = [];
    let match;
    // Create a new RegExp instance from the imported COMMENT_REGEX to ensure `lastIndex` is reset for each call
    const localCommentRegex = new RegExp(COMMENT_REGEX);
    while ((match = localCommentRegex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const decoration = { range: new vscode.Range(startPos, endPos) };
        commentDecorations.push(decoration);
    }

    // Apply the decorations
    activeEditor.setDecorations(resolvedDecorationType, resolvedDecorations);
    activeEditor.setDecorations(focusedDecorationType, focusedDecorations);
    activeEditor.setDecorations(commentDecorationType, commentDecorations); // Apply comment decorations
}

function triggerUpdateDecorations(wordStorage: WordStorage, throttle = false) {
    if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
    }
    if (throttle) {
        timeout = setTimeout(() => updateDecorations(wordStorage), 200);
    } else {
        updateDecorations(wordStorage);
    }
}

export function initializeDecorations(context: vscode.ExtensionContext, wordStorage: WordStorage) {
    if (activeEditor) {
        triggerUpdateDecorations(wordStorage);
    }

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) triggerUpdateDecorations(wordStorage);
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) triggerUpdateDecorations(wordStorage, true);
    }));

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        if (activeEditor && event.textEditor === activeEditor) {
            triggerUpdateDecorations(wordStorage, true); // Throttle updates on selection change
        }
    }));
}