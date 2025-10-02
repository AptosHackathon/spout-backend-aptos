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
  timestamp?: string; // Transaction timestamp from blockchain
}

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private readonly aptos: Aptos;

  constructor() {
    // Initialize Aptos client with testnet configuration
    const config = new AptosConfig({ network: Network.TESTNET });
    this.aptos = new Aptos(config);

    this.logger.log('Aptos client initialized for testnet');
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
      
      this.logger.log(`✅ Account found:`);
      this.logger.log(`  - Sequence Number: ${account.sequence_number}`);
      this.logger.log(`  - Authentication Key: ${account.authentication_key}`);
      
      return account;
    } catch (error) {
      this.logger.error(`❌ Failed to get account info for ${accountAddress}:`, error.message);
      
      // Check if it's a "account not found" error
      if (error.message && error.message.includes('not found')) {
        this.logger.error(`🚨 Account ${accountAddress} does not exist on the network`);
      }
      
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

      this.logger.log(`📦 Found ${transactions.length} transactions for ${accountAddress}`);

      const events: AptosEventData[] = [];

      for (const transaction of transactions) {
        // Type guard to check if transaction has events (committed transactions only)
        if ('events' in transaction && transaction.events) {
          const transactionTimestamp = 'timestamp' in transaction ? transaction.timestamp || '' : '';
          const transactionEvents = transaction.events.map((event: any) => ({
            type: event.type,
            guid: {
              creation_number: event.guid?.creation_number?.toString() || '0',
              account_address: event.guid?.account_address || '',
            },
            sequence_number: event.sequence_number?.toString() || '0',
            data: event.data,
            timestamp: transactionTimestamp,
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
   * Get events by specific event types from an account
   */
  async getEventsByType(
    accountAddress: string,
    eventTypes: string[],
    options?: {
      start?: number;
      limit?: number;
    }
  ): Promise<AptosEventData[]> {
    try {
      this.logger.log(`🔎 Filtering events by types: ${eventTypes.join(', ')}`);
      
      const allEvents = await this.getAccountEvents(accountAddress, options);
      
      this.logger.log(`📊 All events count before filtering: ${allEvents.length}`);
      
      // Filter events by the specified types
      const filteredEvents = allEvents.filter(event => 
        eventTypes.includes(event.type)
      );

      return filteredEvents;
    } catch (error) {
      this.logger.error(`Failed to get events by type for ${accountAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): string {
    return Network.TESTNET;
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
