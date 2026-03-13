import {diffLines, Change} from 'diff';

export interface TextDiffResult {
  changes: Change[];
  addedLines: number;
  removedLines: number;
}

export interface LinkDiffResult {
  added: Array<{href: string; text: string}>;
  removed: Array<{href: string; text: string}>;
}

export class DiffEngine {
  static computeTextDiff(oldText: string, newText: string): TextDiffResult {
    const changes = diffLines(oldText, newText, {
      ignoreWhitespace: true,
    });

    let addedLines = 0;
    let removedLines = 0;

    for (const change of changes) {
      if (change.added) {
        addedLines += change.count ?? 1;
      } else if (change.removed) {
        removedLines += change.count ?? 1;
      }
    }

    return {changes, addedLines, removedLines};
  }

  static computeLinkDiff(
    oldLinks: Array<{href: string; text: string}>,
    newLinks: Array<{href: string; text: string}>,
  ): LinkDiffResult {
    const oldHrefs = new Set(oldLinks.map(l => l.href));
    const newHrefs = new Set(newLinks.map(l => l.href));

    const added = newLinks.filter(l => !oldHrefs.has(l.href));
    const removed = oldLinks.filter(l => !newHrefs.has(l.href));

    return {added, removed};
  }

  static generateSummary(
    textDiff: TextDiffResult,
    linksAdded: Array<{href: string; text: string}>,
    linksRemoved: Array<{href: string; text: string}>,
  ): string {
    const parts: string[] = [];

    if (textDiff.addedLines > 0 || textDiff.removedLines > 0) {
      parts.push(
        `+${textDiff.addedLines} / -${textDiff.removedLines} lines`,
      );
    }
    if (linksAdded.length > 0) {
      parts.push(`${linksAdded.length} new link${linksAdded.length > 1 ? 's' : ''}`);
    }
    if (linksRemoved.length > 0) {
      parts.push(
        `${linksRemoved.length} link${linksRemoved.length > 1 ? 's' : ''} removed`,
      );
    }

    return parts.join(' · ') || 'Minor changes';
  }

  static hasSignificantChanges(
    textDiff: TextDiffResult,
    linksAdded: Array<{href: string}>,
    linksRemoved: Array<{href: string}>,
  ): boolean {
    return (
      textDiff.addedLines > 0 ||
      textDiff.removedLines > 0 ||
      linksAdded.length > 0 ||
      linksRemoved.length > 0
    );
  }
}
