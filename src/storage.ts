// e:\work\novel-extention\src\storage.ts
import * as vscode from 'vscode';
import { WordEntry } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
const STORAGE_KEY = 'novelExtension.registeredWords';

export class WordStorage {
    private context: vscode.ExtensionContext;
    private words: WordEntry[] = [];
    private readonly onDidChangeWordsEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeWords = this.onDidChangeWordsEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this._initialize();
    }
    private async _initialize(): Promise<void> {
        await this._loadWords();
    }
    private _getWordListFilePath(): vscode.Uri | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // vscode.window.showWarningMessage('No workspace folder open. Word list operations will be in-memory only for this session.');
            return undefined;
        }
        const workspaceRoot = workspaceFolders[0].uri;
        const relativePath = vscode.workspace.getConfiguration('novelExtension').get<string>('wordListFilePath');

        if (!relativePath) {
            // Default to .vscode/novelWords.json if not set, though package.json should provide a default.
            return vscode.Uri.joinPath(workspaceRoot, '.vscode', 'novelWords.json');
        }

        if (path.isAbsolute(relativePath)) {
            return vscode.Uri.file(relativePath);
        }
        return vscode.Uri.joinPath(workspaceRoot, relativePath);
    }

    private async _loadWords(): Promise<void> {
        const filePath = this._getWordListFilePath();
        if (!filePath) {
            this.words = []; // No workspace, or path not configured for file storage
            this.onDidChangeWordsEmitter.fire();
            return;
        }

        try {
            const fileContents = await fs.readFile(filePath.fsPath, 'utf-8');
            this.words = JSON.parse(fileContents) as WordEntry[];
        } catch (error: any) {
            if (error.code === 'ENOENT') { // File not found
                this.words = []; // Start with an empty list if file doesn't exist
            } else {
                vscode.window.showErrorMessage(`Error loading word list from ${filePath.fsPath}: ${error.message}`);
                this.words = []; // Fallback to empty list on other errors
            }
        }
        this.onDidChangeWordsEmitter.fire();
    }

    private async _saveWords(): Promise<void> {
        const filePath = this._getWordListFilePath();
        if (!filePath) {
            // Optionally, notify user that words can't be saved without a workspace/configured path
            // vscode.window.showWarningMessage('Cannot save word list: No workspace or file path configured.');
            return;
        }

        try {
            const dirPathUri = vscode.Uri.joinPath(filePath, '..');
            try {
                await fs.stat(dirPathUri.fsPath);
            } catch (e: any) {
                if (e.code === 'ENOENT') { // Directory does not exist
                    await fs.mkdir(dirPathUri.fsPath, { recursive: true });
                } else {
                    throw e; // Re-throw other errors
                }
            }
            await fs.writeFile(filePath.fsPath, JSON.stringify(this.words, null, 4), 'utf-8');
            this.onDidChangeWordsEmitter.fire(); // Notify that words have changed
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error saving word list to ${filePath.fsPath}: ${error.message}`);
        }
    }

    public async getWords(): Promise<WordEntry[]> {
        return [...this.words]; // Return a copy of the in-memory words
    }

    async addWord(key: string, value: string): Promise<void> {
        if (this.words.some(entry => entry.key === key)) {
            throw new Error(`Word with key "${key}" already exists.`);
        }
        this.words.push({ key, value });
        await this._saveWords();
    }

    async updateWord(originalKey: string, newKey: string, newValue: string): Promise<void> {
        const wordIndex = this.words.findIndex(entry => entry.key === originalKey);
        if (wordIndex === -1) {
            throw new Error(`Word with key "${originalKey}" not found.`);
        }
        if (newKey !== originalKey && this.words.some(entry => entry.key === newKey)) {
            throw new Error(`Another word with key "${newKey}" already exists.`);
        }
        this.words[wordIndex] = { key: newKey, value: newValue };
        await this._saveWords();
    }

    async deleteWord(key: string): Promise<void> {
        this.words = this.words.filter(entry => entry.key !== key);
        await this._saveWords();
    }

    async getWordMap(): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        for (const entry of this.words) {
            map.set(entry.key, entry.value);
        }
        return map;
    }
    public async refreshStorageLocation(): Promise<void> {
        await this._loadWords();
    }
}