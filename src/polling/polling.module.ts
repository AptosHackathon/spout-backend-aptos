import { Module } from '@nestjs/common';
import { PollingService } from './polling.service';
import { Web3Module } from '../web3/web3.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [Web3Module, SupabaseModule],
  providers: [PollingService],
  exports: [PollingService],
})
export class PollingModule {}
