import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Web3Service } from '../web3/web3.service';

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  
  // Placeholder address - replace with actual address you want to monitor
  private readonly ACCOUNT_ADDRESS = '0x1'; // Aptos core framework account

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
    this.logger.log('Polling for new events started');
    // try {
    //   // Get recent events for the monitored account
    //   const events = await this.web3Service.getAccountEvents(this.ACCOUNT_ADDRESS, {
    //     limit: 10, // Limit to recent events
    //   });

    //   if (events.length > 0) {
    //     this.logger.log(`Found ${events.length} events for account ${this.ACCOUNT_ADDRESS}`);
        
    //     // Process each event
    //     for (const event of events) {
    //       this.logger.debug(`Event type: ${event.type}, Data:`, event.data);
          
    //       // Add your event processing logic here
    //       // For example:
    //       // - Store events in database
    //       // - Send notifications
    //       // - Trigger business logic
    //     }
    //   }
    // } catch (error) {
    //   this.logger.error('Error during event polling:', error);
    // }
    this.logger.log('Polling for new events finished');
  }
}
