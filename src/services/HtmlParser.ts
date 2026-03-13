import * as htmlparser2 from 'htmlparser2';
import {normalizeText} from '../utils/textNormalizer';

export interface ParsedLink {
  href: string;
  text: string;
}

export interface ParsedContent {
  textContent: string;
  links: ParsedLink[];
}

const SKIP_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'head',
  'meta',
  'link',
  'canvas',
  'template',
]);

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'main', 'aside', 'footer', 'header',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'ul', 'ol', 'tr', 'td', 'th',
  'blockquote', 'pre', 'br', 'hr',
]);

export class HtmlParser {
  static parse(html: string): ParsedContent {
    const textParts: string[] = [];
    const links: ParsedLink[] = [];
    let skipDepth = 0;
    let currentLinkHref: string | null = null;
    let currentLinkText = '';

    const parser = new htmlparser2.Parser({
      onopentag(name: string, attrs: Record<string, string>) {
        if (SKIP_TAGS.has(name)) {
          skipDepth++;
          return;
        }
        if (BLOCK_TAGS.has(name)) {
          textParts.push('\n');
        }
        if (name === 'a' && attrs.href && !attrs.href.startsWith('#')) {
          currentLinkHref = attrs.href;
          currentLinkText = '';
        }
      },
      ontext(rawText: string) {
        if (skipDepth > 0) {
          return;
        }
        const cleaned = rawText.replace(/\s+/g, ' ');
        if (cleaned.trim()) {
          textParts.push(cleaned);
          if (currentLinkHref !== null) {
            currentLinkText += cleaned;
          }
        }
      },
      onclosetag(name: string) {
        if (SKIP_TAGS.has(name)) {
          skipDepth = Math.max(0, skipDepth - 1);
          return;
        }
        if (name === 'a' && currentLinkHref !== null) {
          const trimmed = currentLinkText.trim();
          if (trimmed || currentLinkHref) {
            links.push({href: currentLinkHref, text: trimmed});
          }
          currentLinkHref = null;
          currentLinkText = '';
        }
      },
    });

    parser.write(html);
    parser.end();

    const rawText = textParts.join('');
    const textContent = normalizeText(rawText);

    return {textContent, links};
  }
}
