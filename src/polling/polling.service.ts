import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service } from '../web3/web3.service';

interface BuyOrderCreated {
  user: string;
  ticker: string;
  usdc_amount: string;
  asset_amount: string;
  price: string;
  oracle_ts: string;
}

interface SellOrderCreated {
  user: string;
  ticker: string;
  usdc_amount: string;
  asset_amount: string;
  price: string;
  oracle_ts: string;
}

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  
  // Order contract address
  private readonly ORDER_CONTRACT_ADDRESS = '0x55816489757de1d92999dad0629734b877a22455a7fe05e1de36645389646ceb';
  
  // Event types to monitor
  private readonly BUY_ORDER_EVENT_TYPE = `${this.ORDER_CONTRACT_ADDRESS}::orders::BuyOrderCreated`;
  private readonly SELL_ORDER_EVENT_TYPE = `${this.ORDER_CONTRACT_ADDRESS}::orders::SellOrderCreated`;

  constructor(private readonly web3Service: Web3Service) {}

  async onModuleInit() {
    // Check connection on module initialization
    const isConnected = await this.web3Service.isConnected();
    if (isConnected) {
      this.logger.log('Connected to Aptos network, polling service ready');
    } else {
      this.logger.error('Failed to connect to Aptos network');
    }
  }

  /**
   * Cron job that runs every 10 seconds to poll for new events
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForEvents(): Promise<void> {
    this.logger.log('Polling for new order events started');
    
    try {
      // Get recent events filtered by event types
      const orderEvents = await this.web3Service.getEventsByType(
        this.ORDER_CONTRACT_ADDRESS,
        [this.BUY_ORDER_EVENT_TYPE, this.SELL_ORDER_EVENT_TYPE],
        {
          limit: 10, // Increased limit to catch more events
        }
      );

      if (orderEvents.length > 0) {
        this.logger.log(`Found ${orderEvents.length} order events`);
        
        // Process each order event
        for (const event of orderEvents) {
          if (event.type === this.BUY_ORDER_EVENT_TYPE) {
            await this.processBuyOrderEvent(event.data as BuyOrderCreated);
          } else if (event.type === this.SELL_ORDER_EVENT_TYPE) {
            await this.processSellOrderEvent(event.data as SellOrderCreated);
          }
        }
      } else {
        this.logger.log('No order events found');
      }
    } catch (error) {
      this.logger.error('Error during order event polling:', error);
    }
    
    this.logger.log('Polling for new order events finished');
  }

  /**
   * Process BuyOrderCreated event
   */
  private async processBuyOrderEvent(eventData: BuyOrderCreated): Promise<void> {
    const ticker = this.parseTickerFromBytes(eventData.ticker);
    const formattedPrice = this.formatPrice(eventData.price);
    const formattedUsdcAmount = this.formatAmount(eventData.usdc_amount, 6); // USDC has 6 decimals
    const formattedAssetAmount = this.formatAmount(eventData.asset_amount, 18); // Assuming 18 decimals for asset
    const timestamp = new Date(parseInt(eventData.oracle_ts) * 1000).toISOString();
    
    this.logger.log('🟢 BUY ORDER CREATED:');
    this.logger.log(`  User: ${eventData.user}`);
    this.logger.log(`  Ticker: ${ticker}`);
    this.logger.log(`  USDC Amount: ${formattedUsdcAmount} USDC`);
    this.logger.log(`  Asset Amount: ${formattedAssetAmount} ${ticker}`);
    this.logger.log(`  Price: $${formattedPrice}`);
    this.logger.log(`  Oracle Timestamp: ${timestamp}`);
    
    // Add your custom business logic here
    // For example:
    // - Store in database
    // - Send notifications
    // - Update user balances
    // - Trigger other services
  }

  /**
   * Process SellOrderCreated event
   */
  private async processSellOrderEvent(eventData: SellOrderCreated): Promise<void> {
    const ticker = this.parseTickerFromBytes(eventData.ticker);
    const formattedPrice = this.formatPrice(eventData.price);
    const formattedUsdcAmount = this.formatAmount(eventData.usdc_amount, 6); // USDC has 6 decimals
    const formattedAssetAmount = this.formatAmount(eventData.asset_amount, 18); // Assuming 18 decimals for asset
    const timestamp = new Date(parseInt(eventData.oracle_ts) * 1000).toISOString();
    
    this.logger.log('🔴 SELL ORDER CREATED:');
    this.logger.log(`  User: ${eventData.user}`);
    this.logger.log(`  Ticker: ${ticker}`);
    this.logger.log(`  USDC Amount: ${formattedUsdcAmount} USDC`);
    this.logger.log(`  Asset Amount: ${formattedAssetAmount} ${ticker}`);
    this.logger.log(`  Price: $${formattedPrice}`);
    this.logger.log(`  Oracle Timestamp: ${timestamp}`);
    
    // Add your custom business logic here
    // For example:
    // - Store in database
    // - Send notifications
    // - Update user balances
    // - Trigger other services
  }

  /**
   * Parse ticker from byte array
   */
  private parseTickerFromBytes(tickerBytes: string | number[]): string {
    try {
      if (typeof tickerBytes === 'string') {
        return tickerBytes;
      }
      
      if (Array.isArray(tickerBytes)) {
        return Buffer.from(tickerBytes).toString('utf8');
      }
      
      return String(tickerBytes);
    } catch (error) {
      this.logger.error('Failed to parse ticker from bytes:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Format price from wei-like units (1e18) to human readable format
   */
  private formatPrice(price: string): string {
    try {
      const priceNum = BigInt(price);
      const divisor = BigInt('1000000000000000000'); // 1e18
      const wholePart = priceNum / divisor;
      const fractionalPart = priceNum % divisor;
      
      // Convert to decimal string with proper formatting
      const decimalPlaces = 6; // Show 6 decimal places for price
      const fractionalStr = fractionalPart.toString().padStart(18, '0');
      const truncatedFractional = fractionalStr.slice(0, decimalPlaces);
      
      return `${wholePart.toString()}.${truncatedFractional}`;
    } catch (error) {
      this.logger.error('Failed to format price:', error);
      return price;
    }
  }

  /**
   * Format amount based on decimal places
   */
  private formatAmount(amount: string, decimals: number): string {
    try {
      const amountNum = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const wholePart = amountNum / divisor;
      const fractionalPart = amountNum % divisor;
      
      if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
      }
      
      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      // Remove trailing zeros
      const trimmedFractional = fractionalStr.replace(/0+$/, '');
      
      return trimmedFractional ? `${wholePart.toString()}.${trimmedFractional}` : wholePart.toString();
    } catch (error) {
      this.logger.error('Failed to format amount:', error);
      return amount;
    }
  }
}
