import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface OrderBookEntry {
  order_type: 'BUY' | 'SELL';
  user_address: string;
  ticker: string;
  usdc_amount_formatted: number;
  asset_amount: string; // Keep as string for large numbers
  asset_amount_formatted: number;
  price: string; // Keep as string for large numbers  
  price_formatted: number;
  oracle_timestamp: string; // ISO string
  event_timestamp: string; // ISO string
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client with placeholder credentials
    // Replace these with your actual Supabase URL and service key
    const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key-here';

    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.logger.log('Supabase client initialized');
  }

  /**
   * Insert order data into the order_book table
   */
  async insertOrderBook(orderData: OrderBookEntry): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('order_book')
        .insert([orderData]);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          this.logger.error(`Cannot insert order: order_book table does not exist. Please create the table first.`);
        } else {
          this.logger.error('Failed to insert order into database:', error.message);
        }
        throw error;
      }

      this.logger.log(`Successfully inserted ${orderData.order_type} order for ${orderData.ticker} into database`);
    } catch (error) {
      if (error.message && error.message.includes('fetch failed')) {
        this.logger.error('Database connection failed - unable to insert order');
      } else {
        this.logger.error('Error inserting order into database:', error.message || error);
      }
      throw error;
    }
  }

  /**
   * Create the order_book table if it doesn't exist
   * This is a one-time setup function
   */
  async createOrderBookTable(): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('create_order_book_table_if_not_exists');
      
      if (error) {
        this.logger.error('Failed to create order_book table:', error);
        throw error;
      }

      this.logger.log('Order book table setup completed');
    } catch (error) {
      this.logger.error('Error setting up order_book table:', error);
      throw error;
    }
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

      // Try to check if order_book table exists
      const { error: tableError } = await this.supabase
        .from('order_book')
        .select('count', { count: 'exact', head: true });

      if (tableError) {
        if (tableError.code === 'PGRST116' || tableError.message.includes('does not exist')) {
          this.logger.warn('order_book table does not exist. Please run the database setup script.');
          return false;
        } else {
          this.logger.error('Database connection test failed:', tableError);
          return false;
        }
      }

      this.logger.log('Database connection test successful');
      return true;
    } catch (error) {
      this.logger.warn('Database connection test error - continuing without database:', error.message);
      return false;
    }
  }
}
