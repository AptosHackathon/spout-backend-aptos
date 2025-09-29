import { Injectable, Logger } from '@nestjs/common';
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

export interface AptosEventData {
  type: string;
  guid: {
    creation_number: string;
    account_address: string;
  };
  sequence_number: string;
  data: any;
}

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private readonly aptos: Aptos;

  constructor() {
    // Initialize Aptos client with devnet configuration
    const config = new AptosConfig({ network: Network.DEVNET });
    this.aptos = new Aptos(config);
    
    this.logger.log('Aptos client initialized for devnet');
  }

  /**
   * Get Aptos client instance
   */
  getAptosClient(): Aptos {
    return this.aptos;
  }

  /**
   * Get account information
   */
  async getAccountInfo(accountAddress: string) {
    try {
      const account = await this.aptos.getAccountInfo({
        accountAddress,
      });
      return account;
    } catch (error) {
      this.logger.error(`Failed to get account info for ${accountAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get events for a specific account by fetching recent transactions
   */
  async getAccountEvents(
    accountAddress: string,
    options?: {
      start?: number;
      limit?: number;
    }
  ): Promise<AptosEventData[]> {
    try {
      const transactions = await this.aptos.getAccountTransactions({
        accountAddress,
        options: {
          offset: options?.start,
          limit: options?.limit || 25,
        },
      });

      const events: AptosEventData[] = [];

      for (const transaction of transactions) {
        // Type guard to check if transaction has events (committed transactions only)
        if ('events' in transaction && transaction.events) {
          const transactionEvents = transaction.events.map((event: any) => ({
            type: event.type,
            guid: {
              creation_number: event.guid?.creation_number?.toString() || '0',
              account_address: event.guid?.account_address || '',
            },
            sequence_number: event.sequence_number?.toString() || '0',
            data: event.data,
          }));
          events.push(...transactionEvents);
        }
      }

      return events;
    } catch (error) {
      this.logger.error(`Failed to get account events for ${accountAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): string {
    return Network.DEVNET;
  }

  /**
   * Check if the service is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.aptos.getLedgerInfo();
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Aptos network:', error);
      return false;
    }
  }
}
