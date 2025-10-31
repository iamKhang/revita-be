import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly recommenderUrl = process.env.RECOMMENDER_BASE_URL;

  async translateViToEn(input: string): Promise<string> {
    const url = this.recommenderUrl && `${this.recommenderUrl}/translate/vi-en`;
    if (!url) return input;
    const chunks = this.splitIntoCharChunks(input, 2000);
    const results: string[] = [];
    for (const chunk of chunks) {
      if (!chunk.trim()) { results.push(chunk); continue; }
      try {
        const res = await axios.post(url, { text: chunk }, { timeout: 10000 });
        const tr = res.data?.translated_text;
        results.push(typeof tr === 'string' ? tr : chunk);
      } catch (e) {
        this.logger.warn(`Recommender translate vi-en fail: ${String(e)}`);
        results.push(chunk);
      }
    }
    return results.join('');
  }

  async translateEnToVi(input: string): Promise<string> {
    const url = this.recommenderUrl && `${this.recommenderUrl}/translate/en-vi`;
    if (!url) return input;
    const chunks = this.splitIntoCharChunks(input, 2000);
    const results: string[] = [];
    for (const chunk of chunks) {
      if (!chunk.trim()) { results.push(chunk); continue; }
      try {
        const res = await axios.post(url, { text: chunk }, { timeout: 10000 });
        const tr = res.data?.translated_text;
        results.push(typeof tr === 'string' ? tr : chunk);
      } catch (e) {
        this.logger.warn(`Recommender translate en-vi fail: ${String(e)}`);
        results.push(chunk);
      }
    }
    return results.join('');
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
}


