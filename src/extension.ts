/**
 * @file Main extension logic for the "Class Sync - Student" VS Code extension.
 * @author Afonso Miguel & Gemini
 * @version 1.0.0
 */

import * as vscode from 'vscode';
import { exec, ExecException } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Executes a shell command within the current workspace folder and shows a progress notification.
 * @param command The shell command to execute.
 * @param progressTitle The title to display in the progress notification UI.
 * @returns A Promise that resolves with the standard output (stdout) of the command upon success.
 */
function runCommand(command: string, progressTitle: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            return reject('Please open a project folder first.');
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        }, async (progress) => {
            exec(command, { cwd: workspaceFolder }, (error: ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    console.error(`Execution error object:`, error);
                    return reject(error);
                }
                console.log(`Command output: ${stdout}`);
                return resolve(stdout);
            });
        });
    });
}

/**
 * The main entry point for the extension.
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {

    console.log('The "Class Sync - Student" extension is now active.');

    // --- STATUS BAR BUTTON VISIBILITY LOGIC ---

    // 1. Create the two Status Bar buttons for the student.
    const cloneButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    cloneButton.command = 'class-sync.studentSetup';
    cloneButton.text = `$(repo-clone) Class Sync: Clone`;
    cloneButton.tooltip = 'Clone the professor\'s repository to start';
    context.subscriptions.push(cloneButton);

    const resetButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
    resetButton.command = 'class-sync.studentResync';
    resetButton.text = `$(debug-restart) Class Sync: Reset`;
    resetButton.tooltip = 'Reset local changes to the professor\'s latest version';
    context.subscriptions.push(resetButton);

    /**
     * Checks if the current folder is a Git repository and shows/hides the appropriate buttons.
     */
    function updateStatusBarVisibility() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            const gitPath = path.join(workspaceFolder, '.git');
            if (fs.existsSync(gitPath)) {
                // If it's a Git repo, show the Reset button and hide the Clone button.
                resetButton.show();
                cloneButton.hide();
            } else {
                // If not, show the Clone button and hide the Reset button.
                cloneButton.show();
                resetButton.hide();
            }
        } else {
            // If no folder is open, hide both.
            cloneButton.hide();
            resetButton.hide();
        }
    }

    // 2. Update button visibility when the extension starts...
    updateStatusBarVisibility();

    // 3. ...and whenever the user opens or closes a folder.
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBarVisibility()));


    // --- COMMAND DEFINITIONS ---

    /**
     * Command for the student's initial setup: clones the professor's repository.
     */
    const studentSetup = vscode.commands.registerCommand('class-sync.studentSetup', async () => {
        try {
            const repoName = await vscode.window.showInputBox({ prompt: 'Enter the name of the professor\'s repository' });
            if (!repoName) {
                return;
            }
            const repoUrl = `https://github.com/afmiguel/${repoName}.git`;
    
            await runCommand(`git clone ${repoUrl} .`, 'Cloning the professor\'s project...');
    
            await context.workspaceState.update('repoUrl', repoUrl);
    
            vscode.window.showInformationMessage('Professor\'s project cloned successfully! The window will now reload.');
    
            // Reloading the window will automatically trigger the visibility update.
            vscode.commands.executeCommand('workbench.action.reloadWindow');
    
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to clone repository: ${error.message || error}`);
        }
    });

    /**
     * The "panic button" command for a student to reset their work.
     */
    const studentResync = vscode.commands.registerCommand('class-sync.studentResync', async () => {
        const confirmation = await vscode.window.showWarningMessage(
            'This will discard ALL your local changes and download the professor\'s latest version. Are you sure?',
            { modal: true },
            'Yes, reset my work'
        );

        if (confirmation === 'Yes, reset my work') {
            try {
                await runCommand('git fetch origin', 'Fetching professor\'s version...');

                const branchName = (await runCommand('git branch --show-current', 'Checking current branch...')).trim();
                await runCommand(`git reset --hard origin/${branchName}`, 'Resetting to professor\'s version...');
                
                await runCommand('git clean -fd', 'Cleaning untracked files...');
                vscode.window.showInformationMessage('Project synced successfully!');
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to sync: ${error.message || error}`);
            }
        }
    });

    context.subscriptions.push(studentSetup, studentResync);
}

/**
 * This function is called when the extension is deactivated.
 */
export function deactivate() {}