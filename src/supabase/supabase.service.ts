import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface OrderRecord {
  version: string;
  sequence_number: string;
  event_type: 'BuyOrderCreated' | 'SellOrderCreated';
  user_address: string;
  ticker: string;
  usdc_amount: number;
  asset_amount: string;
  price: number;
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key-here';

    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.logger.log('Supabase client initialized');
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to connect to Supabase by checking auth endpoint
      const { data, error } = await this.supabase.auth.getSession();

      if (error && error.message.includes('fetch failed')) {
        this.logger.warn('Unable to connect to Supabase - network or credentials issue');
        return false;
      }

      this.logger.log('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.warn('Database connection test error - continuing without database:', error.message);
      return false;
    }
  }

  /**
   * Check if an order already exists in the database
   */
  async orderExists(userAddress: string, eventType: string, sequenceNumber: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('order_book')
        .select('id')
        .eq('user_address', userAddress)
        .eq('event_type', eventType)
        .eq('sequence_number', sequenceNumber)
        .limit(1);

      if (error) {
        this.logger.error('Error checking if order exists:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      this.logger.error('Error checking if order exists:', error);
      return false;
    }
  }

  /**
   * Insert a new order record into the database
   */
  async insertOrder(orderRecord: OrderRecord): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('order_book')
        .insert({
          version: orderRecord.version,
          sequence_number: orderRecord.sequence_number,
          event_type: orderRecord.event_type,
          user_address: orderRecord.user_address,
          ticker: orderRecord.ticker,
          usdc_amount: orderRecord.usdc_amount,
          asset_amount: orderRecord.asset_amount,
          price: orderRecord.price
        });

      if (error) {
        this.logger.error('Error inserting order:', error);
        return false;
      }

      this.logger.log(`Successfully inserted ${orderRecord.event_type} order for user ${orderRecord.user_address}`);
      return true;
    } catch (error) {
      this.logger.error('Error inserting order:', error);
      return false;
    }
  }

  /**
   * Insert multiple order records into the database
   */
  async insertOrders(orderRecords: OrderRecord[]): Promise<number> {
    if (orderRecords.length === 0) {
      return 0;
    }

    try {
      const { data, error } = await this.supabase
        .from('order_book')
        .insert(orderRecords.map(record => ({
          version: record.version,
          sequence_number: record.sequence_number,
          event_type: record.event_type,
          user_address: record.user_address,
          ticker: record.ticker,
          usdc_amount: record.usdc_amount,
          asset_amount: record.asset_amount,
          price: record.price
        })));

      if (error) {
        this.logger.error('Error inserting orders:', error);
        return 0;
      }

      this.logger.log(`Successfully inserted ${orderRecords.length} orders`);
      return orderRecords.length;
    } catch (error) {
      this.logger.error('Error inserting orders:', error);
      return 0;
    }
  }
}
