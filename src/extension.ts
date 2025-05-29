// e:\work\novel-extention\src\extension.ts
import * as vscode from 'vscode';
import { WordStorage } from './storage';
import { transformText } from './textProcessor';
import { initializeDecorations, updateDecorations } from './decorationProvider';
import { SidebarWebViewProvider } from './sidebarWebViewProvider';

let wordStorage: WordStorage;
let charCountStatusBarItem: vscode.StatusBarItem;

async function updateCharCountStatus(): Promise<void> { // Make async to await wordMap
    if (vscode.window.activeTextEditor && wordStorage) { // Ensure wordStorage is initialized
        const document = vscode.window.activeTextEditor.document;
        const originalText = document.getText();

        try {
            const wordMap = await wordStorage.getWordMap();
            const transformedText = transformText(originalText, wordMap);
            // Count characters in the transformed text
            const count = transformedText.length;

        charCountStatusBarItem.text = `$(symbol-string) Chars: ${count}`;
            charCountStatusBarItem.tooltip = `Current file transformed character count: ${count}`;
        charCountStatusBarItem.show();
        } catch (error) {
            console.error("Error updating character count status:", error);
            charCountStatusBarItem.text = `$(symbol-string) Chars: Error`;
            charCountStatusBarItem.tooltip = `Error calculating transformed character count.`;
            charCountStatusBarItem.show();
        }
    } else {
        charCountStatusBarItem.hide();
    }
}

export function deactivate() {
    // StatusBarItem will be disposed automatically if added to context.subscriptions
    // No explicit charCountStatusBarItem.dispose() needed here if it's in subscriptions.
}

export function activate(context: vscode.ExtensionContext) {
    wordStorage = new WordStorage(context);

    // Register Sidebar Webview Provider
    const sidebarProvider = new SidebarWebViewProvider(
        context.extensionUri,
        wordStorage,
        updateDecorations // Pass the actual updateDecorations function
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarWebViewProvider.viewType, sidebarProvider));

    // Initialize decorations
    initializeDecorations(context, wordStorage);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('novelExtension.refreshWordList', () => {
            sidebarProvider.sendWordsToWebview(); // Also refresh webview
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('customTextTransformer.transformAndSaveFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active text editor.');
                return;
            }

            const document = editor.document;
            const originalText = document.getText();
            const wordMap = await wordStorage.getWordMap();

            const transformedContent = transformText(originalText, wordMap);

            try {
                const newUri = await vscode.window.showSaveDialog({
                    defaultUri: document.uri.with({ path: document.uri.path.replace(/(\.[^.]+)$/, '_transformed$1') }),
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'Text Files': ['txt', 'md', 'log'], // Customize as needed
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'All Files': ['*']
                    }
                });

                if (newUri) {
                    await vscode.workspace.fs.writeFile(newUri, Buffer.from(transformedContent, 'utf8'));
                    vscode.window.showInformationMessage(`File saved: ${vscode.workspace.asRelativePath(newUri)}`);
                    vscode.workspace.openTextDocument(newUri).then(doc => vscode.window.showTextDocument(doc));
                }
            } catch (e: any) {
                vscode.window.showErrorMessage(`Error saving file: ${e.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('customTextTransformer.refreshDecorations', () => {
            updateDecorations(wordStorage);
            vscode.window.showInformationMessage('Text decorations refreshed.');
        })
    );


    // Initialize Status Bar Item for Character Count
    charCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(charCountStatusBarItem);

    // Update status bar on activation and when active editor changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async () => {
        // wordStorage might not be fully ready if called too early,
        // but updateCharCountStatus now checks for it.
        await updateCharCountStatus();
    }));

    // Update status bar when text changes in the active editor
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            await updateCharCountStatus();
        }
    }));

    // Initial update for the status bar
    // Ensure wordStorage is available before the first call.
    // It's initialized right at the start of activate, so it should be fine.
    updateCharCountStatus(); // This will now be an async call, fire and forget.

    // Listen for configuration changes to reload words if the file path changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('novelExtension.wordListFilePath')) {
            if (wordStorage) {
                await wordStorage.refreshStorageLocation(); // Method to be added in WordStorage
                // Refresh webview and decorations as words might have changed
                sidebarProvider.sendWordsToWebview();
                updateDecorations(wordStorage);
                vscode.window.showInformationMessage('Word list file path changed. Words reloaded.');
            }
        }
    }));

    // Subscribe to word changes from storage to update webview
    context.subscriptions.push(wordStorage.onDidChangeWords(() => {
        sidebarProvider.sendWordsToWebview();
    }));
}
