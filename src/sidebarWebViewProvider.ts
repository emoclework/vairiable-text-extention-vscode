// e:\work\novel-extention\src\sidebarWebViewProvider.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WordStorage } from './storage';

export class SidebarWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'novelWordManagerWebview';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private wordStorage: WordStorage,
        private updateDecorationsFunction: (wordStorage: WordStorage) => Promise<void>
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'), // 既存のmediaディレクトリも保持する場合
                vscode.Uri.joinPath(this._extensionUri, 'webviews', 'sidebar')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.command) {
                case 'getWords':
                    await this.sendWordsToWebview();
                    break;
                case 'addWord':
                    try {
                        await this.wordStorage.addWord(data.key, data.value);
                        vscode.window.showInformationMessage(`Word "${data.key}" added.`);
                        await this.notifyUpdates();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(e.message);
                    }
                    break;
                case 'editWord':
                    try {
                        await this.wordStorage.updateWord(data.originalKey, data.newKey, data.newValue);
                        vscode.window.showInformationMessage(`Word "${data.originalKey}" updated.`);
                        await this.notifyUpdates();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(e.message);
                    }
                    break;
                case 'confirmDeleteWord': // Handle request to confirm deletion
                    const keyToDelete = data.key;
                    const decision = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete the word "${keyToDelete}"? This action cannot be undone.`,
                        { modal: true }, // Make the dialog modal
                        "Delete",       // Option 1 (Confirm)
                    );

                    if (decision === "Delete") {
                        await this.performDeleteWord(keyToDelete); // Call helper to perform deletion
                    }
                    break;
                // The 'deleteWord' case is removed as deletion is now initiated via 'confirmDeleteWord'
                // and handled by performDeleteWord after confirmation.
            }
        });

        // Initial load of words
        this.sendWordsToWebview();
    }

    private async performDeleteWord(key: string) {
        try {
            await this.wordStorage.deleteWord(key);
            vscode.window.showInformationMessage(`Word "${key}" deleted.`);
            await this.notifyUpdates();
        } catch (e: any) {
            vscode.window.showErrorMessage(e.message);
        }
    }

    private async notifyUpdates() {
        await this.sendWordsToWebview();
        await this.updateDecorationsFunction(this.wordStorage);
    }

    public async sendWordsToWebview() {
        if (this._view) {
            const words = await this.wordStorage.getWords();
            this._view.webview.postMessage({ command: 'updateWords', words: words });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'sidebar', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'sidebar', 'main.js'));

        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'webviews', 'sidebar', 'index.html');
        let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Replace placeholders in HTML
        htmlContent = htmlContent.replace(/{{webview.cspSource}}/g, webview.cspSource);
        htmlContent = htmlContent.replace(/{{styleUri}}/g, styleUri.toString());
        htmlContent = htmlContent.replace(/{{scriptUri}}/g, scriptUri.toString());

        return htmlContent;
    }
}