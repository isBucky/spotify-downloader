import { createPrompt, useKeypress, usePrefix, useState } from '@inquirer/core';
import { sync as globSync } from 'glob';
import chalk from 'chalk';

import { basename, join, resolve, dirname } from 'node:path';
import { statSync, accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';

/**
 * Prompts the user to select a folder, returning the path as a string.
 *
 * @param options - Configuration options for the prompt, including message, base path, and ignore patterns.
 * @returns A promise that resolves to the path of the selected folder.
 */

export async function selectFolder(options: PromptOptions): Promise<string> {
    try {
        const result = await folderPrompt(options);
        return result; // Return only the path as string
    } catch (error) {
        console.error('Error executing prompt:', error);
        throw error;
    }
}

/**
 * Get an array of folder choices from the given directory, excluding any matching the
 * given ignore patterns. The choices are objects with name, value, and isRestricted
 * properties, where name is the folder name as a string including a folder icon, value
 * is the full path to the folder, and isRestricted is a boolean indicating whether the
 * folder is read-only.
 *
 * @param currentDir The directory to scan for folders.
 * @param ignorePatterns An array of glob patterns to ignore.
 * @returns An array of folder choices.
 */
function getFolderChoices(currentDir: string, ignorePatterns: string[] = []): Choice[] {
    const items = globSync(join(currentDir, '*/'), { dot: false, ignore: ignorePatterns });
    const choices: Choice[] = [];

    items.forEach((item) => {
        let isRestricted = false;
        try {
            accessSync(item, constants.W_OK);
        } catch (error) {
            isRestricted = true; // No write permission
        }

        choices.push({
            name: `📁 ${basename(item)}`,
            value: item,
            isRestricted,
        });
    });

    return choices;
}

const folderPrompt = createPrompt<string, PromptOptions>((config, done) => {
    const userHomeDir = homedir();
    const initialDir = config.basePath ? resolve(config.basePath) : userHomeDir; // Default to home directory

    const [currentDir, setCurrentDir] = useState(
        initialDir.startsWith(userHomeDir) ? initialDir : userHomeDir, // Ensure it stays within home
    );
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState<string | null>(null); // State for the selected folder

    const choices = getFolderChoices(currentDir, config.ignorePatterns); // Pass ignore patterns
    const prefix = usePrefix({});
    const visibleLimit = 5; // Limit of visible items
    const startIndex = Math.max(0, cursor - Math.floor(visibleLimit / 2)); // Calculate window start
    const endIndex = Math.min(choices.length, startIndex + visibleLimit); // Calculate window end

    useKeypress((key) => {
        if (selected) return;

        switch (key.name) {
            case 'up':
                {
                    const newCursor = cursor > 0 ? cursor - 1 : choices.length - 1;
                    setCursor(newCursor);
                }
                break;

            case 'down':
                {
                    const newCursor = cursor < choices.length - 1 ? cursor + 1 : 0;
                    setCursor(newCursor);
                }
                break;

            case 'space':
                {
                    if (choices[cursor]?.value) {
                        if (statSync(choices[cursor]?.value).isDirectory()) {
                            const newDir = choices[cursor].value;

                            if (!choices[cursor].isRestricted && newDir.startsWith(userHomeDir)) {
                                setCurrentDir(newDir);
                                setCursor(0);
                            }
                        }
                    } else setCursor(0);
                }
                break;

            case 'backspace':
                {
                    const parentDir = dirname(currentDir); // Go back to parent folder

                    if (parentDir.startsWith(userHomeDir) && parentDir !== currentDir) {
                        setCurrentDir(parentDir);
                        setCursor(0);
                    }
                }
                break;

            case 'return':
                {
                    const selectedPath = choices[cursor]?.value;

                    if (selectedPath && !choices[cursor]?.isRestricted) {
                        setSelected(selectedPath); // Mark as selected
                        done(selectedPath); // Return only the path as string
                    }
                }
                break;
        }
    });

    const instructions = chalk.dim('  [↑↓ navigate | space enter | backspace back | enter select]');

    if (selected) {
        const selectedMessage = `${chalk.white(config.message)} ${chalk.yellow(basename(selected))}`;

        return `${prefix} ${selectedMessage}`;
    }

    const title = `${chalk.bold(config.message)} ${chalk.bold.cyan(currentDir)}`;
    const visibleChoices = choices.slice(startIndex, endIndex); // Only visible items

    const options = visibleChoices.map((choice, index) => {
        const isSelected = startIndex + index === cursor;
        const prefix = isSelected ? chalk.green('❯ ') : '  ';

        const name = choice.isRestricted
            ? chalk.red(choice.name)
            : isSelected
              ? chalk.yellow(choice.name)
              : choice.name;

        return `${prefix}${name}`;
    });

    const hasMoreAbove = startIndex > 0;
    const hasMoreBelow = endIndex < choices.length;
    const outputLines = [
        `${prefix} ${title}`, // Message with current directory next to it
        ...(hasMoreAbove ? [chalk.dim('  ...')] : []),
        ...options,
        ...(hasMoreBelow ? [chalk.dim('  ...')] : []),
        instructions,
    ];

    // Join all lines into a single string with line breaks
    return outputLines.join('\n');
});

interface PromptOptions {
    message: string;
    basePath?: string;
    ignorePatterns?: string[];
}

interface Choice {
    name: string;
    value: string;
    isRestricted: boolean;
}
