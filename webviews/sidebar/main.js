(function() {
    const vscode = acquireVsCodeApi();
    let currentWords = [];

    // DOM Elements
    const wordList = document.getElementById('word-list');
    const wordForm = document.getElementById('word-form');
    const formTitle = document.getElementById('form-title');
    const keyInput = document.getElementById('key-input');
    const valueInput = document.getElementById('value-input');
    const originalKeyInput = document.getElementById('original-key-input');
    const saveWordButton = document.getElementById('save-word-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    
    const searchVariableInput = document.getElementById('search-variable-input');

    function renderWordList(wordsToRender) {
        wordList.innerHTML = '';
        wordsToRender.forEach(word => {
            const li = document.createElement('li');
            li.classList.add('word-entry');
            li.innerHTML = `
                <span><span class="key">${escapeHtml(word.key)}:</span> <span class="value">${escapeHtml(word.value)}</span></span>
                <span class="word-actions">
                    <button class="edit-btn" data-key="${escapeHtml(word.key)}" data-value="${escapeHtml(word.value)}">Edit</button>
                    <button class="delete-btn" data-key="${escapeHtml(word.key)}">Delete</button>
                </span>
            `;
            wordList.appendChild(li);
        });

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                formTitle.textContent = 'Edit Word';
                const key = e.target.dataset.key;
                const value = e.target.dataset.value;
                keyInput.value = key;
                valueInput.value = value;
                originalKeyInput.value = key;
                saveWordButton.textContent = 'Update Word';
                cancelEditButton.style.display = 'inline-block';
                keyInput.focus();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const keyToDelete = e.target.dataset.key;
                // Ask extension to show a confirmation dialog
                vscode.postMessage({ command: 'confirmDeleteWord', key: keyToDelete });
            });
        });
    }

    function resetForm() {
        formTitle.textContent = 'Add New Word';
        wordForm.reset();
        originalKeyInput.value = '';
        saveWordButton.textContent = 'Save Word';
        cancelEditButton.style.display = 'none';
    }

    wordForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const key = keyInput.value.trim();
        const value = valueInput.value.trim();
        const originalKey = originalKeyInput.value.trim();

        if (!key) { alert('Key cannot be empty.'); return; }

        if (originalKey) { // Editing
            vscode.postMessage({ command: 'editWord', originalKey, newKey: key, newValue: value });
        } else { // Adding
            vscode.postMessage({ command: 'addWord', key, value });
        }
        resetForm();
    });

    cancelEditButton.addEventListener('click', resetForm);

    searchVariableInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredWords = currentWords.filter(word => 
            word.key.toLowerCase().includes(searchTerm) || 
            word.value.toLowerCase().includes(searchTerm)
        );
        renderWordList(filteredWords);
    });

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateWords':
                currentWords = message.words.sort((a,b) => a.key.localeCompare(b.key));
                renderWordList(currentWords);
                // If search term exists, re-apply filter
                if (searchVariableInput.value) {
                    searchVariableInput.dispatchEvent(new Event('input'));
                }
                break;
        }
    });

    // Request initial words
    vscode.postMessage({ command: 'getWords' });
}());
