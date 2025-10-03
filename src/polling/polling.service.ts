import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service, FormattedOrderEvent } from '../web3/web3.service';
import { SupabaseService, OrderRecord } from '../supabase/supabase.service';
import { MintburnService, TokenOperation, BurnOperation } from '../web3/mintburn.service';

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  
  // Order contract address
  private readonly ORDER_CONTRACT_ADDRESS = '0x55816489757de1d92999dad0629734b877a22455a7fe05e1de36645389646ceb';
  
  constructor(
    private readonly web3Service: Web3Service,
    private readonly supabaseService: SupabaseService,
    private readonly mintburnService: MintburnService
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
  // @Cron(CronExpression.EVERY_30_SECONDS)
  async pollForEvents(): Promise<void> {
    this.logger.log('-------------------------');
    this.logger.log('Polling for new order events started');
    this.logger.log('-------------------------');
    try {
      // Get event limit from environment variables (default to 1 if not set)
      const eventLimit = parseInt(process.env.POLLING_EVENT_LIMIT || '1', 10);
      
      // Fetch latest buy order events
      const buyOrderEvents = await this.web3Service.fetchBuyOrderEvents(eventLimit);
      this.logger.log(`Fetched ${buyOrderEvents.length} buy order events`);

      // Fetch latest sell order events
      const sellOrderEvents = await this.web3Service.fetchSellOrderEvents(eventLimit);
      this.logger.log(`Fetched ${sellOrderEvents.length} sell order events`);

      // Process buy orders
      const newBuyOrderEvents = await this.filterNewOrders(buyOrderEvents, 'BuyOrderCreated');
      this.logger.log(`Found ${newBuyOrderEvents.length} new buy order events`);

      // Process sell orders
      const newSellOrderEvents = await this.filterNewOrders(sellOrderEvents, 'SellOrderCreated');
      this.logger.log(`Found ${newSellOrderEvents.length} new sell order events`);

      // Insert new orders into database
      await this.insertNewOrders([...newBuyOrderEvents, ...newSellOrderEvents]);

      // Process mint/burn operations for new orders
      await this.processMintBurnOperations([...newBuyOrderEvents, ...newSellOrderEvents]);

    } catch (error) {
      this.logger.error('Error during order event polling:', error);
    }
    this.logger.log('Polling for new order events completed');
  }

  /**
   * Filter out orders that already exist in the database
   */
  private async filterNewOrders(
    orderEvents: FormattedOrderEvent[], 
    eventType: 'BuyOrderCreated' | 'SellOrderCreated'
  ): Promise<FormattedOrderEvent[]> {
    const newOrders: FormattedOrderEvent[] = [];

    for (const event of orderEvents) {
      try {
        const exists = await this.supabaseService.orderExists(
          event.user,
          eventType,
          event.sequenceNumber
        );

        if (!exists) {
          newOrders.push(event);
        } else {
          this.logger.log(`Filtered out existing order: User ${event.user}, Event: ${eventType}, Sequence: ${event.sequenceNumber}`);
        }
      } catch (error) {
        this.logger.error(`Error checking if order exists for user ${event.user}:`, error);
        // In case of error, assume it's new to avoid missing data
        newOrders.push(event);
      }
    }

    // Log all new orders at once
    if (newOrders.length > 0) {
      this.logger.log(`New ${eventType} orders found:`, JSON.stringify(newOrders, null, 2));
    }

    return newOrders;
  }

  /**
   * Insert new orders into the database one by one
   */
  private async insertNewOrders(orderEvents: FormattedOrderEvent[]): Promise<void> {
    if (orderEvents.length === 0) {
      this.logger.log('No new orders to insert');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const event of orderEvents) {
      try {
        const orderRecord: OrderRecord = {
          version: event.version,
          sequence_number: event.sequenceNumber,
          event_type: event.eventType,
          user_address: event.user,
          ticker: event.ticker,
          usdc_amount: event.usdcAmount,
          asset_amount: event.assetAmount.toString(),
          price: event.price
        };

        const success = await this.supabaseService.insertOrder(orderRecord);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        this.logger.error(`Error inserting order for user ${event.user}:`, error);
        failureCount++;
      }
    }

    this.logger.log(`Order insertion complete: ${successCount} successful, ${failureCount} failed`);
  }

  /**
   * Process mint/burn operations for new orders
   * Buy orders = mint tokens to user
   * Sell orders = burn tokens from user
   */
  private async processMintBurnOperations(orderEvents: FormattedOrderEvent[]): Promise<void> {
    if (orderEvents.length === 0) {
      this.logger.log('No new orders to process for mint/burn operations');
      return;
    }

    this.logger.log(`Processing ${orderEvents.length} orders for mint/burn operations`);
    
    let mintSuccessCount = 0;
    let burnSuccessCount = 0;
    let failureCount = 0;

    for (const event of orderEvents) {
      try {
        // Map ticker to token type (assuming ticker matches token type)
        const tokenType = this.mapTickerToTokenType(event.ticker);
        
        if (!tokenType) {
          this.logger.warn(`Unsupported ticker: ${event.ticker}, skipping mint/burn operation`);
          continue;
        }

        if (event.eventType === 'BuyOrderCreated') {
          // Buy order = mint tokens to user
          const mintOperation: TokenOperation = {
            tokenType: tokenType,
            recipient: event.user,
            amount: event.assetAmount
          };

          const result = await this.mintburnService.mintTokens(mintOperation);
          
          if (result.success) {
            mintSuccessCount++;
            this.logger.log(`Successfully minted ${event.assetAmount} ${tokenType} tokens to ${event.user}. TX: ${result.hash}`);
          } else {
            failureCount++;
            this.logger.error(`Failed to mint ${event.assetAmount} ${tokenType} tokens to ${event.user}: ${result.errorMessage}`);
          }

        } else if (event.eventType === 'SellOrderCreated') {
          // Sell order = burn tokens from user
          const burnOperation: BurnOperation = {
            tokenType: tokenType,
            user: event.user,
            amount: event.assetAmount
          };

          const result = await this.mintburnService.adminBurnTokens(burnOperation);
          
          if (result.success) {
            burnSuccessCount++;
            this.logger.log(`Successfully burned ${event.assetAmount} ${tokenType} tokens from ${event.user}. TX: ${result.hash}`);
          } else {
            failureCount++;
            this.logger.error(`Failed to burn ${event.assetAmount} ${tokenType} tokens from ${event.user}: ${result.errorMessage}`);
          }
        }

      } catch (error) {
        this.logger.error(`Error processing mint/burn operation for user ${event.user}:`, error);
        failureCount++;
      }
    }

    this.logger.log(`Mint/burn operations complete: ${mintSuccessCount} mints, ${burnSuccessCount} burns, ${failureCount} failures`);
  }

  /**
   * Map ticker symbols to token types supported by the mint/burn service
   */
  private mapTickerToTokenType(ticker: string): 'USD' | 'USDC' | 'LQD' | 'TSLA' | 'AAPL' | 'GOLD' | null {
    const upperTicker = ticker.toUpperCase();
    const supportedTokens = ['USD', 'USDC', 'LQD', 'TSLA', 'AAPL', 'GOLD'];
    
    if (supportedTokens.includes(upperTicker)) {
      return upperTicker as 'USD' | 'USDC' | 'LQD' | 'TSLA' | 'AAPL' | 'GOLD';
    }
    
    return null;
  }

}