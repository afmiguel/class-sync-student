/**
 * @file Main extension logic for the "Class Sync" VS Code extension.
 * This file contains the activation logic and command definitions for both
 * the professor and student workflows.
 * @author Afonso Miguel & Gemini
 * @version 1.0.0
 */

// Import the necessary modules from VS Code and Node.js
import * as vscode from 'vscode';
import { exec, ExecException } from 'child_process';

/**
 * Executes a shell command within the current workspace folder and shows a progress notification.
 * This is a centralized utility function for running Git commands.
 * @param command The shell command to execute.
 * @param progressTitle The title to display in the progress notification UI.
 * @returns A Promise that resolves with the standard output (stdout) of the command upon success.
 * It rejects with the error object from the command's execution upon failure.
 */
function runCommand(command: string, progressTitle: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// Ensure a workspace folder is open.
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceFolder) {
			return reject('Please open a project folder first.');
		}

		// Use VS Code's progress API to give user feedback for long-running operations.
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: progressTitle,
			cancellable: false
		}, async (progress) => {
			exec(command, { cwd: workspaceFolder }, (error: ExecException | null, stdout: string, stderr: string) => {
				// If the 'exec' callback provides an error object, the command failed.
				if (error) {
					console.error(`Execution error object:`, error);
					// Reject with the full error object, which contains the exit code, stdout, and stderr.
					return reject(error);
				}
				// If successful, resolve with the standard output.
				console.log(`Command output: ${stdout}`);
				return resolve(stdout);
			});
		});
	});
}

/**
 * The main entry point for the extension. This function is called only once
 * when the extension is activated (i.e., the first time one of its commands is run).
 * @param context The extension context provided by VS Code, used for subscriptions and state management.
 */
export function activate(context: vscode.ExtensionContext) {

	console.log('The "Class Sync" extension is now active.');

	// --- PROFESSOR COMMANDS ---

	/**
	 * Command for the professor's initial setup: configures Git, connects to a GitHub repo, and pushes the initial state.
	 * This version is customized for a specific user to reduce prompts.
	 */
	const professorSetup = vscode.commands.registerCommand('class-sync.professorSetup', async () => {
		try {
			// --- INÍCIO DAS ALTERAÇÕES DE CUSTOMIZAÇÃO ---

			// 1. Informações do usuário agora são fixas (hardcoded).
			const userName = "Afonso Miguel";
			const userEmail = "afonso.miguel@pucpr.br";

			// 2. Pede apenas o NOME do repositório, não o URL completo.
			const repoName = await vscode.window.showInputBox({
				prompt: 'Enter the repository name',
				placeHolder: 'e.g., class-repo (must be created and empty on GitHub first)'
			});
			if (!repoName) { return; }

			// 3. Monta o URL completo automaticamente.
			const repoUrl = `https://github.com/afmiguel/${repoName}.git`;

			// --- FIM DAS ALTERAÇÕES DE CUSTOMIZAÇÃO ---
			
			// --- A LÓGICA DE EXECUÇÃO CONTINUA A MESMA ---

			await runCommand(`git config --global user.name "${userName}"`, 'Configuring user name...');
			await runCommand(`git config --global user.email "${userEmail}"`, 'Configuring email...');
			vscode.window.showInformationMessage(`Git configured globally for: ${userName}`);
			
			await runCommand('git init', 'Initializing local repository...');

			try {
				await runCommand('git remote remove origin', 'Cleaning up old remote configurations...');
			} catch (error) {
				console.log("No old 'origin' remote to remove, which is normal.");
			}

			await runCommand(`git remote add origin ${repoUrl}`, 'Connecting to the remote repository...');

			await runCommand('git add .', 'Adding files...');
			await runCommand('git commit --allow-empty -m "Initial commit from Class Sync"', 'Making initial commit...');

			const branchName = (await runCommand('git branch --show-current', 'Checking current branch...')).trim();
			await runCommand(`git push -u origin ${branchName}`, 'Pushing initial project...');

			vscode.window.showInformationMessage(`Repository configured and pushed successfully!`);

		} catch (error: any) {
			vscode.window.showErrorMessage(`An error occurred: ${error.message || error}`);
		}
	});

	/**
	 * Registers the command for the professor to quickly push an update.
	 * This is the day-to-day command for syncing changes to students.
	 */
	const professorSync = vscode.commands.registerCommand('class-sync.professorSync', async () => {
		try {
			// First, check if there are any changes to commit.
			// 'git status --porcelain' is a script-friendly command that is language-independent.
			const status = await runCommand('git status --porcelain', 'Checking for changes...');
			if (status.trim() === '') {
				// If the output is empty, there's nothing to do.
				vscode.window.showInformationMessage('No new changes to send.');
				return;
			}

			// If there are changes, proceed with the add, commit, push workflow.
			await runCommand('git add .', 'Adding changes...');
			await runCommand('git commit -m "Update from professor"', 'Committing changes...');
			await runCommand('git push', 'Pushing updates...'); 
			
			vscode.window.showInformationMessage('Update pushed successfully!');
			
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to push update: ${error.message || error}`);
		}
	});

	// --- STUDENT COMMANDS ---

	/**
	 * Command for the student's initial setup: clones the professor's repository.
	 * This version is customized to ask only for the repository name.
	 */
	const studentSetup = vscode.commands.registerCommand('class-sync.studentSetup', async () => {
		try {
			// 1. Asks for only the repository name, not the full URL.
			const repoName = await vscode.window.showInputBox({ prompt: 'Enter the name of the professor\'s repository' });
			if (!repoName) {
				return;
			}

			// 2. Constructs the full URL automatically.
			const repoUrl = `https://github.com/afmiguel/${repoName}.git`;
	
			// The rest of the logic remains the same.
			await runCommand(`git clone ${repoUrl} .`, 'Cloning the professor\'s project...');
	
			await context.workspaceState.update('repoUrl', repoUrl);
	
			vscode.window.showInformationMessage('Professor\'s project cloned successfully! The window will now reload.');
	
			vscode.commands.executeCommand('workbench.action.reloadWindow');
	
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to clone repository: ${error.message || error}`);
		}
	});

	/**
	 * Registers the "panic button" command for a student to reset their work.
	 * It discards all local changes and syncs their project to the professor's latest version.
	 */
	const studentResync = vscode.commands.registerCommand('class-sync.studentResync', async () => {
		const confirmation = await vscode.window.showWarningMessage(
			'This will discard ALL your local changes and download the professor\'s latest version. Are you sure?',
			{ modal: true }, // The modal option prevents the user from accidentally dismissing the dialog.
			'Yes, reset my work'
		);

		if (confirmation === 'Yes, reset my work') {
			try {
				await runCommand('git fetch origin', 'Fetching professor\'s version...');

				// Dynamically get the current branch name to reset correctly.
				const branchName = (await runCommand('git branch --show-current', 'Checking current branch...')).trim();
				await runCommand(`git reset --hard origin/${branchName}`, 'Resetting to professor\'s version...');
				
				// Remove any new, untracked files the student may have created.
				await runCommand('git clean -fd', 'Cleaning untracked files...');
				vscode.window.showInformationMessage('Project synced successfully!');
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to sync: ${error.message || error}`);
			}
		}
	});

	// Add all registered commands to the extension's subscriptions list to make them available.
	context.subscriptions.push(professorSetup, professorSync, studentSetup, studentResync);
}

/**
 * This function is called when the extension is deactivated.
 * It can be used for cleanup tasks.
 */
export function deactivate() {}