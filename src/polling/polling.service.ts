import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service, FormattedOrderEvent } from '../web3/web3.service';
import { SupabaseService, OrderRecord } from '../supabase/supabase.service';

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  
  // Order contract address
  private readonly ORDER_CONTRACT_ADDRESS = '0x55816489757de1d92999dad0629734b877a22455a7fe05e1de36645389646ceb';
  
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
      // Fetch latest 5 buy order events
      const buyOrderEvents = await this.web3Service.fetchBuyOrderEvents(5);
      this.logger.log(`Fetched ${buyOrderEvents.length} buy order events`);

      // Fetch latest 5 sell order events
      const sellOrderEvents = await this.web3Service.fetchSellOrderEvents(5);
      this.logger.log(`Fetched ${sellOrderEvents.length} sell order events`);

      // Process buy orders
      const newBuyOrderEvents = await this.filterNewOrders(buyOrderEvents, 'BuyOrderCreated');
      this.logger.log(`Found ${newBuyOrderEvents.length} new buy order events`);

      // Process sell orders
      const newSellOrderEvents = await this.filterNewOrders(sellOrderEvents, 'SellOrderCreated');
      this.logger.log(`Found ${newSellOrderEvents.length} new sell order events`);

      // Insert new orders into database
      await this.insertNewOrders([...newBuyOrderEvents, ...newSellOrderEvents]);

      if (buyOrderEvents.length > 0) {
        this.logger.log(`Latest buy order event: User ${buyOrderEvents[0].user}, Ticker: ${buyOrderEvents[0].ticker}, Amount: ${buyOrderEvents[0].usdcAmount}`);
      }
      
      if (sellOrderEvents.length > 0) {
        this.logger.log(`Latest sell order event: User ${sellOrderEvents[0].user}, Ticker: ${sellOrderEvents[0].ticker}, Amount: ${sellOrderEvents[0].usdcAmount}`);
      }

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
          this.logger.debug(`Order already exists: User ${event.user}, Event: ${eventType}, Sequence: ${event.sequenceNumber}`);
        }
      } catch (error) {
        this.logger.error(`Error checking if order exists for user ${event.user}:`, error);
        // In case of error, assume it's new to avoid missing data
        newOrders.push(event);
      }
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

}