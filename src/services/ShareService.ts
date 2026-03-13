import {Share} from 'react-native';
import {format} from 'date-fns';

interface ShareChangeParams {
  pageTitle: string;
  url: string;
  changeSummary: string;
  detectedAt: number;
  linksAdded: Array<{href: string; text: string}>;
  linksRemoved: Array<{href: string; text: string}>;
}

export class ShareService {
  static async shareChange(params: ShareChangeParams): Promise<void> {
    const {pageTitle, url, changeSummary, detectedAt, linksAdded, linksRemoved} = params;
    const detectedDate = format(new Date(detectedAt), 'yyyy-MM-dd HH:mm');

    let message = `📄 Page Changed: ${pageTitle}\n`;
    message += `🔗 ${url}\n`;
    message += `🕐 ${detectedDate}\n`;
    message += `📝 ${changeSummary}\n`;

    if (linksAdded.length > 0) {
      message += `\n➕ New links (${linksAdded.length}):\n`;
      linksAdded.slice(0, 5).forEach(link => {
        message += `  • ${link.text || link.href}\n`;
      });
      if (linksAdded.length > 5) {
        message += `  … and ${linksAdded.length - 5} more\n`;
      }
    }

    if (linksRemoved.length > 0) {
      message += `\n➖ Removed links (${linksRemoved.length}):\n`;
      linksRemoved.slice(0, 5).forEach(link => {
        message += `  • ${link.text || link.href}\n`;
      });
      if (linksRemoved.length > 5) {
        message += `  … and ${linksRemoved.length - 5} more\n`;
      }
    }

    message += `\n— Shared via Page Monitor`;

    await Share.share({
      message,
      title: `Page changes: ${pageTitle}`,
    });
  }
}
