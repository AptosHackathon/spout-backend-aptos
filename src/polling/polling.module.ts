import { Module } from '@nestjs/common';
import { PollingService } from './polling.service';
import { Web3Module } from '../web3/web3.module';

@Module({
  imports: [Web3Module],
  providers: [PollingService],
  exports: [PollingService],
})
export class PollingModule {}
