/**
 * BrightData Queue Service
 *
 * Manages a sequential queue for BrightData API calls to prevent rate limiting.
 * All scrape requests go through this queue and are processed one at a time.
 */

import { scrapeLinkedInCompany, scrapeLinkedInProfile, scrapeLinkedInPosts } from './brightdata.js';
import type { BrightDataLinkedInCompany, BrightDataLinkedInProfile, BrightDataLinkedInPost } from './brightdata.js';

// Minimum delay between API calls (ms)
const MIN_DELAY_BETWEEN_CALLS = 5000; // 5 seconds

interface QueueItem {
  id: string;
  type: 'company' | 'profile' | 'posts';
  url: string;
  discoverBy?: 'company_url' | 'profile_url';
  dateRange?: { startDate: string; endDate: string };
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  addedAt: number;
}

class BrightDataQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private lastCallTime = 0;
  private itemCounter = 0;

  /**
   * Add a company scrape to the queue
   */
  async scrapeCompany(url: string): Promise<BrightDataLinkedInCompany[]> {
    return this.enqueue('company', url) as Promise<BrightDataLinkedInCompany[]>;
  }

  /**
   * Add a profile scrape to the queue
   */
  async scrapeProfile(url: string): Promise<BrightDataLinkedInProfile[]> {
    return this.enqueue('profile', url) as Promise<BrightDataLinkedInProfile[]>;
  }

  /**
   * Add a posts discovery scrape to the queue
   */
  async scrapePosts(
    url: string,
    discoverBy: 'company_url' | 'profile_url',
    dateRange?: { startDate: string; endDate: string }
  ): Promise<BrightDataLinkedInPost[]> {
    return this.enqueue('posts', url, discoverBy, dateRange) as Promise<BrightDataLinkedInPost[]>;
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        id: item.id,
        type: item.type,
        url: item.url,
        waitingMs: Date.now() - item.addedAt,
      })),
    };
  }

  private async enqueue(
    type: QueueItem['type'],
    url: string,
    discoverBy?: 'company_url' | 'profile_url',
    dateRange?: { startDate: string; endDate: string }
  ): Promise<unknown> {
    const id = `${type}-${++this.itemCounter}`;

    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id,
        type,
        url,
        discoverBy,
        dateRange,
        resolve,
        reject,
        addedAt: Date.now(),
      };

      this.queue.push(item);
      console.log(`📥 [BrightDataQueue] Added ${type} scrape to queue: ${url} (position: ${this.queue.length})`);

      // Start processing if not already
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      // Ensure minimum delay between calls
      const timeSinceLastCall = Date.now() - this.lastCallTime;
      if (timeSinceLastCall < MIN_DELAY_BETWEEN_CALLS && this.lastCallTime > 0) {
        const waitTime = MIN_DELAY_BETWEEN_CALLS - timeSinceLastCall;
        console.log(`⏳ [BrightDataQueue] Waiting ${waitTime}ms before next API call...`);
        await this.sleep(waitTime);
      }

      console.log(`🚀 [BrightDataQueue] Processing ${item.type} scrape: ${item.url} (waited ${Date.now() - item.addedAt}ms)`);

      try {
        this.lastCallTime = Date.now();
        let result: unknown;

        switch (item.type) {
          case 'company':
            result = await scrapeLinkedInCompany(item.url);
            break;
          case 'profile':
            result = await scrapeLinkedInProfile(item.url);
            break;
          case 'posts':
            result = await scrapeLinkedInPosts(
              item.url,
              item.discoverBy || 'company_url',
              item.dateRange
            );
            break;
        }

        console.log(`✅ [BrightDataQueue] Completed ${item.type} scrape: ${item.url}`);
        item.resolve(result);
      } catch (error) {
        console.error(`❌ [BrightDataQueue] Failed ${item.type} scrape: ${item.url}`, error);
        item.reject(error);
      }

      // Log remaining queue
      if (this.queue.length > 0) {
        console.log(`📊 [BrightDataQueue] ${this.queue.length} items remaining in queue`);
      }
    }

    this.processing = false;
    console.log(`✅ [BrightDataQueue] Queue empty, processing complete`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const brightdataQueue = new BrightDataQueue();
