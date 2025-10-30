import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { URL } from 'url';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly apiUrl = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
  private readonly xfyunUrl = process.env.XFYUN_ITS_URL || 'http://its-api-sg.xf-yun.com/v2/its';
  private readonly xfyunAppId = process.env.XFYUN_APPID;
  private readonly xfyunApiKey = process.env.XFYUN_API_KEY;
  private readonly xfyunApiSecret = process.env.XFYUN_API_SECRET;
  private readonly libreApiKey = process.env.LIBRETRANSLATE_API_KEY;

  /**
   * Translate Vietnamese text to English using LibreTranslate.
   * Splits input into chunks of at most 5000 words each to avoid limits.
   */
  async translateViToEn(input: string): Promise<string> {
    const chunks = this.splitIntoWordChunks(input, 5000);
    const results: string[] = [];

    // Prefer XFYun if configured
    const useXfyun = !!(this.xfyunAppId && this.xfyunApiKey && this.xfyunApiSecret);

    for (const chunk of chunks) {
      if (!chunk) { results.push(''); continue; }
      if (useXfyun) {
        try {
          const translated = await this.translateWithXfyun(chunk, 'vi', 'en');
          results.push(translated ?? chunk);
          continue;
        } catch (e) {
          this.logger.warn(`XFYun translate vi->en failed, fallback to LibreTranslate. ${String(e)}`);
        }
      }
      try {
        const res = await axios.post(
          `${this.apiUrl}/translate`,
          { q: chunk, source: 'vi', target: 'en', format: 'text', api_key: this.libreApiKey },
          { headers: { 'Content-Type': 'application/json', ...(this.libreApiKey ? { Authorization: `Bearer ${this.libreApiKey}` } : {}) }, timeout: 15000 },
        );
        const translated: string | undefined = res.data?.translatedText as string | undefined;
        results.push(translated ?? chunk);
      } catch (error) {
        this.logger.warn(`Translation failed for a chunk, returning original text. ${String(error)}`);
        results.push(chunk);
      }
    }

    return results.join('\n');
  }

  /** Translate English text to Vietnamese using LibreTranslate with chunking */
  async translateEnToVi(input: string): Promise<string> {
    const chunks = this.splitIntoWordChunks(input, 5000)
      .map((x) => x.trim())
      .filter(Boolean); // Remove empty chunks
    const results: string[] = [];

    // Prefer XFYun if configured
    const useXfyun = !!(this.xfyunAppId && this.xfyunApiKey && this.xfyunApiSecret);

    for (const chunk of chunks) {
      if (!chunk) { results.push(""); continue; }
      if (useXfyun) {
        try {
          const translated = await this.translateWithXfyun(chunk, 'en', 'vi');
          results.push(translated ?? chunk);
          continue;
        } catch (error) {
          let respMsg = '';
          if ((error as any).response?.data) respMsg = JSON.stringify((error as any).response.data);
          this.logger.warn(`XFYun translate en->vi failed, fallback to LibreTranslate. ${String(error)} | Response: ${respMsg}`);
        }
      }
      try {
        const res = await axios.post(
          `${this.apiUrl}/translate`,
          { q: chunk, source: 'en', target: 'vi', format: 'text', api_key: this.libreApiKey },
          { headers: { 'Content-Type': 'application/json', ...(this.libreApiKey ? { Authorization: `Bearer ${this.libreApiKey}` } : {}) }, timeout: 15000 },
        );
        const translated: string | undefined = res.data?.translatedText as string | undefined;
        results.push(translated ?? chunk);
      } catch (error) {
        // Log chi tiết lỗi resp nếu có
        let respMsg = '';
        if ((error as any).response && (error as any).response.data) {
          respMsg = JSON.stringify((error as any).response.data);
        }
        this.logger.warn(`Translation failed for a chunk, returning original text. ${String(error)} | Response: ${respMsg}`);
        results.push(chunk);
      }
    }

    return results.join('\n');
  }

  private async translateWithXfyun(input: string, source: 'en' | 'vi', target: 'en' | 'vi'): Promise<string> {
    if (!this.xfyunAppId || !this.xfyunApiKey || !this.xfyunApiSecret) {
      throw new Error('XFYun credentials are not configured');
    }
    // Chunk further by characters to be safe for ITS limits
    const charChunks = this.splitIntoCharChunks(input, 2000);
    const outputs: string[] = [];

    for (const c of charChunks) {
      const res = await this.callXfyunOnce(c, source, target);
      outputs.push(res);
    }
    return outputs.join('');
  }

  private async callXfyunOnce(text: string, source: 'en' | 'vi', target: 'en' | 'vi'): Promise<string> {
    const u = new URL(this.xfyunUrl);
    const host = u.host;
    const path = u.pathname;
    const date = new Date().toUTCString();
    const requestLine = `POST ${path} HTTP/1.1`;
    const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
    const signatureSha = crypto
      .createHmac('sha256', this.xfyunApiSecret as string)
      .update(signatureOrigin)
      .digest('base64');
    const authorization = `api_key="${this.xfyunApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;

    const body = {
      common: { app_id: this.xfyunAppId },
      business: { from: source, to: target },
      data: { text: Buffer.from(text, 'utf8').toString('base64') },
    };

    const resp = await axios.post(this.xfyunUrl, body, {
      headers: {
        Host: host,
        Date: date,
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    // Try multiple common response shapes
    const d = resp.data as any;
    const result = d?.data?.result;
    const directDst = result?.trans_result?.dst || result?.dst;
    if (typeof directDst === 'string') return directDst;
    const arr = result?.trans_result || result;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (typeof first?.dst === 'string') return first.dst as string;
    }
    // Fallback: return original on unexpected format
    this.logger.warn(`XFYun unexpected response format: ${JSON.stringify(d)}`);
    return text;
  }

  private splitIntoCharChunks(text: string, maxChars: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + maxChars));
      i += maxChars;
    }
    return chunks;
  }

  private splitIntoWordChunks(text: string, maxWordsPerChunk: number): string[] {
    // Preserve paragraph structure first
    const paragraphs = text.split(/\n+/);
    const chunks: string[] = [];

    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        chunks.push('');
        continue;
      }
      for (let i = 0; i < words.length; i += maxWordsPerChunk) {
        const slice = words.slice(i, i + maxWordsPerChunk).join(' ');
        chunks.push(slice);
      }
    }

    return chunks;
  }
}


