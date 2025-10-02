import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service } from '../web3/web3.service';
import { SupabaseService, OrderBookEntry } from '../supabase/supabase.service';

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

interface EventWithTimestamp {
  data: BuyOrderCreated | SellOrderCreated;
  type: string;
  timestamp?: string;
}

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  
  // Order contract address
  private readonly ORDER_CONTRACT_ADDRESS = '0x55816489757de1d92999dad0629734b877a22455a7fe05e1de36645389646ceb';
  
  // Event types to monitor
  private readonly BUY_ORDER_EVENT_TYPE = `${this.ORDER_CONTRACT_ADDRESS}::orders::BuyOrderCreated`;
  private readonly SELL_ORDER_EVENT_TYPE = `${this.ORDER_CONTRACT_ADDRESS}::orders::SellOrderCreated`;

  constructor(
    private readonly web3Service: Web3Service,
    private readonly supabaseService: SupabaseService
  ) {}

  async onModuleInit() {
    // Check connections on module initialization
    const isWeb3Connected = await this.web3Service.isConnected();
    const isDbConnected = await this.supabaseService.testConnection();
    
    if (isWeb3Connected) {
      this.logger.log('Connected to Aptos network');
    } else {
      this.logger.error('Failed to connect to Aptos network');
    }

    if (isDbConnected) {
      this.logger.log('Connected to Supabase database');
    } else {
      this.logger.error('Failed to connect to Supabase database');
    }

    if (isWeb3Connected && isDbConnected) {
      this.logger.log('Polling service ready');
    }
  }

  /**
   * Cron job that runs every 10 seconds to poll for new events
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollForEvents(): Promise<void> {
    this.logger.log('Polling for new order events started');
    try {
      // First, let's verify the contract account exists
      this.logger.log(`🔍 Checking contract account: ${this.ORDER_CONTRACT_ADDRESS}`);
      
      try {
        await this.web3Service.getAccountInfo(this.ORDER_CONTRACT_ADDRESS);
      } catch (accountError) {
        this.logger.error(`❌ Contract account verification failed:`, accountError.message);
        return;
      }
      const orderEvents = await this.web3Service.getEventsByType(
        this.ORDER_CONTRACT_ADDRESS,
        [this.BUY_ORDER_EVENT_TYPE, this.SELL_ORDER_EVENT_TYPE],
        {
          limit: 25, // Get more transactions if available
        }
      );

      this.logger.log(`📊 Found ${orderEvents.length} order events from account transactions`);

      // Count events by type
      let buyOrderCount = 0;
      let sellOrderCount = 0;

      // Process each order event
      for (const event of orderEvents) {
        if (event.type === this.BUY_ORDER_EVENT_TYPE) {
          buyOrderCount++;
          await this.processBuyOrderEvent(event.data as BuyOrderCreated, event.timestamp);
        } else if (event.type === this.SELL_ORDER_EVENT_TYPE) {
          sellOrderCount++;
          await this.processSellOrderEvent(event.data as SellOrderCreated, event.timestamp);
        }
      }

      // Log event counts
      this.logger.log(`buy order events: ${buyOrderCount}`);
      this.logger.log(`sell order events: ${sellOrderCount}`);
    } catch (error) {
      this.logger.error('Error during order event polling:', error);
    }
    this.logger.log('Polling for new order events completed');
  }

  /**
   * Process BuyOrderCreated event
   */
  private async processBuyOrderEvent(eventData: BuyOrderCreated, blockchainTimestamp?: string): Promise<void> {
    const ticker = this.parseTickerFromBytes(eventData.ticker);
    const formattedPrice = this.formatPrice(eventData.price);
    const formattedUsdcAmount = this.formatAmount(eventData.usdc_amount, 6); // USDC has 6 decimals
    const formattedAssetAmount = this.formatAmount(eventData.asset_amount, 18); // Assuming 18 decimals for asset
    const oracleTimestamp = new Date(parseInt(eventData.oracle_ts) * 1000).toISOString();
    const eventTimestamp = blockchainTimestamp ? new Date(parseInt(blockchainTimestamp) / 1000).toISOString() : new Date().toISOString();
    
    this.logger.log('🟢 BUY ORDER CREATED:');
    this.logger.log(`  User: ${eventData.user}`);
    this.logger.log(`  Ticker: ${ticker}`);
    this.logger.log(`  USDC Amount: ${formattedUsdcAmount} USDC`);
    this.logger.log(`  Asset Amount: ${formattedAssetAmount} ${ticker}`);
    this.logger.log(`  Price: $${formattedPrice}`);
    this.logger.log(`  Oracle Timestamp: ${oracleTimestamp}`);
    this.logger.log(`  Event Timestamp: ${eventTimestamp}`);
    
    // Prepare order data for database insertion
    const orderBookEntry: OrderBookEntry = {
      order_type: 'BUY',
      user_address: eventData.user,
      ticker: ticker,
      usdc_amount_formatted: parseFloat(formattedUsdcAmount),
      asset_amount: eventData.asset_amount, // Keep original big number as string
      asset_amount_formatted: parseFloat(formattedAssetAmount),
      price: eventData.price, // Keep original big number as string
      price_formatted: parseFloat(formattedPrice),
      oracle_timestamp: oracleTimestamp,
      event_timestamp: eventTimestamp,
    };

    // Insert into database
    try {
      await this.supabaseService.insertOrderBook(orderBookEntry);
      this.logger.log(`✅ BUY order saved to database`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to save BUY order to database - continuing without persistence`);
    }
  }

  /**
   * Process SellOrderCreated event
   */
  private async processSellOrderEvent(eventData: SellOrderCreated, blockchainTimestamp?: string): Promise<void> {
    const ticker = this.parseTickerFromBytes(eventData.ticker);
    const formattedPrice = this.formatPrice(eventData.price);
    const formattedUsdcAmount = this.formatAmount(eventData.usdc_amount, 6); // USDC has 6 decimals
    const formattedAssetAmount = this.formatAmount(eventData.asset_amount, 18); // Assuming 18 decimals for asset
    const oracleTimestamp = new Date(parseInt(eventData.oracle_ts) * 1000).toISOString();
    const eventTimestamp = blockchainTimestamp ? new Date(parseInt(blockchainTimestamp) / 1000).toISOString() : new Date().toISOString();
    
    this.logger.log('🔴 SELL ORDER CREATED:');
    this.logger.log(`  User: ${eventData.user}`);
    this.logger.log(`  Ticker: ${ticker}`);
    this.logger.log(`  USDC Amount: ${formattedUsdcAmount} USDC`);
    this.logger.log(`  Asset Amount: ${formattedAssetAmount} ${ticker}`);
    this.logger.log(`  Price: $${formattedPrice}`);
    this.logger.log(`  Oracle Timestamp: ${oracleTimestamp}`);
    this.logger.log(`  Event Timestamp: ${eventTimestamp}`);
    
    // Prepare order data for database insertion
    const orderBookEntry: OrderBookEntry = {
      order_type: 'SELL',
      user_address: eventData.user,
      ticker: ticker,
      usdc_amount_formatted: parseFloat(formattedUsdcAmount),
      asset_amount: eventData.asset_amount, // Keep original big number as string
      asset_amount_formatted: parseFloat(formattedAssetAmount),
      price: eventData.price, // Keep original big number as string
      price_formatted: parseFloat(formattedPrice),
      oracle_timestamp: oracleTimestamp,
      event_timestamp: eventTimestamp,
    };

    // Insert into database
    try {
      await this.supabaseService.insertOrderBook(orderBookEntry);
      this.logger.log(`✅ SELL order saved to database`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to save SELL order to database - continuing without persistence`);
    }
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
