import { Module } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { MintburnService } from './mintburn.service';

@Module({
  providers: [Web3Service, MintburnService],
  exports: [Web3Service, MintburnService],
})
export class Web3Module {}
