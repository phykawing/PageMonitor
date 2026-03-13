import {FETCH_TIMEOUT_MS, MAX_HTML_BYTES} from '../utils/constants';

/**
 * Uses XMLHttpRequest instead of fetch() because XHR's `timeout` property is
 * handled at the native networking layer.  JS timers (setTimeout) are throttled
 * by Android when the app is in the background, so fetch + AbortController
 * timeouts never fire — causing the background task to hang until the OS kills
 * it at the 60-second mark.
 */
export class PageFetcher {
  static fetch(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = FETCH_TIMEOUT_MS;

      // Headers
      xhr.setRequestHeader(
        'User-Agent',
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      );
      xhr.setRequestHeader(
        'Accept',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      );
      xhr.setRequestHeader('Accept-Language', 'en-US,en;q=0.9,zh-TW;q=0.8');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('Pragma', 'no-cache');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let text = xhr.responseText;
          if (text.length > MAX_HTML_BYTES) {
            text = text.slice(0, MAX_HTML_BYTES);
          }
          resolve(text);
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network request failed'));
      xhr.ontimeout = () =>
        reject(new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`));

      xhr.send();
    });
  }
}
