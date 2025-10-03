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

export interface RawOrderEventData {
  asset_amount: string;
  oracle_ts: string;
  price: string;
  ticker: string;
  usdc_amount: string;
  user: string;
}

export interface RawOrderEvent {
  version: string;
  guid: {
    creation_number: string;
    account_address: string;
  };
  sequence_number: string;
  type: string;
  data: RawOrderEventData;
}

export interface FormattedOrderEvent {
  version: string;
  sequenceNumber: string;
  eventType: 'BuyOrderCreated' | 'SellOrderCreated';
  user: string;
  ticker: string;
  usdcAmount: number;
  assetAmount: number;
  price: number;
}

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private readonly aptos: Aptos;

  // Contract addresses and event endpoints
  private readonly ACCOUNT_ADDRESS = '0xc50c45c8cf451cf262827f258bba2254c94487311c326fa097ce30c39beda4ea';
  private readonly CONTRACT_ADDRESS = '0xf21ca0578f286a0ce5e9f43eab0387a9b7ee1b9ffd1f4634a772d415561fa0fd';
  private readonly BUY_ORDER_EVENTS_PATH = `${this.CONTRACT_ADDRESS}::orders::OrderEvents/buy_order_events`;
  private readonly SELL_ORDER_EVENTS_PATH = `${this.CONTRACT_ADDRESS}::orders::OrderEvents/sell_order_events`;
  private readonly BASE_URL = 'https://fullnode.testnet.aptoslabs.com/v1';

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

  /**
   * Fetch latest buy order events
   */
  async fetchBuyOrderEvents(limit: number = 5): Promise<FormattedOrderEvent[]> {
    try {
      const url = `${this.BASE_URL}/accounts/${this.ACCOUNT_ADDRESS}/events/${this.BUY_ORDER_EVENTS_PATH}?limit=${limit}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const rawEvents: RawOrderEvent[] = await response.json();
      
      // Format events
      const formattedEvents = rawEvents.map(event => this.formatOrderEvent(event, 'BuyOrderCreated'));
      
      return formattedEvents;
    } catch (error) {
      this.logger.error('Error fetching buy order events:', error);
      throw error;
    }
  }

  /**
   * Fetch latest sell order events
   */
  async fetchSellOrderEvents(limit: number = 5): Promise<FormattedOrderEvent[]> {
    try {
      const url = `${this.BASE_URL}/accounts/${this.ACCOUNT_ADDRESS}/events/${this.SELL_ORDER_EVENTS_PATH}?limit=${limit}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const rawEvents: RawOrderEvent[] = await response.json();
      
      // Format events
      const formattedEvents = rawEvents.map(event => this.formatOrderEvent(event, 'SellOrderCreated'));
      
      return formattedEvents;
    } catch (error) {
      this.logger.error('Error fetching sell order events:', error);
      throw error;
    }
  }

  /**
   * Format raw order event data into a structured format
   */
  private formatOrderEvent(rawEvent: RawOrderEvent, eventType: 'BuyOrderCreated' | 'SellOrderCreated'): FormattedOrderEvent {
    return {
      version: rawEvent.version,
      sequenceNumber: rawEvent.sequence_number,
      eventType,
      user: rawEvent.data.user,
      ticker: this.formatTicker(rawEvent.data.ticker),
      usdcAmount: parseInt(rawEvent.data.usdc_amount),
      assetAmount: parseInt(rawEvent.data.asset_amount),
      price: parseInt(rawEvent.data.price),
    };
  }

  /**
   * Format ticker from hex to readable string
   */
  private formatTicker(hexTicker: string): string {
    try {
      // Remove '0x' prefix and convert hex to string
      const hex = hexTicker.replace('0x', '');
      let result = '';
      for (let i = 0; i < hex.length; i += 2) {
        const hexChar = hex.substr(i, 2);
        const charCode = parseInt(hexChar, 16);
        if (charCode !== 0) { // Skip null bytes
          result += String.fromCharCode(charCode);
        }
      }
      return result || hexTicker; // Return original if conversion fails
    } catch (error) {
      this.logger.warn(`Failed to format ticker ${hexTicker}, returning as is:`, error);
      return hexTicker;
    }
  }
}
