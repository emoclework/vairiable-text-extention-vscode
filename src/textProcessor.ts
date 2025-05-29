// e:\work\novel-extention\src\textProcessor.ts
import * as vscode from 'vscode';

export const PLACEHOLDER_REGEX = /{([^{}]+?)}/g; // Non-greedy match for content inside {}
export const COMMENT_REGEX = /\/\/.*/g;

export interface PlaceholderMatch {
    key: string;
    range: vscode.Range;
    startIndex: number;
    endIndex: number;
}

/**
 * Parses text to find all placeholders and their positions.
 */
export function findPlaceholders(document: vscode.TextDocument): PlaceholderMatch[] {
    const text = document.getText();
    const matches: PlaceholderMatch[] = [];
    let match;
    while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
        const key = match[1];
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        matches.push({
            key,
            range: new vscode.Range(document.positionAt(startIndex), document.positionAt(endIndex)),
            startIndex,
            endIndex
        });
    }
    return matches;
}

/**
 * Transforms text: replaces placeholders, removes comments.
 */
export function transformText(text: string, wordMap: Map<string, string>): string {
    const lines = text.split(/\r?\n/);
    const processedLines: string[] = [];

    // Regex to identify lines that consist only of a comment (and possibly whitespace)
    // 例: "   // this is a comment"
    const commentOnlyLineRegex = /^\s*\/\/.*/;

    for (const line of lines) {
        // 1. 元の行がコメントのみの行かチェック
        if (commentOnlyLineRegex.test(line)) {
            // コメントのみの行は完全に削除するため、processedLines には追加しない
            continue;
        }

        // 2. コメントのみではない行（内容がある行、または元々空の行）の処理
        //    まずプレースホルダーを置換
        let processedLine = line.replace(PLACEHOLDER_REGEX, (match, key) => {
            return wordMap.get(key) || match; // 見つからなければ元の文字列を維持
        });

        //    次に、行末のコメント部分を削除 (例: "text // comment" -> "text ")
        processedLine = processedLine.replace(COMMENT_REGEX, '');

        //    行末の空白をトリム (例: "text " -> "text")
        processedLine = processedLine.trimEnd();

        processedLines.push(processedLine);
    }
    return processedLines.join('\n');
}